-- Sender-only soft deletion for everyone; preserve audit trail and original attachments.
alter table public.messages add column if not exists deleted_at timestamptz;
create or replace function public.delete_own_chat_message(p_message_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.messages m set deleted_at=now()
  where m.id=p_message_id and m.sender_id=auth.uid() and m.deleted_at is null
    and exists(select 1 from public.conversations c where c.id=m.conversation_id);
  if not found then raise exception 'Mensagem indisponível ou sem permissão para excluir' using errcode='42501'; end if;
end;
$$;
revoke all on function public.delete_own_chat_message(uuid) from public,anon;
grant execute on function public.delete_own_chat_message(uuid) to authenticated;
