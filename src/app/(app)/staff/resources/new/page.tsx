import { PageBanner } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile } from '@/lib/auth';
import { createResource } from '@/app/actions/resources';
import { SubmitButton } from '@/components/SubmitButton';
import { Flash } from '@/components/ui';
import { WEEKDAYS } from '@/lib/time';

export default async function NewResource({
  searchParams,
}: {
  searchParams: { error?: string; msg?: string };
}) {
  const profile = await requireProfile(['owner', 'admin']);
  const supabase = createClient();
  const admin = createAdminClient();
  const [{ data: trainings }, { data: managerLinks }] = await Promise.all([
    supabase.from('trainings').select('*').order('name'),
    admin
      .from('owner_managers')
      .select('manager:profiles!owner_managers_manager_id_fkey(id,full_name)')
      .eq('owner_id', profile.id)
      .is('revoked_at', null),
  ]);
  const managers = (managerLinks ?? []).map((link: any) => link.manager).filter(Boolean);
  return (
    <div className="max-w-3xl">
      <PageBanner
        title="List a resource"
        subtitle="Describe what is available, who may use it and under what conditions. Students see all of this before they ask."
      />
      <div className="mt-4">
        <Flash sp={searchParams} />
      </div>
      <form action={createResource} className="card space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">
              Name
            </label>
            <input id="name" name="name" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="category">
              Category
            </label>
            <input
              id="category"
              name="category"
              required
              className="input"
              placeholder="Space, Device, Tool, Computer, Camera"
            />
          </div>
          <div>
            <label className="label" htmlFor="location">
              Location
            </label>
            <input
              id="location"
              name="location"
              required
              className="input"
              placeholder="Block B, Room 204"
            />
          </div>
          <div>
            <label className="label" htmlFor="manager_id">
              Technician in charge
            </label>
            <select id="manager_id" name="manager_id" className="input">
              <option value="">None (owner handles it)</option>
              {(managers ?? []).map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="description">
            Description
          </label>
          <textarea id="description" name="description" rows={3} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="rules">
            Usage rules
          </label>
          <textarea
            id="rules"
            name="rules"
            rows={3}
            className="input"
            placeholder="Safety gear, supervision, what is not allowed"
          />
        </div>
        <div>
          <label className="label" htmlFor="image_url">
            Photo link (optional)
          </label>
          <input id="image_url" name="image_url" className="input" />
        </div>

        <fieldset>
          <legend className="label">Available days and hours (college time)</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            {WEEKDAYS.map((d, i) => (
              <label key={d} className="flex items-center gap-1.5">
                <input type="checkbox" name="days" value={i} defaultChecked={i >= 1 && i <= 5} />{' '}
                {d}
              </label>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3 text-sm">
            From{' '}
            <input
              type="number"
              name="start_hour"
              min={0}
              max={23}
              defaultValue={10}
              className="input w-20"
            />{' '}
            to{' '}
            <input
              type="number"
              name="end_hour"
              min={1}
              max={24}
              defaultValue={17}
              className="input w-20"
            />{' '}
            (24-hour clock)
          </div>
        </fieldset>

        <fieldset>
          <legend className="label">Required training</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            {(trainings ?? []).map((t: any) => (
              <label key={t.id} className="flex items-center gap-1.5">
                <input type="checkbox" name="trainings" value={t.id} /> {t.name}
              </label>
            ))}
            {(trainings ?? []).length === 0 && (
              <p className="hint">No trainings exist yet. An admin can add them.</p>
            )}
          </div>
          {profile.role === 'owner' && (
            <p className="hint mt-2">
              Your item needs a training that is not listed?{' '}
              <a href="/staff/trainings" className="text-bench underline">
                Ask the admin to add it
              </a>
              , then come back and tick it.
            </p>
          )}
        </fieldset>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label" htmlFor="max_hours">
              Max hours per booking
            </label>
            <input
              id="max_hours"
              type="number"
              name="max_hours"
              min={1}
              defaultValue={3}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="weekly_cap">
              Weekly cap per person (hours)
            </label>
            <input
              id="weekly_cap"
              type="number"
              name="weekly_cap"
              min={1}
              defaultValue={8}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="max_active">
              Active bookings per person
            </label>
            <input
              id="max_active"
              type="number"
              name="max_active"
              min={1}
              defaultValue={2}
              className="input"
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="deposit_note">
            Deposit or conditions (optional)
          </label>
          <input
            id="deposit_note"
            name="deposit_note"
            className="input"
            placeholder="Rs. 500 refundable deposit, collected at handover"
          />
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="requires_approval" defaultChecked /> A person must approve
            each request
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="high_demand" /> High demand (one booking per person per
            day)
          </label>
        </div>
        <SubmitButton>List resource</SubmitButton>
      </form>
    </div>
  );
}
