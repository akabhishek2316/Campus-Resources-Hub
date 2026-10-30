import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { rankResources } from '@/lib/ai';
import { summarizeWindows } from '@/lib/time';
import { Flash, Pill, Empty, PageBanner } from '@/components/ui';
import { categoryStyle } from '@/lib/brand';

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    category?: string;
    eligible?: string;
    date?: string;
    smart?: string;
    error?: string;
    msg?: string;
  };
}) {
  const profile = await requireProfile();
  const supabase = createClient();
  const [{ data: all }, { data: creds }] = await Promise.all([
    supabase
      .from('resources')
      .select(
        '*, resource_requirements(training_id, trainings(name)), availability_windows(*), owner:profiles!owner_id(full_name)'
      )
      .eq('active', true)
      .order('name'),
    supabase
      .from('user_credentials')
      .select('training_id')
      .eq('user_id', profile.id)
      .eq('status', 'approved'),
  ]);
  const have = new Set((creds ?? []).map((c: any) => c.training_id));

  const resources = (all ?? []).map((r: any) => {
    const missing = (r.resource_requirements ?? [])
      .filter((q: any) => !have.has(q.training_id))
      .map((q: any) => q.trainings?.name);
    return { ...r, missing };
  });
  const categories = [...new Set(resources.map((r: any) => r.category))].sort();

  let list = resources;
  const reasons: Record<string, string> = {};
  let aiUsed = false;
  const q = (searchParams.q ?? '').trim();
  if (q && searchParams.smart === '1') {
    const ranked = await rankResources(q, resources);
    aiUsed = ranked.some((x) => x.ai);
    ranked.forEach((x) => (reasons[x.id] = x.reason));
    list = ranked.map((x) => resources.find((r: any) => r.id === x.id)).filter(Boolean);
  } else if (q) {
    const needle = q.toLowerCase();
    list = list.filter((r: any) =>
      `${r.name} ${r.category} ${r.location} ${r.description ?? ''}`.toLowerCase().includes(needle)
    );
  }
  if (searchParams.category) list = list.filter((r: any) => r.category === searchParams.category);
  if (searchParams.eligible === '1')
    list = list.filter((r: any) => profile.verified && r.missing.length === 0);
  if (searchParams.date) {
    const wd = new Date(searchParams.date + 'T00:00:00Z').getUTCDay();
    list = list.filter((r: any) => r.availability_windows.some((w: any) => w.weekday === wd));
  }

  return (
    <div>
      <PageBanner
        title="Find equipment, labs and spaces"
        subtitle="Each card shows whether you can book it right now, and what is missing if you cannot."
      />
      <Flash sp={searchParams} />

      <form className="card mb-6 grid gap-3 md:grid-cols-6" method="get">
        <div className="md:col-span-2">
          <label className="label" htmlFor="q">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            className="input"
            placeholder="e.g. I need to print an enclosure"
          />
        </div>
        <div>
          <label className="label" htmlFor="category">
            Category
          </label>
          <select
            id="category"
            name="category"
            defaultValue={searchParams.category ?? ''}
            className="input"
          >
            <option value="">All</option>
            {categories.map((c: any) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="date">
            Open on
          </label>
          <input
            id="date"
            type="date"
            name="date"
            defaultValue={searchParams.date ?? ''}
            className="input"
          />
        </div>
        <div className="flex flex-col justify-end gap-1 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="eligible"
              value="1"
              defaultChecked={searchParams.eligible === '1'}
            />{' '}
            I can book it now
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="smart"
              value="1"
              defaultChecked={searchParams.smart === '1'}
            />{' '}
            Smart match
          </label>
        </div>
        <div className="flex items-end">
          <button className="btn btn-primary w-full">Search</button>
        </div>
      </form>

      {searchParams.smart === '1' && q && (
        <p className="mb-3 text-xs text-ink-mute">
          {aiUsed
            ? 'Matched with Gemini. Suggestions only; you decide what to book.'
            : 'Matched by keywords (add a Gemini key for natural-language matching).'}
        </p>
      )}

      {list.length === 0 ? (
        <Empty title="No resources match">
          Try removing a filter or searching with different words.
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.map((r: any) => (
            <Link
              key={r.id}
              href={`/resources/${r.id}`}
              className="card group relative block overflow-hidden pt-6 transition-shadow hover:shadow-md"
            >
              <span className={`absolute inset-x-0 top-0 h-1.5 ${categoryStyle(r.category).bar}`} />
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white ${categoryStyle(r.category).tile}`}
                  >
                    {String(r.category).charAt(0).toUpperCase()}
                  </span>
                  <h2 className="text-base group-hover:text-bench">{r.name}</h2>
                </div>
                <span className={`badge ${categoryStyle(r.category).chip}`}>{r.category}</span>
              </div>
              <p className="mt-1 text-sm text-ink-soft">{r.location}</p>
              <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{r.description}</p>
              {reasons[r.id] && <p className="mt-2 text-xs text-steel">{reasons[r.id]}</p>}
              <p className="mt-3 text-xs text-ink-mute">
                {summarizeWindows(r.availability_windows)[0]}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {!profile.verified ? (
                  <Pill tone="warn">Verify your college ID</Pill>
                ) : r.missing.length === 0 ? (
                  <Pill tone="ok">You can book this</Pill>
                ) : (
                  <Pill tone="bad">Missing: {r.missing.join(', ')}</Pill>
                )}
                {r.requires_approval ? (
                  <Pill tone="info">Needs approval</Pill>
                ) : (
                  <Pill tone="ok">Instant approval</Pill>
                )}
                {r.high_demand && <Pill tone="warn">High demand</Pill>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
