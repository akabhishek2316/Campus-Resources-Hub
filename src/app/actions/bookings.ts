'use server';
import { redirect } from 'next/navigation';
import { randomInt } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile, canManage, hasResourcePermission } from '@/lib/auth';
import { flash } from '@/lib/flash';
import { logAudit, notify } from '@/lib/audit';
import { uploadFiles } from '@/lib/storage';
import { promoteWaitlist } from '@/lib/waitlist';
import {
  checkLimits,
  computePriority,
  effectiveScore,
  recentHoursOnResource,
} from '@/lib/fairness';
import { fmtDateTime, fmtRange, localToUtc, localWeekday, WEEKDAYS } from '@/lib/time';

const genOtp = () => String(randomInt(100000, 999999));
const BLOCKING = ['approved', 'checked_in', 'overdue'];

// ---------- request ----------
export async function requestBooking(fd: FormData) {
  const profile = await requireProfile();
  const resourceId = String(fd.get('resource_id'));
  const back = `/resources/${resourceId}`;
  const date = String(fd.get('date') || '');
  const startHour = Number(fd.get('start_hour'));
  const duration = Number(fd.get('duration'));
  const purpose = String(fd.get('purpose') || '').trim();
  const purposeType = String(fd.get('purpose_type') || 'personal');
  if (!date || Number.isNaN(startHour) || !duration || purpose.length < 5)
    flash(
      back,
      'error',
      'Fill in the date, start time, duration and a purpose of at least 5 characters.'
    );

  const admin = createAdminClient();
  const { data: resource } = await admin
    .from('resources')
    .select('*, resource_requirements(training_id, trainings(name)), availability_windows(*)')
    .eq('id', resourceId)
    .single();
  if (!resource || !resource.active) flash(back, 'error', 'This resource is not available.');
  if (profile.suspended_until && new Date(profile.suspended_until) > new Date())
    flash(
      back,
      'error',
      `Your booking access is suspended until ${fmtDateTime(profile.suspended_until)} after an incident. Contact the lab manager.`
    );

  const start = localToUtc(date, startHour);
  const end = new Date(start.getTime() + duration * 3600000);
  if (start.getTime() <= Date.now()) flash(back, 'error', 'Pick a start time in the future.');

  // 1. automatic requirement checks
  const failures: string[] = [];
  const windows = resource.availability_windows.filter(
    (w: any) => w.weekday === localWeekday(start)
  );
  if (!windows.some((w: any) => startHour >= w.start_hour && startHour + duration <= w.end_hour))
    failures.push(
      `${WEEKDAYS[localWeekday(start)]} ${startHour}:00 to ${startHour + duration}:00 is outside the opening hours.`
    );
  if (!profile.verified)
    failures.push('Your college ID is not verified yet. An admin must verify it first.');
  const required = resource.resource_requirements ?? [];
  if (required.length) {
    const { data: creds } = await admin
      .from('user_credentials')
      .select('training_id')
      .eq('user_id', profile.id)
      .eq('status', 'approved');
    const have = new Set((creds ?? []).map((c: any) => c.training_id));
    for (const r of required)
      if (!have.has(r.training_id))
        failures.push(`Missing approved training: ${r.trainings?.name}.`);
  }
  const { data: ub } = await admin.from('bookings').select('*').eq('user_id', profile.id);
  const userBookings = ub ?? [];
  failures.push(...checkLimits({ resource, start, end, userBookings }));

  // 2. conflicts and competition
  const { data: overlaps } = await admin
    .from('bookings')
    .select('id,status')
    .eq('resource_id', resource.id)
    .in('status', [...BLOCKING, 'pending_review'])
    .lt('start_at', end.toISOString())
    .gt('end_at', start.toISOString());
  const taken = (overlaps ?? []).some((o: any) => BLOCKING.includes(o.status));
  const competing = (overlaps ?? []).filter((o: any) => o.status === 'pending_review').length;

  // 3. fairness score
  const recent = recentHoursOnResource(userBookings, resource.id);
  const pr = computePriority({ purposeType, recentHours: recent });

  let status: string;
  let reason: string;
  if (failures.length) {
    status = 'auto_rejected';
    reason = failures.join(' ');
  } else if (taken) {
    status = 'waitlisted';
    reason =
      'That slot is already booked. You are on the waitlist and move to review if it frees up.';
  } else if (!resource.requires_approval && competing === 0) {
    status = 'approved';
    reason = 'Auto-approved: this resource needs no manual approval and every check passed.';
  } else {
    status = 'pending_review';
    reason = competing
      ? `${competing} other request(s) compete for this slot. The owner compares priority scores.`
      : 'All automatic checks passed. Waiting for the owner or manager.';
  }

  const { data: b, error } = await admin
    .from('bookings')
    .insert({
      resource_id: resource.id,
      user_id: profile.id,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      purpose,
      purpose_type: purposeType,
      status,
      decision_reason: reason,
      priority_score: pr.score,
      priority_explanation: pr.explanation,
      otp: status === 'approved' ? genOtp() : null,
    })
    .select('id')
    .single();
  if (error || !b)
    flash(
      back,
      'error',
      error?.code === '23P01'
        ? 'That slot was just taken. Pick another time.'
        : error?.message || 'Could not create the booking.'
    );

  const actor = {
    actorId: profile.id,
    actorName: profile.full_name,
    entityType: 'booking',
    entityId: b!.id,
    bookingId: b!.id,
  };
  await logAudit(admin, {
    ...actor,
    action: 'booking_requested',
    details: { when: fmtRange(start, end), purpose, priority: pr.explanation },
  });
  const outcome: Record<string, string> = {
    auto_rejected: 'auto_rejected',
    waitlisted: 'waitlisted_on_request',
    approved: 'auto_approved',
  };
  if (outcome[status])
    await logAudit(admin, {
      ...actor,
      actorName: 'System',
      actorId: null,
      action: outcome[status],
      details: { reason },
    });
  if (status === 'pending_review' || status === 'waitlisted') {
    await notify(
      admin,
      resource.owner_id,
      `New request for ${resource.name} from ${profile.full_name}.`,
      `/bookings/${b!.id}`
    );
    if (resource.manager_id)
      await notify(
        admin,
        resource.manager_id,
        `New request for ${resource.name} from ${profile.full_name}.`,
        `/bookings/${b!.id}`
      );
  }
  await notify(admin, profile.id, `${resource.name}: ${reason}`, `/bookings/${b!.id}`);
  redirect(`/bookings/${b!.id}`);
}

