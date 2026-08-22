import { authenticateDevice, json } from '../_shared/device-auth.ts'

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' })
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return json(400, { ok: false, error: 'Invalid JSON' }) }
  const code = typeof body.device_code === 'string' ? body.device_code : ''
  const auth = await authenticateDevice(request, code)
  if (!auth) return json(401, { ok: false, error: 'Invalid device credentials' })
  const now = new Date().toISOString()
  if (body.action === 'ack') {
    const commandId = typeof body.command_id === 'string' ? body.command_id : ''
    const accepted = body.accepted === true
    const message = typeof body.message === 'string' ? body.message.slice(0, 500) : null
    if (!commandId) return json(422, { ok: false, error: 'Missing command ID' })
    const { data, error } = await auth.db.from('borehole_commands').update({
      status: accepted ? 'acknowledged' : 'rejected',
      acknowledged_at: now,
      result_message: message,
    }).eq('id', commandId).eq('device_id', auth.deviceId)
      .in('status', ['pending', 'delivered']).select('id').maybeSingle()
    if (error || !data) return json(404, { ok: false, error: 'Command is unavailable' })
    return json(200, { ok: true })
  }
  await auth.db.from('borehole_commands').update({ status: 'expired' })
    .eq('device_id', auth.deviceId).in('status', ['pending', 'delivered']).lt('expires_at', now)
  const { data, error } = await auth.db.from('borehole_commands')
    .select('id,command_type,payload,expires_at').eq('device_id', auth.deviceId)
    .in('status', ['pending', 'delivered']).gt('expires_at', now).order('requested_at').limit(1).maybeSingle()
  if (error) return json(500, { ok: false, error: 'Command lookup failed' })
  if (!data) return json(200, { ok: true, command: null })
  await auth.db.from('borehole_commands').update({ status: 'delivered', delivered_at: now }).eq('id', data.id)
  return json(200, {
    ok: true,
    command: { id: data.id, type: data.command_type, ...data.payload },
  })
})
