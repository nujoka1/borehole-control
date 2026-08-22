const url = process.env.BOREHOLE_TELEMETRY_URL
const deviceCode = process.env.BOREHOLE_DEVICE_CODE
const token = process.env.BOREHOLE_DEVICE_TOKEN
if (!url || !deviceCode || !token) {
  console.error('Set BOREHOLE_TELEMETRY_URL, BOREHOLE_DEVICE_CODE and BOREHOLE_DEVICE_TOKEN.')
  process.exit(1)
}

let level = 35
let pumpOn = true
const upload = async () => {
  level += pumpOn ? 2.5 : -1.2
  if (level >= 95) pumpOn = false
  if (level <= 60) pumpOn = true
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-device-token': token },
    body: JSON.stringify({
      device_code: deviceCode,
      uptime_ms: Math.floor(process.uptime() * 1000),
      distance_cm: 10 + (100 - level),
      water_depth_cm: level,
      level_percent: level,
      sensor_status: 'healthy',
      pump_state: pumpOn ? 'on' : 'off',
      control_mode: 'automatic',
      fault_code: null,
      wifi_rssi_dbm: -58,
      firmware_version: 'simulator-0.1.0',
    }),
  })
  console.log(new Date().toISOString(), response.status, level.toFixed(1), pumpOn ? 'on' : 'off')
}

await upload()
setInterval(() => void upload().catch(error => console.error(error.message)), 10_000)
