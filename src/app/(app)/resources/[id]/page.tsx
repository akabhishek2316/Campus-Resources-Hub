import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile, canManage } from '@/lib/auth';
import { requestBooking } from '@/app/actions/bookings';
import { SubmitButton } from '@/components/SubmitButton';
import { Flash, Pill, RoleTag } from '@/components/ui';
import { categoryStyle } from '@/lib/brand';
import { fmtRange, summarizeWindows, todayLocalStr, TZ_LABEL } from '@/lib/time';
import { weeklyHoursUsed } from '@/lib/fairness';

export default async function ResourcePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string; msg?: string };
}) {
  const profile = await requireProfile();
  const supabase = createClient();
  const admin = createAdminClient();
  // All four queries only need the id from the URL, so they run at the same time.
  const [{ data: r }, { data: creds }, { data: mine }, { data: booked }] = await Promise.all([
    supabase
      .from('resources')
      .select(
        '*, resource_requirements(training_id, trainings(name)), availability_windows(*), owner:profiles!owner_id(full_name,owner_type,organization_name), manager:profiles!manager_id(full_name)'
      )
      .eq('id', params.id)
      .single(),
    supabase.from('user_credentials').select('training_id,status').eq('user_id', profile.id),
    supabase.from('bookings').select('*').eq('user_id', profile.id),
    admin
      .from('bookings')
      .select('start_at,end_at,status')
      .eq('resource_id', params.id)
      .in('status', ['approved', 'checked_in', 'overdue'])
      .gt('end_at', new Date().toISOString())
      .order('start_at')
      .limit(8),
  ]);
  if (!r) notFound();
  const credStatus = new Map((creds ?? []).map((c: any) => [c.training_id, c.status]));
  const used = weeklyHoursUsed(mine ?? [], r.id, new Date());

  const reqRows = (r.resource_requirements ?? []).map((q: any) => ({
    name: q.trainings?.name,
    status: credStatus.get(q.training_id) ?? 'none',
  }));
  const eligible = profile.verified && reqRows.every((x: any) => x.status === 'approved');
  const openHours = new Set<number>();
  r.availability_windows.forEach((w: any) => {
    for (let h = w.start_hour; h < w.end_hour; h++) openHours.add(h);
  });
  const hours = [...openHours].sort((a, b) => a - b);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <div>
          <Link href="/resources" className="text-sm text-ink-soft hover:text-ink">
            Back to resources
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1>{r.name}</h1>
            <span className={`badge ${categoryStyle(r.category).chip}`}>{r.category}</span>
            {!r.active && <Pill tone="bad">Hidden</Pill>}
          </div>
          <p className="mt-1 text-ink-soft">
            {r.location}. Listed by{' '}
            {r.owner?.organization_name
              ? `${r.owner.organization_name} (${r.owner.full_name})`
              : r.owner?.full_name}{' '}
            <RoleTag role="owner" ownerType={r.owner?.owner_type} />
            {r.manager ? ` Manager: ${r.manager.full_name}` : ''}
          </p>
        </div>
        <Flash sp={searchParams} />
        <div className="card">
          <h2>About</h2>
          <p className="mt-2 text-sm text-ink-soft whitespace-pre-line">{r.description}</p>
          <h2 className="mt-5">Usage rules</h2>
          <p className="mt-2 text-sm text-ink-soft whitespace-pre-line">
            {r.rules || 'No special rules.'}
          </p>
          {r.deposit_note && (
            <p className="mt-4 rounded-md bg-amber2-light px-3 py-2 text-sm text-amber2">
              Deposit: {r.deposit_note}
            </p>
          )}
        </div>
        <div className="card">
          <h2>Can you book this?</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-center gap-2">
              {profile.verified ? <Pill tone="ok">Done</Pill> : <Pill tone="bad">Missing</Pill>}{' '}
              College ID verified by an admin
            </li>
            {reqRows.map((x: any) => (
              <li key={x.name} className="flex items-center gap-2">
                {x.status === 'approved' ? (
                  <Pill tone="ok">Done</Pill>
                ) : x.status === 'pending' ? (
                  <Pill tone="warn">In review</Pill>
                ) : (
                  <Pill tone="bad">{x.status === 'rejected' ? 'Rejected' : 'Missing'}</Pill>
                )}
                Training: {x.name}
                {x.status !== 'approved' && x.status !== 'pending' && (
                  <Link href="/credentials" className="text-bench underline">
                    Upload proof
                  </Link>
                )}
              </li>
            ))}
            <li className="flex items-center gap-2">
              <Pill tone="info">{r.requires_approval ? 'Manual' : 'Automatic'}</Pill>{' '}
              {r.requires_approval
                ? 'The owner or technician reviews each request'
                : 'Approved instantly if every check passes'}
            </li>
          </ul>
        </div>
        <div className="card">
          <h2>Fair-use limits</h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-ink-soft">
            <li>
              Up to {r.max_hours_per_booking}h per booking, {r.weekly_cap_hours}h per week. You have
              used {used}h this week.
            </li>
            <li>At most {r.max_active_bookings} active bookings on this resource at a time.</li>
            {r.high_demand && <li>High demand: one booking per person per day.</li>}
            <li>
              If two people want the same slot, a visible priority score decides (purpose, waiting
              time, recent use).
            </li>
          </ul>
        </div>
      </div>

      <aside className="space-y-5">
        <div className="card">
          <h2>Request a booking</h2>
          <p className="hint mt-1">
            Open: {summarizeWindows(r.availability_windows).join('; ')} ({TZ_LABEL})
          </p>
          <form action={requestBooking} className="mt-4 space-y-3">
            <input type="hidden" name="resource_id" value={r.id} />
            <div>
              <label className="label" htmlFor="date">
                Date
              </label>
              <input
                id="date"
                type="date"
                name="date"
                min={todayLocalStr()}
                required
                className="input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="start_hour">
                  Start
                </label>
                <select id="start_hour" name="start_hour" className="input">
                  {hours.map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="duration">
                  Hours
                </label>
                <select id="duration" name="duration" className="input">
                  {Array.from({ length: r.max_hours_per_booking }, (_, i) => i + 1).map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="purpose_type">
                What is it for?
              </label>
              <select id="purpose_type" name="purpose_type" className="input">
                <option value="course_project">Course project</option>
                <option value="research">Research</option>
                <option value="personal">Personal use</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="purpose">
                Describe your purpose
              </label>
              <textarea
                id="purpose"
                name="purpose"
                rows={3}
                required
                className="input"
                placeholder="What will you do with it?"
              />
            </div>
            <SubmitButton className="btn btn-primary w-full">Check and send request</SubmitButton>
            {!eligible && (
              <p className="hint">
                You are not eligible yet. You can still send it and the system will record exactly
                why it was blocked.
              </p>
            )}
          </form>
        </div>
        <div className="card">
          <h2>Already booked</h2>
          {(booked ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">No confirmed bookings coming up.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-ink-soft">
              {(booked ?? []).map((b: any, i: number) => (
                <li key={i}>{fmtRange(b.start_at, b.end_at)}</li>
              ))}
            </ul>
          )}
        </div>
        {canManage(profile, r) && (
          <Link href="/staff/requests" className="btn w-full">
            Open the review queue
          </Link>
        )}
      </aside>
    </div>
  );
}
