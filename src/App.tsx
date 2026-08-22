import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, Gauge, LogOut, Power, RefreshCw, Settings, Wifi, WifiOff } from 'lucide-react'
import { configured, supabase } from './lib/supabase'
import { isDeviceOnline, normalizedLevel } from './lib/device'
import type { Device, DeviceCommand, DeviceEvent, DeviceSettings, Reading } from './types'

const formatTime = (value?: string | null) => value
  ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'Never'

function App() {
  const [session, setSession] = useState<Awaited<ReturnType<NonNullable<typeof supabase>['auth']['getSession']>>['data']['session']>(null)
  const [ready, setReady] = useState(!configured)
  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])
  if (!ready) return <Loading text="Checking your session…" />
  if (configured && !session) return <Login />
  return <Dashboard userId={session?.user.id ?? null} />
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage('Signing in…')
    const { error } = await supabase!.auth.signInWithPassword({ email, password })
    setMessage(error?.message ?? '')
  }
  return <main className="auth"><form className="panel auth-card" onSubmit={submit}>
    <div className="logo">K</div><p className="eyebrow">Kahalla smart water</p><h1>Know your tank.<br/>Protect your pump.</h1>
    <label>Email<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
    <label>Password<input required minLength={8} type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></label>
    <button className="primary">Sign in</button>{message && <p role="alert">{message}</p>}
  </form></main>
}

