-- ResourcesHub schema. Run the whole file once in Supabase > SQL Editor.
create extension if not exists btree_gist;

-- ---------- tables ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null default 'student' check (role in ('student','owner','manager','admin')),
  department text,
  college_id text,
  verified boolean not null default false,
  warnings int not null default 0,
  suspended_until timestamptz,
  created_at timestamptz not null default now()
);

-- Role applications: what the person asked to become, and the documents they uploaded.
alter table profiles
  add column if not exists requested_role text check (requested_role in ('student','owner','manager')),
  add column if not exists application_status text not null default 'none' check (application_status in ('none','pending','approved','rejected')),
  add column if not exists owner_type text check (owner_type in ('college_staff','organization','individual')),
  add column if not exists organization_name text,
  add column if not exists owner_address text,
  add column if not exists resource_share_list text,
  add column if not exists designation text,
  add column if not exists employee_id text,
  add column if not exists application_note text,
  add column if not exists cv_path text,
  add column if not exists id_doc_path text,
  add column if not exists college_id_doc_path text,
  add column if not exists application_review_note text,
  add column if not exists application_reviewed_at timestamptz;

-- Account status: an admin can deactivate an account (it is blocked from signing in) and reactivate it later.
alter table profiles
  add column if not exists is_active boolean not null default true,
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_by uuid,
  add column if not exists deactivation_reason text;

-- Owner-managed invitations. Pending invitations grant no access; accepted managers
-- are linked to exactly one owner at a time. Tokens are stored only as SHA-256 hashes.
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

create table if not exists trainings (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists user_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  training_id uuid not null references trainings(id) on delete cascade,
  proof_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, training_id)
);

create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id),
  manager_id uuid references profiles(id),
  name text not null,
  category text not null,
  location text not null,
  description text,
  rules text,
  image_url text,
  requires_approval boolean not null default true,
  high_demand boolean not null default false,
  max_hours_per_booking int not null default 3,
  weekly_cap_hours int not null default 8,
  max_active_bookings int not null default 2,
  deposit_note text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists availability_windows (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references resources(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),   -- 0 = Sunday
  start_hour int not null check (start_hour between 0 and 23),
  end_hour int not null check (end_hour between 1 and 24)
);

create table if not exists resource_requirements (
  resource_id uuid not null references resources(id) on delete cascade,
  training_id uuid not null references trainings(id) on delete cascade,
  primary key (resource_id, training_id)
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references resources(id),
  user_id uuid not null references profiles(id),
  start_at timestamptz not null,
  end_at timestamptz not null,
  purpose text not null,
  purpose_type text not null default 'personal' check (purpose_type in ('course_project','research','personal')),
  status text not null check (status in ('pending_review','approved','rejected','waitlisted','auto_rejected','checked_in','overdue','returned','closed','cancelled','no_show')),
  decision_reason text,
  decided_by uuid,
  decided_at timestamptz,
  priority_score numeric not null default 0,
  priority_explanation text,
  otp text,
  checked_in_at timestamptz,
  checked_in_by uuid,
  returned_at timestamptz,
  reminder_sent boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

-- Hard guarantee against double booking, enforced by the database itself.
alter table bookings drop constraint if exists no_double_booking;
alter table bookings add constraint no_double_booking
  exclude using gist (resource_id with =, tstzrange(start_at, end_at) with &&)
  where (status in ('approved','checked_in','overdue'));

create table if not exists condition_reports (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  phase text not null check (phase in ('before','after')),
  rating int not null check (rating between 1 and 5),
  notes text,
  photo_paths text[] not null default '{}',
  recorded_by uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists incidents (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  resource_id uuid not null references resources(id),
  reported_by uuid,
  type text not null check (type in ('damage','delay','conflict','misuse')),
  description text not null,
  auto_flagged boolean not null default false,
  ai_summary text,
  status text not null default 'open' check (status in ('open','resolved')),
  resolution text check (resolution in ('no_action','warning','suspension')),
  resolution_note text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  message text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_name text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  booking_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_bookings_resource_time on bookings (resource_id, start_at, end_at);
create index if not exists idx_bookings_user on bookings (user_id);
create index if not exists idx_audit_booking on audit_log (booking_id);

-- The audit log is insert-only, even for the service role.
create or replace function audit_log_immutable() returns trigger language plpgsql as $$
begin raise exception 'audit_log is append-only'; end $$;
drop trigger if exists audit_no_update on audit_log;
create trigger audit_no_update before update or delete on audit_log
  for each row execute function audit_log_immutable();

-- ---------- new user -> profile ----------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, department, college_id)
  values (new.id, new.email,
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'department',
    new.raw_user_meta_data->>'college_id');
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- helper functions for RLS ----------
create or replace function my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() $$;

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

-- ---------- row level security ----------
-- All writes go through server actions using the service role after explicit
-- permission checks. RLS protects every read made with a user session.
alter table profiles enable row level security;
alter table manager_invitations enable row level security;
alter table owner_managers enable row level security;
alter table trainings enable row level security;
alter table user_credentials enable row level security;
alter table resources enable row level security;
alter table availability_windows enable row level security;
alter table resource_requirements enable row level security;
alter table bookings enable row level security;
alter table condition_reports enable row level security;
alter table incidents enable row level security;
alter table notifications enable row level security;
alter table audit_log enable row level security;

drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select to authenticated using (
  id = auth.uid() or my_role() = 'admin' or role in ('owner','manager','admin')
  or exists (select 1 from bookings b join resources r on r.id = b.resource_id
             where b.user_id = profiles.id and (r.owner_id = auth.uid() or r.manager_id = auth.uid())));

drop policy if exists trainings_read on trainings;
create policy trainings_read on trainings for select to authenticated using (true);
drop policy if exists resources_read on resources;
create policy resources_read on resources for select to authenticated using (true);
drop policy if exists windows_read on availability_windows;
create policy windows_read on availability_windows for select to authenticated using (true);
drop policy if exists reqs_read on resource_requirements;
create policy reqs_read on resource_requirements for select to authenticated using (true);

drop policy if exists creds_read on user_credentials;
create policy creds_read on user_credentials for select to authenticated using (user_id = auth.uid() or my_role() = 'admin');

drop policy if exists bookings_read on bookings;
create policy bookings_read on bookings for select to authenticated using (can_access_booking(id));
drop policy if exists reports_read on condition_reports;
create policy reports_read on condition_reports for select to authenticated using (can_access_booking(booking_id));
drop policy if exists incidents_read on incidents;
create policy incidents_read on incidents for select to authenticated using (can_access_booking(booking_id));
drop policy if exists notifs_read on notifications;
create policy notifs_read on notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists audit_read on audit_log;
create policy audit_read on audit_log for select to authenticated using (
  my_role() = 'admin' or (booking_id is not null and can_access_booking(booking_id)));

-- ---------- training requests (owner asks admin to add a training) ----------
create table if not exists training_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references profiles(id) on delete cascade,
  name text not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note text,
  training_id uuid references trainings(id) on delete set null,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table training_requests enable row level security;
drop policy if exists training_requests_read on training_requests;
create policy training_requests_read on training_requests for select to authenticated using (requested_by = auth.uid() or my_role() = 'admin');

-- ---------- private storage for photos and proofs ----------
insert into storage.buckets (id, name, public) values ('evidence', 'evidence', false)
on conflict (id) do nothing;
