alter table public.messages add column if not exists attachment_preview_path text;
alter table public.messages add constraint messages_preview_path_check check (
 attachment_preview_path is null or (attachment_path is not null and attachment_type like 'image/%'
 and attachment_preview_path=attachment_path||'-preview.jpg')
);
grant insert (attachment_preview_path) on public.messages to authenticated;
create policy chat_previews_insert on storage.objects for insert to authenticated with check (
 bucket_id='chat-attachments' and split_part(name,'/',2)=auth.uid()::text
 and split_part(name,'/',3) ~ '^[0-9a-f-]{36}-preview[.]jpg$'
 and exists (select 1 from public.conversations where id::text=split_part(name,'/',1))
);
create policy chat_previews_read on storage.objects for select to authenticated using (
 bucket_id='chat-attachments' and exists (select 1 from public.conversations where id::text=split_part(name,'/',1))
 and (split_part(name,'/',2)=auth.uid()::text or exists (select 1 from public.messages where attachment_preview_path=name))
);
