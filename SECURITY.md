# Security policy

Report suspected credential exposure or unauthorized device control privately
to the repository owner. Do not include tokens, passwords, service-role keys or
customer installation details in a public issue.

## Secrets

- `firmware/include/secrets.h` and the Arduino sketch `secrets.h` are ignored.
- Device firmware and private ZIP packages contain credentials; share privately.
- Frontend `VITE_` values must contain only the Supabase URL and publishable key.
- Use one device token per controller and rotate it after suspected exposure.
- The supplied legacy C baseline contains a historical Blynk credential. Treat
  it as exposed and rotate/revoke it before any Blynk reuse.

## Authorization

Dashboard permissions must be enforced by Supabase RLS and membership roles,
not only by hidden buttons. Device endpoints must verify both device code and
token. Privileged database functions must not be executable by anonymous users.

## Supported version

Only the latest `main` branch and currently deployed backend are maintained.
Physical electrical safety issues are outside software vulnerability handling
and require immediate isolation plus qualified inspection.
