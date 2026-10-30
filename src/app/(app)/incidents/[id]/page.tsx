import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireProfile, canManage } from '@/lib/auth';
import { resolveIncident, summarizeIncidentAction } from '@/app/actions/incidents';
import { SubmitButton } from '@/components/SubmitButton';
import { Flash, Pill } from '@/components/ui';
import { fmtDateTime } from '@/lib/time';

export default async function IncidentPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string; msg?: string };
}) {
  const profile = await requireProfile();
  const supabase = createClient();
  const { data: i } = await supabase
    .from('incidents')
    .select(
      '*, booking:bookings(*, resource:resources(*), user:profiles!user_id(full_name,warnings))'
    )
    .eq('id', params.id)
    .single();
  if (!i) notFound();
  const manager = canManage(profile, i.booking.resource);
  const labels: Record<string, string> = {
    no_action: 'No action',
    warning: 'Warning recorded',
    suspension: 'Booking suspended for 7 days',
  };
  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href="/incidents" className="text-sm text-ink-soft hover:text-ink">
          Back to incidents
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1>{i.booking.resource.name}</h1>
          <Pill tone={i.status === 'open' ? 'warn' : 'ok'}>{i.status}</Pill>
          <Pill tone="plain">{i.type}</Pill>
          {i.auto_flagged && <Pill tone="info">Auto-flagged</Pill>}
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          Booking by {i.booking.user?.full_name}, reported {fmtDateTime(i.created_at)}.{' '}
          <Link href={`/bookings/${i.booking_id}`} className="text-bench underline">
            Open booking and photos
          </Link>
        </p>
      </div>
      <Flash sp={searchParams} />
      <div className="card">
        <h2>What was reported</h2>
        <p className="mt-2 text-sm">{i.description}</p>
      </div>

      {i.ai_summary && (
        <div className="card">
          <h2>Summary for the reviewer</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">{i.ai_summary}</p>
          <p className="hint mt-2">
            Generated automatically. It describes the facts only and does not decide fault or
            penalty.
          </p>
        </div>
      )}
      {manager && i.status === 'open' && (
        <form action={summarizeIncidentAction}>
          <input type="hidden" name="id" value={i.id} />
          <SubmitButton className="btn">
            {i.ai_summary ? 'Refresh summary' : 'Summarise the evidence'}
          </SubmitButton>
        </form>
      )}

      {i.status === 'resolved' ? (
        <div className="card border-bench">
          <h2>Outcome: {labels[i.resolution]}</h2>
          <p className="mt-2 text-sm">{i.resolution_note}</p>
          <p className="hint mt-2">Decided by a staff member on {fmtDateTime(i.resolved_at)}.</p>
        </div>
      ) : manager ? (
        <form action={resolveIncident} className="card space-y-3">
          <h2>Your decision</h2>
          <p className="text-sm text-ink-soft">
            Check the before and after photos first. {i.booking.user?.full_name} has{' '}
            {i.booking.user?.warnings} earlier warning(s).
          </p>
          <input type="hidden" name="id" value={i.id} />
          <div>
            <label className="label" htmlFor="resolution">
              Outcome
            </label>
            <select id="resolution" name="resolution" className="input">
              <option value="no_action">No action</option>
              <option value="warning">Record a warning</option>
              <option value="suspension">Suspend booking for 7 days</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="note">
              Explanation (both parties will see this)
            </label>
            <textarea id="note" name="note" rows={3} required className="input" />
          </div>
          <SubmitButton>Resolve incident</SubmitButton>
        </form>
      ) : (
        <div className="card text-sm text-ink-soft">
          A staff member is reviewing this. You will be notified of the outcome.
        </div>
      )}
    </div>
  );
}
