'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile, canManage, hasResourcePermission } from '@/lib/auth';
import { flash } from '@/lib/flash';
import { logAudit, notify } from '@/lib/audit';
import { summarizeIncident } from '@/lib/ai';
import { fmtDateTime } from '@/lib/time';

export async function reportIncident(fd: FormData) {
  const profile = await requireProfile();
  const id = String(fd.get('booking_id'));
  const back = `/bookings/${id}`;
  const type = String(fd.get('type'));
  const description = String(fd.get('description') || '').trim();
  if (!['damage', 'delay', 'conflict', 'misuse'].includes(type))
    flash(back, 'error', 'Choose an incident type.');
  if (description.length < 10)
    flash(back, 'error', 'Describe what happened in at least 10 characters.');
  const admin = createAdminClient();
  const { data: b } = await admin
    .from('bookings')
    .select('*, resource:resources(*)')
    .eq('id', id)
    .single();
  if (!b || (b.user_id !== profile.id && !canManage(profile, b.resource)))
    flash(back, 'error', 'You are not part of this booking.');
  if (b.user_id !== profile.id && !(await hasResourcePermission(profile, b.resource, 'incidents')))
    flash(
      back,
      'error',
      'Your manager permissions do not allow incident reporting for this resource.'
    );
  const { data: inc } = await admin
    .from('incidents')
    .insert({
      booking_id: id,
      resource_id: b.resource_id,
      reported_by: profile.id,
      type,
      description,
    })
    .select('id')
    .single();
  await logAudit(admin, {
    actorId: profile.id,
    actorName: profile.full_name,
    action: 'incident_reported',
    entityType: 'incident',
    entityId: inc?.id,
    bookingId: id,
    details: { type, description },
  });
  const other =
    b.user_id === profile.id ? (b.resource.manager_id ?? b.resource.owner_id) : b.user_id;
  await notify(
    admin,
    other,
    `An incident (${type}) was reported on ${b.resource.name}.`,
    `/incidents/${inc?.id}`
  );
  flash(`/incidents/${inc?.id}`, 'msg', 'Incident recorded. A person will review it.');
}

export async function resolveIncident(fd: FormData) {
  const profile = await requireProfile(['owner', 'manager', 'admin']);
  const id = String(fd.get('id'));
  const back = `/incidents/${id}`;
  const resolution = String(fd.get('resolution'));
  const note = String(fd.get('note') || '').trim();
  if (!['no_action', 'warning', 'suspension'].includes(resolution))
    flash(back, 'error', 'Choose an outcome.');
  if (note.length < 5)
    flash(
      back,
      'error',
      'Explain the decision in at least 5 characters. Both parties will see it.'
    );
  const admin = createAdminClient();
  const { data: inc } = await admin
    .from('incidents')
    .select('*, booking:bookings(*, resource:resources(*))')
    .eq('id', id)
    .single();
  if (!inc || !canManage(profile, inc.booking.resource))
    flash(back, 'error', 'You do not manage this resource.');
  if (!(await hasResourcePermission(profile, inc.booking.resource, 'incidents')))
    flash(back, 'error', 'Your manager permissions do not allow incident management.');
  if (inc.status === 'resolved') flash(back, 'error', 'Already resolved.');

  await admin
    .from('incidents')
    .update({
      status: 'resolved',
      resolution,
      resolution_note: note,
      resolved_by: profile.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id);
  const userId = inc.booking.user_id;
  if (resolution !== 'no_action') {
    const { data: u } = await admin.from('profiles').select('warnings').eq('id', userId).single();
    const patch: any = { warnings: (u?.warnings ?? 0) + 1 };
    if (resolution === 'suspension')
      patch.suspended_until = new Date(Date.now() + 7 * 86400000).toISOString();
    await admin.from('profiles').update(patch).eq('id', userId);
  }
  await logAudit(admin, {
    actorId: profile.id,
    actorName: profile.full_name,
    action: 'incident_resolved',
    entityType: 'incident',
    entityId: id,
    bookingId: inc.booking_id,
    details: { resolution, note },
  });
  const label = {
    no_action: 'No action taken',
    warning: 'A warning was recorded',
    suspension: 'Booking access suspended for 7 days',
  }[resolution];
  await notify(
    admin,
    userId,
    `Incident on ${inc.booking.resource.name} resolved: ${label}. ${note}`,
    back
  );
  if (inc.reported_by && inc.reported_by !== userId)
    await notify(admin, inc.reported_by, `Your incident report was resolved: ${label}.`, back);
  flash(back, 'msg', 'Incident resolved and both parties notified.');
}

export async function summarizeIncidentAction(fd: FormData) {
  const profile = await requireProfile(['owner', 'manager', 'admin']);
  const id = String(fd.get('id'));
  const back = `/incidents/${id}`;
  const admin = createAdminClient();
  const { data: inc } = await admin
    .from('incidents')
    .select('*, booking:bookings(*, resource:resources(*), user:profiles!user_id(full_name))')
    .eq('id', id)
    .single();
  if (!inc || !canManage(profile, inc.booking.resource))
    flash(back, 'error', 'You do not manage this resource.');
  if (!(await hasResourcePermission(profile, inc.booking.resource, 'incidents')))
    flash(back, 'error', 'Your manager permissions do not allow incident access.');
  const { data: reports } = await admin
    .from('condition_reports')
    .select('*')
    .eq('booking_id', inc.booking_id);
  const { data: log } = await admin
    .from('audit_log')
    .select('*')
    .eq('booking_id', inc.booking_id)
    .order('created_at');
  const ctx = [
    `Resource: ${inc.booking.resource.name}. Booked by ${inc.booking.user?.full_name}. Slot: ${fmtDateTime(inc.booking.start_at)} to ${fmtDateTime(inc.booking.end_at)}.`,
    `Incident (${inc.type}${inc.auto_flagged ? ', auto-flagged' : ''}): ${inc.description}`,
    ...(reports ?? []).map(
      (r: any) =>
        `Condition ${r.phase}: rating ${r.rating}/5, notes: ${r.notes}, photos: ${r.photo_paths.length}`
    ),
    ...(log ?? []).map((l: any) => `${fmtDateTime(l.created_at)} ${l.actor_name}: ${l.action}`),
  ].join('\n');
  const out = await summarizeIncident(ctx);
  await admin.from('incidents').update({ ai_summary: out.text }).eq('id', id);
  await logAudit(admin, {
    actorId: profile.id,
    actorName: profile.full_name,
    action: 'ai_summary_generated',
    entityType: 'incident',
    entityId: id,
    bookingId: inc.booking_id,
    details: { source: out.source },
  });
  flash(
    back,
    'msg',
    out.source === 'gemini'
      ? 'AI summary added. It is advisory only.'
      : 'Basic summary added (no AI key configured).'
  );
}
