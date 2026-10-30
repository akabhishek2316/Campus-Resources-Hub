import { PageBanner } from '@/components/ui';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { fmtDateTime } from '@/lib/time';
import { Empty, Pill } from '@/components/ui';

export default async function Incidents() {
  const profile = await requireProfile();
  const supabase = createClient();
  const { data } = await supabase
    .from('incidents')
    .select('*, resource:resources(name)')
    .order('created_at', { ascending: false });
  return (
    <div>
      <PageBanner
        title="Incidents"
        subtitle={
          profile.role === 'student'
            ? 'Incidents on your bookings.'
            : 'Damage, delay and misuse reports. A person always makes the final call.'
        }
      />
      <div className="mt-5 space-y-3">
        {(data ?? []).length === 0 && <Empty title="No incidents" />}
        {(data ?? []).map((i: any) => (
          <Link key={i.id} href={`/incidents/${i.id}`} className="card block hover:border-bench">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={i.status === 'open' ? 'warn' : 'ok'}>{i.status}</Pill>
              <Pill tone="plain">{i.type}</Pill>
              {i.auto_flagged && <Pill tone="info">Auto-flagged</Pill>}
              <span className="font-medium">{i.resource?.name}</span>
              <span className="ml-auto text-xs text-ink-mute">{fmtDateTime(i.created_at)}</span>
            </div>
            <p className="mt-2 text-sm text-ink-soft">{i.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
