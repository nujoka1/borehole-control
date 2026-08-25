import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, Bell, BookOpen, ChevronRight, CircleHelp, Clock,
  Droplets, Eye, EyeOff, Gauge, History, Info, LogOut, Moon, Radio,
  RefreshCw, Settings, ShieldCheck, Sun, TrendingUp, UserRound, Wifi, WifiOff, X,
} from 'lucide-react'
import { configured, supabase } from './lib/supabase'
import { isDeviceOnline, normalizedLevel } from './lib/device'
import type { Device, DeviceCommand, DeviceEvent, DeviceSettings, Reading } from './types'

type Theme = 'light' | 'dark'
type Tab = 'home' | 'history' | 'alerts' | 'settings'
type InfoPage = 'about' | 'guide' | 'terms' | null

const ADMIN_EMAIL = 'ahmadkgaladima@gmail.com'
const now = new Date().toISOString()
const DEMO_DEVICE: Device = { id: 'preview', device_code: 'PREVIEW', name: 'Main Tank', location_name: null, firmware_version: '1.0.0', is_online: true, last_seen_at: now }
const DEMO_READING: Reading = { id: 1, device_id: 'preview', received_at: now, uptime_ms: 86400000, distance_cm: 66, water_depth_cm: 144, level_percent: 72, sensor_status: 'healthy', pump_state: 'on', control_mode: 'automatic', fault_code: null, wifi_rssi_dbm: -54, firmware_version: '1.0.0' }
const DEMO_SETTINGS: DeviceSettings = { device_id: 'preview', lower_limit_percent: 60, upper_limit_percent: 95, usable_tank_depth_cm: 200, mounting_offset_cm: 10, maximum_pump_runtime_seconds: 1800, telemetry_interval_seconds: 10 }
const DEMO_EVENTS: DeviceEvent[] = [{ id: 1, event_type: 'pump_started', severity: 'info', message: 'Pump started automatically', created_at: now }]

const formatTime = (value?: string | null, short = false) => value
  ? new Intl.DateTimeFormat(undefined, short ? { hour: 'numeric', minute: '2-digit' } : { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'Never'

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('smart-water-theme') ?? localStorage.getItem('borehole-theme')
    return saved === 'dark' || saved === 'light' ? saved : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('smart-water-theme', theme)
  }, [theme])
  return { theme, toggle: () => setTheme(value => value === 'light' ? 'dark' : 'light') }
}

function App() {
  const { theme, toggle } = useTheme()
  const [session, setSession] = useState<Awaited<ReturnType<NonNullable<typeof supabase>['auth']['getSession']>>['data']['session']>(null)
  const [ready, setReady] = useState(!configured)
  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])
  if (!ready) return <Loading text="Securing your session…" />
  if (configured && !session) return <Login theme={theme} toggleTheme={toggle} />
  return <Dashboard userId={session?.user.id ?? null} userEmail={session?.user.email} theme={theme} toggleTheme={toggle} />
}

