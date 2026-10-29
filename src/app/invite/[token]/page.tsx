import Link from 'next/link';
import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { acceptManagerInvite } from '@/app/actions/managers';
import { AuthShell } from '@/components/AuthShell';
import { Flash } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';

export default async function ManagerInvitePage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { error?: string; msg?: string };
}) {
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from('manager_invitations')
    .select(
      'email,expires_at,accepted_at,revoked_at,owner:profiles!manager_invitations_owner_id_fkey(full_name)'
    )
    .eq('token_hash', createHash('sha256').update(params.token).digest('hex'))
    .maybeSingle();
  const valid =
    !!invite &&
    !invite.accepted_at &&
    !invite.revoked_at &&
    new Date(invite.expires_at) > new Date();
  return (
    <AuthShell
      title="Manager invitation"
      subtitle={
        valid
          ? `You have been invited by ${(invite as any).owner?.full_name ?? 'a resource owner'} to help manage ResourcesHub resources.`
          : 'This invitation is not available.'
      }
      points={[
        'Your access is limited to the inviting owner',
        'The invitation can only be accepted once',
        'Use the invited email address',
      ]}
    >
      <Flash sp={searchParams} />
      {valid ? (
        <form action={acceptManagerInvite} className="card space-y-4">
          <input type="hidden" name="token" value={params.token} />
          <div>
            <label className="label" htmlFor="email">
              Invited email
            </label>
            <input id="email" value={invite!.email} readOnly className="input" />
          </div>
          <div>
            <label className="label" htmlFor="full_name">
              Full name (for new accounts)
            </label>
            <input
              id="full_name"
              name="full_name"
              autoComplete="name"
              className="input"
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Create password (for new accounts)
            </label>
            <input
              id="password"
              name="password"
              type="password"
              minLength={8}
              autoComplete="new-password"
              className="input"
              placeholder="At least 8 characters"
            />
            <p className="hint mt-1">
              If you already have an account, sign in with the invited email first, then reopen this
              link.
            </p>
          </div>
          <SubmitButton className="btn btn-primary w-full" pendingText="Joining...">
            Accept invitation
          </SubmitButton>
        </form>
      ) : (
        <div className="card">
          <p className="text-sm">Ask the owner to create a new invitation.</p>
          <Link href="/login" className="mt-3 inline-block font-medium text-bench underline">
            Sign in
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
