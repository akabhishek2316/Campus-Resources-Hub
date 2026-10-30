import { PageBanner } from '@/components/ui';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { waitlistRank } from '@/lib/queue';
import { fmtRange } from '@/lib/time';
import { Empty, Flash, StatusBadge } from '@/components/ui';

export default async function MyBookings({
  searchParams,
}: {
  searchParams: { error?: string; msg?: string };
}) {
  const profile = await requireProfile();
  const supabase = createClient();
  const { data } = await supabase
    .from('bookings')
    .select('*, resource:resources(name,location)')
    .eq('user_id', profile.id)
    .order('start_at', { ascending: false });
  const rows = await Promise.all(
    (data ?? []).map(async (b: any) => ({
      ...b,
      rank: b.status === 'waitlisted' ? await waitlistRank(b) : null,
    }))
  );
  return (
    <div>
      <PageBanner
        title="My bookings"
        subtitle="Open a booking to see why it was decided, your OTP, photos and the full history."
      />
      <div className="mt-4">
        <Flash sp={searchParams} />
      </div>
      {rows.length === 0 ? (
        <Empty title="No bookings yet">
          <Link href="/resources" className="text-bench underline">
            Find a resource
          </Link>{' '}
          to make your first request.
        </Empty>
      ) : (
        <div className="space-y-3">
          {rows.map((b: any) => (
            <Link key={b.id} href={`/bookings/${b.id}`} className="card block hover:border-bench">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base">{b.resource?.name}</h2>
                  <p className="text-sm text-ink-soft">{fmtRange(b.start_at, b.end_at)}</p>
                </div>
                <StatusBadge status={b.status} />
              </div>
              {b.decision_reason && (
                <p className="mt-2 text-sm text-ink-soft">{b.decision_reason}</p>
              )}
              {b.rank && b.rank.rank > 0 && (
                <p className="mt-1 text-sm text-steel">
                  You are #{b.rank.rank} of {b.rank.total} on the waitlist for this slot.
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
