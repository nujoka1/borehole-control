import { authenticateDevice, json } from '../_shared/device-auth.ts'

const enumValues = {
  sensor_status: ['initializing', 'healthy', 'timeout', 'out_of_range'],
  pump_state: ['on', 'off'],
  control_mode: ['automatic', 'manual'],
} as const

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' })
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return json(400, { ok: false, error: 'Invalid JSON' }) }
  const code = typeof body.device_code === 'string' ? body.device_code : ''
  const auth = await authenticateDevice(request, code)
  if (!auth) return json(401, { ok: false, error: 'Invalid device credentials' })

  const numberIn = (value: unknown, minimum: number, maximum: number) =>
    typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
  const healthy = body.sensor_status === 'healthy'
  const validLevel = healthy
    ? numberIn(body.level_percent, 0, 100) &&
      numberIn(body.distance_cm, 0, 1100) &&
      numberIn(body.water_depth_cm, 0, 1000)
    : body.level_percent === null && body.distance_cm === null && body.water_depth_cm === null
  if (!numberIn(body.uptime_ms, 0, Number.MAX_SAFE_INTEGER) ||
      !validLevel ||
      !enumValues.sensor_status.includes(body.sensor_status as never) ||
      !enumValues.pump_state.includes(body.pump_state as never) ||
      !enumValues.control_mode.includes(body.control_mode as never) ||
      (body.fault_code !== null && (typeof body.fault_code !== 'string' || body.fault_code.length > 80)) ||
      !numberIn(body.wifi_rssi_dbm, -127, 0) ||
      typeof body.firmware_version !== 'string' ||
      body.firmware_version.length < 1 || body.firmware_version.length > 40) {
    return json(422, { ok: false, error: 'Telemetry payload failed validation' })
  }
  const { device_code: _code, ...reading } = body
  const { data: previousState } = await auth.db.from('borehole_device_state')
    .select('pump_state,fault_code').eq('device_id', auth.deviceId).maybeSingle()
  const { error } = await auth.db.from('borehole_readings').insert({
    ...reading,
    device_id: auth.deviceId,
  })
  if (error) return json(500, { ok: false, error: 'Telemetry was not stored' })
  const state = {
    device_id: auth.deviceId,
    received_at: new Date().toISOString(),
    distance_cm: body.distance_cm,
    water_depth_cm: body.water_depth_cm,
    level_percent: body.level_percent,
    sensor_status: body.sensor_status,
    pump_state: body.pump_state,
    control_mode: body.control_mode,
    fault_code: body.fault_code,
    wifi_rssi_dbm: body.wifi_rssi_dbm,
    firmware_version: body.firmware_version,
  }
  const { error: stateError } = await auth.db.from('borehole_device_state')
    .upsert(state, { onConflict: 'device_id' })
  if (stateError) return json(500, { ok: false, error: 'Latest state was not stored' })
  const events: Record<string, unknown>[] = []
  if (previousState && previousState.pump_state !== body.pump_state) {
    events.push({
      device_id: auth.deviceId,
      event_type: body.pump_state === 'on' ? 'pump_started' : 'pump_stopped',
      message: body.pump_state === 'on' ? 'Pump started' : 'Pump stopped',
    })
  }
  if (previousState && previousState.fault_code !== body.fault_code) {
    events.push(body.fault_code
      ? { device_id: auth.deviceId, event_type: 'fault_raised', severity: 'warning', message: `Fault raised: ${String(body.fault_code).slice(0, 80)}` }
      : { device_id: auth.deviceId, event_type: 'fault_cleared', message: 'Device fault cleared' })
  }
  if (events.length) await auth.db.from('borehole_events').insert(events)
  await auth.db.from('borehole_devices').update({
    is_online: true,
    last_seen_at: new Date().toISOString(),
    firmware_version: body.firmware_version,
  }).eq('id', auth.deviceId)
  return json(201, { ok: true })
})
