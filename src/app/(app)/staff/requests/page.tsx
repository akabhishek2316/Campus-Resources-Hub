import { PageBanner } from '@/components/ui';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { effectiveScore } from '@/lib/fairness';
import { fmtRange } from '@/lib/time';
import { Empty, Flash, StatusBadge } from '@/components/ui';

const SECTIONS: { status: string[]; title: string; hint: string }[] = [
  {
    status: ['pending_review'],
    title: 'Needs your decision',
    hint: 'Highest priority first. Open a request to approve, reject or waitlist it with a reason.',
  },
  {
    status: ['waitlisted'],
    title: 'Waitlist',
    hint: 'Waiting for a slot to free up. They move to review automatically on cancellation.',
  },
  {
    status: ['approved'],
    title: 'Ready for check-in',
    hint: 'The student records condition, then gives you their OTP.',
  },
  {
    status: ['checked_in', 'overdue'],
    title: 'Out on loan',
    hint: 'Waiting for the student to return and record condition after use.',
  },
  {
    status: ['returned'],
    title: 'Confirm returns',
    hint: 'Compare before and after photos, then close.',
  },
];

export default async function Requests({
  searchParams,
}: {
  searchParams: { error?: string; msg?: string };
}) {
  await requireProfile(['owner', 'manager', 'admin']);
  const supabase = createClient();
  const { data } = await supabase
    .from('bookings')
    .select('*, resource:resources(name), requester:profiles!user_id(full_name,department)')
    .in(
      'status',
      SECTIONS.flatMap((s) => s.status)
    )
    .order('start_at');
  const rows = data ?? [];
  return (
    <div>
      <PageBanner
        title="Requests and handovers"
        subtitle="Everything for resources you own or manage."
      />
      <div className="mt-4">
        <Flash sp={searchParams} />
      </div>
      {rows.length === 0 && <Empty title="Nothing to handle right now" />}
      {SECTIONS.map((s) => {
        let list = rows.filter((r: any) => s.status.includes(r.status));
        if (s.status[0] === 'pending_review' || s.status[0] === 'waitlisted')
          list = list.sort((a: any, b: any) => effectiveScore(b) - effectiveScore(a));
        if (!list.length) return null;
        return (
          <section key={s.title} className="mt-6">
            <h2>
              {s.title} <span className="text-sm font-normal text-ink-mute">({list.length})</span>
            </h2>
            <p className="hint mb-2">{s.hint}</p>
            <div className="card overflow-x-auto p-0">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-paper-line">
                    <th className="th">Resource</th>
                    <th className="th">Student</th>
                    <th className="th">When</th>
                    <th className="th">Priority</th>
                    <th className="th">Status</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((b: any) => (
                    <tr key={b.id} className="border-b border-paper-line last:border-0">
                      <td className="td font-medium">{b.resource?.name}</td>
                      <td className="td">
                        {b.requester?.full_name}
                        <div className="hint">{b.requester?.department}</div>
                      </td>
                      <td className="td">{fmtRange(b.start_at, b.end_at)}</td>
                      <td className="td">{effectiveScore(b)}</td>
                      <td className="td">
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="td">
                        <Link href={`/bookings/${b.id}`} className="btn py-1">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