function Login({ theme, toggleTheme }: { theme: Theme; toggleTheme: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState<InfoPage>(null)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('')
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setMessage(error.message)
    setBusy(false)
  }
  const reset = async () => {
    if (!email.trim()) { setMessage('Enter your email address first.'); return }
    setBusy(true)
    const { error } = await supabase!.auth.resetPasswordForEmail(email.trim())
    setMessage(error?.message ?? 'Password reset instructions were sent if the account exists.')
    setBusy(false)
  }
  return <main className="auth-page">
    <button className="icon-button auth-theme" onClick={toggleTheme} aria-label={`Use ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? <Moon/> : <Sun/>}</button>
    <section className="auth-visual"><Brand/><div className="auth-message"><img className="auth-illustration" src="./brand-illustration.png" alt="Connected smart water tank and pump"/><p className="auth-kicker">Automatic water management</p><h1>Your tank,<br/>always protected.</h1><p>Monitor water level, pump health and automatic filling from one secure application.</p></div><small>Kachalla smart water system</small></section>
    <form className="auth-card" onSubmit={submit}>
      <div className="auth-mobile-brand"><Brand/></div><p className="eyebrow">Administrator access</p><h2>Welcome back</h2><p>Sign in to monitor the assigned smart water tank.</p>
      <label>Email address<input required type="email" autoComplete="email" placeholder={ADMIN_EMAIL} value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label>Password<div className="password-field"><input required minLength={8} type={visible ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={event => setPassword(event.target.value)} /><button type="button" onClick={() => setVisible(value => !value)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff/> : <Eye/>}</button></div></label>
      <button type="button" className="text-button reset" onClick={() => void reset()}>Forgot password?</button>
      <button className="primary large" disabled={busy}>{busy ? 'Please wait…' : 'Sign in securely'}</button>
      {message && <p className="form-message" role="status">{message}</p>}
      <p className="security-note"><ShieldCheck/> Access and device assignment are verified by the server.</p>
      <footer><button type="button" onClick={() => setInfo('about')}>About</button><button type="button" onClick={() => setInfo('guide')}>User guide</button><button type="button" onClick={() => setInfo('terms')}>Terms</button></footer>
    </form>
    {info && <InfoSheet page={info} close={() => setInfo(null)} />}
  </main>
}

function Dashboard({ userId, userEmail, theme, toggleTheme }: { userId: string | null; userEmail?: string; theme: Theme; toggleTheme: () => void }) {
  const preview = !configured
  const [tab, setTab] = useState<Tab>('home')
  const [info, setInfo] = useState<InfoPage>(null)
  const [device, setDevice] = useState<Device | null>(preview ? DEMO_DEVICE : null)
  const [reading, setReading] = useState<Reading | null>(preview ? DEMO_READING : null)
  const [history, setHistory] = useState<Reading[]>(preview ? [DEMO_READING] : [])
  const [settings, setSettings] = useState<DeviceSettings | null>(preview ? DEMO_SETTINGS : null)
  const [commands, setCommands] = useState<DeviceCommand[]>([])
  const [events, setEvents] = useState<DeviceEvent[]>(preview ? DEMO_EVENTS : [])
  const [loading, setLoading] = useState(!preview)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    setError('')
    const { data: devices, error: deviceError } = await supabase.from('borehole_devices').select('*').order('created_at').limit(1)
    const next = devices?.[0] as Device | undefined
    if (deviceError || !next) { setError(deviceError?.message ?? 'No smart water tank is assigned to this account.'); setLoading(false); return }
    setDevice(next)
    const [{ data: readings, error: readingError }, { data: storedSettings }, { data: storedCommands }, { data: storedEvents }] = await Promise.all([
      supabase.from('borehole_readings').select('*').eq('device_id', next.id).order('received_at', { ascending: false }).limit(200),
      supabase.from('borehole_device_settings').select('*').eq('device_id', next.id).maybeSingle(),
      supabase.from('borehole_commands').select('id,command_type,status,requested_at,result_message').eq('device_id', next.id).order('requested_at', { ascending: false }).limit(20),
      supabase.from('borehole_events').select('id,event_type,severity,message,created_at').eq('device_id', next.id).order('created_at', { ascending: false }).limit(50),
    ])
    if (readingError) setError(readingError.message)
    const items = (readings ?? []) as Reading[]
    setReading(items[0] ?? null); setHistory(items); setSettings(storedSettings as DeviceSettings | null); setCommands((storedCommands ?? []) as DeviceCommand[]); setEvents((storedEvents ?? []) as DeviceEvent[]); setLoading(false)
  }, [])
  useEffect(() => {
    void load(); if (!supabase) return
    const channel = supabase.channel('smart-water-dashboard')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'borehole_readings' }, payload => { const next = payload.new as Reading; setReading(next); setHistory(old => [next, ...old].slice(0, 200)) })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'borehole_devices' }, payload => setDevice(payload.new as Device))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'borehole_commands' }, payload => { const next = payload.new as DeviceCommand; if (next?.id) setCommands(old => [next, ...old.filter(item => item.id !== next.id)].slice(0, 20)) })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'borehole_events' }, payload => setEvents(old => [payload.new as DeviceEvent, ...old].slice(0, 50))).subscribe()
    return () => { void supabase!.removeChannel(channel) }
  }, [load])
  const send = async (command_type: string, payload: Record<string, unknown>) => {
    if (preview) { setNotice('Preview mode cannot send commands. Connect Supabase and an ESP32 first.'); return }
    if (!supabase || !device || !userId) return
    setNotice('Sending secure configuration…')
    const { error: commandError } = await supabase.from('borehole_commands').insert({ device_id: device.id, requested_by: userId, command_type, payload })
    setNotice(commandError ? commandError.message : 'Configuration queued. Waiting for device acknowledgement.')
  }
  if (loading) return <Loading text="Loading smart tank status…" />
  const online = preview || isDeviceOnline(device)
  const level = normalizedLevel(reading)
  const chart = history.slice().reverse().map(item => ({ time: item.received_at, level: item.level_percent }))
  return <div className="app-shell">
    <header className="app-header"><Brand/><div className="header-actions"><button className="icon-button" onClick={() => setTab('alerts')} aria-label="Open alerts"><Bell/>{events.some(item => item.severity !== 'info') && <i/>}</button><button className="icon-button" onClick={toggleTheme} aria-label={`Use ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? <Moon/> : <Sun/>}</button></div></header>
    <main className="app-content">
      {preview && <div className="preview-banner"><Info/>Interactive preview — connect Supabase for the assigned tank.</div>}
      {error && <div className="banner error"><AlertTriangle/><span>{error}</span><button onClick={() => void load()}><RefreshCw/>Retry</button></div>}
      {tab === 'home' && <Home reading={reading} settings={settings} events={events} online={online} level={level}/>}
      {tab === 'history' && <HistoryPage chart={chart} history={history}/>}
      {tab === 'alerts' && <Alerts events={events} commands={commands} reading={reading} settings={settings} online={online}/>}
      {tab === 'settings' && <SettingsPage settings={settings} device={device} userEmail={userEmail} theme={theme} toggleTheme={toggleTheme} send={send} showInfo={setInfo}/>}
    </main>
    <nav className="bottom-nav" aria-label="Primary navigation"><Nav tab="home" current={tab} set={setTab} icon={<Gauge/>} label="Home"/><Nav tab="history" current={tab} set={setTab} icon={<History/>} label="History"/><Nav tab="alerts" current={tab} set={setTab} icon={<Bell/>} label="Alerts"/><Nav tab="settings" current={tab} set={setTab} icon={<Settings/>} label="Settings"/></nav>
    {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={() => setNotice('')}>Dismiss</button></div>}
    {info && <InfoSheet page={info} close={() => setInfo(null)} />}
  </div>
}