// ---------- owner or manager decision ----------
export async function decideBooking(fd: FormData) {
  const profile = await requireProfile(['owner', 'manager', 'admin']);
  const id = String(fd.get('id'));
  const back = String(fd.get('back') || `/bookings/${id}`);
  const decision = String(fd.get('decision'));
  const reason = String(fd.get('reason') || '').trim();
  if (reason.length < 5)
    flash(back, 'error', 'Enter a reason of at least 5 characters. The student will see it.');
  const statusMap: Record<string, string> = {
    approve: 'approved',
    reject: 'rejected',
    waitlist: 'waitlisted',
  };
  const status = statusMap[decision];
  if (!status) flash(back, 'error', 'Unknown decision.');

  const admin = createAdminClient();
  const { data: b } = await admin
    .from('bookings')
    .select('*, resource:resources(*)')
    .eq('id', id)
    .single();
  if (!b || !canManage(profile, b.resource))
    flash(back, 'error', 'You do not manage this resource.');
  if (!(await hasResourcePermission(profile, b.resource, 'booking_requests')))
    flash(back, 'error', 'Your manager permissions do not allow booking decisions.');
  if (!['pending_review', 'waitlisted'].includes(b.status))
    flash(back, 'error', 'This request has already been decided.');

  const patch: any = {
    status,
    decision_reason: reason,
    decided_by: profile.id,
    decided_at: new Date().toISOString(),
  };
  if (status === 'approved') patch.otp = genOtp();
  const { error } = await admin.from('bookings').update(patch).eq('id', id);
  if (error)
    flash(
      back,
      'error',
      error.code === '23P01'
        ? 'Another booking already holds this slot, so this one cannot be approved.'
        : error.message
    );

  await logAudit(admin, {
    actorId: profile.id,
    actorName: profile.full_name,
    action: status,
    entityType: 'booking',
    entityId: id,
    bookingId: id,
    details: { reason, priority: b.priority_explanation },
  });
  const verb = { approved: 'approved', rejected: 'rejected', waitlisted: 'moved to the waitlist' }[
    status
  ];
  await notify(
    admin,
    b.user_id,
    `Your request for ${b.resource.name} was ${verb}. Reason: ${reason}`,
    `/bookings/${id}`
  );

  if (status === 'approved') {
    const { data: losers } = await admin
      .from('bookings')
      .select('id,user_id')
      .eq('resource_id', b.resource_id)
      .eq('status', 'pending_review')
      .neq('id', id)
      .lt('start_at', b.end_at)
      .gt('end_at', b.start_at);
    for (const l of losers ?? []) {
      const why = `Another request for this slot was approved (winner priority ${b.priority_score}). You stay on the waitlist if it frees up.`;
      await admin
        .from('bookings')
        .update({ status: 'waitlisted', decision_reason: why })
        .eq('id', l.id);
      await logAudit(admin, {
        actorId: null,
        actorName: 'System',
        action: 'demoted_to_waitlist',
        entityType: 'booking',
        entityId: l.id,
        bookingId: l.id,
        details: { reason: why },
      });
      await notify(admin, l.user_id, `${b.resource.name}: ${why}`, `/bookings/${l.id}`);
    }
  }
  flash(back, 'msg', `Request ${verb}.`);
}

