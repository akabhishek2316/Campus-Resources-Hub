import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { deactivateUser, reactivateUser } from '@/app/actions/admin';
import { SubmitButton } from '@/components/SubmitButton';
import { AdminTabs } from '@/components/AdminTabs';
import { Empty, Flash, PageBanner, UserTags } from '@/components/ui';
import { fmtDateTime } from '@/lib/time';
import { OWNER_TYPE_LABEL } from '@/lib/applications';

const STATUS_FILTERS: [string, string][] = [
  ['', 'Any status'],
  ['active', 'Active'],
  ['deactivated', 'Deactivated'],
  ['verified', 'Verified'],
  ['unverified', 'Not verified'],
  ['pending', 'Request pending'],
  ['rejected', 'Request rejected'],
  ['suspended', 'Booking suspended'],
];

export default async function Users({
  searchParams,
}: {
  searchParams: {
    q?: string;
    role?: string;
    otype?: string;
    status?: string;
    error?: string;
    msg?: string;
  };
}) {
  const me = await requireProfile(['admin']);
  const supabase = createClient();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);
  const all = data ?? [];
  const now = new Date();

  const q = (searchParams.q ?? '').trim().toLowerCase();
  const role = searchParams.role ?? '';
  const status = searchParams.status ?? '';
  const otype = searchParams.otype ?? '';
  const list = all.filter((u: any) => {
    if (role && u.role !== role) return false;
    if (otype && !(u.role === 'owner' && u.owner_type === otype)) return false;
    if (
      q &&
      !`${u.full_name} ${u.email} ${u.college_id ?? ''} ${u.employee_id ?? ''} ${u.department ?? ''} ${u.organization_name ?? ''}`
        .toLowerCase()
        .includes(q)
    )
      return false;
    switch (status) {
      case 'active':
        return u.is_active !== false;
      case 'deactivated':
        return u.is_active === false;
      case 'verified':
        return u.verified;
      case 'unverified':
        return !u.verified;
      case 'pending':
        return u.application_status === 'pending';
      case 'rejected':
        return u.application_status === 'rejected';
      case 'suspended':
        return u.suspended_until && new Date(u.suspended_until) > now;
      default:
        return true;
    }
  });

  const count = (f: (u: any) => boolean) => all.filter(f).length;
  const stats: [string, number][] = [
    ['All users', all.length],
    ['Students', count((u) => u.role === 'student')],
    ['Owners', count((u) => u.role === 'owner')],
    ['Managers', count((u) => u.role === 'manager')],
    ['Deactivated', count((u) => u.is_active === false)],
  ];

  return (
    <div>
      <PageBanner
        title="All users"
        subtitle="Everyone on the platform. Open a profile to see documents and activity, or deactivate an account."
      />
      <AdminTabs pending={count((u) => u.application_status === 'pending')} />
      <Flash sp={searchParams} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map(([label, n]) => (
          <div key={label} className="card py-3">
            <p className="text-xs text-ink-soft">{label}</p>
            <p className="text-2xl font-semibold text-bench-dark">{n}</p>
          </div>
        ))}
      </div>
      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        {Object.entries(OWNER_TYPE_LABEL).map(([k, label]) => (
          <Link
            key={k}
            href={`/admin/users?otype=${k}`}
            className={`rounded-full border px-3 py-1 transition hover:bg-bench-light ${otype === k ? 'border-bench bg-bench-light text-bench-dark' : 'border-paper-line bg-white text-ink-soft'}`}
          >
            {label}: <b>{count((u) => u.role === 'owner' && u.owner_type === k)}</b>
          </Link>
        ))}
        {count((u) => u.role === 'owner' && !u.owner_type) > 0 && (
          <span className="rounded-full border border-paper-line bg-white px-3 py-1 text-ink-soft">
            Resource owner (type not set):{' '}
            <b>{count((u) => u.role === 'owner' && !u.owner_type)}</b>
          </span>
        )}
      </div>

      <form method="get" className="card mb-4 grid gap-3 md:grid-cols-[2fr_1fr_1.2fr_1fr_auto]">
        <div>
          <label className="label" htmlFor="q">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={searchParams.q ?? ''}
            className="input"
            placeholder="Name, email, college or staff ID"
          />
        </div>
        <div>
          <label className="label" htmlFor="role">
            Role
          </label>
          <select id="role" name="role" defaultValue={role} className="input">
            <option value="">All roles</option>
            <option value="student">Students</option>
            <option value="owner">Owners</option>
            <option value="manager">Managers</option>
            <option value="admin">Admins</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="otype">
            Owner type
          </label>
          <select id="otype" name="otype" defaultValue={otype} className="input">
            <option value="">Any owner type</option>
            {Object.entries(OWNER_TYPE_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="status">
            Status
          </label>
          <select id="status" name="status" defaultValue={status} className="input">
            {STATUS_FILTERS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button className="btn btn-primary w-full">Filter</button>
        </div>
      </form>

      <p className="hint mb-2">
        Showing {list.length} of {all.length}
      </p>
      {list.length === 0 ? (
        <Empty title="No users match these filters" />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="border-b border-paper-line">
                <th className="th">Person</th>
                <th className="th">Tags</th>
                <th className="th">Joined</th>
                <th className="th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u: any) => (
                <tr
                  key={u.id}
                  className={`border-b border-paper-line last:border-0 ${u.is_active === false ? 'bg-rust-light/40' : ''}`}
                >
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bench-light text-xs font-semibold text-bench-dark">
                        {u.full_name
                          .split(' ')
                          .map((w: string) => w[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </span>
                      <div>
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="font-medium hover:text-bench hover:underline"
                        >
                          {u.full_name}
                          {u.id === me.id ? ' (you)' : ''}
                        </Link>
                        <div className="hint">{u.email}</div>
                        {(u.college_id || u.employee_id) && (
                          <div className="hint">ID {u.college_id || u.employee_id}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="td">
                    <UserTags u={u} />
                  </td>
                  <td className="td whitespace-nowrap text-xs text-ink-soft">
                    {fmtDateTime(u.created_at)}
                  </td>
                  <td className="td">
                    <div className="flex flex-wrap items-start gap-2">
                      <Link href={`/admin/users/${u.id}`} className="btn py-1">
                        View profile
                      </Link>
                      {u.id !== me.id &&
                        u.role !== 'admin' &&
                        (u.is_active === false ? (
                          <form action={reactivateUser}>
                            <input type="hidden" name="id" value={u.id} />
                            <SubmitButton className="btn py-1" pendingText="Reactivating...">
                              Reactivate
                            </SubmitButton>
                          </form>
                        ) : (
                          <details>
                            <summary className="btn btn-danger cursor-pointer list-none py-1">
                              Deactivate
                            </summary>
                            <form
                              action={deactivateUser}
                              className="mt-2 w-64 space-y-2 rounded-lg border border-paper-line bg-white p-3 shadow-sm"
                            >
                              <input type="hidden" name="id" value={u.id} />
                              <label className="label" htmlFor={`r-${u.id}`}>
                                Reason (saved in the audit log)
                              </label>
                              <input
                                id={`r-${u.id}`}
                                name="reason"
                                required
                                minLength={5}
                                className="input"
                                placeholder="e.g. Left the college"
                              />
                              <SubmitButton
                                className="btn btn-danger w-full"
                                pendingText="Deactivating..."
                              >
                                Confirm deactivation
                              </SubmitButton>
                            </form>
                          </details>
                        ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
