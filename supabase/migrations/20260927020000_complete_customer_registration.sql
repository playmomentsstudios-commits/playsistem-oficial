create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,email,first_name,last_name,phone,document_number,postal_code,street,address_number,address_complement,neighborhood,city,state,role,status
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'document_number', ''),
    nullif(new.raw_user_meta_data ->> 'postal_code', ''),
    nullif(new.raw_user_meta_data ->> 'street', ''),
    nullif(new.raw_user_meta_data ->> 'address_number', ''),
    nullif(new.raw_user_meta_data ->> 'address_complement', ''),
    nullif(new.raw_user_meta_data ->> 'neighborhood', ''),
    nullif(new.raw_user_meta_data ->> 'city', ''),
    nullif(new.raw_user_meta_data ->> 'state', ''),
    'customer','active'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
