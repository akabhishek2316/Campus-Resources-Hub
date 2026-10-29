import { hoursBetween, localDateStr, weekStartUtc } from './time';

export const PURPOSE_LABEL: Record<string, string> = {
  course_project: 'Course project',
  research: 'Research',
  personal: 'Personal use',
};
export const PURPOSE_WEIGHT: Record<string, number> = {
  course_project: 50,
  research: 40,
  personal: 20,
};

const ACTIVE = ['pending_review', 'approved', 'waitlisted', 'checked_in', 'overdue'];
const COUNTED = ['pending_review', 'approved', 'checked_in', 'overdue', 'returned', 'closed'];

// Priority = purpose weight + days waiting (max +10) - recent use of this resource (max -30)
export function computePriority(opts: {
  purposeType: string;
  daysWaiting?: number;
  recentHours: number;
}) {
  const w = PURPOSE_WEIGHT[opts.purposeType] ?? 20;
  const wait = Math.min((opts.daysWaiting ?? 0) * 2, 10);
  const penalty = Math.min(Math.round(opts.recentHours * 2), 30);
  const score = w + wait - penalty;
  const explanation =
    `Priority ${score} = purpose "${PURPOSE_LABEL[opts.purposeType] ?? opts.purposeType}" (+${w}) ` +
    `+ waiting time (+${wait}) - recent use of this resource, ${opts.recentHours.toFixed(1)}h in 30 days (-${penalty}).`;
  return { score, explanation };
}

export function effectiveScore(b: { priority_score: number; created_at: string }) {
  const days = (Date.now() - new Date(b.created_at).getTime()) / 86400000;
  return Number(b.priority_score) + Math.min(Math.floor(days) * 2, 10);
}

export function recentHoursOnResource(userBookings: any[], resourceId: string) {
  const since = Date.now() - 30 * 86400000;
  return userBookings
    .filter(
      (b) =>
        b.resource_id === resourceId &&
        COUNTED.includes(b.status) &&
        new Date(b.start_at).getTime() > since &&
        new Date(b.start_at).getTime() < Date.now()
    )
    .reduce((s, b) => s + hoursBetween(b.start_at, b.end_at), 0);
}

export function weeklyHoursUsed(userBookings: any[], resourceId: string, slotStart: Date) {
  const ws = weekStartUtc(slotStart).getTime();
  const we = ws + 7 * 86400000;
  return userBookings
    .filter(
      (b) =>
        b.resource_id === resourceId &&
        COUNTED.includes(b.status) &&
        new Date(b.start_at).getTime() >= ws &&
        new Date(b.start_at).getTime() < we
    )
    .reduce((s, b) => s + hoursBetween(b.start_at, b.end_at), 0);
}

// Returns a list of human-readable reasons. Empty list means the request is within limits.
export function checkLimits(opts: {
  resource: any;
  start: Date;
  end: Date;
  userBookings: any[];
}): string[] {
  const { resource, start, end, userBookings } = opts;
  const fails: string[] = [];
  const hours = hoursBetween(start, end);
  if (hours > resource.max_hours_per_booking)
    fails.push(
      `This resource allows at most ${resource.max_hours_per_booking}h per booking (you asked for ${hours}h).`
    );

  const activeHere = userBookings.filter(
    (b) =>
      b.resource_id === resource.id && ACTIVE.includes(b.status) && new Date(b.end_at) > new Date()
  );
  if (activeHere.length >= resource.max_active_bookings)
    fails.push(
      `You already have ${activeHere.length} active booking(s) for this resource (limit ${resource.max_active_bookings}). Finish or cancel one first.`
    );

  const used = weeklyHoursUsed(userBookings, resource.id, start);
  if (used + hours > resource.weekly_cap_hours)
    fails.push(
      `Weekly cap reached: you have used ${used}h of ${resource.weekly_cap_hours}h this week on this resource, so ${hours}h more would exceed it.`
    );

  if (resource.high_demand) {
    const day = localDateStr(start);
    const sameDay = userBookings.filter(
      (b) =>
        b.resource_id === resource.id &&
        COUNTED.includes(b.status) &&
        localDateStr(b.start_at) === day
    );
    if (sameDay.length >= 1)
      fails.push('High-demand resource: one booking per person per day, so others get a turn.');
  }
  return fails;
}
