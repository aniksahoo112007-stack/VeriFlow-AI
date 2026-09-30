begin;

alter table public.documents
  add column if not exists invoice_number text,
  add column if not exists receipt_number text,
  add column if not exists vendor_address text,
  add column if not exists vendor_phone text,
  add column if not exists vendor_email text,
  add column if not exists transaction_date date,
  add column if not exists gst_amount numeric,
  add column if not exists cgst numeric,
  add column if not exists sgst numeric,
  add column if not exists igst numeric,
  add column if not exists discount numeric,
  add column if not exists paid_amount numeric,
  add column if not exists balance_amount numeric,
  add column if not exists utr_number text,
  add column if not exists transaction_id text,
  add column if not exists reference_number text,
  add column if not exists pan text,
  add column if not exists bank_name text,
  add column if not exists account_last4 text,
  add column if not exists payment_method text;

alter table public.documents drop constraint if exists documents_document_type_check;
-- Preserve suspicious signed values so application validation can flag them as evidence.
alter table public.documents drop constraint if exists documents_subtotal_check;
alter table public.documents drop constraint if exists documents_tax_amount_check;
alter table public.documents drop constraint if exists documents_total_amount_check;
alter table public.documents add constraint documents_document_type_check
  check (document_type is null or document_type in ('invoice','purchase_order','receipt','payment','expense_bill','form','contract','other'));

create index if not exists idx_documents_invoice_number on public.documents (user_id, lower(invoice_number));
create index if not exists idx_documents_utr_number on public.documents (user_id, lower(utr_number));
create index if not exists idx_documents_transaction_id on public.documents (user_id, lower(transaction_id));
create index if not exists idx_documents_reference_number on public.documents (user_id, lower(reference_number));

commit;
