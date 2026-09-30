-- VeriFlow AI database schema. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null check (email = lower(email)),
  password_hash text,
  full_name text,
  avatar_url text,
  auth_provider text not null default 'local' check (auth_provider in ('local','google')),
  google_subject text unique,
  role text not null default 'user' check (role in ('user','reviewer','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text unique not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  original_name text,
  storage_path text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  document_type text check (document_type is null or document_type in ('invoice','purchase_order','receipt','expense_bill','form','contract','other')),
  document_number text,
  vendor_name text,
  document_date date,
  currency text,
  subtotal numeric check (subtotal is null or subtotal >= 0),
  tax_amount numeric check (tax_amount is null or tax_amount >= 0),
  total_amount numeric check (total_amount is null or total_amount >= 0),
  purchase_order_number text,
  gstin text,
  due_date date,
  line_items jsonb not null default '[]'::jsonb,
  summary text,
  status text not null default 'uploaded' check (status in ('uploaded','under_review','approved','rejected','review_requested')),
  processing_status text not null default 'pending' check (processing_status in ('pending','processing','completed','failed')),
  ai_model text,
  ai_confidence numeric check (ai_confidence is null or ai_confidence between 0 and 1),
  raw_extraction jsonb,
  risk_score integer check (risk_score is null or risk_score between 0 and 100),
  risk_level text check (risk_level is null or risk_level in ('low','medium','high')),
  processing_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_links (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null references public.documents(id) on delete cascade,
  reference_document_id uuid not null references public.documents(id) on delete cascade,
  relation_type text not null,
  created_at timestamptz not null default now(),
  unique (source_document_id, reference_document_id, relation_type),
  check (source_document_id <> reference_document_id)
);

create table if not exists public.validation_results (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  code text not null,
  severity text not null check (severity in ('info','warning','critical')),
  title text not null,
  description text,
  field_name text,
  expected_value text,
  actual_value text,
  passed boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  action text not null check (action in ('approved','rejected','review_requested','edited_extraction')),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  document_id uuid references public.documents(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists users_email_idx on public.users(email);
create index if not exists refresh_tokens_user_id_idx on public.refresh_tokens(user_id);
create index if not exists documents_user_id_idx on public.documents(user_id);
create index if not exists documents_status_idx on public.documents(status);
create index if not exists documents_processing_status_idx on public.documents(processing_status);
create index if not exists documents_document_type_idx on public.documents(document_type);
create index if not exists documents_created_at_idx on public.documents(created_at desc);
create index if not exists documents_document_number_idx on public.documents(document_number);
create index if not exists documents_purchase_order_number_idx on public.documents(purchase_order_number);
create index if not exists validation_results_document_id_idx on public.validation_results(document_id);
create index if not exists approvals_document_id_idx on public.approvals(document_id);
create index if not exists audit_logs_user_id_idx on public.audit_logs(user_id);
create index if not exists audit_logs_document_id_idx on public.audit_logs(document_id);
create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_read_at_idx on public.notifications(read_at);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at before update on public.users for each row execute function public.set_updated_at();
drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at before update on public.documents for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.refresh_tokens enable row level security;
alter table public.documents enable row level security;
alter table public.document_links enable row level security;
alter table public.validation_results enable row level security;
alter table public.approvals enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;

-- No anonymous/authenticated policies are created. The trusted Express service
-- uses the server-side Supabase secret and enforces identity and ownership.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760, array['application/pdf','image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