// ---------- cancel ----------
export async function cancelBooking(fd: FormData) {
  const profile = await requireProfile();
  const id = String(fd.get('id'));
  const back = `/bookings/${id}`;
  const reason = String(fd.get('reason') || '').trim() || 'No reason given';
  const admin = createAdminClient();
  const { data: b } = await admin
    .from('bookings')
    .select('*, resource:resources(*)')
    .eq('id', id)
    .single();
  if (!b) flash('/bookings', 'error', 'Booking not found.');
  const mine = b.user_id === profile.id;
  if (!mine && !canManage(profile, b.resource))
    flash(back, 'error', 'You cannot cancel this booking.');
  if (!mine && !(await hasResourcePermission(profile, b.resource, 'booking_requests')))
    flash(back, 'error', 'Your manager permissions do not allow booking management.');
  if (!['pending_review', 'approved', 'waitlisted'].includes(b.status))
    flash(back, 'error', 'This booking can no longer be cancelled.');

  const wasApproved = b.status === 'approved';
  const late = wasApproved && new Date(b.start_at).getTime() - Date.now() < 2 * 3600000;
  await admin
    .from('bookings')
    .update({
      status: 'cancelled',
      decision_reason: `Cancelled by ${mine ? 'the student' : 'staff'}: ${reason}`,
    })
    .eq('id', id);
  await logAudit(admin, {
    actorId: profile.id,
    actorName: profile.full_name,
    action: 'cancelled',
    entityType: 'booking',
    entityId: id,
    bookingId: id,
    details: { reason, late_cancellation: late },
  });
  if (!mine)
    await notify(
      admin,
      b.user_id,
      `Your booking for ${b.resource.name} was cancelled by staff. Reason: ${reason}`,
      back
    );
  else
    await notify(
      admin,
      b.resource.manager_id ?? b.resource.owner_id,
      `${profile.full_name} cancelled a booking for ${b.resource.name}${late ? ' (less than 2h notice)' : ''}.`,
      back
    );
  if (wasApproved) await promoteWaitlist(admin, b.resource, b.start_at, b.end_at);
  flash(back, 'msg', 'Booking cancelled.');
}