function Home({ reading, settings, events, online, level }: { reading: Reading | null; settings: DeviceSettings | null; events: DeviceEvent[]; online: boolean; level: number | null }) {
  const pumpOn = reading?.pump_state === 'on'
  const depth = settings?.usable_tank_depth_cm
  const status = tankStatus(level, reading, settings, online)
  const waterHeight = reading?.water_depth_cm
  return <>
    <section className="welcome-row"><div><h1>Tank Overview</h1></div><div className={`status-pill ${online ? 'online' : 'offline'}`}>{online ? <Wifi/> : <WifiOff/>}{online ? 'Device online' : 'Device offline'}</div></section>
    <section className="tank-overview card">
      <div className="tank-visual"><div className="tank-shell"><div className="tank-shine"/><div className="water" style={{ height: `${level ?? 0}%` }}/></div><div className="depth-scale"><span>{depth ?? '—'} cm</span><span>{depth ? Math.round(depth / 2) : '—'} cm</span><span>0 cm</span></div></div>
      <div className="tank-copy"><p className="eyebrow">Water level</p><strong>{level === null ? '—' : `${Math.round(level)}%`}</strong><p>{waterHeight?.toFixed(0) ?? '—'} cm of {depth ?? '—'} cm</p><div className="tank-mini-grid"><div><b>{waterHeight?.toFixed(0) ?? '—'} cm</b><small>Water height</small></div><div><b>{depth ?? '—'} cm</b><small>Tank depth</small></div></div></div>
      <div className="threshold-track"><span style={{ width: `${settings?.lower_limit_percent ?? 60}%` }}/><i style={{ left: `${settings?.lower_limit_percent ?? 60}%` }}><b>Start</b>{settings?.lower_limit_percent ?? 60}%</i><i style={{ left: `${settings?.upper_limit_percent ?? 95}%` }}><b>Stop</b>{settings?.upper_limit_percent ?? 95}%</i></div>
    </section>
    <section className="live-grid card"><article><span className="metric-icon"><Droplets/></span><div><small>Water level</small><strong>{level === null ? 'Unavailable' : `${Math.round(level)}%`}</strong><em>{status.short}</em></div></article><article><span className={`metric-icon pump ${pumpOn ? 'active' : ''}`}><Activity/></span><div><small>Pump status</small><strong className={pumpOn ? 'good' : ''}>{pumpOn ? 'RUNNING' : 'STOPPED'}</strong><em>{online ? 'Live status' : 'Last known status'}</em></div></article></section>
    <section className={`card system-status ${status.tone}`}><div className="status-icon"><ShieldCheck/></div><div><p className="eyebrow">Tank status</p><h2>{status.title}</h2><p>{status.message}</p></div><footer><span><Clock/>Updated {formatTime(reading?.received_at, true)}</span><span><RefreshCw/>Auto refresh</span></footer></section>
    <section className="card recent"><div className="section-title"><div><p className="eyebrow">System timeline</p><h2>Recent activity</h2></div><Activity/></div>{events.length ? events.slice(0, 4).map(item => <article key={item.id}><span className={`event-dot ${item.severity}`}/><p>{item.message}</p><time>{formatTime(item.created_at, true)}</time></article>) : <Empty icon={<Activity/>} text="No recent activity recorded."/>}</section>
  </>
}

