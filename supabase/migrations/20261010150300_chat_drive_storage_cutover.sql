-- Apply only after frontend deployment and live integration checks.
-- Retain legacy reads and all originals. Prevent any further chat bytes in Storage.
drop policy if exists chat_files_insert on storage.objects;
drop policy if exists chat_previews_insert on storage.objects;
