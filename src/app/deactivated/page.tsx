import { getProfile } from '@/lib/auth';
import { signOut } from '@/app/actions/auth';
import { AuthShell } from '@/components/AuthShell';
import { SubmitButton } from '@/components/SubmitButton';

export default async function Deactivated() {
  const p = await getProfile();
  return (
    <AuthShell
      title="Account deactivated"
      subtitle="This account can no longer be used to sign in or book resources."
      points={[
        'Your past bookings and records are kept',
        'Contact the admin office if you think this is a mistake',
        'An admin can reactivate the account',
      ]}
    >
      <div className="card space-y-3 text-sm">
        {p?.deactivation_reason && (
          <p>
            <b>Reason:</b> {p.deactivation_reason}
          </p>
        )}
        <p className="text-ink-soft">
          Please contact the college admin office to ask for the account to be restored.
        </p>
        <form action={signOut}>
          <SubmitButton className="btn btn-primary" pendingText="Signing out...">
            Sign out
          </SubmitButton>
        </form>
      </div>
    </AuthShell>
  );
}
