import test from 'node:test'
import assert from 'node:assert/strict'
import { isDeviceOnline, normalizedLevel } from '../src/lib/device-core.mjs'

test('telemetry becomes stale after 45 seconds', () => {
  const device = { last_seen_at: '2026-08-22T10:00:00Z' }
  assert.equal(isDeviceOnline(device, Date.parse('2026-08-22T10:00:44Z')), true)
  assert.equal(isDeviceOnline(device, Date.parse('2026-08-22T10:00:46Z')), false)
})

test('unavailable sensing never becomes an invented level', () => {
  assert.equal(normalizedLevel(null), null)
  assert.equal(normalizedLevel({ level_percent: null }), null)
  assert.equal(normalizedLevel({ level_percent: 140 }), 100)
})
