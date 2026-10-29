-- Run this once in the Supabase SQL Editor if you already installed the first version.

-- Role applications: what the person asked to become, and the documents they uploaded.
alter table profiles
  add column if not exists requested_role text check (requested_role in ('student','owner','manager')),
  add column if not exists application_status text not null default 'none' check (application_status in ('none','pending','approved','rejected')),
  add column if not exists designation text,
  add column if not exists employee_id text,
  add column if not exists application_note text,
  add column if not exists cv_path text,
  add column if not exists id_doc_path text,
  add column if not exists application_review_note text,
  add column if not exists application_reviewed_at timestamptz;
