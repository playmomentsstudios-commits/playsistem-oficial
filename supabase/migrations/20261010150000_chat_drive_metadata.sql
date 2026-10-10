-- Metadata-only pointer to the original Google Drive file. Old Storage objects remain untouched.
alter table public.messages add column if not exists attachment_drive_file_id text;
alter table public.messages add constraint messages_attachment_drive_id_check check (
  attachment_drive_file_id is null or (
    attachment_path is null and attachment_name is not null
    and attachment_type is not null and attachment_size is not null
    and length(attachment_drive_file_id) between 10 and 200
  )
);
-- Existing attachment check must accept either the old Storage path or a Drive pointer.
alter table public.messages drop constraint if exists messages_attachment_check;
alter table public.messages add constraint messages_attachment_check check (
 (attachment_path is null and attachment_drive_file_id is null and attachment_name is null and attachment_type is null and attachment_size is null)
 or (
   attachment_name is not null and attachment_type is not null and attachment_size is not null
   and char_length(attachment_name) between 1 and 255
   and char_length(attachment_type) between 1 and 255
   and attachment_size between 1 and 52428800
   and (
     (attachment_drive_file_id is null and attachment_path = conversation_id::text || '/' || sender_id::text || '/' || id::text)
     or (attachment_drive_file_id is not null and attachment_path is null)
   )
 )
);
grant insert (attachment_drive_file_id) on public.messages to authenticated;
-- Storage validation only applies to legacy objects.
