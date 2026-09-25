-- Private original files. Each object belongs to one immutable message.
insert into storage.buckets(id, name, public, file_size_limit)
values ('chat-attachments', 'chat-attachments', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

alter table public.messages
  add column attachment_path text,
  add column attachment_name text,
  add column attachment_type text,
  add column attachment_size bigint;
alter table public.messages drop constraint messages_content_check;
alter table public.messages add constraint messages_content_check check (
  char_length(content) <= 5000 and (char_length(trim(content)) > 0 or attachment_path is not null)
);
alter table public.messages add constraint messages_attachment_check check (
  (attachment_path is null and attachment_name is null and attachment_type is null and attachment_size is null)
  or (attachment_path is not null and attachment_name is not null and attachment_type is not null and attachment_size is not null
    and char_length(attachment_name) between 1 and 255 and char_length(attachment_type) between 1 and 255
    and attachment_size between 1 and 52428800
    and attachment_path = conversation_id::text || '/' || sender_id::text || '/' || id::text)
);
grant insert (attachment_path, attachment_name, attachment_type, attachment_size) on public.messages to authenticated;

create policy chat_files_insert on storage.objects for insert to authenticated
with check (bucket_id = 'chat-attachments'
  and array_length(string_to_array(name, '/'), 1) = 3
  and split_part(name, '/', 2) = auth.uid()::text
  and split_part(name, '/', 3) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and exists (select 1 from public.conversations where id::text = split_part(name, '/', 1))
);
create policy chat_files_read on storage.objects for select to authenticated
using (bucket_id = 'chat-attachments'
  and exists (select 1 from public.conversations where id::text = split_part(name, '/', 1))
  and (split_part(name, '/', 2) = auth.uid()::text
    or exists (select 1 from public.messages where attachment_path = name))
);
-- Sent files cannot be replaced or deleted through the client. Only abandoned uploads.
create policy chat_files_delete_draft on storage.objects for delete to authenticated
using (bucket_id = 'chat-attachments' and split_part(name, '/', 2) = auth.uid()::text
  and exists (select 1 from public.conversations where id::text = split_part(name, '/', 1))
  and not exists (select 1 from public.messages where attachment_path = name)
);

-- Verify the object actually exists before making an attachment visible in the chat.
create function public.validate_chat_attachment()
returns trigger language plpgsql security definer set search_path = public
as $$
declare object_metadata jsonb;
begin
  if new.attachment_path is not null then
    select metadata into object_metadata from storage.objects
      where bucket_id = 'chat-attachments' and name = new.attachment_path;
    if object_metadata is null
      or (object_metadata->>'size')::bigint is distinct from new.attachment_size
      or object_metadata->>'mimetype' is distinct from new.attachment_type then
      raise exception 'Attachment upload missing or metadata mismatch' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_chat_attachment() from public;
create trigger messages_validate_attachment before insert on public.messages
for each row execute function public.validate_chat_attachment();
