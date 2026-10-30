import { SubmitButton } from '@/components/SubmitButton';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { toggleResource } from '@/app/actions/resources';
import { Empty, Flash, Pill, PageBanner } from '@/components/ui';

export default async function StaffResources({
  searchParams,
}: {
  searchParams: { error?: string; msg?: string };
}) {
  const profile = await requireProfile(['owner', 'admin']);
  const supabase = createClient();
  let q = supabase.from('resources').select('*').order('name');
  if (profile.role !== 'admin') q = q.eq('owner_id', profile.id);
  const { data } = await q;
  return (
    <div>
      <PageBanner
        title="My resources"
        subtitle="Everything you have listed. Hide an item to stop new requests."
      >
        <Link href="/staff/resources/new" className="btn btn-gold">
          List a new resource
        </Link>
      </PageBanner>
      <Flash sp={searchParams} />
      {(data ?? []).length === 0 ? (
        <Empty title="You have not listed anything yet" />
      ) : (
        <div className="space-y-3">
          {(data ?? []).map((r: any) => (
            <div key={r.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link href={`/resources/${r.id}`} className="font-medium hover:underline">
                  {r.name}
                </Link>
                <p className="text-sm text-ink-soft">
                  {r.category}, {r.location}
                </p>
                <div className="mt-2 flex gap-1.5">
                  {r.active ? <Pill tone="ok">Visible</Pill> : <Pill tone="bad">Hidden</Pill>}
                  {r.requires_approval ? (
                    <Pill tone="info">Manual approval</Pill>
                  ) : (
                    <Pill tone="plain">Instant</Pill>
                  )}
                </div>
              </div>
              <form action={toggleResource}>
                <input type="hidden" name="id" value={r.id} />
                <SubmitButton className="btn" pendingText="Saving...">
                  {r.active ? 'Hide from students' : 'Show again'}
                </SubmitButton>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