// ---------- condition reports ----------
export async function submitCondition(fd: FormData) {
  const profile = await requireProfile();
  const id = String(fd.get('id'));
  const back = `/bookings/${id}`;
  const phase = String(fd.get('phase'));
  const rating = Number(fd.get('rating'));
  const notes = String(fd.get('notes') || '').trim();
  const files = fd
    .getAll('photos')
    .filter((f) => f instanceof File && (f as File).size > 0) as File[];

  const admin = createAdminClient();
  const { data: b } = await admin
    .from('bookings')
    .select('*, resource:resources(*)')
    .eq('id', id)
    .single();
  if (!b || b.user_id !== profile.id)
    flash(back, 'error', 'Only the person who booked can record their condition report.');
  if (!(rating >= 1 && rating <= 5)) flash(back, 'error', 'Choose a condition rating from 1 to 5.');
  if (files.length < 1)
    flash(back, 'error', 'Add at least one photo. Photos are required as evidence.');
  if (files.some((f) => !f.type.startsWith('image/')))
    flash(back, 'error', 'Only image files are accepted.');
  if (notes.length < 3) flash(back, 'error', 'Add a short note describing the condition.');

  const { data: prior } = await admin.from('condition_reports').select('*').eq('booking_id', id);
  const before = (prior ?? []).find((r: any) => r.phase === 'before');
  if (phase === 'before') {
    if (b.status !== 'approved')
      flash(back, 'error', 'Condition before use can only be recorded for an approved booking.');
    if (before) flash(back, 'error', 'You already recorded the condition before use.');
  } else if (phase === 'after') {
    if (!['checked_in', 'overdue'].includes(b.status))
      flash(back, 'error', 'You can return only after staff have checked the item out to you.');
  } else flash(back, 'error', 'Unknown phase.');

  let paths: string[] = [];
  try {
    paths = await uploadFiles(id, phase, files.slice(0, 3));
  } catch (e: any) {
    flash(back, 'error', e.message);
  }
  await admin
    .from('condition_reports')
    .insert({ booking_id: id, phase, rating, notes, photo_paths: paths, recorded_by: profile.id });

  if (phase === 'before') {
    await logAudit(admin, {
      actorId: profile.id,
      actorName: profile.full_name,
      action: 'before_condition_recorded',
      entityType: 'booking',
      entityId: id,
      bookingId: id,
      details: { rating, notes, photos: paths.length },
    });
    await notify(
      admin,
      b.resource.manager_id ?? b.resource.owner_id,
      `${profile.full_name} recorded condition before use of ${b.resource.name}. Ready for check-in.`,
      back
    );
    flash(back, 'msg', 'Condition recorded. Show your OTP to the lab staff to check in.');
  }

  const now = new Date();
  await admin
    .from('bookings')
    .update({ status: 'returned', returned_at: now.toISOString() })
    .eq('id', id);
  await logAudit(admin, {
    actorId: profile.id,
    actorName: profile.full_name,
    action: 'after_condition_recorded',
    entityType: 'booking',
    entityId: id,
    bookingId: id,
    details: { rating, notes, photos: paths.length },
  });

  const flags: { type: string; description: string }[] = [];
  const minutesLate = Math.round((now.getTime() - new Date(b.end_at).getTime()) / 60000);
  if (minutesLate > 15)
    flags.push({
      type: 'delay',
      description: `Returned ${minutesLate} minutes after the booked end time.`,
    });
  if (fd.get('damaged') === 'on')
    flags.push({
      type: 'damage',
      description: `The user ticked "something was damaged or not working". Notes: ${notes}`,
    });
  else if (before && rating < before.rating)
    flags.push({
      type: 'damage',
      description: `Condition rating dropped from ${before.rating} to ${rating}. Notes: ${notes}`,
    });
  for (const f of flags) {
    const { data: inc } = await admin
      .from('incidents')
      .insert({
        booking_id: id,
        resource_id: b.resource_id,
        reported_by: profile.id,
        type: f.type,
        description: f.description,
        auto_flagged: true,
      })
      .select('id')
      .single();
    await logAudit(admin, {
      actorId: null,
      actorName: 'System',
      action: 'incident_auto_flagged',
      entityType: 'incident',
      entityId: inc?.id,
      bookingId: id,
      details: f,
    });
    await notify(
      admin,
      b.resource.manager_id ?? b.resource.owner_id,
      `Incident flagged on ${b.resource.name}: ${f.description}`,
      `/incidents/${inc?.id}`
    );
  }
  await notify(
    admin,
    b.resource.manager_id ?? b.resource.owner_id,
    `${profile.full_name} returned ${b.resource.name}. Please confirm the return.`,
    back
  );
  flash(
    back,
    'msg',
    flags.length
      ? 'Returned. An incident was opened for staff to review.'
      : 'Returned. Staff will confirm shortly.'
  );
}

