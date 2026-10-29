import { createAdminClient } from './supabase/admin';
import { logAudit, notify } from './audit';

let lastRun = 0;

// Reminders, overdue flags and no-shows. Runs at most once a minute, from page loads and /api/cron.
export async function runMaintenance(force = false) {
  if (!force && Date.now() - lastRun < 60000) return;
  lastRun = Date.now();
  const admin = createAdminClient();
  const now = new Date();

  const soon = new Date(now.getTime() + 60 * 60000).toISOString();
  const { data: rem } = await admin
    .from('bookings')
    .select('id,user_id,resource:resources(name)')
    .eq('status', 'approved')
    .eq('reminder_sent', false)
    .gt('start_at', now.toISOString())
    .lte('start_at', soon);
  for (const b of (rem ?? []) as any[]) {
    await notify(
      admin,
      b.user_id,
      `Reminder: your booking for ${b.resource?.name} starts within the hour. Bring your OTP.`,
      `/bookings/${b.id}`
    );
    await admin.from('bookings').update({ reminder_sent: true }).eq('id', b.id);
  }

  const { data: late } = await admin
    .from('bookings')
    .select('id,user_id,resource:resources(name,owner_id,manager_id)')
    .eq('status', 'checked_in')
    .lt('end_at', now.toISOString());
  for (const b of (late ?? []) as any[]) {
    await admin.from('bookings').update({ status: 'overdue' }).eq('id', b.id);
    await logAudit(admin, {
      action: 'marked_overdue',
      entityType: 'booking',
      entityId: b.id,
      bookingId: b.id,
    });
    await notify(
      admin,
      b.user_id,
      `Overdue: please return ${b.resource?.name} now.`,
      `/bookings/${b.id}`
    );
    await notify(
      admin,
      b.resource?.manager_id ?? b.resource?.owner_id,
      `${b.resource?.name} is overdue for return.`,
      `/bookings/${b.id}`
    );
  }

  const { data: ns } = await admin
    .from('bookings')
    .select('id,user_id,resource:resources(name)')
    .eq('status', 'approved')
    .lt('end_at', now.toISOString());
  for (const b of (ns ?? []) as any[]) {
    await admin.from('bookings').update({ status: 'no_show' }).eq('id', b.id);
    await logAudit(admin, {
      action: 'marked_no_show',
      entityType: 'booking',
      entityId: b.id,
      bookingId: b.id,
    });
    await notify(
      admin,
      b.user_id,
      `You did not collect ${b.resource?.name}. The booking was marked as a no-show.`,
      `/bookings/${b.id}`
    );
  }
}
