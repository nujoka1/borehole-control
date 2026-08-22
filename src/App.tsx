import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, Bell, BookOpen, ChevronRight, CircleHelp, Droplets, Eye, EyeOff, Gauge, History, Info, LogOut, Moon, Power, RefreshCw, Settings, ShieldCheck, Sun, UserRound, Wifi, WifiOff, X } from 'lucide-react'
import { configured, supabase } from './lib/supabase'
import { isDeviceOnline, normalizedLevel } from './lib/device'
import type { Device, DeviceCommand, DeviceEvent, DeviceSettings, Reading } from './types'

type Theme = 'light' | 'dark'
type Tab = 'home' | 'history' | 'alerts' | 'settings'
type InfoPage = 'about' | 'guide' | 'terms' | null

const now = new Date().toISOString()
const DEMO_DEVICE: Device = { id: 'preview', device_code: 'PREVIEW', name: 'Main Tank', location_name: 'Kahalla water system', firmware_version: '1.0.0', is_online: true, last_seen_at: now }
const DEMO_READING: Reading = { id: 1, device_id: 'preview', received_at: now, uptime_ms: 86400000, distance_cm: 106, water_depth_cm: 204, level_percent: 68, sensor_status: 'healthy', pump_state: 'on', control_mode: 'automatic', fault_code: null, wifi_rssi_dbm: -54, firmware_version: '1.0.0' }
const DEMO_SETTINGS: DeviceSettings = { device_id: 'preview', lower_limit_percent: 60, upper_limit_percent: 95, usable_tank_depth_cm: 300, mounting_offset_cm: 10, maximum_pump_runtime_seconds: 1800, telemetry_interval_seconds: 10 }
const DEMO_EVENTS: DeviceEvent[] = [{ id: 1, event_type: 'pump_started', severity: 'info', message: 'Pump started automatically', created_at: now }]
const formatTime = (value?: string | null, short = false) => value ? new Intl.DateTimeFormat(undefined, short ? { hour: 'numeric', minute: '2-digit' } : { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Never'

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('borehole-theme')
    return saved === 'dark' || saved === 'light' ? saved : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  })
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('borehole-theme', theme) }, [theme])
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
    <section className="auth-visual"><Brand/><div><span className="auth-orbit"><Droplets/></span><h1>Water control,<br/>wherever you are.</h1><p>Monitor tank levels and protect your pump with safe, real-time control.</p></div><small>Secure IoT water management</small></section>
    <form className="auth-card" onSubmit={submit}>
      <div className="auth-mobile-brand"><Brand/></div><p className="eyebrow">Protected access</p><h2>Welcome back</h2><p>Sign in with your assigned administrator, operator or viewer account.</p>
      <label>Email address<input required type="email" autoComplete="email" placeholder="name@example.com" value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label>Password<div className="password-field"><input required minLength={8} type={visible ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={event => setPassword(event.target.value)} /><button type="button" onClick={() => setVisible(value => !value)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff/> : <Eye/>}</button></div></label>
      <button type="button" className="text-button reset" onClick={() => void reset()}>Forgot password?</button>
      <button className="primary large" disabled={busy}>{busy ? 'Please wait…' : 'Sign in securely'}</button>
      {message && <p className="form-message" role="status">{message}</p>}
      <p className="security-note"><ShieldCheck/> Permissions are verified by the server.</p>
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
    if (deviceError || !next) { setError(deviceError?.message ?? 'No borehole device is assigned to this account.'); setLoading(false); return }
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
    const channel = supabase.channel('borehole-dashboard')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'borehole_readings' }, payload => { const next = payload.new as Reading; setReading(next); setHistory(old => [next, ...old].slice(0, 200)) })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'borehole_devices' }, payload => setDevice(payload.new as Device))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'borehole_commands' }, payload => { const next = payload.new as DeviceCommand; if (next?.id) setCommands(old => [next, ...old.filter(item => item.id !== next.id)].slice(0, 20)) })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'borehole_events' }, payload => setEvents(old => [payload.new as DeviceEvent, ...old].slice(0, 50))).subscribe()
    return () => { void supabase!.removeChannel(channel) }
  }, [load])
  const send = async (command_type: string, payload: Record<string, unknown>) => {
    if (preview) { setNotice('Preview mode cannot send commands. Connect Supabase and an ESP32 first.'); return }
    if (!supabase || !device || !userId) return
    setNotice('Sending command…')
    const { error: commandError } = await supabase.from('borehole_commands').insert({ device_id: device.id, requested_by: userId, command_type, payload })
    setNotice(commandError ? commandError.message : 'Command queued. Waiting for device acknowledgement.')
  }
  const togglePump = async () => {
    const starting = reading?.pump_state !== 'on'
    if (starting && !window.confirm('Start the pump manually? Device safety checks still apply.')) return
    await send('pump', { state: starting ? 'on' : 'off' })
  }
  if (loading) return <Loading text="Loading borehole status…" />
  const online = preview || isDeviceOnline(device)
  const level = normalizedLevel(reading)
  const chart = history.slice().reverse().map(item => ({ time: item.received_at, level: item.level_percent }))
  return <div className="app-shell">
    <header className="app-header"><Brand/><div className="header-actions"><button className="icon-button" onClick={() => setTab('alerts')} aria-label="Open alerts"><Bell/>{events.some(item => item.severity !== 'info') && <i/>}</button><button className="icon-button" onClick={toggleTheme} aria-label={`Use ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? <Moon/> : <Sun/>}</button></div></header>
    <main className="app-content">
      {preview && <div className="preview-banner"><Info/>Interactive preview — connect Supabase for real devices.</div>}
      {error && <div className="banner error"><AlertTriangle/><span>{error}</span><button onClick={() => void load()}><RefreshCw/>Retry</button></div>}
      {tab === 'home' && <Home device={device} reading={reading} settings={settings} events={events} online={online} level={level} send={send} togglePump={togglePump}/>}
      {tab === 'history' && <HistoryPage chart={chart} history={history}/>}
      {tab === 'alerts' && <Alerts events={events} commands={commands}/>}
      {tab === 'settings' && <SettingsPage settings={settings} device={device} userEmail={userEmail} theme={theme} toggleTheme={toggleTheme} send={send} showInfo={setInfo}/>}
    </main>
    <nav className="bottom-nav" aria-label="Primary navigation"><Nav tab="home" current={tab} set={setTab} icon={<Gauge/>} label="Home"/><Nav tab="history" current={tab} set={setTab} icon={<History/>} label="History"/><Nav tab="alerts" current={tab} set={setTab} icon={<Bell/>} label="Alerts"/><Nav tab="settings" current={tab} set={setTab} icon={<Settings/>} label="Settings"/></nav>
    {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={() => setNotice('')}>Dismiss</button></div>}
    {info && <InfoSheet page={info} close={() => setInfo(null)} />}
  </div>
}

function Home({ device, reading, settings, events, online, level, send, togglePump }: { device: Device | null; reading: Reading | null; settings: DeviceSettings | null; events: DeviceEvent[]; online: boolean; level: number | null; send: (type: string, payload: Record<string, unknown>) => Promise<void>; togglePump: () => Promise<void> }) {
  const pumpOn = reading?.pump_state === 'on', automatic = reading?.control_mode === 'automatic', depth = settings?.usable_tank_depth_cm
  return <><section className="welcome-row"><div><p>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}</p><h1>{device?.name ?? 'Borehole system'}</h1></div><div className={`status-pill ${online ? 'online' : 'offline'}`}>{online ? <Wifi/> : <WifiOff/>}{online ? 'Device online' : 'Device offline'}</div></section>
    <section className="tank-overview card"><div className="tank-visual"><div className="tank-shell"><div className="water" style={{ height: `${level ?? 0}%` }}/></div><span className="depth top">{depth ?? '—'} cm</span><span className="depth middle">{depth ? Math.round(depth / 2) : '—'} cm</span><span className="depth bottom">0 cm</span></div><div className="tank-copy"><p className="eyebrow">Water level</p><strong>{level === null ? '—' : `${Math.round(level)}%`}</strong><p>{reading?.water_depth_cm?.toFixed(0) ?? '—'} cm of {depth ?? '—'} cm</p><div className={`pump-summary ${pumpOn ? 'active' : ''}`}><span/><div><b>Pump {pumpOn ? 'running' : 'stopped'}</b><small>{automatic ? 'Automatic' : 'Manual'} mode</small></div></div></div><div className="threshold-track"><span style={{ width: `${settings?.lower_limit_percent ?? 60}%` }}/><i style={{ left: `${settings?.lower_limit_percent ?? 60}%` }}><b>Start</b>{settings?.lower_limit_percent ?? 60}%</i><i style={{ left: `${settings?.upper_limit_percent ?? 95}%` }}><b>Stop</b>{settings?.upper_limit_percent ?? 95}%</i></div></section>
    <section className="health-grid"><article className="card"><span className="metric-icon"><Power/></span><div><small>Pump</small><strong className={pumpOn ? 'good' : ''}>{pumpOn ? 'ON' : 'OFF'}</strong></div></article><article className="card"><span className="metric-icon"><ShieldCheck/></span><div><small>System</small><strong className={!reading?.fault_code && reading?.sensor_status === 'healthy' ? 'good' : 'danger'}>{reading?.fault_code ? 'Fault' : reading?.sensor_status === 'healthy' ? 'Healthy' : 'Checking'}</strong></div></article></section>
    <section className="card control-card"><h2>Control mode</h2><div className="segmented"><button className={automatic ? 'active' : ''} onClick={() => void send('set_mode', { mode: 'automatic' })}>Automatic</button><button className={!automatic ? 'active' : ''} onClick={() => void send('set_mode', { mode: 'manual' })}>Manual</button></div><button className={`pump-action ${pumpOn ? 'stop' : 'start'}`} disabled={!online || automatic} onClick={() => void togglePump()}>{pumpOn ? 'Stop pump' : 'Start pump'}</button>{automatic && <small>Switch to manual mode for direct pump control.</small>}</section>
    <section className="card recent"><div className="section-title"><h2>Recent activity</h2><Activity/></div>{events.length ? events.slice(0, 3).map(item => <article key={item.id}><span className={`event-dot ${item.severity}`}/><p>{item.message}</p><time>{formatTime(item.created_at, true)}</time></article>) : <Empty icon={<Activity/>} text="No activity recorded yet."/>}</section></>
}

function HistoryPage({ chart, history }: { chart: { time: string; level: number | null }[]; history: Reading[] }) { return <section className="page-stack"><PageTitle eyebrow="Telemetry" title="Tank history" description="Recent ESP32 readings."/><section className="card chart-card"><TankChart data={chart}/></section><section className="card list-card"><h2>Reading log</h2>{history.length ? history.slice(0, 30).map(item => <article key={item.id}><div><b>{item.level_percent?.toFixed(0) ?? '—'}% full</b><small>{item.water_depth_cm?.toFixed(1) ?? '—'} cm · {item.sensor_status}</small></div><time>{formatTime(item.received_at)}</time></article>) : <Empty icon={<History/>} text="No readings received yet."/>}</section></section> }
function Alerts({ events, commands }: { events: DeviceEvent[]; commands: DeviceCommand[] }) { return <section className="page-stack"><PageTitle eyebrow="System record" title="Alerts & activity" description="Faults, pump events and command delivery."/><section className="card list-card"><h2>System events</h2>{events.length ? events.map(item => <article key={item.id}><span className={`event-icon ${item.severity}`}><Bell/></span><div><b>{item.message}</b><small>{item.event_type.replaceAll('_', ' ')}</small></div><time>{formatTime(item.created_at)}</time></article>) : <Empty icon={<Bell/>} text="No system alerts."/>}</section><section className="card list-card"><h2>Command status</h2>{commands.length ? commands.map(item => <article key={item.id}><span className={`command-state ${item.status}`}/><div><b>{item.command_type.replaceAll('_', ' ')}</b><small>{item.status}{item.result_message ? ` · ${item.result_message}` : ''}</small></div><time>{formatTime(item.requested_at)}</time></article>) : <Empty icon={<Activity/>} text="No commands sent yet."/>}</section></section> }

function SettingsPage({ settings, device, userEmail, theme, toggleTheme, send, showInfo }: { settings: DeviceSettings | null; device: Device | null; userEmail?: string; theme: Theme; toggleTheme: () => void; send: (type: string, payload: Record<string, unknown>) => Promise<void>; showInfo: (page: InfoPage) => void }) {
  return <section className="page-stack"><PageTitle eyebrow="Configuration" title="Settings" description="Device control and app preferences."/><SettingsPanel settings={settings} onSave={payload => send('set_config', payload)}/><section className="card settings-list"><h2>Account & application</h2><SettingRow icon={<UserRound/>} title={userEmail ?? 'Preview account'} detail="Server-managed device access"/><SettingButton icon={<Moon/>} title="Appearance" detail={theme === 'light' ? 'Light mode' : 'Dark mode'} onClick={toggleTheme}/><SettingButton icon={<BookOpen/>} title="User guide" detail="Setup, modes and safe operation" onClick={() => showInfo('guide')}/><SettingButton icon={<Info/>} title="About this system" detail="Device and application information" onClick={() => showInfo('about')}/><SettingButton icon={<ShieldCheck/>} title="Terms & privacy" detail="Responsible use and data handling" onClick={() => showInfo('terms')}/>{configured && <SettingButton danger icon={<LogOut/>} title="Sign out" detail="End this secure session" onClick={() => void supabase?.auth.signOut()}/>}</section><section className="device-meta"><p>{device?.name ?? 'Borehole controller'} · Firmware {device?.firmware_version ?? 'unknown'}</p><p>Device ID: {device?.device_code ?? 'Not assigned'}</p></section></section>
}

function SettingsPanel({ settings, onSave }: { settings: DeviceSettings | null; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const [lower, setLower] = useState(settings?.lower_limit_percent ?? 60), [upper, setUpper] = useState(settings?.upper_limit_percent ?? 95), [depth, setDepth] = useState(settings?.usable_tank_depth_cm ?? 100), [saving, setSaving] = useState(false)
  useEffect(() => { if (settings) { setLower(settings.lower_limit_percent); setUpper(settings.upper_limit_percent); setDepth(settings.usable_tank_depth_cm) } }, [settings])
  const depths = [20, 30, 50, 100, 150, 200, 250, 300, 350], valid = lower >= 0 && upper <= 100 && upper - lower >= 5 && depths.includes(depth)
  const save = async () => { setSaving(true); await onSave({ lower_limit_percent: lower, upper_limit_percent: upper, usable_tank_depth_cm: depth }); setSaving(false) }
  return <section className="card settings-card"><h2>Automatic control</h2><p>The pump starts at the lower limit and stops at the upper limit.</p><div className="settings-fields"><label>Start level<div><input type="number" min="0" max="95" value={lower} onChange={event => setLower(Number(event.target.value))}/><span>%</span></div></label><label>Stop level<div><input type="number" min="5" max="100" value={upper} onChange={event => setUpper(Number(event.target.value))}/><span>%</span></div></label><label>Tank depth<select value={depth} onChange={event => setDepth(Number(event.target.value))}>{depths.map(value => <option key={value}>{value}</option>)}</select></label></div>{!valid && <p className="validation" role="alert">Use 0–100%, at least a 5% gap, and a supported depth.</p>}<button className="primary" disabled={!valid || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save device settings'}</button></section>
}

function InfoSheet({ page, close }: { page: Exclude<InfoPage, null>; close: () => void }) {
  const content = {
    about: { icon: <Droplets/>, title: 'About Borehole Control', body: <><p>A safety-focused companion for the Kahalla ESP32 controller. It displays verified telemetry and sends authenticated commands while automatic protection remains local on the device.</p><h3>Important boundary</h3><p>The app does not replace correct electrical installation, relay protection, tank inspection or qualified maintenance.</p></> },
    guide: { icon: <CircleHelp/>, title: 'User guide', body: <><h3>Automatic mode</h3><p>Recommended for normal use. The ESP32 controls the pump locally even without internet.</p><h3>Manual mode</h3><p>Use only with supervision. Device safety checks can still reject an unsafe command.</p><h3>Offline device</h3><p>Confirm power and Wi-Fi. Inspect the pump and tank if local operation appears abnormal.</p></> },
    terms: { icon: <ShieldCheck/>, title: 'Terms & privacy', body: <><h3>Responsible operation</h3><p>Only authorized users may control an assigned device. Never bypass electrical or pump protection.</p><h3>Data</h3><p>The service processes account identity, telemetry, commands and audit events. Access is restricted by server-side membership policies.</p><h3>Notice</h3><p>This summary requires jurisdiction-specific legal and privacy review before commercial release.</p></> },
  }[page]
  return <div className="sheet-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close() }}><section className="info-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><header><span>{content.icon}</span><button onClick={close} aria-label="Close"><X/></button></header><h2 id="sheet-title">{content.title}</h2>{content.body}<button className="primary" onClick={close}>Done</button></section></div>
}

function TankChart({ data }: { data: { time: string; level: number | null }[] }) {
  const valid = data.filter((item): item is { time: string; level: number } => typeof item.level === 'number')
  const points = useMemo(() => valid.map((item, index) => `${valid.length === 1 ? 500 : index / (valid.length - 1) * 1000},${250 - item.level * 2.3}`).join(' '), [valid])
  if (!valid.length) return <Empty icon={<Activity/>} text="No valid tank levels."/>
  return <div className="tank-chart"><span>100%</span><svg viewBox="0 0 1000 260" role="img" aria-label={`Tank level from ${valid[0].level.toFixed(0)} to ${valid.at(-1)!.level.toFixed(0)} percent`}><line x1="0" y1="20" x2="1000" y2="20"/><line x1="0" y1="135" x2="1000" y2="135"/><line x1="0" y1="250" x2="1000" y2="250"/><polyline points={points}/></svg><small>{formatTime(valid[0].time)}</small><small>{formatTime(valid.at(-1)!.time)}</small></div>
}

function Brand() { return <div className="brand"><span><Droplets/></span><b>Borehole Control</b></div> }
function Nav({ tab, current, set, icon, label }: { tab: Tab; current: Tab; set: (tab: Tab) => void; icon: React.ReactNode; label: string }) { return <button className={current === tab ? 'active' : ''} aria-current={current === tab ? 'page' : undefined} onClick={() => set(tab)}>{icon}<span>{label}</span></button> }
function PageTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <header className="page-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></header> }
function SettingRow({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) { return <div className="setting-row"><span>{icon}</span><div><b>{title}</b><small>{detail}</small></div></div> }
function SettingButton({ icon, title, detail, onClick, danger = false }: { icon: React.ReactNode; title: string; detail: string; onClick: () => void; danger?: boolean }) { return <button className={danger ? 'danger-row' : ''} onClick={onClick}><span>{icon}</span><div><b>{title}</b><small>{detail}</small></div><ChevronRight/></button> }
function Empty({ icon, text }: { icon: React.ReactNode; text: string }) { return <div className="empty-state">{icon}<p>{text}</p></div> }
function Loading({ text }: { text: string }) { return <main className="loading"><span/><p>{text}</p></main> }
export default App
