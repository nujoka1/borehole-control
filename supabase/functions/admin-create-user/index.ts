import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' })

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json(401, { ok: false, error: 'Authentication required' })

  const url = Deno.env.get('SUPABASE_URL')
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !publishableKey || !serviceRoleKey) return json(500, { ok: false, error: 'Server authentication is not configured' })

  const callerClient = createClient(url, publishableKey, { global: { headers: { Authorization: authorization } } })
  const token = authorization.slice('Bearer '.length)
  const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser(token)
  if (callerError || !caller) return json(401, { ok: false, error: 'Invalid session' })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return json(400, { ok: false, error: 'Invalid JSON' }) }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const deviceId = typeof body.deviceId === 'string' ? body.deviceId : ''
  const role = body.role === 'operator' ? 'operator' : body.role === 'viewer' ? 'viewer' : ''
  if (!email || !email.includes('@') || displayName.length < 1 || displayName.length > 120 || password.length < 8 || password.length > 128 || !deviceId || !role) {
    return json(422, { ok: false, error: 'Enter a valid name, email, password and access level' })
  }

  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: ownerMembership, error: ownerError } = await admin.from('borehole_device_members')
    .select('role').eq('device_id', deviceId).eq('user_id', caller.id).maybeSingle()
  if (ownerError) return json(500, { ok: false, error: 'Authorization could not be verified' })
  if (ownerMembership?.role !== 'owner') return json(403, { ok: false, error: 'Only the tank owner can create users' })

  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (createError || !created.user) return json(createError?.status === 422 ? 409 : 400, { ok: false, error: createError?.message ?? 'User creation failed' })

  const { error: profileError } = await admin.from('borehole_profiles').upsert({ user_id: created.user.id, display_name: displayName })
  const { error: membershipError } = profileError ? { error: profileError } : await admin.from('borehole_device_members').insert({ device_id: deviceId, user_id: created.user.id, role })
  if (membershipError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return json(500, { ok: false, error: 'The account could not be assigned to the tank' })
  }

  // Email is deliberately best-effort. The temporary password remains usable
  // even when SMTP is unavailable or the recipient ignores the message.
  const emailClient = createClient(url, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: emailError } = await emailClient.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: 'https://nujoka1.github.io/borehole-control/',
    },
  })

  return json(201, { ok: true, userId: created.user.id, emailSent: !emailError })
})
