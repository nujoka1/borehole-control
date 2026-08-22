#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>

#include "control.h"
#include "hardware_config.h"

#if __has_include("secrets.h")
#include "secrets.h"
#else
#error "Copy firmware/include/secrets.example.h to firmware/include/secrets.h"
#endif

Preferences preferences;
WiFiManager wifiManager;
ControlConfig config;
ControlState controlState;
Measurement latestMeasurement;
uint8_t consecutiveValidSamples = 0;
uint8_t consecutiveFailures = 0;
float distanceSamples[MEDIAN_SAMPLE_COUNT] = {};
uint8_t distanceSampleCount = 0;
uint32_t lastValidMeasurementAt = 0;
uint32_t wifiStartedAt = 0;
bool configPortalStarted = false;
uint32_t lastSampleAt = 0;
uint32_t lastTelemetryAt = 0;
uint32_t lastCommandPollAt = 0;
uint32_t lastWifiAttemptAt = 0;

const char *sensorStatusName(SensorStatus status) {
  switch (status) {
    case SensorStatus::Healthy: return "healthy";
    case SensorStatus::Timeout: return "timeout";
    case SensorStatus::OutOfRange: return "out_of_range";
    default: return "initializing";
  }
}

void applyPumpState(PumpState requested, uint32_t now) {
  if (requested == controlState.pump) return;
  controlState.pump = requested;
  controlState.last_switch_at_ms = now;
  if (requested == PumpState::On) controlState.pump_started_at_ms = now;
  digitalWrite(RELAY_PIN,
               requested == PumpState::On ? RELAY_ACTIVE_LEVEL
                                          : RELAY_INACTIVE_LEVEL);
}

void loadConfig() {
  preferences.begin("borehole", true);
  config.lower_limit_percent = preferences.getFloat("lower", 60.0F);
  config.upper_limit_percent = preferences.getFloat("upper", 95.0F);
  config.usable_tank_depth_cm = preferences.getFloat("depth", 100.0F);
  config.mounting_offset_cm = preferences.getFloat("offset", 10.0F);
  preferences.end();
  if (!validateConfig(config)) config = ControlConfig{};
}

void saveConfig() {
  preferences.begin("borehole", false);
  preferences.putFloat("lower", config.lower_limit_percent);
  preferences.putFloat("upper", config.upper_limit_percent);
  preferences.putFloat("depth", config.usable_tank_depth_cm);
  preferences.putFloat("offset", config.mounting_offset_cm);
  preferences.end();
}

Measurement readTankSample() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  const unsigned long duration = pulseIn(ECHO_PIN, HIGH, ECHO_TIMEOUT_US);
  const bool received = duration > 0;
  const float distance = received ? duration * 0.0343F / 2.0F : 0.0F;
  return calculateMeasurement(distance, received, config);
}

Measurement readFilteredTank() {
  const Measurement sample = readTankSample();
  if (sample.status != SensorStatus::Healthy) {
    distanceSampleCount = 0;
    return sample;
  }
  distanceSamples[distanceSampleCount++] = sample.distance_cm;
  if (distanceSampleCount < MEDIAN_SAMPLE_COUNT) {
    Measurement pending;
    pending.status = SensorStatus::Initializing;
    return pending;
  }
  for (uint8_t i = 1; i < MEDIAN_SAMPLE_COUNT; ++i) {
    const float value = distanceSamples[i];
    int8_t j = i - 1;
    while (j >= 0 && distanceSamples[j] > value) {
      distanceSamples[j + 1] = distanceSamples[j];
      --j;
    }
    distanceSamples[j + 1] = value;
  }
  distanceSampleCount = 0;
  return calculateMeasurement(distanceSamples[MEDIAN_SAMPLE_COUNT / 2], true,
                              config);
}

