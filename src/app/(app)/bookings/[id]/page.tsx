import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireProfile, canManage } from '@/lib/auth';
import { signedUrls } from '@/lib/storage';
import { competingCount, waitlistRank } from '@/lib/queue';
import { fmtDateTime, fmtRange } from '@/lib/time';
import { ACTION_LABEL } from '@/lib/types';
import {
  cancelBooking,
  checkInBooking,
  confirmReturn,
  decideBooking,
  submitCondition,
} from '@/app/actions/bookings';
import { reportIncident } from '@/app/actions/incidents';
import { UploadForm } from '@/components/UploadForm';
import { SubmitButton } from '@/components/SubmitButton';
import { Flash, StatusBadge, Pill } from '@/components/ui';

function detailText(d: any) {
  if (!d) return '';
  const parts = [d.reason, d.note, d.result, d.description, d.when, d.priority].filter(Boolean);
  if (d.rating) parts.push(`rating ${d.rating}/5`);
  return parts.join(' | ');
}

function ConditionFields({
  phase,
  withDamage,
}: {
  phase: 'before' | 'after';
  withDamage?: boolean;
}) {
  return (
    <>
      <input type="hidden" name="phase" value={phase} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor={`r-${phase}`}>
            Condition (1 poor, 5 perfect)
          </label>
          <select id={`r-${phase}`} name="rating" defaultValue="5" className="input">
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor={`n-${phase}`}>
            Notes
          </label>
          <input
            id={`n-${phase}`}
            name="notes"
            required
            className="input"
            placeholder="Scratches, missing parts, everything fine..."
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`p1-${phase}`}>
            Photo 1 (required)
          </label>
          <input
            id={`p1-${phase}`}
            type="file"
            name="photos"
            accept="image/*"
            capture="environment"
            required
            className="text-sm"
          />
        </div>
        <div>
          <label className="label" htmlFor={`p2-${phase}`}>
            Photo 2 (optional)
          </label>
          <input
            id={`p2-${phase}`}
            type="file"
            name="photos"
            accept="image/*"
            capture="environment"
            className="text-sm"
          />
        </div>
      </div>
      {withDamage && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="damaged" /> Something was damaged or stopped working
        </label>
      )}
    </>
  );
}

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string; msg?: string };
}) {
  const profile = await requireProfile();
  const supabase = createClient();
  const { data: b } = await supabase
    .from('bookings')
    .select('*, resource:resources(*), requester:profiles!user_id(full_name,email,department)')
    .eq('id', params.id)
    .single();
  if (!b) notFound();
  const mine = b.user_id === profile.id;
  const manager = canManage(profile, b.resource);

  const needRank = b.status === 'waitlisted';
  const needCompete = manager && ['pending_review', 'waitlisted'].includes(b.status);
  const [{ data: reports }, { data: incidents }, { data: log }, rank, competing] =
    await Promise.all([
      supabase.from('condition_reports').select('*').eq('booking_id', b.id).order('created_at'),
      supabase.from('incidents').select('*').eq('booking_id', b.id).order('created_at'),
      supabase.from('audit_log').select('*').eq('booking_id', b.id).order('created_at'),
      needRank ? waitlistRank(b) : Promise.resolve(null),
      needCompete ? competingCount(b) : Promise.resolve(0),
    ]);
  const urls = await signedUrls((reports ?? []).flatMap((r: any) => r.photo_paths));
  const before = (reports ?? []).find((r: any) => r.phase === 'before');
  const after = (reports ?? []).find((r: any) => r.phase === 'after');

  const cancellable = ['pending_review', 'approved', 'waitlisted'].includes(b.status);
  const canReportIncident =
    (mine || manager) && ['checked_in', 'overdue', 'returned', 'closed'].includes(b.status);
  const back = `/bookings/${b.id}`;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <div>
          <Link
            href={mine ? '/bookings' : '/staff/requests'}
            className="text-sm text-ink-soft hover:text-ink"
          >
            Back
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1>
              <Link href={`/resources/${b.resource_id}`} className="hover:underline">
                {b.resource.name}
              </Link>
            </h1>
            <StatusBadge status={b.status} />
          </div>
          <p className="mt-1 text-ink-soft">{fmtRange(b.start_at, b.end_at)}</p>
          {!mine && (
            <p className="text-sm text-ink-soft">
              Requested by {b.requester?.full_name} ({b.requester?.department || 'no department'}).
              Purpose: {b.purpose}
            </p>
          )}
          {mine && <p className="text-sm text-ink-soft">Purpose: {b.purpose}</p>}
        </div>
        <Flash sp={searchParams} />

        <div className="card">
          <h2>Why this status</h2>
          <p className="mt-2 text-sm">{b.decision_reason ?? 'No decision yet.'}</p>
          {b.priority_explanation && (
            <p className="mt-3 rounded-md bg-paper px-3 py-2 text-xs text-ink-soft">
              {b.priority_explanation}
            </p>
          )}
          {rank && rank.rank > 0 && (
            <p className="mt-3 text-sm text-steel">
              You are #{rank.rank} of {rank.total} on the waitlist for this slot. Higher priority
              scores move up; if the slot is cancelled the top request goes back to review.
            </p>
          )}
          {competing > 0 && (
            <p className="mt-3 text-sm text-amber2">
              {competing} other request(s) compete for this slot. Compare their priority scores in
              the queue before deciding.
            </p>
          )}
        </div>

        {mine && b.status === 'approved' && b.otp && (
          <div className="card border-bench bg-bench-light">
            <h2>Your check-in code</h2>
            <p className="mt-2 font-mono text-4xl font-medium tracking-[0.3em] text-bench-dark">
              {b.otp}
            </p>
            <p className="mt-2 text-sm text-bench-dark">
              Record the condition below, then show this code to the lab staff at handover.
            </p>
          </div>
        )}

        {manager && ['pending_review', 'waitlisted'].includes(b.status) && (
          <form action={decideBooking} className="card space-y-3">
            <h2>Your decision</h2>
            <input type="hidden" name="id" value={b.id} />
            <div>
              <label className="label" htmlFor="reason">
                Reason (the student will read this)
              </label>
              <textarea
                id="reason"
                name="reason"
                rows={2}
                required
                className="input"
                placeholder="e.g. Fits the project deadline; first request received."
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <SubmitButton name="decision" value="approve" pendingText="Approving...">
                Approve
              </SubmitButton>
              <SubmitButton
                name="decision"
                value="waitlist"
                className="btn"
                pendingText="Moving..."
              >
                Move to waitlist
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
        )}

        {mine && b.status === 'approved' && !before && (
          <UploadForm
            action={submitCondition}
            submitLabel="Save condition before use"
            className="card space-y-3"
          >
            <h2>Step 1: record condition before use</h2>
            <input type="hidden" name="id" value={b.id} />
            <ConditionFields phase="before" />
          </UploadForm>
        )}
        {mine && b.status === 'approved' && before && (
          <div className="card text-sm text-ink-soft">
            Condition before use is recorded. Show your OTP to the lab staff to check in.
          </div>
        )}

        {manager && b.status === 'approved' && (
          <form action={checkInBooking} className="card space-y-3">
            <h2>Check the student in</h2>
            {!before && (
              <p className="text-sm text-amber2">
                Waiting for the student to record the condition before use.
              </p>
            )}
            <input type="hidden" name="id" value={b.id} />
            <div className="flex items-end gap-3">
              <div>
                <label className="label" htmlFor="otp">
                  Student OTP
                </label>
                <input
                  id="otp"
                  name="otp"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  className="input w-40 font-mono tracking-widest"
                />
              </div>
              <SubmitButton>Verify and check in</SubmitButton>
            </div>
          </form>
        )}

        {mine && ['checked_in', 'overdue'].includes(b.status) && (
          <UploadForm
            action={submitCondition}
            submitLabel="Return and save condition"
            className="card space-y-3"
          >
            <h2>Return it: record condition after use</h2>
            {b.status === 'overdue' && (
              <p className="text-sm text-rust">This is overdue. Return it as soon as you can.</p>
            )}
            <input type="hidden" name="id" value={b.id} />
            <ConditionFields phase="after" withDamage />
          </UploadForm>
        )}

        {manager && b.status === 'returned' && (
          <form action={confirmReturn} className="card space-y-3">
            <h2>Confirm the return</h2>
            <p className="text-sm text-ink-soft">
              Compare the before and after photos below, then close the booking. If something is
              wrong, report an incident instead.
            </p>
            <input type="hidden" name="id" value={b.id} />
            <input name="note" className="input" placeholder="Optional note" />
            <SubmitButton>Confirm return and close</SubmitButton>
          </form>
        )}

        {(before || after) && (
          <div className="card">
            <h2>Condition records</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {[before, after].map((r: any, i: number) => (
                <div key={i}>
                  <p className="text-sm font-medium">{i === 0 ? 'Before use' : 'After use'}</p>
                  {r ? (
                    <>
                      <p className="text-sm text-ink-soft">
                        Rating {r.rating}/5. {r.notes}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {r.photo_paths.map((p: string) =>
                          urls[p] ? (
                            <a key={p} href={urls[p]} target="_blank" rel="noreferrer">
                              <img
                                src={urls[p]}
                                alt={`${i === 0 ? 'Before' : 'After'} photo`}
                                className="h-28 w-28 rounded-md border border-paper-line object-cover"
                              />
                            </a>
                          ) : null
                        )}
                        {r.photo_paths.length === 0 && (
                          <p className="text-xs text-ink-mute">No photos (demo data).</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-ink-mute">Not recorded yet.</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {(incidents ?? []).length > 0 && (
          <div className="card">
            <h2>Incidents</h2>
            <ul className="mt-2 space-y-2">
              {(incidents ?? []).map((i: any) => (
                <li key={i.id}>
                  <Link
                    href={`/incidents/${i.id}`}
                    className="flex items-center gap-2 text-sm hover:underline"
                  >
                    <Pill tone={i.status === 'open' ? 'warn' : 'ok'}>{i.status}</Pill> {i.type}:{' '}
                    {i.description.slice(0, 90)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {canReportIncident && (
          <form action={reportIncident} className="card space-y-3">
            <h2>Report a problem</h2>
            <input type="hidden" name="booking_id" value={b.id} />
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="type">
                  Type
                </label>
                <select id="type" name="type" className="input">
                  <option value="damage">Damage</option>
                  <option value="delay">Delay</option>
                  <option value="conflict">Scheduling conflict</option>
                  <option value="misuse">Misuse</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="description">
                  What happened?
                </label>
                <input
                  id="description"
                  name="description"
                  required
                  minLength={10}
                  className="input"
                />
              </div>
            </div>
            <SubmitButton className="btn">Send report</SubmitButton>
          </form>
        )}
      </div>

      <aside className="space-y-5">
        {cancellable && (mine || manager) && (
          <form action={cancelBooking} className="card space-y-3">
            <h2>Cancel booking</h2>
            <input type="hidden" name="id" value={b.id} />
            <input name="reason" className="input" placeholder="Reason (optional)" />
            <SubmitButton className="btn btn-danger">Cancel booking</SubmitButton>
            {b.status === 'approved' && (
              <p className="hint">
                Cancelling frees the slot for the waitlist. Under 2 hours notice is recorded as a
                late cancellation.
              </p>
            )}
          </form>
        )}
        <div className="card">
          <h2>History</h2>
          <p className="hint">Every action is recorded and cannot be edited.</p>
          <ol className="mt-3 space-y-3 border-l border-paper-line pl-4">
            {(log ?? []).map((l: any) => (
              <li key={l.id} className="relative text-sm">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-bench" />
                <p className="font-medium">{ACTION_LABEL[l.action] ?? l.action}</p>
                <p className="text-xs text-ink-mute">
                  {l.actor_name}, {fmtDateTime(l.created_at)}
                </p>
                {detailText(l.details) && (
                  <p className="mt-0.5 text-xs text-ink-soft">{detailText(l.details)}</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>
  );
}