function Dashboard({ userId }: { userId: string | null }) {
  const [device, setDevice] = useState<Device | null>(null)
  const [reading, setReading] = useState<Reading | null>(null)
  const [history, setHistory] = useState<Reading[]>([])
  const [settings, setSettings] = useState<DeviceSettings | null>(null)
  const [commands, setCommands] = useState<DeviceCommand[]>([])
  const [events, setEvents] = useState<DeviceEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    setError('')
    const { data: devices, error: deviceError } = await supabase.from('borehole_devices').select('*').order('created_at').limit(1)
    const nextDevice = devices?.[0] as Device | undefined
    if (deviceError || !nextDevice) { setError(deviceError?.message ?? 'No borehole device is assigned to this account.'); setLoading(false); return }
    setDevice(nextDevice)
    const [{ data: readings, error: readingError }, { data: storedSettings }, { data: storedCommands }, { data: storedEvents }] = await Promise.all([
      supabase.from('borehole_readings').select('*').eq('device_id', nextDevice.id).order('received_at', { ascending: false }).limit(200),
      supabase.from('borehole_device_settings').select('*').eq('device_id', nextDevice.id).maybeSingle(),
      supabase.from('borehole_commands').select('id,command_type,status,requested_at,result_message').eq('device_id', nextDevice.id).order('requested_at', { ascending: false }).limit(10),
      supabase.from('borehole_events').select('id,event_type,severity,message,created_at').eq('device_id', nextDevice.id).order('created_at', { ascending: false }).limit(10),
    ])
    if (readingError) setError(readingError.message)
    const items = (readings ?? []) as Reading[]
    setReading(items[0] ?? null); setHistory(items); setSettings(storedSettings as DeviceSettings | null)
    setCommands((storedCommands ?? []) as DeviceCommand[]); setEvents((storedEvents ?? []) as DeviceEvent[]); setLoading(false)
  }, [])
  useEffect(() => {
    void load(); if (!supabase) return
    const channel = supabase.channel('borehole-dashboard')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'borehole_readings' }, payload => {
        const next = payload.new as Reading
        setReading(next); setHistory(previous => [next, ...previous].slice(0, 200))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'borehole_devices' }, payload => setDevice(payload.new as Device))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'borehole_commands' }, payload => {
        const next = payload.new as DeviceCommand
        if (next?.id) setCommands(previous => [next, ...previous.filter(item => item.id !== next.id)].slice(0, 10))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'borehole_events' }, payload => {
        const next = payload.new as DeviceEvent
        setEvents(previous => [next, ...previous].slice(0, 10))
      })
      .subscribe()
    return () => { void supabase!.removeChannel(channel) }
  }, [load])
  const send = async (command_type: string, payload: Record<string, unknown>) => {
    if (!supabase || !device || !userId) return
    setNotice('Sending command…')
    const { error: commandError } = await supabase.from('borehole_commands').insert({ device_id: device.id, requested_by: userId, command_type, payload })
    setNotice(commandError ? commandError.message : 'Command queued. Waiting for the device to acknowledge it.')
  }
  const togglePump = async () => {
    const starting = reading?.pump_state !== 'on'
    if (starting && !window.confirm('Start this pump manually? Automatic level control is currently disabled.')) return
    await send('pump', { state: starting ? 'on' : 'off' })
  }
  const online = isDeviceOnline(device)
  const level = normalizedLevel(reading)
  const chart = useMemo(() => history.slice().reverse().map(item => ({ time: item.received_at, level: item.level_percent })), [history])
  if (loading) return <Loading text="Loading borehole status…" />
  return <div className="shell">
    <aside><div className="brand"><div className="logo">K</div><div><b>Kahalla</b><small>Borehole control</small></div></div><nav><a className="active"><Gauge/>Overview</a><a href="#history"><Activity/>History</a><a href="#settings"><Settings/>Settings</a></nav><button className="signout" onClick={() => void supabase?.auth.signOut()}><LogOut/>Sign out</button></aside>
    <main><header><div><p className="eyebrow">Water system</p><h1>{device?.name ?? 'Borehole dashboard'}</h1><p>{device?.location_name ?? 'Location not configured'}</p></div><div className={`connection ${online ? 'online' : 'offline'}`}>{online ? <Wifi/> : <WifiOff/>}<span><b>{online ? 'Online' : 'Offline'}</b><small>Last seen {formatTime(device?.last_seen_at)}</small></span></div></header>
      {!configured && <div className="banner"><AlertTriangle/>Preview mode: add Supabase public configuration to load real devices.</div>}
      {error && <div className="banner error"><AlertTriangle/>{error}<button onClick={() => void load()}><RefreshCw/>Retry</button></div>}
      <section className="hero-grid"><article className="tank-card"><div><p className="eyebrow">Current tank level</p><strong>{level === null ? '—' : `${level.toFixed(0)}%`}</strong><p>{reading?.water_depth_cm?.toFixed(1) ?? '—'} cm water depth</p></div><div className="tank" aria-label={level === null ? 'Tank level unavailable' : `Tank ${level}% full`}><div style={{ height: `${level ?? 0}%` }}><span/></div></div></article>
        <article className={`pump-card ${reading?.pump_state ?? 'off'}`}><div className="pump-icon"><Power/></div><p className="eyebrow">Pump</p><h2>{reading?.pump_state === 'on' ? 'Running' : 'Stopped'}</h2><p>{reading?.control_mode ?? 'Unknown'} control</p><div className="control-row"><button disabled={!online || reading?.control_mode !== 'manual'} onClick={() => void togglePump()}>{reading?.pump_state === 'on' ? 'Stop pump' : 'Start pump'}</button><button onClick={() => void send('set_mode', { mode: reading?.control_mode === 'manual' ? 'automatic' : 'manual' })}>Use {reading?.control_mode === 'manual' ? 'automatic' : 'manual'}</button></div></article>
      </section>
      <section className="metrics"><Metric label="Sensor" value={reading?.sensor_status ?? 'Unavailable'} warning={reading?.sensor_status !== 'healthy'} /><Metric label="Wi-Fi signal" value={reading?.wifi_rssi_dbm ? `${reading.wifi_rssi_dbm} dBm` : '—'} /><Metric label="Firmware" value={device?.firmware_version ?? '—'} /><Metric label="Fault" value={reading?.fault_code ?? 'None'} warning={Boolean(reading?.fault_code)} /></section>
      <section className="panel chart-panel" id="history"><div><p className="eyebrow">Last 200 readings</p><h2>Tank level history</h2></div>{chart.length ? <TankChart data={chart} /> : <p className="empty">No readings received yet.</p>}</section>
      <SettingsPanel settings={settings} onSave={payload => send('set_config', payload)} />
      <section className="activity-grid"><ActivityList title="Recent events" empty="No pump or fault events yet." items={events.map(item => ({ id: String(item.id), title: item.message, meta: `${item.severity} · ${formatTime(item.created_at)}` }))}/><ActivityList title="Command lifecycle" empty="No dashboard commands yet." items={commands.map(item => ({ id: item.id, title: item.command_type.replaceAll('_', ' '), meta: `${item.status} · ${formatTime(item.requested_at)}${item.result_message ? ` · ${item.result_message}` : ''}` }))}/></section>
      {reading?.fault_code && <section className="panel fault-action"><div><p className="eyebrow">Recoverable lockout</p><h2>{reading.fault_code}</h2><p>The ESP32 will accept this only while the pump is off and sensing is healthy below the upper limit.</p></div><button className="primary" disabled={!online || reading.sensor_status !== 'healthy' || reading.pump_state === 'on' || (reading.level_percent ?? 100) >= (settings?.upper_limit_percent ?? 95)} onClick={() => void send('clear_fault', {})}>Clear fault safely</button></section>}
      {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice('')}>Dismiss</button></div>}
    </main>
  </div>
}

