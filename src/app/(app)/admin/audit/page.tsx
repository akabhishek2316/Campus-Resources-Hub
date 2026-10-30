import { PageBanner } from '@/components/ui';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { fmtDateTime } from '@/lib/time';
import { ACTION_LABEL } from '@/lib/types';

export default async function Audit({
  searchParams,
}: {
  searchParams: { action?: string; booking?: string };
}) {
  await requireProfile(['admin']);
  const supabase = createClient();
  let q = supabase.from('audit_log').select('*').order('id', { ascending: false }).limit(200);
  if (searchParams.action) q = q.eq('action', searchParams.action);
  if (searchParams.booking) q = q.eq('booking_id', searchParams.booking.trim());
  const { data } = await q;
  return (
    <div>
      <PageBanner
        title="Audit log"
        subtitle="Append-only. The database refuses edits and deletes, even from the server."
      />
      <form className="card my-4 flex flex-wrap items-end gap-3" method="get">
        <div>
          <label className="label" htmlFor="action">
            Action
          </label>
          <select
            id="action"
            name="action"
            defaultValue={searchParams.action ?? ''}
            className="input"
          >
            <option value="">All actions</option>
            {Object.entries(ACTION_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="booking">
            Booking ID
          </label>
          <input
            id="booking"
            name="booking"
            defaultValue={searchParams.booking ?? ''}
            className="input w-80"
          />
        </div>
        <button className="btn btn-primary">Filter</button>
      </form>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-paper-line">
              <th className="th">When</th>
              <th className="th">Who</th>
              <th className="th">Action</th>
              <th className="th">Details</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((l: any) => (
              <tr key={l.id} className="border-b border-paper-line last:border-0">
                <td className="td whitespace-nowrap">{fmtDateTime(l.created_at)}</td>
                <td className="td">{l.actor_name}</td>
                <td className="td">
                  {l.booking_id ? (
                    <Link href={`/bookings/${l.booking_id}`} className="text-bench hover:underline">
                      {ACTION_LABEL[l.action] ?? l.action}
                    </Link>
                  ) : (
                    (ACTION_LABEL[l.action] ?? l.action)
                  )}
                </td>
                <td className="td max-w-md text-xs text-ink-soft">
                  {Object.entries(l.details ?? {})
                    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                    .join(' | ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
