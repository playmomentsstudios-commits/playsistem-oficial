alter table public.chat_drive_migration_results
 add column source_kind text not null default 'legacy',
 add column source_drive_file_id text,
 add column legacy_sha256 text,
 add column restored_bytes bigint,
 add column archived_drive_file_id text;
