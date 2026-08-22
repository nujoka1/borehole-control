export function isDeviceOnline(
  device: { last_seen_at: string | null } | null,
  now?: number,
): boolean
export function normalizedLevel(
  reading: { level_percent: number | null } | null,
): number | null
