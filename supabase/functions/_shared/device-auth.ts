import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

export const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

export const serviceClient = () => {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function authenticateDevice(
  request: Request,
  deviceCode: string,
) {
  const token = request.headers.get('x-device-token')
  if (!token || token.length < 24 || token.length > 256) return null
  const db = serviceClient()
  if (!db) return null
  const { data, error } = await db.rpc('authenticate_borehole_device', {
      supplied_code: deviceCode,
      supplied_token: token,
    })
  return error || !data ? null : { db, deviceId: data as string }
}
