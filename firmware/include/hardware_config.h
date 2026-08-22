#pragma once

#include <stdint.h>

// Preserved from IOT Borehole Switch_100746.c.
constexpr uint8_t ECHO_PIN = 14;
constexpr uint8_t TRIG_PIN = 27;
constexpr uint8_t BUZZER_PIN = 26;
constexpr uint8_t STATUS_LED_PIN = 25;
constexpr uint8_t RELAY_PIN = 33;

// The existing firmware drives HIGH to start the pump. Verify this on the
// physical relay/contactor before connecting a pump.
constexpr uint8_t RELAY_ACTIVE_LEVEL = 1;
constexpr uint8_t RELAY_INACTIVE_LEVEL = 0;

constexpr uint32_t SENSOR_SAMPLE_INTERVAL_MS = 500;
constexpr uint32_t TELEMETRY_INTERVAL_MS = 10000;
constexpr uint32_t COMMAND_POLL_INTERVAL_MS = 5000;
constexpr uint32_t WIFI_RETRY_INTERVAL_MS = 15000;
constexpr uint32_t ECHO_TIMEOUT_US = 30000;
constexpr uint8_t REQUIRED_VALID_SAMPLES = 3;
constexpr uint8_t MEDIAN_SAMPLE_COUNT = 5;
constexpr uint8_t SENSOR_FAILURE_LOCKOUT_COUNT = 3;
constexpr uint32_t SENSOR_STALE_AFTER_MS = 4000;
constexpr uint32_t WIFI_PRIMARY_TIMEOUT_MS = 20000;