bool postJson(const char *url, const JsonDocument &document, String *response) {
  if (WiFi.status() != WL_CONNECTED) return false;
  WiFiClientSecure client;
  client.setCACert(API_ROOT_CA);
  HTTPClient http;
  if (!http.begin(client, url)) return false;
  http.addHeader("content-type", "application/json");
  http.addHeader("x-device-token", DEVICE_TOKEN);
  String body;
  serializeJson(document, body);
  const int status = http.POST(body);
  if (response) *response = http.getString();
  http.end();
  return status >= 200 && status < 300;
}

void uploadTelemetry() {
  JsonDocument body;
  body["device_code"] = DEVICE_CODE;
  body["uptime_ms"] = millis();
  if (latestMeasurement.status == SensorStatus::Healthy) {
    body["distance_cm"] = latestMeasurement.distance_cm;
    body["water_depth_cm"] = latestMeasurement.water_depth_cm;
    body["level_percent"] = latestMeasurement.level_percent;
  } else {
    body["distance_cm"] = nullptr;
    body["water_depth_cm"] = nullptr;
    body["level_percent"] = nullptr;
  }
  body["sensor_status"] = sensorStatusName(latestMeasurement.status);
  body["pump_state"] = controlState.pump == PumpState::On ? "on" : "off";
  body["control_mode"] =
      controlState.mode == ControlMode::Automatic ? "automatic" : "manual";
  body["fault_code"] = controlState.fault;
  body["wifi_rssi_dbm"] = WiFi.RSSI();
  body["firmware_version"] = FIRMWARE_VERSION;
  postJson(TELEMETRY_URL, body, nullptr);
}

void acknowledgeCommand(const char *commandId, bool accepted,
                        const char *message) {
  JsonDocument body;
  body["device_code"] = DEVICE_CODE;
  body["action"] = "ack";
  body["command_id"] = commandId;
  body["accepted"] = accepted;
  body["message"] = message;
  postJson(COMMAND_URL, body, nullptr);
}

void processCommandResponse(const String &response, uint32_t now) {
  JsonDocument document;
  if (deserializeJson(document, response)) return;
  JsonObject command = document["command"];
  if (command.isNull()) return;
  const char *commandId = command["id"] | "";
  const char *type = command["type"] | "";
  bool accepted = false;
  const char *message = "unsupported_command";
  if (strcmp(type, "set_config") == 0) {
    ControlConfig candidate = config;
    candidate.lower_limit_percent = command["lower_limit_percent"] | candidate.lower_limit_percent;
    candidate.upper_limit_percent = command["upper_limit_percent"] | candidate.upper_limit_percent;
    candidate.usable_tank_depth_cm = command["usable_tank_depth_cm"] | candidate.usable_tank_depth_cm;
    if (validateConfig(candidate)) {
      config = candidate;
      saveConfig();
      accepted = true;
      message = "configuration_applied";
    } else {
      message = "invalid_configuration";
    }
  } else if (strcmp(type, "set_mode") == 0) {
    const char *mode = command["mode"] | "automatic";
    controlState.mode = strcmp(mode, "manual") == 0
                            ? ControlMode::Manual
                            : ControlMode::Automatic;
    accepted = true;
    message = "mode_applied";
  } else if (strcmp(type, "pump") == 0 &&
             controlState.mode == ControlMode::Manual) {
    const char *state = command["state"] | "off";
    const bool startRequested = strcmp(state, "on") == 0;
    if (startRequested && (latestMeasurement.status != SensorStatus::Healthy ||
                           now - lastValidMeasurementAt > SENSOR_STALE_AFTER_MS ||
                           consecutiveValidSamples < REQUIRED_VALID_SAMPLES ||
                           controlState.runtime_lockout ||
                           latestMeasurement.level_percent >=
                               config.upper_limit_percent)) {
      message = "pump_start_rejected_by_safety_interlock";
    } else {
      applyPumpState(startRequested ? PumpState::On : PumpState::Off, now);
      accepted = true;
      message = "pump_command_applied";
    }
  } else if (strcmp(type, "clear_fault") == 0) {
    const bool safe = latestMeasurement.status == SensorStatus::Healthy &&
                      now - lastValidMeasurementAt <= SENSOR_STALE_AFTER_MS &&
                      consecutiveValidSamples >= REQUIRED_VALID_SAMPLES &&
                      latestMeasurement.level_percent < config.upper_limit_percent &&
                      controlState.pump == PumpState::Off;
    if (safe) {
      controlState.runtime_lockout = false;
      controlState.fault = nullptr;
      accepted = true;
      message = "recoverable_fault_cleared";
    } else {
      message = "fault_clear_rejected_by_safety_interlock";
    }
  }
  if (commandId[0] != '\0') acknowledgeCommand(commandId, accepted, message);
}

