import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { requestTraining } from '@/app/actions/trainings';
import { SubmitButton } from '@/components/SubmitButton';
import { Empty, Flash, PageBanner, StatusBadge } from '@/components/ui';
import { fmtDateTime } from '@/lib/time';

export default async function TrainingRequests({
  searchParams,
}: {
  searchParams: { error?: string; msg?: string };
}) {
  const profile = await requireProfile(['owner']);
  const supabase = createClient();
  const [{ data: mine }, { data: trainings }] = await Promise.all([
    supabase
      .from('training_requests')
      .select('*')
      .eq('requested_by', profile.id)
      .order('created_at', { ascending: false }),
    supabase.from('trainings').select('name').order('name'),
  ]);
  return (
    <div className="max-w-3xl space-y-5">
      <PageBanner
        title="Request a training"
        subtitle="Sharing something that needs a safety or skill training? Ask the admin to add it. Once approved you can make it required on your listing."
      />
      <Flash sp={searchParams} />
      <form action={requestTraining} className="card space-y-4">
        <h2>New request</h2>
        <div>
          <label className="label" htmlFor="name">
            Training name
          </label>
          <input
            id="name"
            name="name"
            required
            minLength={3}
            className="input"
            placeholder="e.g. Laser cutter safety"
          />
        </div>
        <div>
          <label className="label" htmlFor="reason">
            Which item is it for, and why is it needed?
          </label>
          <textarea
            id="reason"
            name="reason"
            rows={3}
            required
            minLength={10}
            className="input"
            placeholder="e.g. I will share my laser cutter. Users must know the fire and fume rules before using it."
          />
        </div>
        <p className="hint">
          Already available: {(trainings ?? []).map((t: any) => t.name).join(', ') || 'none yet'}.
          Check the list before asking for a new one.
        </p>
        <SubmitButton pendingText="Sending...">Send to admin</SubmitButton>
      </form>
      <section>
        <h2>My requests</h2>
        <div className="mt-3 space-y-3">
          {(mine ?? []).length === 0 && <Empty title="No requests yet" />}
          {(mine ?? []).map((r: any) => (
            <div key={r.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{r.name}</p>
                <StatusBadge status={r.status} />
              </div>
              <p className="mt-1 text-sm text-ink-soft">{r.reason}</p>
              <p className="mt-1 text-xs text-ink-mute">
                Sent {fmtDateTime(r.created_at)}
                {r.review_note ? `. Admin note: ${r.review_note}` : ''}
              </p>
              {r.status === 'approved' && (
                <Link
                  href="/staff/resources/new"
                  className="mt-2 inline-block text-sm text-bench underline"
                >
                  List a resource that needs it
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
