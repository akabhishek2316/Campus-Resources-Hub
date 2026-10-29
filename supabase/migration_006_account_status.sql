-- Run once in the Supabase SQL Editor if you already installed an earlier version.
-- Account status: an admin can deactivate an account (it is blocked from signing in) and reactivate it later.
alter table profiles
  add column if not exists is_active boolean not null default true,
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_by uuid,
  add column if not exists deactivation_reason text;
