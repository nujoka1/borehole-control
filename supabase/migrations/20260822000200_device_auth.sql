create or replace function public.authenticate_borehole_device(
  supplied_code text,
  supplied_token text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_device_id uuid;
begin
  if supplied_code is null or supplied_token is null
     or char_length(supplied_token) < 24
     or char_length(supplied_token) > 256 then
    return null;
  end if;
  select d.id into matched_device_id
  from public.borehole_devices d
  where d.device_code = supplied_code
    and d.token_hash = crypt(supplied_token, d.token_hash);
  return matched_device_id;
end;
$$;

revoke all on function public.authenticate_borehole_device(text, text) from public;
revoke all on function public.authenticate_borehole_device(text, text) from anon;
revoke all on function public.authenticate_borehole_device(text, text) from authenticated;
grant execute on function public.authenticate_borehole_device(text, text) to service_role;
