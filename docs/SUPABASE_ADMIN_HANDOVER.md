# Supabase administrator handover

This runbook transfers ownership of the Smart Water Tank device to
`ahmadkgaladima@gmail.com` after the production Supabase project is connected.
No live account or database change was made while Supabase was disconnected.

The firmware device code remains `KAHALLA_BOREHOLE_01`. It is a stable technical
identifier shared by the firmware and backend, not customer-facing branding.
Changing it requires coordinated device reprovisioning and is outside this
account handover.

## 1. Create and verify Ahmad's account

1. Open the correct Supabase project and confirm its URL matches the project's
   private deployment configuration. Do not paste keys into source files.
2. In **Authentication > Users**, invite or create
   `ahmadkgaladima@gmail.com`.
3. Complete email verification and record the generated user UUID.

Supabase documents user administration in its
[user-management guide](https://supabase.com/docs/guides/auth/managing-user-data).
Never use a service-role key in the browser, Android app, or client firmware.

## 2. Assign device ownership

Run this in the Supabase SQL Editor. It fails safely if either the verified user
or device is missing and can be re-run without creating duplicate memberships.

```sql
do $$
declare
  target_user_id uuid;
  target_device_id uuid;
begin
  select id into target_user_id
  from auth.users
  where lower(email) = lower('ahmadkgaladima@gmail.com');

  if target_user_id is null then
    raise exception 'Verified Ahmad account was not found';
  end if;

  select id into target_device_id
  from public.borehole_devices
  where device_code = 'KAHALLA_BOREHOLE_01';

  if target_device_id is null then
    raise exception 'KAHALLA_BOREHOLE_01 was not found';
  end if;

  insert into public.borehole_profiles (user_id, display_name)
  values (target_user_id, 'Ahmad K. Galadima')
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        updated_at = now();

  insert into public.borehole_device_members (device_id, user_id, role)
  values (target_device_id, target_user_id, 'owner')
  on conflict (device_id, user_id) do update
    set role = excluded.role;
end $$;
```

This is environment-specific account data, so do not add the email or user UUID
to a schema migration.

## 3. Verify before removing prior access

Run:

```sql
select
  u.email,
  d.device_code,
  d.name,
  m.role
from public.borehole_device_members m
join auth.users u on u.id = m.user_id
join public.borehole_devices d on d.id = m.device_id
where lower(u.email) = lower('ahmadkgaladima@gmail.com')
  and d.device_code = 'KAHALLA_BOREHOLE_01';
```

Then verify all of the following:

- Ahmad can sign in through the deployed dashboard.
- The assigned tank appears and live state is readable.
- Automatic limits can be submitted by the owner account.
- Another user cannot read this device unless explicitly assigned.
- The database security advisors show no unresolved RLS exposure.

The authorization boundary is the database membership and RLS policy, not the
email shown in the React interface. See Supabase's
[RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security).

## 4. Retire the old owner only after acceptance

After Ahmad has completed the checks, revoke active sessions for the previous
administrator and remove or demote only that user's row in
`public.borehole_device_members`. Keep the old user temporarily for rollback;
do not immediately delete the authentication record.

Finally, ensure the Authentication URL configuration permits the deployed app:

```text
https://nujoka1.github.io/borehole-control/
```

Re-test sign-in from the installed Android app as well as the browser dashboard.
