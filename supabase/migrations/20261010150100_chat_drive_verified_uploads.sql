-- Server-only ledger. No Drive session URLs or unverified IDs are exposed via Data API.
create table public.chat_drive_folders (
 folder_key text primary key,
 drive_folder_id text not null unique,
 created_at timestamptz not null default now()
);
create table public.chat_drive_uploads (
 message_id uuid primary key,
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 sender_id uuid not null references public.profiles(id),
 drive_file_id text not null unique,
 drive_folder_id text not null,
 file_name text not null check(length(file_name) between 1 and 255),
 mime_type text not null check(length(mime_type) between 1 and 255),
 file_size bigint not null check(file_size between 1 and 52428800),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 upload_url text,
 session_created_at timestamptz,
 verified_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.chat_drive_migration_results (
 message_id uuid primary key references public.messages(id) on delete cascade,
 legacy_path text not null,
 status text not null check(status in ('pending','migrated','missing','corrupt','failed')),
 original_bytes bigint,
 sha256 text,
 drive_file_id text,
 preview_status text,
 error text,
 updated_at timestamptz not null default now()
);
alter table public.chat_drive_folders enable row level security;
alter table public.chat_drive_uploads enable row level security;
alter table public.chat_drive_migration_results enable row level security;
revoke all on public.chat_drive_folders,public.chat_drive_uploads,public.chat_drive_migration_results from public,anon,authenticated;
grant all on public.chat_drive_folders,public.chat_drive_uploads,public.chat_drive_migration_results to service_role;
-- This trigger has a narrow privileged purpose: verify immutable server-written ledger.
create or replace function public.validate_chat_attachment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare object_metadata jsonb;
begin
 if new.attachment_drive_file_id is not null then
  if not exists(select 1 from public.chat_drive_uploads u where
   u.message_id=new.id and u.conversation_id=new.conversation_id and u.sender_id=new.sender_id
   and u.drive_file_id=new.attachment_drive_file_id and u.verified_at is not null
   and u.file_name=new.attachment_name and u.mime_type=new.attachment_type and u.file_size=new.attachment_size) then
   raise exception 'Drive attachment is not verified for this message' using errcode='23514';
  end if;
 elsif new.attachment_path is not null then
  select metadata into object_metadata from storage.objects where bucket_id='chat-attachments' and name=new.attachment_path;
  if object_metadata is null or (object_metadata->>'size')::bigint is distinct from new.attachment_size
   or split_part(object_metadata->>'mimetype',';',1) is distinct from split_part(new.attachment_type,';',1) then
   raise exception 'Attachment upload missing or metadata mismatch' using errcode='23514';
  end if;
 end if;
 return new;
end;
$$;
revoke all on function public.validate_chat_attachment() from public,anon,authenticated;
-- Also guard migration/update linkage; read receipts do not require a Drive lookup.
create trigger messages_validate_drive_update before update of attachment_drive_file_id,attachment_name,attachment_type,attachment_size,attachment_path on public.messages for each row execute function public.validate_chat_attachment();
-- Keep legacy read paths intact during deployment. Blocking Storage writes is a separate
-- cutover after integration checks and production frontend deployment.
-- Scoped migration jobs, queued only by an authenticated database operator.
create table public.chat_drive_operator_jobs (
 id uuid primary key default gen_random_uuid(),
 message_id uuid not null references public.messages(id) on delete cascade,
 token_sha256 text not null,
 expires_at timestamptz not null,
 status text not null default 'queued' check(status in ('queued','running','finished','failed')),
 result jsonb,
 created_at timestamptz not null default now()
);
alter table public.chat_drive_operator_jobs enable row level security;
revoke all on public.chat_drive_operator_jobs from public,anon,authenticated;
grant all on public.chat_drive_operator_jobs to service_role;
