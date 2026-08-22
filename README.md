# Kahalla Borehole Control

A production-oriented replacement for the Blynk-based ESP32 borehole controller. The workspace contains safe local pump-control firmware, fallback captive-portal Wi-Fi provisioning, authenticated HTTPS telemetry and commands, a Supabase backend, a responsive React PWA, and a Capacitor Android application.

The original `IOT Borehole Switch_100746.c` is retained unchanged as the hardware and behavior baseline.

## Confirmed pin contract

| Function | GPIO | Firmware behavior |
|---|---:|---|
| Ultrasonic ECHO | 14 | Input; must not exceed ESP32 input voltage |
| Ultrasonic TRIG | 27 | Output |
| Buzzer | 26 | Active high assumption |
| Status LED | 25 | Output |
| Pump relay | 33 | Active high assumption from original code |

Relay polarity and the ultrasonic ECHO voltage remain **not physically verified**.

## Software boundaries

- The ESP32 performs automatic control locally. Internet availability never decides whether the pump should stop at the upper limit.
- The dashboard inserts authorized, expiring commands. The ESP32 polls for them over TLS.
- Device tokens are unique per unit. Only bcrypt hashes are stored in Postgres.
- Users see only devices assigned through `borehole_device_members` policies.
- Invalid sensing and boot both request the safe relay-off state.
- The configured tank depth is the usable water depth. The 10 cm mounting offset represents the sensor-to-full-water clearance; the valid sensor-to-bottom distance is therefore `usable depth + offset`.
- The firmware uses five ultrasonic samples per median reading, three validated readings before enabling control, stale-reading rejection and a three-failure sensor lockout.

## ESP32 build

Copy the ignored credential template and enter per-device values:

```bash
cp firmware/include/secrets.example.h firmware/include/secrets.h
/home/nujoka/.platformio/penv/bin/pio run -e esp32dev
```

The HTTPS root CA must be checked against the deployed endpoint before flashing. Do not use an insecure TLS client in production.

On first boot, the firmware exposes a temporary access point named `Kahalla-Pump-xxxx`. Connect to it with a phone and enter the installation Wi-Fi credentials. Stored credentials are retried on later boots.

The ignored local `secrets.h` first attempts the installation network (`Default` in the current local setup). Only after a 20-second unsuccessful primary attempt does the non-blocking captive portal start. Credentials are never logged.

## Dashboard

```bash
cp .env.example .env.local
npm install
npm run dev
```

Only the Supabase URL and publishable key belong in `VITE_` variables. Never expose a service-role or secret key to the PWA.

Quality gates:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

After deploying the backend and provisioning a development device, live data can be exercised without an ESP32:

```bash
BOREHOLE_TELEMETRY_URL=https://PROJECT.supabase.co/functions/v1/borehole-telemetry \
BOREHOLE_DEVICE_CODE=BHS_DEV BOREHOLE_DEVICE_TOKEN=YOUR_DEV_TOKEN \
npm run simulate:device
```

## Supabase

Apply migrations in order, deploy `borehole-telemetry` and `borehole-commands`, then create each device with a long random token whose bcrypt hash is stored in `borehole_devices.token_hash`. Assign users through `borehole_device_members` and add one matching `borehole_device_settings` row.

No Supabase project is linked from this repository, so migrations and functions are not deployed automatically.

The intended production project name is `IoT Borehole Control`. Creation was attempted in the connected Supabase organization, but the account currently has two active free projects and Supabase rejected a third. Do not reuse an unrelated project merely to bypass that limit.

## Existing production Site

The existing Site is `Borehole Control` at <https://borehole-control.nujoka.chatgpt.site/> with project ID `appgprj_6a88d464f74481919ca40702644620c7`. Its source binding is recorded in `.openai/hosting.json`. Production deployment remains blocked until the dedicated Supabase project exists and the Site can be configured with that project's URL and publishable key.

## Android

Build the debug APK from the same frontend:

```bash
npm run android:apk
```

The APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`. It is debug-signed only; release signing requires an owner-controlled keystore and must not reuse the debug certificate.

The original C file contains a historical Blynk token. Rotate that token before sharing or publishing this workspace; the replacement firmware does not use it.

## Verification status

Software compilation and tests do not validate relay polarity, ECHO voltage, tank geometry, acoustic behavior, contactor wiring, pump current, dry-run protection or real network reliability. Those require the exact hardware and a controlled hardware-in-the-loop test before connecting a pump.