function tankStatus(level: number | null, reading: Reading | null, settings: DeviceSettings | null, online: boolean) {
  if (!online) return { title: 'Device is Offline', message: 'Local automatic control can continue, but live monitoring is unavailable.', short: 'Offline', tone: 'warning' }
  if (reading?.fault_code || (reading && reading.sensor_status !== 'healthy')) return { title: 'Attention Required', message: reading?.fault_code ? `Controller fault: ${reading.fault_code.replaceAll('_', ' ')}` : 'The level sensor is not reporting a healthy reading.', short: 'Check sensor', tone: 'danger' }
  if (level === null) return { title: 'Waiting for a Reading', message: 'The controller has not supplied a valid water level yet.', short: 'Checking', tone: 'neutral' }
  if (level >= (settings?.upper_limit_percent ?? 95)) return { title: 'Tank is Full', message: 'The upper limit has been reached and the pump should be stopped.', short: 'Full', tone: 'good' }
  if (level <= (settings?.lower_limit_percent ?? 60)) return { title: 'Automatic Filling Active', message: 'Water is at the start threshold; the ESP32 manages pump operation.', short: 'Low level', tone: 'warning' }
  return { title: 'Everything is Normal', message: 'Tank level is operating within the configured safe range.', short: 'Normal', tone: 'good' }
}

function HistoryPage({ chart, history }: { chart: { time: string; level: number | null }[]; history: Reading[] }) {
  const levels = history.flatMap(item => typeof item.level_percent === 'number' ? [item.level_percent] : [])
  const average = levels.length ? levels.reduce((sum, value) => sum + value, 0) / levels.length : null
  return <section className="page-stack"><PageTitle eyebrow="Telemetry" title="Tank history" description="Recent automatic measurements from the ESP32."/><section className="history-summary"><SummaryStat label="Average" value={average === null ? '—' : `${average.toFixed(0)}%`} icon={<TrendingUp/>}/><SummaryStat label="Highest" value={levels.length ? `${Math.max(...levels).toFixed(0)}%` : '—'} icon={<Droplets/>}/><SummaryStat label="Readings" value={String(history.length)} icon={<Activity/>}/></section><section className="card chart-card"><TankChart data={chart}/></section><section className="card list-card"><h2>Reading log</h2>{history.length ? history.slice(0, 30).map(item => <article key={item.id}><span className="reading-level">{item.level_percent?.toFixed(0) ?? '—'}%</span><div><b>{item.water_depth_cm?.toFixed(1) ?? '—'} cm water height</b><small>{item.sensor_status.replaceAll('_', ' ')} · pump {item.pump_state}</small></div><time>{formatTime(item.received_at)}</time></article>) : <Empty icon={<History/>} text="No readings received yet."/>}</section></section>
}

