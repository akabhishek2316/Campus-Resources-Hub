-- Run once in the Supabase SQL Editor if you already installed an earlier version.
-- Training requests: an owner asks the admin to add a training that one of their resources needs.
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