// ---------- staff: check-in and return confirmation ----------
export async function checkInBooking(fd: FormData) {
  const profile = await requireProfile(['owner', 'manager', 'admin']);
  const id = String(fd.get('id'));
  const back = `/bookings/${id}`;
  const otp = String(fd.get('otp') || '').trim();
  const admin = createAdminClient();
  const { data: b } = await admin
    .from('bookings')
    .select('*, resource:resources(*)')
    .eq('id', id)
    .single();
  if (!b || !canManage(profile, b.resource))
    flash(back, 'error', 'You do not manage this resource.');
  if (!(await hasResourcePermission(profile, b.resource, 'check_in_out')))
    flash(back, 'error', 'Your manager permissions do not allow check-in or return handling.');
  if (b.status !== 'approved') flash(back, 'error', 'Only approved bookings can be checked in.');
  if (new Date(b.end_at).getTime() < Date.now())
    flash(back, 'error', 'This booking has already ended.');
  const { count } = await admin
    .from('condition_reports')
    .select('id', { count: 'exact', head: true })
    .eq('booking_id', id)
    .eq('phase', 'before');
  if (!count) flash(back, 'error', 'The student has not recorded the condition before use yet.');
  if (otp !== b.otp) {
    await logAudit(admin, {
      actorId: profile.id,
      actorName: profile.full_name,
      action: 'checked_in',
      entityType: 'booking',
      entityId: id,
      bookingId: id,
      details: { result: 'wrong OTP, check-in refused' },
    });
    flash(
      back,
      'error',
      'The OTP does not match. Ask the student to open their booking and read the code again.'
    );
  }
  const early = Date.now() < new Date(b.start_at).getTime() - 30 * 60000;
  await admin
    .from('bookings')
    .update({
      status: 'checked_in',
      checked_in_at: new Date().toISOString(),
      checked_in_by: profile.id,
    })
    .eq('id', id);
  await logAudit(admin, {
    actorId: profile.id,
    actorName: profile.full_name,
    action: 'checked_in',
    entityType: 'booking',
    entityId: id,
    bookingId: id,
    details: { result: 'OTP verified', early_checkin: early },
  });
  await notify(
    admin,
    b.user_id,
    `You are checked in for ${b.resource.name}. Return it by ${fmtDateTime(b.end_at)}.`,
    back
  );
  flash(back, 'msg', 'Checked in. OTP verified.');
}

export async function confirmReturn(fd: FormData) {
  const profile = await requireProfile(['owner', 'manager', 'admin']);
  const id = String(fd.get('id'));
  const back = `/bookings/${id}`;
  const admin = createAdminClient();
  const { data: b } = await admin
    .from('bookings')
    .select('*, resource:resources(*)')
    .eq('id', id)
    .single();
  if (!b || !canManage(profile, b.resource))
    flash(back, 'error', 'You do not manage this resource.');
  if (!(await hasResourcePermission(profile, b.resource, 'check_in_out')))
    flash(back, 'error', 'Your manager permissions do not allow return handling.');
  if (b.status !== 'returned')
    flash(back, 'error', 'This booking is not waiting for return confirmation.');
  await admin.from('bookings').update({ status: 'closed' }).eq('id', id);
  await logAudit(admin, {
    actorId: profile.id,
    actorName: profile.full_name,
    action: 'return_confirmed',
    entityType: 'booking',
    entityId: id,
    bookingId: id,
    details: { note: String(fd.get('note') || '') },
  });
  await notify(
    admin,
    b.user_id,
    `Your return of ${b.resource.name} was confirmed. Thank you.`,
    back
  );
  flash(back, 'msg', 'Return confirmed and booking closed.');
}
