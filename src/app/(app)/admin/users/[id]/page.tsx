import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile } from '@/lib/auth';
import { signedUrls } from '@/lib/storage';
import {
  deactivateUser,
  liftSuspension,
  reactivateUser,
  setRole,
  setVerified,
} from '@/app/actions/admin';
import { SubmitButton } from '@/components/SubmitButton';
import { AdminTabs } from '@/components/AdminTabs';
import { Flash, RoleTag, StatusBadge, UserTags } from '@/components/ui';
import { fmtDateTime } from '@/lib/time';
import { ACTION_LABEL } from '@/lib/types';
import { OWNER_TYPE_LABEL, roleLabel } from '@/lib/applications';

const OWNER_TYPE: Record<string, string> = {
  college_staff: 'College staff',
  organization: 'Organisation or business',
  individual: 'Individual',
};

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[170px_1fr]">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

export default async function UserProfile({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string; msg?: string };
}) {
  const me = await requireProfile(['admin']);
  const admin = createAdminClient();
  const id = params.id;
  const [
    { data: u },
    { data: bookings },
    { data: incidents },
    { data: owned },
    { data: links },
    { data: myOwner },
    { data: log },
    { data: creds },
  ] = await Promise.all([
    admin.from('profiles').select('*').eq('id', id).maybeSingle(),
    admin
      .from('bookings')
      .select('id,status,start_at,end_at,resource:resources(name)')
      .eq('user_id', id)
      .order('start_at', { ascending: false }),
    admin
      .from('incidents')
      .select('id,type,status,description,created_at,booking:bookings!inner(user_id)')
      .eq('booking.user_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
    admin.from('resources').select('id,name,category,active').eq('owner_id', id).order('name'),
    admin
      .from('owner_managers')
      .select(
        'manager_id,permissions,manager:profiles!owner_managers_manager_id_fkey(full_name,email)'
      )
      .eq('owner_id', id)
      .is('revoked_at', null),
    admin
      .from('owner_managers')
      .select(
        'permissions,owner:profiles!owner_managers_owner_id_fkey(id,full_name,email,owner_type)'
      )
      .eq('manager_id', id)
      .is('revoked_at', null)
      .maybeSingle(),
    admin
      .from('audit_log')
      .select('*')
      .or(`actor_id.eq.${id},entity_id.eq.${id}`)
      .order('id', { ascending: false })
      .limit(15),
    admin
      .from('user_credentials')
      .select('status,proof_path,review_note,trainings(name)')
      .eq('user_id', id),
  ]);
  if (!u) notFound();

  const urls = await signedUrls(
    [
      u.college_id_doc_path,
      u.cv_path,
      u.id_doc_path,
      ...(creds ?? []).map((c: any) => c.proof_path),
    ].filter(Boolean)
  );
  const docs: [string, string | null][] = [];
  if (u.college_id_doc_path) docs.push(['College ID card', u.college_id_doc_path]);
  if (u.owner_type === 'college_staff') {
    docs.push(['Appointment letter', u.cv_path], ['Staff ID card', u.id_doc_path]);
  } else if (u.owner_type === 'organization') {
    docs.push(['Registration proof', u.cv_path], ['Owner photo ID', u.id_doc_path]);
  } else if (u.owner_type === 'individual') docs.push(['Photo ID', u.id_doc_path]);
  else {
    if (u.cv_path) docs.push(['Resume or CV', u.cv_path]);
    if (u.id_doc_path) docs.push(['ID document', u.id_doc_path]);
  }

  const byStatus = new Map<string, number>();
  (bookings ?? []).forEach((b: any) => byStatus.set(b.status, (byStatus.get(b.status) ?? 0) + 1));
  const isSelf = u.id === me.id;
  const locked = isSelf || u.role === 'admin';
  const suspended = u.suspended_until && new Date(u.suspended_until) > new Date();
  const back = `/admin/users/${u.id}`;
  const initials = u.full_name
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div>
      <AdminTabs />
      <Link href="/admin/users" className="text-sm text-ink-soft hover:text-ink">
        Back to all users
      </Link>
      <div className="card mt-2 flex flex-wrap items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-bench text-lg font-semibold text-white">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="!text-2xl">
            {u.full_name}
            {isSelf ? ' (you)' : ''}
          </h1>
          <p className="text-sm text-ink-soft">{u.email}</p>
          <div className="mt-2">
            <UserTags u={u} />
          </div>
        </div>
      </div>
      <div className="mt-4">
        <Flash sp={searchParams} />
      </div>

      {u.is_active === false && (
        <div className="mb-4 rounded-lg border border-rust bg-rust-light px-4 py-3 text-sm text-rust">
          Deactivated {u.deactivated_at ? fmtDateTime(u.deactivated_at) : ''}. Reason:{' '}
          {u.deactivation_reason || 'not recorded'}. This person cannot sign in.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="card">
            <h2>Identity and contact</h2>
            <dl className="mt-2 divide-y divide-paper-line">
              <Row label="Full name" value={u.full_name} />
              <Row label="Email" value={u.email} />
              <Row label="Department" value={u.department} />
              <Row label="College ID number" value={u.college_id} />
              <Row label="Joined" value={fmtDateTime(u.created_at)} />
            </dl>
          </section>

          {(u.owner_type || u.requested_role || docs.length > 0) && (
            <section className="card">
              <h2>Verification details</h2>
              <dl className="mt-2 divide-y divide-paper-line">
                <Row label="Current role" value={roleLabel(u.role, u.owner_type)} />
                <Row
                  label="Requested role"
                  value={u.requested_role ? roleLabel(u.requested_role, u.owner_type) : null}
                />
                <Row
                  label="Application status"
                  value={
                    u.application_status !== 'none' ? (
                      <span className="capitalize">{u.application_status}</span>
                    ) : null
                  }
                />
                <Row label="Owner type" value={OWNER_TYPE_LABEL[u.owner_type]} />
                <Row label="Organisation" value={u.organization_name} />
                <Row label="Job title" value={u.designation} />
                <Row label="Staff ID" value={u.employee_id} />
                <Row label="Address" value={u.owner_address} />
                <Row label="Wants to share" value={u.resource_share_list || u.application_note} />
                <Row label="Review note" value={u.application_review_note} />
                <Row
                  label="Reviewed"
                  value={u.application_reviewed_at ? fmtDateTime(u.application_reviewed_at) : null}
                />
              </dl>
              {docs.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-3 border-t border-paper-line pt-3">
                  {docs.map(([label, path]) =>
                    path && urls[path] ? (
                      <a
                        key={label}
                        href={urls[path]}
                        target="_blank"
                        rel="noreferrer"
                        className="btn py-1.5"
                      >
                        Open {label}
                      </a>
                    ) : (
                      <span
                        key={label}
                        className="rounded-md bg-rust-light px-2 py-1 text-xs text-rust"
                      >
                        {label}: not uploaded
                      </span>
                    )
                  )}
                </div>
              )}
            </section>
          )}

          {(creds ?? []).length > 0 && (
            <section className="card">
              <h2>Training certificates</h2>
              <ul className="mt-2 divide-y divide-paper-line">
                {(creds ?? []).map((c: any, i: number) => (
                  <li
                    key={i}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  >
                    <span>{c.trainings?.name}</span>
                    <span className="flex items-center gap-3">
                      <StatusBadge status={c.status} />
                      {c.proof_path && urls[c.proof_path] && (
                        <a
                          href={urls[c.proof_path]}
                          target="_blank"
                          rel="noreferrer"
                          className="text-bench underline"
                        >
                          Open proof
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {u.role === 'owner' && (
            <section className="card">
              <h2>
                Listings and team{' '}
                <span className="ml-2 align-middle">
                  <RoleTag role="owner" ownerType={u.owner_type} />
                </span>
              </h2>
              <p className="mt-2 text-sm font-medium">Resources ({(owned ?? []).length})</p>
              {(owned ?? []).length === 0 ? (
                <p className="text-sm text-ink-soft">Nothing listed yet.</p>
              ) : (
                <ul className="mt-1 space-y-1 text-sm">
                  {(owned ?? []).map((r: any) => (
                    <li key={r.id}>
                      <Link href={`/resources/${r.id}`} className="text-bench hover:underline">
                        {r.name}
                      </Link>{' '}
                      <span className="text-ink-mute">
                        ({r.category}){r.active ? '' : ', hidden'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-sm font-medium">Managers ({(links ?? []).length})</p>
              {(links ?? []).length === 0 ? (
                <p className="text-sm text-ink-soft">No managers. The owner handles everything.</p>
              ) : (
                <ul className="mt-1 space-y-1 text-sm">
                  {(links ?? []).map((l: any) => (
                    <li key={l.manager_id}>
                      <Link
                        href={`/admin/users/${l.manager_id}`}
                        className="text-bench hover:underline"
                      >
                        {l.manager?.full_name}
                      </Link>{' '}
                      <span className="text-ink-mute">{l.manager?.email}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {u.role === 'manager' && (
            <section className="card">
              <h2>Works for</h2>
              {myOwner ? (
                <p className="mt-2 text-sm">
                  <Link
                    href={`/admin/users/${(myOwner as any).owner?.id}`}
                    className="font-medium text-bench hover:underline"
                  >
                    {(myOwner as any).owner?.full_name}
                  </Link>{' '}
                  <span className="text-ink-mute">({(myOwner as any).owner?.email})</span>{' '}
                  <RoleTag role="owner" ownerType={(myOwner as any).owner?.owner_type} />
                </p>
              ) : (
                <p className="mt-2 text-sm text-ink-soft">Not assigned to any owner right now.</p>
              )}
              {myOwner && (
                <p className="mt-2 text-xs text-ink-soft">
                  Permissions:{' '}
                  {Object.entries((myOwner as any).permissions ?? {})
                    .filter(([, v]) => v)
                    .map(([k]) => k.replace(/_/g, ' '))
                    .join(', ') || 'none'}
                </p>
              )}
            </section>
          )}

          <section className="card">
            <h2>Bookings ({(bookings ?? []).length})</h2>
            {(bookings ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">No bookings yet.</p>
            ) : (
              <>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[...byStatus.entries()].map(([s, n]) => (
                    <span key={s} className="flex items-center gap-1.5 text-sm">
                      <StatusBadge status={s} /> {n}
                    </span>
                  ))}
                </div>
                <ul className="mt-3 divide-y divide-paper-line">
                  {(bookings ?? []).slice(0, 6).map((b: any) => (
                    <li
                      key={b.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                    >
                      <Link href={`/bookings/${b.id}`} className="hover:text-bench hover:underline">
                        {b.resource?.name}{' '}
                        <span className="text-ink-mute">{fmtDateTime(b.start_at)}</span>
                      </Link>
                      <StatusBadge status={b.status} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {(incidents ?? []).length > 0 && (
            <section className="card">
              <h2>Incidents on their bookings</h2>
              <ul className="mt-2 divide-y divide-paper-line">
                {(incidents ?? []).map((i: any) => (
                  <li key={i.id} className="py-2 text-sm">
                    <Link
                      href={`/incidents/${i.id}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <StatusBadge status={i.status} />
                      <span className="capitalize">{i.type}</span>
                      <span className="truncate text-ink-soft">{i.description}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-5">
          <section className="card">
            <h2>Account actions</h2>
            {locked ? (
              <p className="mt-2 text-sm text-ink-soft">
                {isSelf
                  ? 'This is your own account. Role and status cannot be changed here.'
                  : 'Admin accounts are managed by the platform operator.'}
              </p>
            ) : (
              <div className="mt-3 space-y-4">
                <form action={setVerified} className="flex items-center justify-between gap-3">
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="back" value={back} />
                  <input type="hidden" name="verified" value={String(!u.verified)} />
                  <span className="text-sm">
                    {u.verified ? 'Verified person' : 'Not verified yet'}
                  </span>
                  <SubmitButton className="btn py-1" pendingText="Saving...">
                    {u.verified ? 'Remove verification' : 'Verify'}
                  </SubmitButton>
                </form>

                {(u.role === 'student' || u.role === 'owner') && (
                  <form action={setRole} className="space-y-2 border-t border-paper-line pt-3">
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="back" value={back} />
                    <label className="label" htmlFor="role">
                      Role
                    </label>
                    <div className="flex gap-2">
                      <select id="role" name="role" defaultValue={u.role} className="input">
                        <option value="student">Student</option>
                        <option value="owner">Owner</option>
                      </select>
                      <SubmitButton className="btn" pendingText="Saving...">
                        Save
                      </SubmitButton>
                    </div>
                  </form>
                )}
                {u.role === 'manager' && (
                  <p className="border-t border-paper-line pt-3 text-xs text-ink-soft">
                    Managers join through an owner invitation and are removed by that owner, or by
                    deactivating the account.
                  </p>
                )}

                {suspended && (
                  <form
                    action={liftSuspension}
                    className="space-y-2 border-t border-paper-line pt-3"
                  >
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="back" value={back} />
                    <p className="text-sm text-rust">
                      Booking suspended until {fmtDateTime(u.suspended_until)}.
                    </p>
                    <SubmitButton className="btn py-1" pendingText="Lifting...">
                      Lift suspension
                    </SubmitButton>
                  </form>
                )}

                {u.is_active === false ? (
                  <form action={reactivateUser} className="border-t border-paper-line pt-3">
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="back" value={back} />
                    <SubmitButton className="btn btn-primary w-full" pendingText="Reactivating...">
                      Reactivate account
                    </SubmitButton>
                  </form>
                ) : (
                  <form
                    action={deactivateUser}
                    className="space-y-2 border-t border-paper-line pt-3"
                  >
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="back" value={back} />
                    <label className="label" htmlFor="reason">
                      Deactivate account
                    </label>
                    <input
                      id="reason"
                      name="reason"
                      required
                      minLength={5}
                      className="input"
                      placeholder="Reason (saved in the audit log)"
                    />
                    <p className="hint">
                      Blocks sign-in, cancels open bookings, hides an owner&apos;s listings and ends
                      manager links.
                    </p>
                    <SubmitButton className="btn btn-danger w-full" pendingText="Deactivating...">
                      Deactivate
                    </SubmitButton>
                  </form>
                )}
              </div>
            )}
          </section>

          <section className="card">
            <h2>Recent activity</h2>
            {(log ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">Nothing recorded yet.</p>
            ) : (
              <ol className="mt-3 space-y-3 border-l border-paper-line pl-4">
                {(log ?? []).map((l: any) => (
                  <li key={l.id} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-bench" />
                    <p className="font-medium">{ACTION_LABEL[l.action] ?? l.action}</p>
                    <p className="text-xs text-ink-mute">
                      {l.actor_name}, {fmtDateTime(l.created_at)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
