import { cache } from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from './supabase/server';
import { createAdminClient } from './supabase/admin';
import type { Role } from './types';

// Who is signed in?
// 1. The middleware has already verified the session with Supabase Auth and passes the user id in a header
//    (it deletes any value sent by the browser). If that header is ever missing we ask Supabase Auth ourselves.
// 2. The profile is then read by that verified id with the service role. This way a row-level-security quirk or an
//    expired token inside a page can never make a valid, signed-in person look "logged out" and bounce to /login.
export const getProfile = cache(async () => {
  let uid = headers().get('x-user-id');
  if (!uid) {
    try {
      const { data } = await createClient().auth.getUser();
      uid = data.user?.id ?? null;
    } catch {
      uid = null;
    }
  }
  if (!uid) return null;
  const { data, error } = await createAdminClient()
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .maybeSingle();
  if (error) console.error('[auth] could not load profile', uid, error.message);
  return (data as any) ?? null;
});

export async function requireProfile(roles?: Role[]) {
  const p = await getProfile();
  if (!p) redirect('/login');
  if (p.is_active === false) redirect('/deactivated');
  if (roles && !roles.includes(p.role))
    redirect(
      '/resources?error=' + encodeURIComponent('You do not have permission to open that page.')
    );
  return p;
}

export const isStaff = (role: string) => ['owner', 'manager', 'admin'].includes(role);
export const canManage = (p: any, r: { owner_id: string; manager_id: string | null }) =>
  p.role === 'admin' || r.owner_id === p.id || r.manager_id === p.id;

// Check the permission attached to this manager's active owner association.
// Owners and platform admins retain their normal management authority.
export async function hasResourcePermission(
  profile: any,
  resource: { owner_id: string; manager_id: string | null },
  permission: 'booking_requests' | 'check_in_out' | 'incidents' | 'manage_resources'
) {
  if (profile.role === 'admin' || (profile.role === 'owner' && resource.owner_id === profile.id))
    return true;
  if (profile.role !== 'manager' || resource.manager_id !== profile.id) return false;
  const { createAdminClient } = await import('./supabase/admin');
  const admin = createAdminClient();
  const { data } = await admin
    .from('owner_managers')
    .select('permissions')
    .eq('owner_id', resource.owner_id)
    .eq('manager_id', profile.id)
    .is('revoked_at', null)
    .maybeSingle();
  return data?.permissions?.[permission] === true;
}
