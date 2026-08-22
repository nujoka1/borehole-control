export type PumpState = 'on' | 'off'
export type ControlMode = 'automatic' | 'manual'
export type SensorStatus = 'initializing' | 'healthy' | 'timeout' | 'out_of_range'

export interface Device {
  id: string
  device_code: string
  name: string
  location_name: string | null
  firmware_version: string
  is_online: boolean
  last_seen_at: string | null
}

export interface Reading {
  id: number
  device_id: string
  received_at: string
  uptime_ms: number
  distance_cm: number | null
  water_depth_cm: number | null
  level_percent: number | null
  sensor_status: SensorStatus
  pump_state: PumpState
  control_mode: ControlMode
  fault_code: string | null
  wifi_rssi_dbm: number | null
  firmware_version: string
}

export interface DeviceSettings {
  device_id: string
  lower_limit_percent: number
  upper_limit_percent: number
  usable_tank_depth_cm: number
  mounting_offset_cm: number
  maximum_pump_runtime_seconds: number
  telemetry_interval_seconds: number
}

export interface DeviceCommand {
  id: string
  command_type: 'set_config' | 'set_mode' | 'pump' | 'clear_fault'
  status: 'pending' | 'delivered' | 'acknowledged' | 'rejected' | 'failed' | 'expired'
  requested_at: string
  result_message: string | null
}

export interface DeviceEvent {
  id: number
  event_type: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  created_at: string
}
