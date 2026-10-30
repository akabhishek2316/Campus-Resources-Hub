import Link from 'next/link';
import { PageBanner } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { signedUrls } from '@/lib/storage';
import { addTraining, reviewApplication, reviewCredential } from '@/app/actions/admin';
import { reviewTrainingRequest } from '@/app/actions/trainings';
import { SubmitButton } from '@/components/SubmitButton';
import { AdminTabs } from '@/components/AdminTabs';
import { roleLabel } from '@/lib/applications';
import { fmtDateTime } from '@/lib/time';
import { Flash, Pill } from '@/components/ui';

export default async function Admin({
  searchParams,
}: {
  searchParams: { error?: string; msg?: string };
}) {
  await requireProfile(['admin']);
  const supabase = createClient();
  const [{ data: pending }, { data: applicants }, { data: trainingReqs }] = await Promise.all([
    supabase
      .from('user_credentials')
      .select('*, trainings(name), user:profiles!user_id(full_name,email)')
      .eq('status', 'pending')
      .order('created_at'),
    supabase.from('profiles').select('*').eq('application_status', 'pending').order('created_at'),
    supabase
      .from('training_requests')
      .select('*, owner:profiles!requested_by(full_name,email)')
      .eq('status', 'pending')
      .order('created_at'),
  ]);
  const apps = applicants ?? [];
  const urls = await signedUrls(
    [
      ...(pending ?? []).map((c: any) => c.proof_path),
      ...apps.flatMap((u: any) => [u.cv_path, u.id_doc_path, u.college_id_doc_path]),
    ].filter(Boolean)
  );
  return (
    <div className="space-y-8">
      <PageBanner
        title="Administration"
        subtitle="Verify people, review training proof and manage accounts. Every change is written to the audit log."
      />
      <AdminTabs pending={apps.length} />
      <Flash sp={searchParams} />
      {searchParams.msg?.includes('approved') && (
        <p className="-mt-2 text-sm text-ink-soft">
          Approved people now appear under{' '}
          <Link href="/admin/users" className="font-medium text-bench underline">
            All users
          </Link>
          , where you can view profiles and manage accounts.
        </p>
      )}

      <section>
        <h2>Registration requests ({apps.length})</h2>
        <p className="hint">
          Check the documents, then approve to grant the role, or reject with a reason the person
          will read.
        </p>
        <div className="mt-3 space-y-3">
          {apps.length === 0 && (
            <div className="card text-sm text-ink-soft">No registrations waiting.</div>
          )}
          {apps.map((u: any) => {
            const staffReq = u.requested_role !== 'student';
            const ownerTypeLabel =
              (
                {
                  college_staff: 'College staff',
                  organization: 'Organisation / business',
                  individual: 'Individual',
                } as Record<string, string>
              )[u.owner_type] || 'Not specified';
            return (
              <form key={u.id} action={reviewApplication} className="card space-y-3">
                <input type="hidden" name="id" value={u.id} />
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {u.full_name} <span className="font-normal text-ink-mute">({u.email})</span>
                    </p>
                    <p className="text-sm text-ink-soft">
                      {u.department || 'No department'}, registered {fmtDateTime(u.created_at)}
                    </p>
                  </div>
                  <Pill tone={staffReq ? 'warn' : 'info'}>
                    Wants: {roleLabel(u.requested_role, u.owner_type)}
                  </Pill>
                </div>
                {staffReq ? (
                  <div className="rounded-lg bg-paper p-3 text-sm">
                    <p>
                      <b>Owner type:</b> {ownerTypeLabel}
                    </p>
                    {u.owner_type === 'college_staff' && (
                      <p>
                        <b>Job title:</b> {u.designation || '—'}. <b>Staff ID:</b>{' '}
                        {u.employee_id || '—'}
                      </p>
                    )}
                    {u.organization_name && (
                      <p>
                        <b>Organisation / business:</b> {u.organization_name}
                      </p>
                    )}
                    {u.owner_address && (
                      <p>
                        <b>Address:</b> {u.owner_address}
                      </p>
                    )}
                    {(u.resource_share_list || u.application_note) && (
                      <p className="mt-1 text-ink-soft">
                        <b>Resources / notes:</b> {u.resource_share_list || u.application_note}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3">
                      {u.owner_type !== 'individual' &&
                        (urls[u.cv_path] ? (
                          <a
                            href={urls[u.cv_path]}
                            target="_blank"
                            rel="noreferrer"
                            className="text-bench underline"
                          >
                            {u.owner_type === 'college_staff'
                              ? 'Open appointment letter'
                              : 'Open registration proof'}
                          </a>
                        ) : (
                          <span className="text-rust">
                            No{' '}
                            {u.owner_type === 'college_staff'
                              ? 'appointment letter'
                              : 'registration proof'}{' '}
                            uploaded
                          </span>
                        ))}
                      {urls[u.id_doc_path] ? (
                        <a
                          href={urls[u.id_doc_path]}
                          target="_blank"
                          rel="noreferrer"
                          className="text-bench underline"
                        >
                          {u.owner_type === 'college_staff'
                            ? 'Open staff ID card'
                            : 'Open owner photo ID'}
                        </a>
                      ) : (
                        <span className="text-rust">No ID document uploaded</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-paper p-3 text-sm space-y-2">
                    <p>
                      <b>College ID number:</b> {u.college_id || 'not given'}. Check it against the
                      college records.
                    </p>
                    {urls[u.college_id_doc_path] ? (
                      <a
                        href={urls[u.college_id_doc_path]}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-bench underline"
                      >
                        Open uploaded college ID card
                      </a>
                    ) : (
                      <span className="block text-rust">No college ID card uploaded</span>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap items-end gap-3">
                  <input
                    name="note"
                    className="input min-w-[220px] flex-1"
                    placeholder="Note (required if rejecting)"
                  />
                  <SubmitButton name="decision" value="approve" pendingText="Approving...">
                    {staffReq
                      ? `Approve as ${roleLabel(u.requested_role, u.owner_type)}`
                      : 'Verify student'}
                  </SubmitButton>
                  <SubmitButton
                    name="decision"
                    value="reject"
                    className="btn btn-danger"
                    pendingText="Rejecting..."
                  >
                    Reject
                  </SubmitButton>
                </div>
              </form>
            );
          })}
        </div>
      </section>

      <section>
        <h2>Training requests from owners ({(trainingReqs ?? []).length})</h2>
        <p className="hint">
          An owner wants to share an item that needs a training that does not exist yet. Approve to
          add it to the list, or reject with a reason.
        </p>
        <div className="mt-3 space-y-3">
          {(trainingReqs ?? []).length === 0 && (
            <div className="card text-sm text-ink-soft">No training requests waiting.</div>
          )}
          {(trainingReqs ?? []).map((t: any) => (
            <form key={t.id} action={reviewTrainingRequest} className="card space-y-3">
              <input type="hidden" name="id" value={t.id} />
              <div>
                <p className="font-medium">
                  {t.owner?.full_name}{' '}
                  <span className="font-normal text-ink-mute">({t.owner?.email})</span>
                </p>
                <p className="text-sm text-ink-soft">{t.reason}</p>
                <p className="text-xs text-ink-mute">Sent {fmtDateTime(t.created_at)}</p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="label" htmlFor={`tn-${t.id}`}>
                    Training name (you may edit)
                  </label>
                  <input
                    id={`tn-${t.id}`}
                    name="name"
                    defaultValue={t.name}
                    className="input w-64"
                  />
                </div>
                <input
                  name="note"
                  className="input min-w-[200px] flex-1"
                  placeholder="Note (required if rejecting)"
                />
                <SubmitButton name="decision" value="approve" pendingText="Approving...">
                  Approve and add
                </SubmitButton>
                <SubmitButton
                  name="decision"
                  value="reject"
                  className="btn btn-danger"
                  pendingText="Rejecting..."
                >
                  Reject
                </SubmitButton>
              </div>
            </form>
          ))}
        </div>
      </section>

      <section>
        <h2>Training proofs to review ({(pending ?? []).length})</h2>
        <div className="mt-3 space-y-3">
          {(pending ?? []).length === 0 && (
            <div className="card text-sm text-ink-soft">No proofs waiting.</div>
          )}
          {(pending ?? []).map((c: any) => (
            <form
              key={c.id}
              action={reviewCredential}
              className="card flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="id" value={c.id} />
              <div className="min-w-[220px] flex-1">
                <p className="font-medium">
                  {c.user?.full_name}{' '}
                  <span className="text-ink-mute font-normal">({c.user?.email})</span>
                </p>
                <p className="text-sm text-ink-soft">
                  {c.trainings?.name}, uploaded {fmtDateTime(c.created_at)}
                </p>
                {urls[c.proof_path] && (
                  <a
                    href={urls[c.proof_path]}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-bench underline"
                  >
                    Open the proof
                  </a>
                )}
              </div>
              <input
                name="note"
                className="input w-64"
                placeholder="Note (required if rejecting)"
              />
              <SubmitButton name="decision" value="approve" pendingText="Approving...">
                Approve
              </SubmitButton>
              <SubmitButton
                name="decision"
                value="reject"
                className="btn btn-danger"
                pendingText="Rejecting..."
              >
                Reject
              </SubmitButton>
            </form>
          ))}
        </div>
      </section>

      <section>
        <h2>Add a training</h2>
        <form action={addTraining} className="mt-3 flex max-w-md gap-3">
          <input name="name" required className="input" placeholder="e.g. Laser cutter safety" />
          <SubmitButton pendingText="Adding...">Add</SubmitButton>
        </form>
      </section>
    </div>
  );
}
