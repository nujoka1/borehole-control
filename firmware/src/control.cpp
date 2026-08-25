#include "control.h"

#include <math.h>

bool validateConfig(const ControlConfig &config) {
  return isfinite(config.lower_limit_percent) &&
         isfinite(config.upper_limit_percent) &&
         isfinite(config.usable_tank_depth_cm) &&
         config.lower_limit_percent >= 0.0F &&
         config.upper_limit_percent <= 100.0F &&
         config.upper_limit_percent - config.lower_limit_percent >= 5.0F &&
         (config.usable_tank_depth_cm == 20.0F ||
          config.usable_tank_depth_cm == 30.0F ||
          config.usable_tank_depth_cm == 50.0F ||
          config.usable_tank_depth_cm == 100.0F ||
          config.usable_tank_depth_cm == 150.0F ||
          config.usable_tank_depth_cm == 200.0F ||
          config.usable_tank_depth_cm == 250.0F ||
          config.usable_tank_depth_cm == 300.0F ||
          config.usable_tank_depth_cm == 350.0F) &&
         config.mounting_offset_cm >= 0.0F &&
         config.mounting_offset_cm <= 100.0F;
}

Measurement calculateMeasurement(float distance_cm, bool echo_received,
                                 const ControlConfig &config) {
  Measurement result;
  result.distance_cm = distance_cm;
  if (!echo_received || !isfinite(distance_cm)) {
    result.status = SensorStatus::Timeout;
    return result;
  }

  const float maximum_distance =
      config.usable_tank_depth_cm + config.mounting_offset_cm;
  if (distance_cm < config.mounting_offset_cm || distance_cm > maximum_distance) {
    result.status = SensorStatus::OutOfRange;
    return result;
  }

  result.water_depth_cm = maximum_distance - distance_cm;
  result.level_percent =
      (result.water_depth_cm / config.usable_tank_depth_cm) * 100.0F;
  if (result.level_percent < 0.0F) result.level_percent = 0.0F;
  if (result.level_percent > 100.0F) result.level_percent = 100.0F;
  result.status = SensorStatus::Healthy;
  return result;
}

PumpState evaluateAutomaticControl(const Measurement &measurement,
                                   const ControlConfig &config,
                                   ControlState &state, uint32_t now_ms) {
  if (measurement.status != SensorStatus::Healthy) {
    state.fault = "sensor_invalid";
    return PumpState::Off;
  }

  if (state.runtime_lockout) {
    state.fault = "maximum_runtime_lockout";
    return PumpState::Off;
  }

  if (state.pump == PumpState::On && config.maximum_pump_runtime_ms > 0 &&
      now_ms - state.pump_started_at_ms >= config.maximum_pump_runtime_ms) {
    state.fault = "maximum_runtime_exceeded";
    state.runtime_lockout = true;
    return PumpState::Off;
  }

  if (now_ms - state.last_switch_at_ms < config.minimum_switch_interval_ms) {
    return state.pump;
  }

  state.fault = nullptr;
  if (measurement.level_percent >= config.upper_limit_percent) {
    state.upper_limit_latched = true;
    return PumpState::Off;
  }
  if (state.upper_limit_latched &&
      measurement.level_percent > config.lower_limit_percent) {
    return PumpState::Off;
  }
  if (measurement.level_percent <= config.lower_limit_percent) {
    state.upper_limit_latched = false;
    return PumpState::On;
  }
  return state.pump;
}