function Alerts({ events, commands, reading, settings, online }: { events: DeviceEvent[]; commands: DeviceCommand[]; reading: Reading | null; settings: DeviceSettings | null; online: boolean }) {
  const current = tankStatus(normalizedLevel(reading), reading, settings, online)
  const configurationCommands = commands.filter(item => item.command_type === 'set_config')
  return <section className="page-stack"><PageTitle eyebrow="System record" title="Alerts & activity" description="Safety status and controller events."/><section className={`card alert-overview ${current.tone}`}><ShieldCheck/><div><b>{current.title}</b><p>{current.message}</p></div></section><section className="card list-card"><h2>System events</h2>{events.length ? events.map(item => <article key={item.id}><span className={`event-icon ${item.severity}`}><Bell/></span><div><b>{item.message}</b><small>{item.event_type.replaceAll('_', ' ')}</small></div><time>{formatTime(item.created_at)}</time></article>) : <Empty icon={<Bell/>} text="No system alerts."/>}</section>{configurationCommands.length > 0 && <section className="card list-card"><h2>Configuration delivery</h2>{configurationCommands.map(item => <article key={item.id}><span className={`command-state ${item.status}`}/><div><b>Pump thresholds</b><small>{item.status}{item.result_message ? ` · ${item.result_message}` : ''}</small></div><time>{formatTime(item.requested_at)}</time></article>)}</section>}</section>
}

function SettingsPage({ settings, device, userEmail, theme, toggleTheme, send, showInfo }: { settings: DeviceSettings | null; device: Device | null; userEmail?: string; theme: Theme; toggleTheme: () => void; send: (type: string, payload: Record<string, unknown>) => Promise<void>; showInfo: (page: InfoPage) => void }) {
  return <section className="page-stack"><PageTitle eyebrow="Configuration" title="Settings" description="Automatic filling and application preferences."/><SettingsPanel settings={settings} onSave={payload => send('set_config', payload)}/><section className="card settings-list"><h2>Account & application</h2><SettingRow icon={<UserRound/>} title={userEmail ?? ADMIN_EMAIL} detail="Assigned administrator"/><SettingButton icon={<Moon/>} title="Appearance" detail={theme === 'light' ? 'Light mode' : 'Dark mode'} onClick={toggleTheme}/><SettingButton icon={<BookOpen/>} title="User guide" detail="Automatic operation and safe use" onClick={() => showInfo('guide')}/><SettingButton icon={<Info/>} title="About Smart Water Tank" detail="Device and application information" onClick={() => showInfo('about')}/><SettingButton icon={<ShieldCheck/>} title="Terms & privacy" detail="Responsible use and data handling" onClick={() => showInfo('terms')}/>{configured && <SettingButton danger icon={<LogOut/>} title="Sign out" detail="End this secure session" onClick={() => void supabase?.auth.signOut()}/>}</section><section className="device-meta"><p>{device?.name ?? 'Smart tank controller'} · Firmware {device?.firmware_version ?? 'unknown'}</p><p>Device ID: {device?.device_code ?? 'Not assigned'}</p></section></section>
}

