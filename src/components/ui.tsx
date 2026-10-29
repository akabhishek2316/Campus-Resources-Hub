import { STATUS_LABEL } from '@/lib/types';
import { roleLabel } from '@/lib/applications';

const TONE: Record<string, string> = {
  pending_review: 'bg-amber2-light text-amber2',
  approved: 'bg-leaf-light text-leaf',
  rejected: 'bg-rust-light text-rust',
  auto_rejected: 'bg-rust-light text-rust',
  waitlisted: 'bg-steel-light text-steel',
  checked_in: 'bg-bench text-white',
  overdue: 'bg-rust text-white',
  returned: 'bg-steel-light text-steel',
  closed: 'bg-paper text-ink-soft border border-paper-line',
  cancelled: 'bg-paper text-ink-soft border border-paper-line',
  no_show: 'bg-paper text-ink-soft border border-paper-line',
  open: 'bg-amber2-light text-amber2',
  resolved: 'bg-leaf-light text-leaf',
  pending: 'bg-amber2-light text-amber2',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${TONE[status] ?? 'bg-paper text-ink-soft'}`}>
      {STATUS_LABEL[status] ?? status.replace('_', ' ')}
    </span>
  );
}

export function Pill({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'bad' | 'info' | 'plain';
  children: React.ReactNode;
}) {
  const t = {
    ok: 'bg-leaf-light text-leaf',
    warn: 'bg-amber2-light text-amber2',
    bad: 'bg-rust-light text-rust',
    info: 'bg-steel-light text-steel',
    plain: 'bg-paper text-ink-soft border border-paper-line',
  }[tone];
  return <span className={`badge ${t}`}>{children}</span>;
}

export function Flash({ sp }: { sp: { error?: string; msg?: string } }) {
  if (!sp?.error && !sp?.msg) return null;
  return (
    <div
      role="status"
      className={`mb-4 rounded-md border px-4 py-3 text-sm ${sp.error ? 'border-rust bg-rust-light text-rust' : 'border-leaf bg-leaf-light text-leaf'}`}
    >
      {sp.error ?? sp.msg}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-sm text-ink-soft">{children}</div>}
    </div>
  );
}

export function PageBanner({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative mb-6 overflow-hidden rounded-xl bg-gradient-to-r from-bench-dark via-bench to-[#2D6CC0] px-5 py-6 text-white shadow-sm sm:px-8 sm:py-7">
      <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-gold/25" />
      <div className="absolute -bottom-12 right-24 h-28 w-28 rounded-full bg-white/10" />
      <div className="relative">
        <h1 className="!text-white">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-blue-100">{subtitle}</p>}
        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}

const ROLE_TAG: Record<string, string> = {
  student: 'bg-sky-100 text-sky-800',
  manager: 'bg-teal-100 text-teal-800',
  admin: 'bg-rose-100 text-rose-800',
};
// Each kind of owner has its own colour, so it is obvious at a glance.
const OWNER_TAG: Record<string, string> = {
  college_staff: 'bg-indigo-100 text-indigo-800',
  organization: 'bg-orange-100 text-orange-800',
  individual: 'bg-emerald-100 text-emerald-800',
};

export function RoleTag({ role, ownerType }: { role: string; ownerType?: string | null }) {
  const cls =
    role === 'owner'
      ? (OWNER_TAG[ownerType ?? ''] ?? 'bg-indigo-100 text-indigo-800')
      : (ROLE_TAG[role] ?? 'bg-paper text-ink-soft');
  return <span className={`badge ${cls}`}>{roleLabel(role, ownerType)}</span>;
}

// Role, verification, account status and pending requests, shown as coloured tags.
export function UserTags({ u }: { u: any }) {
  const suspended = u.suspended_until && new Date(u.suspended_until) > new Date();
  return (
    <div className="flex flex-wrap gap-1.5">
      <RoleTag role={u.role} ownerType={u.owner_type} />
      {u.is_active === false ? (
        <span className="badge bg-rust text-white">Deactivated</span>
      ) : (
        <span className="badge bg-leaf-light text-leaf">Active</span>
      )}
      {u.verified ? (
        <span className="badge bg-leaf-light text-leaf">Verified</span>
      ) : (
        <span className="badge bg-amber2-light text-amber2">Not verified</span>
      )}
      {suspended && <span className="badge bg-rust-light text-rust">Booking suspended</span>}
      {u.application_status === 'pending' && (
        <span className="badge bg-gold-light text-amber2">
          {u.requested_role === 'owner'
            ? `Applying: ${roleLabel('owner', u.owner_type)}`
            : 'ID verification pending'}
        </span>
      )}
      {u.application_status === 'rejected' && (
        <span className="badge bg-rust-light text-rust">
          {u.requested_role === 'owner' ? 'Owner request rejected' : 'ID rejected'}
        </span>
      )}
      {u.warnings > 0 && (
        <span className="badge bg-paper text-ink-soft border border-paper-line">
          {u.warnings} warning{u.warnings > 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}
