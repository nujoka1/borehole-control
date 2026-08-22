/** @param {{last_seen_at: string|null}|null} device @param {number} now */
export const isDeviceOnline = (device, now = Date.now()) =>
  Boolean(device?.last_seen_at && now - Date.parse(device.last_seen_at) < 45_000)

/** @param {{level_percent: number|null}|null} reading */
export const normalizedLevel = (reading) => {
  const level = reading?.level_percent
  if (typeof level !== 'number' || !Number.isFinite(level)) return null
  return Math.max(0, Math.min(100, level))
}
