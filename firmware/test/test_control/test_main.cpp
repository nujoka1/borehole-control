#include <unity.h>

#include "control.h"

void setUp() {}
void tearDown() {}

void test_level_is_calculated_as_percentage() {
  ControlConfig config;
  config.usable_tank_depth_cm = 100.0F;
  config.mounting_offset_cm = 10.0F;
  const Measurement reading = calculateMeasurement(60.0F, true, config);
  TEST_ASSERT_EQUAL_INT((int)SensorStatus::Healthy, (int)reading.status);
  TEST_ASSERT_FLOAT_WITHIN(0.01F, 50.0F, reading.level_percent);
}

void test_timeout_is_not_treated_as_full_tank() {
  const Measurement reading = calculateMeasurement(0.0F, false, ControlConfig{});
  TEST_ASSERT_EQUAL_INT((int)SensorStatus::Timeout, (int)reading.status);
}

void test_invalid_threshold_order_is_rejected() {
  ControlConfig config;
  config.lower_limit_percent = 90.0F;
  config.upper_limit_percent = 60.0F;
  TEST_ASSERT_FALSE(validateConfig(config));
}

void test_hysteresis_starts_low_and_stops_high() {
  ControlConfig config;
  config.minimum_switch_interval_ms = 0;
  ControlState state;
  Measurement reading;
  reading.status = SensorStatus::Healthy;
  reading.level_percent = 40.0F;
  TEST_ASSERT_EQUAL_INT((int)PumpState::On,
                        (int)evaluateAutomaticControl(reading, config, state, 1));
  state.pump = PumpState::On;
  state.pump_started_at_ms = 1;
  reading.level_percent = 96.0F;
  TEST_ASSERT_EQUAL_INT((int)PumpState::Off,
                        (int)evaluateAutomaticControl(reading, config, state, 2));
}

void test_sensor_fault_requests_pump_off() {
  ControlState state;
  state.pump = PumpState::On;
  Measurement reading;
  reading.status = SensorStatus::Timeout;
  TEST_ASSERT_EQUAL_INT(
      (int)PumpState::Off,
      (int)evaluateAutomaticControl(reading, ControlConfig{}, state, 100));
}

void test_runtime_limit_latches_a_lockout() {
  ControlConfig config;
  config.maximum_pump_runtime_ms = 100;
  config.minimum_switch_interval_ms = 0;
  ControlState state;
  state.pump = PumpState::On;
  state.pump_started_at_ms = 1;
  Measurement reading;
  reading.status = SensorStatus::Healthy;
  reading.level_percent = 10.0F;
  TEST_ASSERT_EQUAL_INT((int)PumpState::Off,
                        (int)evaluateAutomaticControl(reading, config, state, 101));
  TEST_ASSERT_TRUE(state.runtime_lockout);
  TEST_ASSERT_EQUAL_INT((int)PumpState::Off,
                        (int)evaluateAutomaticControl(reading, config, state, 1000));
}

int main(int, char **) {
  UNITY_BEGIN();
  RUN_TEST(test_level_is_calculated_as_percentage);
  RUN_TEST(test_timeout_is_not_treated_as_full_tank);
  RUN_TEST(test_invalid_threshold_order_is_rejected);
  RUN_TEST(test_hysteresis_starts_low_and_stops_high);
  RUN_TEST(test_sensor_fault_requests_pump_off);
  RUN_TEST(test_runtime_limit_latches_a_lockout);
  return UNITY_END();
}
