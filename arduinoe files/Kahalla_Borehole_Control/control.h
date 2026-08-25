#pragma once

#include <stdint.h>

enum class PumpState : uint8_t { Off, On };
enum class SensorStatus : uint8_t { Initializing, Healthy, Timeout, OutOfRange };

struct ControlConfig {
  float lower_limit_percent = 60.0F;
  float upper_limit_percent = 95.0F;
  float usable_tank_depth_cm = 100.0F;
  float mounting_offset_cm = 10.0F;
  uint32_t maximum_pump_runtime_ms = 30UL * 60UL * 1000UL;
  uint32_t minimum_switch_interval_ms = 3000UL;
};

struct Measurement {
  float distance_cm = 0.0F;
  float water_depth_cm = 0.0F;
  float level_percent = 0.0F;
  SensorStatus status = SensorStatus::Initializing;
};

struct ControlState {
  PumpState pump = PumpState::Off;
  bool upper_limit_latched = false;
  bool runtime_lockout = false;
  uint32_t pump_started_at_ms = 0;
  uint32_t last_switch_at_ms = 0;
  const char *fault = nullptr;
};

bool validateConfig(const ControlConfig &config);
Measurement calculateMeasurement(float distance_cm, bool echo_received,
                                 const ControlConfig &config);
PumpState evaluateAutomaticControl(const Measurement &measurement,
                                   const ControlConfig &config,
                                   ControlState &state, uint32_t now_ms);
