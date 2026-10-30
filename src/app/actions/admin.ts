'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile } from '@/lib/auth';
import { flash } from '@/lib/flash';
import { logAudit, notify } from '@/lib/audit';
import { roleLabel } from '@/lib/applications';
import { promoteWaitlist } from '@/lib/waitlist';

// Forms can say where to return to (only inside /admin).
const backTo = (fd: FormData, fallback: string) => {
  const b = String(fd.get('back') || '');
  return b.startsWith('/admin') ? b : fallback;
};

export async function reviewCredential(fd: FormData) {
  const profile = await requireProfile(['admin']);
  const id = String(fd.get('id'));
  const approve = fd.get('decision') === 'approve';
  const note = String(fd.get('note') || '').trim();
  if (!approve && note.length < 5)
    flash('/admin', 'error', 'Give a short reason when rejecting proof.');
  const admin = createAdminClient();
  const { data: c } = await admin
    .from('user_credentials')
    .select('*, trainings(name)')
    .eq('id', id)
    .single();
  await admin
    .from('user_credentials')
    .update({
      status: approve ? 'approved' : 'rejected',
      review_note: note || null,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id);
  await logAudit(admin, {
    actorId: profile.id,
    actorName: profile.full_name,
    action: approve ? 'credential_approved' : 'credential_rejected',
    entityType: 'credential',
    entityId: id,
    details: { training: c?.trainings?.name, note },
  });
  await notify(
    admin,
    c.user_id,
    `Your ${c?.trainings?.name} proof was ${approve ? 'approved' : 'rejected'}.${note ? ' Note: ' + note : ''}`,
    '/credentials'
  );
  flash('/admin', 'msg', 'Credential reviewed.');
}

export async function setVerified(fd: FormData) {
  const profile = await requireProfile(['admin']);
  const id = String(fd.get('id'));
  const verified = fd.get('verified') === 'true';
  const admin = createAdminClient();
  await admin.from('profiles').update({ verified }).eq('id', id);
  await logAudit(admin, {
    actorId: profile.id,
    actorName: profile.full_name,
    action: verified ? 'user_verified' : 'user_unverified',
    entityType: 'user',
    entityId: id,
  });
  await notify(
    admin,
    id,
    verified
      ? 'Your college ID is verified. You can now request bookings.'
      : 'Your verification was removed.',
    '/resources'
  );
  flash(backTo(fd, '/admin/users'), 'msg', verified ? 'User verified.' : 'Verification removed.');
}

export async function setRole(fd: FormData) {
  const profile = await requireProfile(['admin']);
  const back = backTo(fd, '/admin/users');
  const id = String(fd.get('id'));
  const role = String(fd.get('role'));
  if (!['student', 'owner'].includes(role))
    flash(
      back,
      'error',
      'Only student and owner roles can be assigned here. Admin is provisioned by the platform operator; managers join through owner invitations.'
    );
  if (id === profile.id) flash(back, 'error', 'You cannot change your own role.');
  const admin = createAdminClient();
  const { data: u } = await admin.from('profiles').select('role').eq('id', id).single();
  if (!u) flash(back, 'error', 'User not found.');
  if (u.role === 'admin' || u.role === 'manager')
    flash(
      back,
      'error',
      'Admin and manager roles are managed separately and cannot be changed here.'
    );
  if (u.role === 'owner' && role === 'student') {
    const { count } = await admin
      .from('resources')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', id);
    if (count)
      flash(
        back,
        'error',
        `This owner still has ${count} listed resource(s). Deactivate the account instead, or ask the owner to hide them first.`
      );
  }
  await admin.from('profiles').update({ role }).eq('id', id);
  await logAudit(admin, {
    actorId: profile.id,
    actorName: profile.full_name,
    action: 'role_changed',
    entityType: 'user',
    entityId: id,
    details: { role },
  });
  flash(back, 'msg', 'Role updated.');
}

export async function addTraining(fd: FormData) {
  const profile = await requireProfile(['admin']);
  const name = String(fd.get('name') || '').trim();
  if (name.length < 3) flash('/admin', 'error', 'Training name is too short.');
  const admin = createAdminClient();
  const { error } = await admin.from('trainings').insert({ name });
  if (error) flash('/admin', 'error', error.message);
  await logAudit(admin, {
    actorId: profile.id,
    actorName: profile.full_name,
    action: 'training_added',
    entityType: 'training',
    details: { name },
  });
  flash('/admin', 'msg', 'Training added.');
}

export async function reviewApplication(fd: FormData) {
  const profile = await requireProfile(['admin']);
  const id = String(fd.get('id'));
  const approve = fd.get('decision') === 'approve';
  const note = String(fd.get('note') || '').trim();
  if (!approve && note.length < 5)
    flash(
      '/admin',
      'error',
      'Give a short reason when rejecting, so the person knows what to fix.'
    );
  const admin = createAdminClient();
  const { data: u } = await admin.from('profiles').select('*').eq('id', id).single();
  if (!u || u.application_status !== 'pending')
    flash('/admin', 'error', 'This request was already reviewed.');
  const role = u.requested_role || 'student';
  if (!['student', 'owner'].includes(role))
    flash(
      '/admin',
      'error',
      'Only student and owner applications can be approved. Managers join through owner invitations.'
    );
  const patch: any = {
    application_status: approve ? 'approved' : 'rejected',
    application_review_note: note || null,
    application_reviewed_at: new Date().toISOString(),
  };
  if (approve) {
    patch.role = role;
    patch.verified = true;
  }
  await admin.from('profiles').update(patch).eq('id', id);
  await logAudit(admin, {
    actorId: profile.id,
    actorName: profile.full_name,
    action: approve ? 'application_approved' : 'application_rejected',
    entityType: 'user',
    entityId: id,
    details: { person: u.full_name, approved_as: roleLabel(role, u.owner_type), note },
  });
  await notify(
    admin,
    id,
    approve
      ? `Your registration was approved. You are now a ${roleLabel(role, u.owner_type)}.${note ? ' Note: ' + note : ''}`
      : `Your registration request was rejected. Reason: ${note}`,
    approve ? '/resources' : '/apply'
  );
  flash(
    '/admin',
    'msg',
    approve
      ? `${u.full_name} approved as ${roleLabel(role, u.owner_type)}.`
      : 'Request rejected and the person was told why.'
  );
}

// ---------- account status ----------
export async function deactivateUser(fd: FormData) {
  const profile = await requireProfile(['admin']);
  const id = String(fd.get('id'));
  const back = backTo(fd, '/admin/users');
  const reason = String(fd.get('reason') || '').trim();
  if (reason.length < 5)
    flash(back, 'error', 'Give a reason of at least 5 characters. It is saved in the audit log.');
  if (id === profile.id) flash(back, 'error', 'You cannot deactivate your own account.');
  const admin = createAdminClient();
  const { data: u } = await admin.from('profiles').select('*').eq('id', id).single();
  if (!u) flash(back, 'error', 'User not found.');
  if (u.role === 'admin') flash(back, 'error', 'Admin accounts cannot be deactivated from here.');
  if (u.is_active === false) flash(back, 'error', 'This account is already deactivated.');

  await admin
    .from('profiles')
    .update({
      is_active: false,
      deactivated_at: new Date().toISOString(),
      deactivated_by: profile.id,
      deactivation_reason: reason,
    })
    .eq('id', id);
  // Block sign-in at the authentication layer too (about 100 years). Failure here must not leave the profile half-changed.
  try {
    await admin.auth.admin.updateUserById(id, { ban_duration: '876000h' });
  } catch {
    /* the is_active flag still blocks every page */
  }

  // Free up everything this person was holding.
  let cancelled = 0;
  const { data: open } = await admin
    .from('bookings')
    .select('*, resource:resources(*)')
    .eq('user_id', id)
    .in('status', ['pending_review', 'approved', 'waitlisted']);
  for (const b of open ?? []) {
    await admin
      .from('bookings')
      .update({
        status: 'cancelled',
        decision_reason: 'Cancelled automatically: the account was deactivated by an admin.',
      })
      .eq('id', b.id);
    await logAudit(admin, {
      actorId: profile.id,
      actorName: profile.full_name,
      action: 'cancelled',
      entityType: 'booking',
      entityId: b.id,
      bookingId: b.id,
      details: { reason: 'Account deactivated' },
    });
    if (b.status === 'approved') await promoteWaitlist(admin, b.resource, b.start_at, b.end_at);
    cancelled++;
  }
  const { count: stillOut } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', id)
    .in('status', ['checked_in', 'overdue', 'returned']);

  let hidden = 0;
  if (u.role === 'owner') {
    const { data: res } = await admin
      .from('resources')
      .update({ active: false })
      .eq('owner_id', id)
      .eq('active', true)
      .select('id');
    hidden = res?.length ?? 0;
    const { data: links } = await admin
      .from('owner_managers')
      .select('manager_id')
      .eq('owner_id', id)
      .is('revoked_at', null);
    await admin
      .from('owner_managers')
      .update({ revoked_at: new Date().toISOString() })
      .eq('owner_id', id)
      .is('revoked_at', null);
    await admin.from('resources').update({ manager_id: null }).eq('owner_id', id);
    for (const l of links ?? [])
      await notify(
        admin,
        l.manager_id,
        `${u.full_name}'s account was deactivated, so your manager access ended.`,
        '/resources'
      );
  }
  if (u.role === 'manager') {
    const { data: link } = await admin
      .from('owner_managers')
      .select('owner_id')
      .eq('manager_id', id)
      .is('revoked_at', null)
      .maybeSingle();
    await admin
      .from('owner_managers')
      .update({ revoked_at: new Date().toISOString() })
      .eq('manager_id', id)
      .is('revoked_at', null);
    await admin.from('resources').update({ manager_id: null }).eq('manager_id', id);
    if (link)
      await notify(
        admin,
        link.owner_id,
        `Manager ${u.full_name} was deactivated by an admin. Their resources are back under your control.`,
        '/staff/team'
      );
  }

  await logAudit(admin, {
    actorId: profile.id,
    actorName: profile.full_name,
    action: 'user_deactivated',
    entityType: 'user',
    entityId: id,
    details: {
      person: u.full_name,
      reason,
      bookings_cancelled: cancelled,
      listings_hidden: hidden,
    },
  });
  const extra = [
    cancelled ? `${cancelled} open booking(s) cancelled` : '',
    hidden ? `${hidden} listing(s) hidden` : '',
    stillOut ? `${stillOut} item(s) still checked out or awaiting return confirmation` : '',
  ]
    .filter(Boolean)
    .join(', ');
  flash(
    back,
    'msg',
    `${u.full_name} was deactivated and can no longer sign in.${extra ? ' ' + extra + '.' : ''}`
  );
}

export async function reactivateUser(fd: FormData) {
  const profile = await requireProfile(['admin']);
  const id = String(fd.get('id'));
  const back = backTo(fd, '/admin/users');
  const admin = createAdminClient();
  const { data: u } = await admin
    .from('profiles')
    .select('full_name,role,is_active')
    .eq('id', id)
    .single();
  if (!u) flash(back, 'error', 'User not found.');
  if (u.is_active !== false) flash(back, 'error', 'This account is already active.');
  await admin
    .from('profiles')
    .update({
      is_active: true,
      deactivated_at: null,
      deactivated_by: null,
      deactivation_reason: null,
    })
    .eq('id', id);
  try {
    await admin.auth.admin.updateUserById(id, { ban_duration: 'none' });
  } catch {
    /* ignore */
  }
  await logAudit(admin, {
    actorId: profile.id,
    actorName: profile.full_name,
    action: 'user_reactivated',
    entityType: 'user',
    entityId: id,
    details: { person: u.full_name },
  });
  await notify(
    admin,
    id,
    'Your account was reactivated. You can use ResourcesHub again.',
    '/resources'
  );
  flash(
    back,
    'msg',
    `${u.full_name} can sign in again.${u.role === 'owner' ? ' Their listings stay hidden until they show them again.' : ''}`
  );
}

export async function liftSuspension(fd: FormData) {
  const profile = await requireProfile(['admin']);
  const id = String(fd.get('id'));
  const back = backTo(fd, '/admin/users');
  const admin = createAdminClient();
  await admin.from('profiles').update({ suspended_until: null }).eq('id', id);
  await logAudit(admin, {
    actorId: profile.id,
    actorName: profile.full_name,
    action: 'suspension_lifted',
    entityType: 'user',
    entityId: id,
  });
  await notify(admin, id, 'Your booking suspension was lifted by an admin.', '/resources');
  flash(back, 'msg', 'Suspension lifted.');
}