void pollCommands(uint32_t now) {
  JsonDocument body;
  body["device_code"] = DEVICE_CODE;
  String response;
  if (postJson(COMMAND_URL, body, &response)) processCommandResponse(response, now);
}

void connectWifi() {
  wifiManager.setConfigPortalBlocking(false);
  wifiManager.setConfigPortalTimeout(180);
  wifiManager.setConnectTimeout(20);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  wifiStartedAt = millis();
}

void maintainWifi(uint32_t now) {
  if (WiFi.status() == WL_CONNECTED) return;
  if (!configPortalStarted && now - wifiStartedAt >= WIFI_PRIMARY_TIMEOUT_MS) {
    const String accessPoint = String("Kahalla-Pump-") +
                               String((uint32_t)(ESP.getEfuseMac() & 0xFFFF), HEX);
    configPortalStarted = wifiManager.startConfigPortal(accessPoint.c_str());
  }
  if (now - lastWifiAttemptAt >= WIFI_RETRY_INTERVAL_MS) {
    lastWifiAttemptAt = now;
    WiFi.reconnect();
  }
}

void setup() {
  pinMode(ECHO_PIN, INPUT);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(STATUS_LED_PIN, OUTPUT);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_INACTIVE_LEVEL);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(STATUS_LED_PIN, LOW);
  Serial.begin(115200);
  loadConfig();
  connectWifi();
}

void loop() {
  const uint32_t now = millis();
  wifiManager.process();
  maintainWifi(now);
  if (now - lastSampleAt >= SENSOR_SAMPLE_INTERVAL_MS) {
    lastSampleAt = now;
    const Measurement candidate = readFilteredTank();
    if (candidate.status != SensorStatus::Initializing) {
      latestMeasurement = candidate;
      if (latestMeasurement.status == SensorStatus::Healthy) {
        lastValidMeasurementAt = now;
        consecutiveFailures = 0;
        if (consecutiveValidSamples < REQUIRED_VALID_SAMPLES)
          ++consecutiveValidSamples;
      } else {
        consecutiveValidSamples = 0;
        if (consecutiveFailures < UINT8_MAX) ++consecutiveFailures;
      }
    }
    PumpState requested = PumpState::Off;
    if (consecutiveFailures >= SENSOR_FAILURE_LOCKOUT_COUNT) {
      controlState.fault = "sensor_failure_lockout";
    } else if (consecutiveValidSamples >= REQUIRED_VALID_SAMPLES &&
               now - lastValidMeasurementAt <= SENSOR_STALE_AFTER_MS) {
      requested = evaluateAutomaticControl(latestMeasurement, config,
                                           controlState, now);
    } else {
      controlState.fault = "sensor_not_ready";
    }
    applyPumpState(requested, now);
  }
  if (controlState.pump == PumpState::On &&
      now - controlState.pump_started_at_ms >= config.maximum_pump_runtime_ms) {
    controlState.runtime_lockout = true;
    controlState.fault = "maximum_runtime_exceeded";
    applyPumpState(PumpState::Off, now);
  }
  if (now - lastTelemetryAt >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryAt = now;
    uploadTelemetry();
  }
  if (now - lastCommandPollAt >= COMMAND_POLL_INTERVAL_MS) {
    lastCommandPollAt = now;
    pollCommands(now);
  }
  digitalWrite(STATUS_LED_PIN,
               WiFi.status() == WL_CONNECTED ? HIGH : (now / 500U) % 2U);
  delay(5);
}
