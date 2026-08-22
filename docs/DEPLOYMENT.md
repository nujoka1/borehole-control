# Deployment guide

## Dashboard

The React application is deployed through `.github/workflows/pages.yml` to:

<https://nujoka1.github.io/borehole-control/>

The workflow installs locked dependencies, runs tests, type checking and lint,
builds with the `/borehole-control/` base path and publishes the `dist` folder.

Required production variables are stored in `.env.production`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

These values are public client configuration. Never place a Supabase service
role key in a `VITE_` variable, frontend bundle or Android application.

## Supabase

The backend uses migrations under `supabase/migrations` and the Edge Functions:

- `borehole-telemetry`
- `borehole-commands`

Tables use row-level security. Device requests use a device code and private
token; the database stores only a bcrypt token hash. Commands expire and are
audited. Apply migrations in timestamp order and run Supabase security advisors
after every policy or function change.

## Android

```bash
npm run android:apk
```

The resulting debug build is under
`android/app/build/outputs/apk/debug/app-debug.apk`. A commercial release needs
an owner-controlled signing keystore, protected signing credentials, a release
build and store policy review. Never publish a debug-signed APK as production.

## Firmware

```bash
/home/nujoka/.platformio/penv/bin/pio run -e esp32dev
```

The normal application image is `.pio/build/esp32dev/firmware.bin`. A first-time
single-file client flash should use a deliberately merged full image at offset
`0x0`; see [Client flashing guide](CLIENT_FLASHING_GUIDE.md).
