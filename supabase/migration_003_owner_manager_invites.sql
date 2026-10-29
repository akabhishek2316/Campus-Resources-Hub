-- Owner-managed manager invitations and scoped permissions.
-- Safe to run after migration_002_role_applications.sql or the previous schema.sql.
create table if not exists manager_invitations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  permissions jsonb not null default '{"booking_requests":true,"check_in_out":true,"incidents":true,"manage_resources":false}'::jsonb,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  manager_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists owner_managers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  manager_id uuid not null references profiles(id) on delete cascade,
  permissions jsonb not null default '{"booking_requests":true,"check_in_out":true,"incidents":true,"manage_resources":false}'::jsonb,
  invited_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index if not exists owner_managers_one_active_owner_per_manager
  on owner_managers(manager_id) where revoked_at is null;
create index if not exists owner_managers_owner_active on owner_managers(owner_id) where revoked_at is null;
alter table manager_invitations enable row level security;
alter table owner_managers enable row level security;

create or replace function can_access_booking(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from bookings b join resources r on r.id = b.resource_id
    where b.id = bid and (
      b.user_id = auth.uid() or r.owner_id = auth.uid()
      or (select role from profiles where id = auth.uid()) = 'admin'
      or (r.manager_id = auth.uid() and exists (
        select 1 from owner_managers om where om.owner_id = r.owner_id and om.manager_id = auth.uid()
          and om.revoked_at is null and (coalesce((om.permissions->>'booking_requests')::boolean, false)
            or coalesce((om.permissions->>'check_in_out')::boolean, false)
            or coalesce((om.permissions->>'incidents')::boolean, false))
      )))) $$;
