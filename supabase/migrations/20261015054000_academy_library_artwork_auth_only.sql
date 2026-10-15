-- Only authenticated accounts may invoke the library-cover helper.
-- Row-level grant checks inside the function remain unchanged.
revoke all on function public.academy_my_library_artwork() from public,anon;
grant execute on function public.academy_my_library_artwork() to authenticated;
