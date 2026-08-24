<p align="center">
  <img src="public/logo-horizontal.svg" width="520" alt="Smart Water Tank" />
</p>

<p align="center">
  Local-first ESP32 tank and pump control with secure web and Android monitoring.
</p>

<p align="center">
  <a href="https://nujoka1.github.io/borehole-control/"><strong>Open live dashboard</strong></a>
  · <a href="docs/CLIENT_FLASHING_GUIDE.md">Flash an ESP32</a>
  · <a href="docs/USER_GUIDE.md">User guide</a>
  · <a href="docs/PROJECT_WRITEUP.md">Project write-up</a>
</p>

![Smart Water Tank product overview](docs/images/system-hero.png)

## Overview

Smart Water Tank, built for the Kachalla water system, replaces the original
Blynk interface with a complete
IoT product stack:

- ESP32 firmware with local automatic control and safe failure behavior
- ultrasonic tank-level measurement and configurable calibration
- authenticated Supabase telemetry and expiring device commands
- responsive React PWA with light and dark themes
- Capacitor Android application
- Arduino IDE and PlatformIO delivery paths
- client flashing, wiring, operation and commissioning documentation

Automatic pump decisions remain on the ESP32. A temporary internet or cloud
failure cannot remove the local upper-threshold stop logic.

## System architecture

![Smart Water Tank architecture](docs/images/system-architecture.svg)

The dashboard submits authorized commands to Supabase. The ESP32 polls for those
commands over TLS, validates them against local safety interlocks, acknowledges
the result and continues autonomous control when offline.

## Current status

| Requirement | Status | Verification |
|---|---|---|
| Native control logic tests | PASS | Automated Unity tests |
| PlatformIO ESP32 build | PASS | `esp32dev` release image generated |
| Arduino IDE-compatible build | PASS | Compiled for ESP32 Dev Module |
| Dashboard tests/type/lint/build | PASS | Local quality gates |
| GitHub Pages dashboard | PASS | [Live deployment](https://nujoka1.github.io/borehole-control/) |
| Supabase backend and RLS | PASS | Production project deployed and security advisors clear when checked |
| Android debug APK | PASS | Built and v1/v2 signature verified |
| Physical ESP32 and sensor behavior | NOT VERIFIED | Real hardware required |
| Pump electrical commissioning | NOT VERIFIED | Qualified electrician required |

Software build success is not evidence that relay polarity, sensor voltage,
contactor wiring, tank geometry or pump protection is correct.

## Confirmed pin contract

| Function | GPIO | Firmware behavior |
|---|---:|---|
| Ultrasonic ECHO | 14 | Input; use ESP32-safe voltage |
| Ultrasonic TRIG | 27 | Output |
| Buzzer | 26 | Active-high assumption |
| Status LED | 25 | Connected state / offline blink |
| Pump relay command | 33 | Active-high assumption |

See the full [installation and wiring guide](docs/INSTALLATION_AND_WIRING.md).

## Firmware

### PlatformIO

```bash
cp firmware/include/secrets.example.h firmware/include/secrets.h
/home/nujoka/.platformio/penv/bin/pio run -e esp32dev
```

Libraries and framework versions are pinned in `platformio.ini`. Never replace
TLS verification with an insecure client.

### Arduino IDE

Open:

```text
arduinoe files/Kahalla_Borehole_Control/Kahalla_Borehole_Control.ino
```

Install `esp32 by Espressif Systems`, `ArduinoJson` and `WiFiManager`. Keep all
files in the sketch folder together. The real `secrets.h` is intentionally
ignored and must be delivered privately.

For a non-technical client, use the merged full binary and the
[client flashing guide](docs/CLIENT_FLASHING_GUIDE.md).

## Dashboard development

```bash
cp .env.example .env.local
npm install
npm run dev
```

Quality gates:

```bash
npm test
npm run typecheck
npm run lint
npm run build -- --base=/borehole-control/
```

Only a Supabase URL and publishable key belong in frontend `VITE_` variables.
Never expose a service-role key in the dashboard or APK.

## Android

```bash
npm run android:apk
```

The generated debug APK is located at
`android/app/build/outputs/apk/debug/app-debug.apk`. Debug signing is appropriate
for testing only. A production release requires an owner-controlled keystore and
release process.

## Repository map

```text
firmware/                 ESP32 PlatformIO source and control tests
arduinoe files/           Arduino IDE-compatible client sketch
src/                      React dashboard
supabase/                 Database migrations and Edge Functions
android/                  Capacitor Android project
public/                   PWA, icon and brand assets
docs/                     Write-up, guides, diagrams and checklists
.github/workflows/        GitHub Pages CI/CD
```

The supplied `IOT Borehole Switch_100746.c` is retained as the legacy pin and
behavior baseline. It contains a historical Blynk credential; treat that token
as exposed and rotate it before any Blynk reuse.

## Documentation

- [Project write-up](docs/PROJECT_WRITEUP.md)
- [Client flashing guide](docs/CLIENT_FLASHING_GUIDE.md)
- [Installation and wiring](docs/INSTALLATION_AND_WIRING.md)
- [Dashboard user guide](docs/USER_GUIDE.md)
- [Deployment guide](docs/DEPLOYMENT.md)
- [Verification checklist](docs/VERIFICATION_CHECKLIST.md)
- [Security policy](SECURITY.md)
- [Supabase administrator handover](docs/SUPABASE_ADMIN_HANDOVER.md)

## Safety boundary

The repository covers the low-voltage control system. It does not replace a
properly rated contactor, overload device, breaker, earthing, emergency isolation
or qualified electrical work. Commission the installation through controlled
sensor, relay, offline and full-cycle testing before connecting a real pump.
