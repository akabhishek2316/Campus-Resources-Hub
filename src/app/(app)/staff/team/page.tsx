import { requireProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { Flash, PageBanner } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { fmtDateTime } from '@/lib/time';
import { createManagerInvite, revokeManager } from '@/app/actions/managers';

export default async function TeamManagement({
  searchParams,
}: {
  searchParams: { error?: string; msg?: string; invite?: string };
}) {
  const owner = await requireProfile(['owner']);
  const admin = createAdminClient();
  const [{ data: links }, { data: invitations }] = await Promise.all([
    admin
      .from('owner_managers')
      .select(
        'manager_id,created_at,permissions,manager:profiles!owner_managers_manager_id_fkey(id,full_name,email)'
      )
      .eq('owner_id', owner.id)
      .is('revoked_at', null)
      .order('created_at', { ascending: false }),
    admin
      .from('manager_invitations')
      .select('id,email,created_at,expires_at,accepted_at,revoked_at')
      .eq('owner_id', owner.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  return (
    <div className="max-w-3xl space-y-5">
      <PageBanner
        title="Team management"
        subtitle="Invite managers to help with your resources. You can also manage everything yourself."
      />
      <Flash sp={searchParams} />
      {searchParams.invite && (
        <div className="card border-bench space-y-2">
          <h2 className="font-semibold">Invitation link — share privately</h2>
          <p className="text-sm text-ink-soft">This link expires in 7 days and can be used once.</p>
          <input readOnly value={searchParams.invite} className="input" />
          <p className="text-xs text-ink-soft">
            Copy this link and send it only to the intended manager. Do not post it publicly.
          </p>
        </div>
      )}
      <form action={createManagerInvite} className="card space-y-4">
        <h2 className="font-semibold">Invite a manager</h2>
        <div>
          <label className="label" htmlFor="email">
            Manager email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="input"
            placeholder="manager@college.edu"
          />
        </div>
        <fieldset className="space-y-3">
          <legend className="label mb-2">Permissions</legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="booking_requests" defaultChecked className="mt-1" />
            <span>
              <b>Booking requests</b>
              <span className="block text-ink-soft">
                Review requests for resources assigned to them.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="check_in_out" defaultChecked className="mt-1" />
            <span>
              <b>Check-in and returns</b>
              <span className="block text-ink-soft">Help with handovers and return checks.</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="incidents" defaultChecked className="mt-1" />
            <span>
              <b>Incidents</b>
              <span className="block text-ink-soft">
                View and report issues for assigned resources.
              </span>
            </span>
          </label>
        </fieldset>
        <SubmitButton pendingText="Creating link...">Create invitation link</SubmitButton>
      </form>
      <section className="card space-y-3">
        <h2 className="font-semibold">Active managers ({links?.length ?? 0})</h2>
        {!links?.length && (
          <p className="text-sm text-ink-soft">
            No managers assigned. You currently manage your resources yourself.
          </p>
        )}
        {(links ?? []).map((row: any) => (
          <div
            key={row.manager_id}
            className="flex flex-wrap items-center justify-between gap-3 border-t border-paper-line pt-3"
          >
            <div>
              <p className="font-medium">{row.manager?.full_name ?? 'Manager'}</p>
              <p className="text-sm text-ink-soft">{row.manager?.email}</p>
              <p className="mt-1 text-xs text-ink-soft">Assigned {fmtDateTime(row.created_at)}</p>
            </div>
            <form action={revokeManager}>
              <input type="hidden" name="manager_id" value={row.manager_id} />
              <SubmitButton className="btn btn-danger" pendingText="Revoking...">
                Revoke access
              </SubmitButton>
            </form>
          </div>
        ))}
      </section>
      <section className="card space-y-3">
        <h2 className="font-semibold">Recent invitations</h2>
        {!invitations?.length && <p className="text-sm text-ink-soft">No invitations yet.</p>}
        {(invitations ?? []).map((invite: any) => (
          <div
            key={invite.id}
            className="flex flex-wrap items-center justify-between gap-2 border-t border-paper-line pt-3"
          >
            <div>
              <p className="text-sm font-medium">{invite.email}</p>
              <p className="text-xs text-ink-soft">
                {invite.accepted_at
                  ? 'Accepted'
                  : invite.revoked_at
                    ? 'Revoked'
                    : new Date(invite.expires_at) < new Date()
                      ? 'Expired'
                      : 'Pending'}{' '}
                · expires {fmtDateTime(invite.expires_at)}
              </p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