function SettingsPanel({ settings, onSave }: { settings: DeviceSettings | null; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const [lower, setLower] = useState(settings?.lower_limit_percent ?? 60)
  const [upper, setUpper] = useState(settings?.upper_limit_percent ?? 95)
  const [depth, setDepth] = useState(settings?.usable_tank_depth_cm ?? 100)
  useEffect(() => {
    if (!settings) return
    setLower(settings.lower_limit_percent)
    setUpper(settings.upper_limit_percent)
    setDepth(settings.usable_tank_depth_cm)
  }, [settings])
  const depths = [20, 30, 50, 100, 150, 200, 250, 300, 350]
  const valid = lower >= 0 && upper <= 100 && upper - lower >= 5 && depths.includes(depth)
  return <section className="panel settings-panel" id="settings"><p className="eyebrow">Device configuration</p><h2>Automatic control limits</h2><div className="form-grid"><label>Start pump at or below<input type="number" min="0" max="95" value={lower} onChange={event => setLower(Number(event.target.value))}/><span>%</span></label><label>Stop pump at or above<input type="number" min="5" max="100" value={upper} onChange={event => setUpper(Number(event.target.value))}/><span>%</span></label><label>Usable tank depth<select value={depth} onChange={event => setDepth(Number(event.target.value))}>{depths.map(value => <option key={value} value={value}>{value} cm</option>)}</select></label></div>{!valid && <p className="validation" role="alert">Limits must be 0–100% with a gap of at least 5 percentage points.</p>}<button className="primary" disabled={!valid} onClick={() => void onSave({ lower_limit_percent: lower, upper_limit_percent: upper, usable_tank_depth_cm: depth })}>Send settings to device</button></section>
}

function ActivityList({ title, empty, items }: { title: string; empty: string; items: { id: string; title: string; meta: string }[] }) { return <section className="panel activity-list"><h2>{title}</h2>{items.length ? items.map(item => <article key={item.id}><strong>{item.title}</strong><small>{item.meta}</small></article>) : <p>{empty}</p>}</section> }

function TankChart({ data }: { data: { time: string; level: number | null }[] }) {
  const valid = data.filter((item): item is { time: string; level: number } => typeof item.level === 'number')
  if (!valid.length) return <p className="empty">No valid tank levels in this period.</p>
  const points = valid.map((item, index) => {
    const x = valid.length === 1 ? 500 : (index / (valid.length - 1)) * 1000
    return `${x},${250 - item.level * 2.3}`
  }).join(' ')
  return <div className="tank-chart"><span>100%</span><svg viewBox="0 0 1000 260" role="img" aria-label={`Tank level from ${valid[0].level.toFixed(0)} to ${valid.at(-1)!.level.toFixed(0)} percent`}><line x1="0" y1="20" x2="1000" y2="20"/><line x1="0" y1="135" x2="1000" y2="135"/><line x1="0" y1="250" x2="1000" y2="250"/><polyline points={points}/></svg><small>{formatTime(valid[0].time)}</small><small>{formatTime(valid.at(-1)!.time)}</small></div>
}

function Metric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) { return <article className={warning ? 'warning' : ''}><small>{label}</small><strong>{value}</strong></article> }
function Loading({ text }: { text: string }) { return <main className="loading"><span/>{text}</main> }
export default App
