'use server';
import { createHash, randomBytes } from 'node:crypto';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile } from '@/lib/auth';
import { flash } from '@/lib/flash';
import { logAudit, notify } from '@/lib/audit';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createManagerInvite(fd: FormData) {
  const owner = await requireProfile(['owner']);
  if (!owner.verified)
    flash('/staff/team', 'error', 'Your owner account must be verified before inviting managers.');
  const email = String(fd.get('email') || '')
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    flash('/staff/team', 'error', 'Enter a valid email address.');
  const permissions = {
    booking_requests: fd.get('booking_requests') === 'on',
    check_in_out: fd.get('check_in_out') === 'on',
    incidents: fd.get('incidents') === 'on',
    manage_resources: false,
  };
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('profiles')
    .select('id,role,email')
    .eq('email', email)
    .maybeSingle();
  if (existing?.role === 'admin' || existing?.role === 'owner')
    flash(
      '/staff/team',
      'error',
      'This email belongs to an account that cannot be invited as a manager.'
    );
  if (existing?.id) {
    const { data: active } = await admin
      .from('owner_managers')
      .select('id')
      .eq('manager_id', existing.id)
      .is('revoked_at', null)
      .maybeSingle();
    if (active)
      flash(
        '/staff/team',
        'error',
        'This person is already an active manager for an owner. Revoke their existing assignment before inviting them here.'
      );
  }
  // Invalidate any older unaccepted invite for this owner/email before issuing a fresh link.
  await admin
    .from('manager_invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('owner_id', owner.id)
    .eq('email', email)
    .is('accepted_at', null)
    .is('revoked_at', null);
  const token = randomBytes(32).toString('hex');
  const { error } = await admin.from('manager_invitations').insert({
    owner_id: owner.id,
    email,
    token_hash: hashToken(token),
    permissions,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) flash('/staff/team', 'error', error.message);
  await logAudit(admin, {
    actorId: owner.id,
    actorName: owner.full_name,
    action: 'manager_invited',
    entityType: 'manager_invitation',
    details: { email, permissions },
  });
  // No email provider is configured. Give the owner an absolute one-time link to share privately.
  const h = headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  const protocol = h.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || (host ? `${protocol}://${host}` : 'http://localhost:3000')
  ).replace(/\/$/, '');
  redirect(
    '/staff/team?invite=' +
      encodeURIComponent(`${baseUrl}/invite/${token}`) +
      '&msg=' +
      encodeURIComponent('Invitation created. Share the link privately; it expires in 7 days.')
  );
}

export async function revokeManager(fd: FormData) {
  const owner = await requireProfile(['owner']);
  const managerId = String(fd.get('manager_id') || '');
  if (!managerId) flash('/staff/team', 'error', 'Missing manager.');
  const admin = createAdminClient();
  const { data: link } = await admin
    .from('owner_managers')
    .select('id,manager_id')
    .eq('owner_id', owner.id)
    .eq('manager_id', managerId)
    .is('revoked_at', null)
    .maybeSingle();
  if (!link) flash('/staff/team', 'error', 'That manager is not assigned to your account.');
  await admin
    .from('owner_managers')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', link.id);
  await admin
    .from('resources')
    .update({ manager_id: null })
    .eq('owner_id', owner.id)
    .eq('manager_id', managerId);
  await logAudit(admin, {
    actorId: owner.id,
    actorName: owner.full_name,
    action: 'manager_access_revoked',
    entityType: 'user',
    entityId: managerId,
  });
  await notify(
    admin,
    managerId,
    `${owner.full_name} revoked your ResourcesHub manager access.`,
    '/resources'
  );
  flash(
    '/staff/team',
    'msg',
    'Manager access revoked. Assigned resources have been returned to owner management.'
  );
}

export async function acceptManagerInvite(fd: FormData) {
  const token = String(fd.get('token') || '').trim();
  if (!/^[a-f0-9]{64}$/.test(token)) flash('/signup', 'error', 'Invalid invitation link.');
  const admin = createAdminClient();
  const tokenHash = hashToken(token);
  const { data: invite } = await admin
    .from('manager_invitations')
    .select('*')
    .eq('token_hash', tokenHash)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (!invite)
    flash(
      `/invite/${token}`,
      'error',
      'This invitation is invalid, expired, or already used. Ask the owner for a new invitation.'
    );

  const supabase = createClient();
  let {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && (user.email || '').toLowerCase() !== invite.email.toLowerCase()) {
    flash(`/invite/${token}`, 'error', `Sign in with ${invite.email} to accept this invitation.`);
  }
  if (!user) {
    const fullName = String(fd.get('full_name') || '').trim();
    const password = String(fd.get('password') || '');
    if (!fullName) flash(`/invite/${token}`, 'error', 'Enter your full name.');
    if (password.length < 8)
      flash(`/invite/${token}`, 'error', 'Password must be at least 8 characters.');
    const { data, error } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) {
      if (/already registered|already exists/i.test(error.message))
        flash(
          `/invite/${token}`,
          'error',
          'An account already exists for this email. Sign in with that account, then reopen this invitation link.'
        );
      flash(`/invite/${token}`, 'error', error.message);
    }
    user = data.user;
    if (!user)
      flash(`/invite/${token}`, 'error', 'Could not create the account. Please try again.');
    if (!data.session)
      flash(
        `/invite/${token}`,
        'msg',
        'Account created. Confirm your email if requested, sign in, then reopen this invitation link to activate manager access.'
      );
  }

  const { data: active } = await admin
    .from('owner_managers')
    .select('id')
    .eq('manager_id', user!.id)
    .is('revoked_at', null)
    .maybeSingle();
  if (active)
    flash(
      `/invite/${token}`,
      'error',
      'This account is already an active manager for another owner. Ask that owner to revoke access first.'
    );
  const { data: currentProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .maybeSingle();
  if (currentProfile?.role === 'admin' || currentProfile?.role === 'owner')
    flash(
      `/invite/${token}`,
      'error',
      'Owner and admin accounts cannot accept manager invitations.'
    );

  const { data: claimed, error: claimError } = await admin
    .from('manager_invitations')
    .update({ accepted_at: new Date().toISOString(), manager_id: user!.id })
    .eq('id', invite.id)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();
  if (claimError || !claimed)
    flash(
      `/invite/${token}`,
      'error',
      'This invitation was just used or revoked. Ask the owner for a new invitation.'
    );
  await admin
    .from('profiles')
    .update({ role: 'manager', verified: true, requested_role: null, application_status: 'none' })
    .eq('id', user!.id);
  const { error: linkError } = await admin
    .from('owner_managers')
    .insert({
      owner_id: invite.owner_id,
      manager_id: user!.id,
      permissions: invite.permissions,
      invited_by: invite.owner_id,
    });
  if (linkError) {
    await admin.from('profiles').update({ role: 'student', verified: false }).eq('id', user!.id);
    await admin
      .from('manager_invitations')
      .update({ accepted_at: null, manager_id: null })
      .eq('id', invite.id);
    flash(
      `/invite/${token}`,
      'error',
      'Could not attach this manager. The invitation remains available; please retry or contact the owner.'
    );
  }
  await logAudit(admin, {
    actorId: user!.id,
    actorName: user!.user_metadata?.full_name || invite.email,
    action: 'manager_invitation_accepted',
    entityType: 'user',
    entityId: user!.id,
    details: { owner_id: invite.owner_id, permissions: invite.permissions },
  });
  await notify(
    admin,
    invite.owner_id,
    `${user!.user_metadata?.full_name || invite.email} accepted your manager invitation.`,
    '/staff/team'
  );
  redirect(
    '/resources?msg=' +
      encodeURIComponent(
        'Manager invitation accepted. Your access is limited to the inviting owner and assigned resources.'
      )
  );
}
