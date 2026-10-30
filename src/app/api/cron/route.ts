import { NextResponse } from 'next/server';
import { runMaintenance } from '@/lib/maintenance';

export const dynamic = 'force-dynamic';

// Optional: ping this from any scheduler to send reminders and flag overdue returns.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('x-cron-secret') !== secret)
    return NextResponse.json({ ok: false }, { status: 401 });
  await runMaintenance(true);
  return NextResponse.json({ ok: true, ranAt: new Date().toISOString() });
}
