#pragma once

// Copy to secrets.h. This file must never contain real credentials.
#define WIFI_SSID "your-wifi-name"
#define WIFI_PASSWORD "your-wifi-password"
#define DEVICE_CODE "BHS_001"
#define DEVICE_TOKEN "replace-with-a-long-random-device-token"
#define TELEMETRY_URL \
  "https://YOUR_PROJECT_REF.supabase.co/functions/v1/borehole-telemetry"
#define COMMAND_URL \
  "https://YOUR_PROJECT_REF.supabase.co/functions/v1/borehole-commands"

// Paste the currently verified root CA for the deployed HTTPS endpoints.
static const char API_ROOT_CA[] = R"EOF(
-----BEGIN CERTIFICATE-----
PASTE_CURRENT_ROOT_CA_CERTIFICATE_HERE
-----END CERTIFICATE-----
)EOF";
