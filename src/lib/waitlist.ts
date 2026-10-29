import { logAudit, notify } from './audit';
import { effectiveScore } from './fairness';

export const BLOCKING_STATUSES = ['approved', 'checked_in', 'overdue'];

// When an approved slot is freed, the waitlisted request with the highest priority goes back to review.
export async function promoteWaitlist(admin: any, resource: any, startAt: string, endAt: string) {
  const { data: cands } = await admin
    .from('bookings')
    .select('*')
    .eq('resource_id', resource.id)
    .eq('status', 'waitlisted')
    .lt('start_at', endAt)
    .gt('end_at', startAt);
  const sorted = (cands ?? []).sort(
    (a: any, b: any) =>
      effectiveScore(b) - effectiveScore(a) || +new Date(a.created_at) - +new Date(b.created_at)
  );
  for (const c of sorted) {
    const { data: blockers } = await admin
      .from('bookings')
      .select('id')
      .eq('resource_id', resource.id)
      .in('status', BLOCKING_STATUSES)
      .lt('start_at', c.end_at)
      .gt('end_at', c.start_at)
      .limit(1);
    if (blockers?.length) continue;
    const why = `The slot became free and you were first on the waitlist by priority (${effectiveScore(c)}). The owner will now review your request.`;
    await admin
      .from('bookings')
      .update({ status: 'pending_review', decision_reason: why })
      .eq('id', c.id);
    await logAudit(admin, {
      actorId: null,
      actorName: 'System',
      action: 'promoted_from_waitlist',
      entityType: 'booking',
      entityId: c.id,
      bookingId: c.id,
      details: { reason: why },
    });
    await notify(
      admin,
      c.user_id,
      `Good news: ${resource.name} slot is free. ${why}`,
      `/bookings/${c.id}`
    );
    await notify(
      admin,
      resource.manager_id ?? resource.owner_id,
      `A waitlisted request for ${resource.name} is ready for review.`,
      `/bookings/${c.id}`
    );
    break;
  }
}
