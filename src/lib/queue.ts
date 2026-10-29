import { createAdminClient } from './supabase/admin';
import { effectiveScore } from './fairness';

// Returns this booking's rank among waitlisted requests for the same resource and overlapping time.
export async function waitlistRank(b: {
  id: string;
  resource_id: string;
  start_at: string;
  end_at: string;
}) {
  const admin = createAdminClient();
  const { data } = await admin
    .from('bookings')
    .select('id,priority_score,created_at')
    .eq('resource_id', b.resource_id)
    .eq('status', 'waitlisted')
    .lt('start_at', b.end_at)
    .gt('end_at', b.start_at);
  const list = (data ?? []).sort(
    (x: any, y: any) =>
      effectiveScore(y) - effectiveScore(x) || +new Date(x.created_at) - +new Date(y.created_at)
  );
  const idx = list.findIndex((x: any) => x.id === b.id);
  return { rank: idx + 1, total: list.length };
}

export async function competingCount(b: {
  id: string;
  resource_id: string;
  start_at: string;
  end_at: string;
}) {
  const admin = createAdminClient();
  const { count } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('resource_id', b.resource_id)
    .in('status', ['pending_review', 'waitlisted'])
    .neq('id', b.id)
    .lt('start_at', b.end_at)
    .gt('end_at', b.start_at);
  return count ?? 0;
}
