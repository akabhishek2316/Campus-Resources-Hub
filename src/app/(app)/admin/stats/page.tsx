import { PageBanner } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { hoursBetween } from '@/lib/time';
import { STATUS_LABEL } from '@/lib/types';

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-2 w-40 rounded bg-paper">
      <div
        className="h-2 rounded bg-bench"
        style={{ width: `${max ? Math.max(4, (value / max) * 100) : 0}%` }}
      />
    </div>
  );
}

export default async function Stats() {
  await requireProfile(['admin']);
  const supabase = createClient();
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, resource:resources(name), user:profiles!user_id(full_name)');
  const { data: incidents } = await supabase.from('incidents').select('status,type');
  const all = bookings ?? [];
  const used = all.filter((b: any) =>
    ['approved', 'checked_in', 'overdue', 'returned', 'closed'].includes(b.status)
  );

  const byStatus = new Map<string, number>();
  all.forEach((b: any) => byStatus.set(b.status, (byStatus.get(b.status) ?? 0) + 1));
  const byResource = new Map<string, number>();
  used.forEach((b: any) =>
    byResource.set(
      b.resource?.name,
      (byResource.get(b.resource?.name) ?? 0) + hoursBetween(b.start_at, b.end_at)
    )
  );
  const byUser = new Map<string, number>();
  used.forEach((b: any) =>
    byUser.set(
      b.user?.full_name,
      (byUser.get(b.user?.full_name) ?? 0) + hoursBetween(b.start_at, b.end_at)
    )
  );
  const resRows = [...byResource.entries()].sort((a, b) => b[1] - a[1]);
  const userRows = [...byUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const totalHours = used.reduce((s: number, b: any) => s + hoursBetween(b.start_at, b.end_at), 0);
  const top = userRows[0]?.[1] ?? 0;
  const topShare = totalHours ? Math.round((top / totalHours) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageBanner title="Usage statistics" subtitle="Utilisation and fairness at a glance." />
      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['Bookings', all.length],
          ['Hours shared', totalHours.toFixed(0)],
          ['Open incidents', (incidents ?? []).filter((i: any) => i.status === 'open').length],
          ['Largest single-user share', `${topShare}%`],
        ].map(([l, v]) => (
          <div key={String(l)} className="card">
            <p className="text-sm text-ink-soft">{l}</p>
            <p className="mt-1 text-2xl font-semibold">{v}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="card">
          <h2>Hours by resource</h2>
          <table className="mt-3 w-full">
            <tbody>
              {resRows.map(([n, h]) => (
                <tr key={n}>
                  <td className="td">{n}</td>
                  <td className="td">
                    <Bar value={h} max={resRows[0][1]} />
                  </td>
                  <td className="td">{h}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Hours by person</h2>
          <p className="hint">A fairness check: no one should dominate.</p>
          <table className="mt-3 w-full">
            <tbody>
              {userRows.map(([n, h]) => (
                <tr key={n}>
                  <td className="td">{n}</td>
                  <td className="td">
                    <Bar value={h} max={top} />
                  </td>
                  <td className="td">{h}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h2>Bookings by status</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {[...byStatus.entries()].map(([s, n]) => (
            <div key={s} className="rounded-md border border-paper-line px-3 py-2 text-sm">
              <span className="font-medium">{n}</span> {STATUS_LABEL[s] ?? s}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
