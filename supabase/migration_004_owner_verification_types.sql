-- Owner verification types based on the ResourcesHub owner onboarding flow.
alter table profiles
  add column if not exists owner_type text check (owner_type in ('college_staff','organization','individual')),
  add column if not exists organization_name text,
  add column if not exists owner_address text,
  add column if not exists resource_share_list text;