function SettingsPanel({ settings, onSave }: { settings: DeviceSettings | null; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const [lower, setLower] = useState(settings?.lower_limit_percent ?? 60), [upper, setUpper] = useState(settings?.upper_limit_percent ?? 95), [depth, setDepth] = useState(settings?.usable_tank_depth_cm ?? 200), [saving, setSaving] = useState(false)
  useEffect(() => { if (settings) { setLower(settings.lower_limit_percent); setUpper(settings.upper_limit_percent); setDepth(settings.usable_tank_depth_cm) } }, [settings])
  const depths = [20, 30, 50, 100, 150, 200, 250, 300, 350], valid = lower >= 0 && upper <= 100 && upper - lower >= 5 && depths.includes(depth)
  const save = async () => { setSaving(true); await onSave({ lower_limit_percent: lower, upper_limit_percent: upper, usable_tank_depth_cm: depth }); setSaving(false) }
  return <section className="card settings-card"><div className="settings-title"><span><Radio/></span><div><h2>Pump thresholds</h2><p>The ESP32 starts the pump at the lower limit and stops it at the upper limit.</p></div></div><div className="settings-fields"><label>Lower limit<div><input type="number" min="0" max="95" value={lower} onChange={event => setLower(Number(event.target.value))}/><span>%</span></div></label><label>Upper limit<div><input type="number" min="5" max="100" value={upper} onChange={event => setUpper(Number(event.target.value))}/><span>%</span></div></label><label>Usable tank depth<select value={depth} onChange={event => setDepth(Number(event.target.value))}>{depths.map(value => <option key={value}>{value} cm</option>)}</select></label></div>{!valid && <p className="validation" role="alert">Use 0–100%, at least a 5% gap, and a supported depth.</p>}<button className="primary" disabled={!valid || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save pump thresholds'}</button></section>
}

function InfoSheet({ page, close }: { page: Exclude<InfoPage, null>; close: () => void }) {
  const content = {
    about: { icon: <Droplets/>, title: 'About Smart Water Tank', body: <><p>Smart Water Tank is the monitoring companion for the Kachalla ESP32 water controller. It presents live tank level, pump state, automatic thresholds, alerts and history while the ESP32 keeps control local.</p><h3>Safety boundary</h3><p>The application does not replace correct electrical installation, relay protection, tank inspection or qualified maintenance.</p></> },
    guide: { icon: <CircleHelp/>, title: 'User guide', body: <><h3>Automatic operation</h3><p>The pump starts at the lower threshold and stops at the upper threshold. The ESP32 applies these rules locally even without internet.</p><h3>Attention required</h3><p>Check power, Wi-Fi and the level sensor when the device is offline or reports a fault. Never bypass controller or electrical protection.</p><h3>Settings</h3><p>Enter the measured usable tank depth and keep at least five percentage points between start and stop levels.</p></> },
    terms: { icon: <ShieldCheck/>, title: 'Terms & privacy', body: <><h3>Responsible operation</h3><p>Only authorized users may access the assigned tank. The automatic controller must not be used as the only emergency isolation method.</p><h3>Data</h3><p>The service processes account identity, telemetry, configuration commands and audit events. Access must remain restricted by server-side membership policies.</p><h3>Notice</h3><p>This summary requires jurisdiction-specific legal and privacy review before commercial release.</p></> },
  }[page]
  return <div className="sheet-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close() }}><section className="info-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><header><span>{content.icon}</span><button onClick={close} aria-label="Close"><X/></button></header><h2 id="sheet-title">{content.title}</h2>{content.body}<button className="primary" onClick={close}>Done</button></section></div>
}

function TankChart({ data }: { data: { time: string; level: number | null }[] }) {
  const valid = data.filter((item): item is { time: string; level: number } => typeof item.level === 'number')
  const points = useMemo(() => valid.map((item, index) => `${valid.length === 1 ? 500 : index / (valid.length - 1) * 1000},${250 - item.level * 2.3}`).join(' '), [valid])
  if (!valid.length) return <Empty icon={<Activity/>} text="No valid tank levels."/>
  return <div className="tank-chart"><span>100%</span><svg viewBox="0 0 1000 260" role="img" aria-label={`Tank level from ${valid[0].level.toFixed(0)} to ${valid.at(-1)!.level.toFixed(0)} percent`}><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".28"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs><line x1="0" y1="20" x2="1000" y2="20"/><line x1="0" y1="135" x2="1000" y2="135"/><line x1="0" y1="250" x2="1000" y2="250"/><polyline points={points}/></svg><small>{formatTime(valid[0].time)}</small><small>{formatTime(valid.at(-1)!.time)}</small></div>
}

function Brand() { return <div className="brand"><img src="./icon.svg" alt=""/><b>Smart Water Tank</b></div> }
function Nav({ tab, current, set, icon, label }: { tab: Tab; current: Tab; set: (tab: Tab) => void; icon: React.ReactNode; label: string }) { return <button className={current === tab ? 'active' : ''} aria-current={current === tab ? 'page' : undefined} onClick={() => set(tab)}>{icon}<span>{label}</span></button> }
function PageTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <header className="page-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></header> }
function SummaryStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <article className="card"><span>{icon}</span><div><small>{label}</small><b>{value}</b></div></article> }
function SettingRow({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) { return <div className="setting-row"><span>{icon}</span><div><b>{title}</b><small>{detail}</small></div></div> }
function SettingButton({ icon, title, detail, onClick, danger = false }: { icon: React.ReactNode; title: string; detail: string; onClick: () => void; danger?: boolean }) { return <button className={danger ? 'danger-row' : ''} onClick={onClick}><span>{icon}</span><div><b>{title}</b><small>{detail}</small></div><ChevronRight/></button> }
function Empty({ icon, text }: { icon: React.ReactNode; text: string }) { return <div className="empty-state">{icon}<p>{text}</p></div> }
function Loading({ text }: { text: string }) { return <main className="loading"><span/><p>{text}</p></main> }

export default App
