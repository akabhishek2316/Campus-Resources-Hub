import { requireProfile, isStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { runMaintenance } from '@/lib/maintenance';
import { signOut } from '@/app/actions/auth';
import { AppHeader } from '@/components/AppHeader';
import { Footer } from '@/components/Footer';
import { COLLEGE_SHORT } from '@/lib/brand';
import { roleLabel } from '@/lib/applications';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  // Reminders / overdue flags run in the background so they never slow navigation.
  runMaintenance().catch(() => {});
  const supabase = createClient();
  const [{ count }, pendingRes, pendingTr] = await Promise.all([
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('read', false),
    profile.role === 'admin'
      ? supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('application_status', 'pending')
      : Promise.resolve({ count: 0 } as any),
    profile.role === 'admin'
      ? supabase
          .from('training_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
      : Promise.resolve({ count: 0 } as any),
  ]);
  const pendingApps = (pendingRes?.count ?? 0) + (pendingTr?.count ?? 0);

  const links: { href: string; label: string }[] = [
    { href: '/resources', label: 'Resources' },
    { href: '/bookings', label: 'My bookings' },
  ];
  if (profile.role === 'student')
    links.push(
      { href: '/credentials', label: 'My training' },
      { href: '/apply', label: 'Become an owner' }
    );
  if (isStaff(profile.role))
    links.push(
      { href: '/staff/requests', label: 'Requests' },
      { href: '/incidents', label: 'Incidents' }
    );
  if (profile.role === 'owner' || profile.role === 'admin')
    links.push({ href: '/staff/resources', label: 'Listings' });
  if (profile.role === 'owner')
    links.push(
      { href: '/staff/team', label: 'Team management' },
      { href: '/staff/trainings', label: 'Request training' }
    );
  if (profile.role === 'admin')
    links.push(
      { href: '/admin', label: `Admin${pendingApps ? ` (${pendingApps})` : ''}` },
      { href: '/admin/users', label: 'Users' },
      { href: '/admin/audit', label: 'Audit log' },
      { href: '/admin/stats', label: 'Statistics' }
    );

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        links={links}
        unread={count ?? 0}
        name={profile.full_name}
        role={roleLabel(profile.role, profile.owner_type)}
        short={COLLEGE_SHORT}
        signOutAction={signOut}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {profile.role === 'student' &&
          profile.application_status === 'pending' &&
          profile.requested_role !== 'student' && (
            <div className="mb-5 rounded-lg border border-gold bg-gold-light px-4 py-3 text-sm text-amber2">
              Your request to become a {roleLabel(profile.requested_role, profile.owner_type)} is
              waiting for admin review. Until it is approved you have student-level access.
            </div>
          )}
        {profile.role === 'student' && profile.application_status === 'rejected' && (
          <div className="mb-5 rounded-lg border border-rust bg-rust-light px-4 py-3 text-sm text-rust">
            Your registration request was rejected. Reason:{' '}
            {profile.application_review_note || 'not given'}.{' '}
            <a href="/apply" className="font-medium underline">
              Update and apply again
            </a>
            .
          </div>
        )}
        {!profile.verified &&
          profile.role === 'student' &&
          profile.application_status !== 'rejected' &&
          !(profile.application_status === 'pending' && profile.requested_role !== 'student') && (
            <div className="mb-5 rounded-lg border border-gold bg-gold-light px-4 py-3 text-sm text-amber2">
              Your college ID is waiting for admin verification. You can browse now and book once
              you are verified.
            </div>
          )}
        {profile.suspended_until && new Date(profile.suspended_until) > new Date() && (
          <div className="mb-5 rounded-lg border border-rust bg-rust-light px-4 py-3 text-sm text-rust">
            Booking is suspended on your account after an incident review. Contact the lab manager.
          </div>
        )}
        {children}
      </main>
      <Footer signedIn />
    </div>
  );
}
