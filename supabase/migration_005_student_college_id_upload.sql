-- Student registration: store the private evidence-bucket path for the uploaded college ID card.
alter table public.profiles
  add column if not exists college_id_doc_path text;
