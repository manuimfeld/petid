import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  Activity, AlertTriangle, ArrowDownToLine, Boxes, CheckCircle2, ChevronRight,
  CircleDot, Database, FileClock, Fingerprint, Gauge, LoaderCircle, LogOut,
  Menu, PawPrint, Plus, QrCode, RefreshCw, Search, ShieldCheck, Sparkles, Users, X,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:4000'
type View = 'overview' | 'inventory' | 'audit'
type QrStatus = 'available' | 'reserved' | 'activated' | 'disabled'
type AdminUser = { id: string; name: string; email: string; role: 'user' | 'admin' }
type Metrics = {
  qrs: { status: QrStatus; total: number }[]
  totals: { users: number; pets: number; lostPets: number; scans: number; qrs: number }
  scansByDay: { day: string; total: number }[]
}
type Batch = { batch: string; total: number; available: number; activated: number; createdAt: string }
type QrRecord = { id: string; status: QrStatus; batch: string | null; createdAt: string; activatedAt: string | null }
type AuditLog = {
  id: string; action: string; entityType: string; entityId: string
  metadata: Record<string, unknown>; createdAt: string
  actor: { id: string | null; name: string | null; email: string | null } | null
}

const emptyMetrics: Metrics = { qrs: [], totals: { users: 0, pets: 0, lostPets: 0, scans: 0, qrs: 0 }, scansByDay: [] }

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init, credentials: 'include', headers: { Accept: 'application/json', ...init?.headers },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || data.error || `HTTP ${response.status}`)
  return data as T
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}
function statusLabel(status: QrStatus) {
  return { available: 'Disponible', reserved: 'Reservado', activated: 'Activado', disabled: 'Desactivado' }[status]
}

function Login({ onLogin }: { onLogin: (user: AdminUser) => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError('')
    const values = new FormData(event.currentTarget)
    try {
      await api('/api/auth/sign-in/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: values.get('email'), password: values.get('password') }) })
      const { user } = await api<{ user: AdminUser }>('/api/v1/me')
      if (user.role !== 'admin') { await api('/api/auth/sign-out', { method: 'POST' }); throw new Error('Esta cuenta no tiene acceso administrativo.') }
      onLogin(user)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No pudimos iniciar sesión.') }
    finally { setLoading(false) }
  }
  return <main className="login-shell">
    <div className="login-orbit orbit-one" /><div className="login-orbit orbit-two" />
    <section className="login-brand">
      <div className="brand-lockup"><span><PawPrint /></span><b>Pet<span>ID</span></b></div>
      <div className="mission-pill"><Sparkles size={15} /> Command center</div>
      <h1>Todo el universo PetID, bajo control.</h1>
      <p>Inventario, activaciones, mascotas perdidas y auditoría en una consola diseñada para operar rápido.</p>
      <div className="signal-row"><span><ShieldCheck /> Acceso protegido</span><span><Database /> Datos en vivo</span></div>
    </section>
    <section className="login-panel"><div className="login-card">
      <div className="login-icon"><Fingerprint /></div><p className="kicker">Zona restringida</p><h2>Ingresá al panel</h2><p className="muted">Usá una cuenta PetID con rol administrador.</p>
      <form onSubmit={submit}>
        <label>Email<input name="email" type="email" autoComplete="email" placeholder="admin@petid.com" required /></label>
        <label>Contraseña<input name="password" type="password" autoComplete="current-password" minLength={8} placeholder="••••••••" required /></label>
        {error && <div className="form-error"><AlertTriangle size={17} />{error}</div>}
        <button className="primary-button" disabled={loading}>{loading ? <LoaderCircle className="spin" /> : <ShieldCheck />}{loading ? 'Verificando…' : 'Entrar al dashboard'}</button>
      </form>
    </div></section>
  </main>
}

function StatCard({ icon, label, value, detail, tone = 'blue' }: { icon: ReactNode; label: string; value: number; detail: string; tone?: string }) {
  return <article className={`stat-card tone-${tone}`}><div className="stat-top"><span className="stat-icon">{icon}</span><Activity size={17} /></div><p>{label}</p><strong>{value.toLocaleString('es-AR')}</strong><small>{detail}</small></article>
}

function GenerateModal({ onClose, onGenerated }: { onClose: () => void; onGenerated: () => Promise<void> }) {
  const [loading, setLoading] = useState(false); const [result, setResult] = useState<{ batch: string; quantity: number } | null>(null); const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(''); const values = new FormData(event.currentTarget)
    try {
      const data = await api<{ batch: string; quantity: number }>('/api/v1/admin/qrs/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity: Number(values.get('quantity')), ...(values.get('batch') ? { batch: values.get('batch') } : {}) }) })
      setResult(data); await onGenerated()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No pudimos generar el lote.') }
    finally { setLoading(false) }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal-card"><button className="icon-button modal-close" onClick={onClose}><X /></button>
    {!result ? <><div className="modal-symbol"><QrCode /></div><p className="kicker">Nueva emisión</p><h2>Generar códigos PetID</h2><p className="muted">Cada código será único, permanente y quedará listo para convertir en SVG.</p><form onSubmit={submit}>
      <label>Cantidad<input name="quantity" type="number" min="1" max="500" defaultValue="100" required /></label><label>Nombre del lote <small>opcional</small><input name="batch" maxLength={80} placeholder="Ej. medallas-octubre" /></label>
      {error && <div className="form-error"><AlertTriangle size={17} />{error}</div>}<button className="primary-button" disabled={loading}>{loading ? <LoaderCircle className="spin" /> : <Sparkles />}{loading ? 'Generando…' : 'Crear lote'}</button>
    </form></> : <div className="success-state"><span><CheckCircle2 /></span><p className="kicker">Misión cumplida</p><h2>{result.quantity} códigos creados</h2><p>El lote <b>{result.batch}</b> ya está disponible en el inventario.</p><button className="primary-button" onClick={onClose}>Continuar <ChevronRight /></button></div>}
  </section></div>
}

function App() {
  const [user, setUser] = useState<AdminUser | null>(null); const [checking, setChecking] = useState(true); const [view, setView] = useState<View>('overview'); const [menuOpen, setMenuOpen] = useState(false); const [generateOpen, setGenerateOpen] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState('')
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics); const [batches, setBatches] = useState<Batch[]>([]); const [qrs, setQrs] = useState<QrRecord[]>([]); const [logs, setLogs] = useState<AuditLog[]>([]); const [search, setSearch] = useState(''); const [status, setStatus] = useState<QrStatus | ''>('')

  useEffect(() => { api<{ user: AdminUser }>('/api/v1/me').then(({ user: current }) => current.role === 'admin' && setUser(current)).catch(() => undefined).finally(() => setChecking(false)) }, [])
  const loadData = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [metricsData, batchData, qrData, logData] = await Promise.all([api<Metrics>('/api/v1/admin/metrics'), api<{ batches: Batch[] }>('/api/v1/admin/qrs/batches?limit=100'), api<{ qrs: QrRecord[] }>('/api/v1/admin/qrs?limit=100'), api<{ logs: AuditLog[] }>('/api/v1/admin/audit-logs?limit=100')])
      setMetrics(metricsData); setBatches(batchData.batches); setQrs(qrData.qrs); setLogs(logData.logs)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No pudimos cargar el dashboard.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { if (user) void loadData() }, [user, loadData])

  const chartData = useMemo(() => { const byDay = new Map(metrics.scansByDay.map((item) => [item.day, Number(item.total)])); return Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (6 - index)); const key = date.toISOString().slice(0, 10); return { day: new Intl.DateTimeFormat('es-AR', { weekday: 'short' }).format(date), scans: byDay.get(key) ?? 0 } }) }, [metrics.scansByDay])
  const filteredQrs = useMemo(() => qrs.filter((qr) => (!status || qr.status === status) && (!search || qr.id.toLowerCase().includes(search.toLowerCase()) || qr.batch?.toLowerCase().includes(search.toLowerCase()))), [qrs, search, status])
  async function logout() { await api('/api/auth/sign-out', { method: 'POST' }).catch(() => undefined); setUser(null) }
  async function downloadBatch(batch: string) { const response = await fetch(`${API_URL}/api/v1/admin/qrs/batches/${encodeURIComponent(batch)}/svg`, { credentials: 'include' }); if (!response.ok) return setError('No pudimos generar los SVG del lote.'); const blob = await response.blob(); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `petid-${batch}-svg.zip`; link.click(); URL.revokeObjectURL(link.href) }

  if (checking) return <div className="boot-screen"><PawPrint /><LoaderCircle className="spin" /><span>Iniciando PetID Command…</span></div>
  if (!user) return <Login onLogin={setUser} />
  const nav = [{ id: 'overview' as const, label: 'Centro de control', icon: <Gauge /> }, { id: 'inventory' as const, label: 'Inventario QR', icon: <Boxes /> }, { id: 'audit' as const, label: 'Auditoría', icon: <FileClock /> }]

  return <div className="app-shell"><aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
    <div className="sidebar-head"><div className="brand-lockup"><span><PawPrint /></span><b>Pet<span>ID</span></b></div><button className="icon-button mobile-close" onClick={() => setMenuOpen(false)}><X /></button></div>
    <div className="environment"><span className="live-dot" /> Sistema operativo <small>API conectada</small></div><nav>{nav.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => { setView(item.id); setMenuOpen(false) }}>{item.icon}<span>{item.label}</span><ChevronRight /></button>)}</nav>
    <div className="sidebar-foot"><div className="avatar">{user.name.slice(0, 2).toUpperCase()}</div><div><b>{user.name}</b><small>{user.email}</small></div><button className="icon-button" onClick={logout} title="Cerrar sesión"><LogOut /></button></div>
  </aside>{menuOpen && <div className="mobile-scrim" onClick={() => setMenuOpen(false)} />}
  <main className="dashboard"><header className="topbar"><button className="icon-button menu-button" onClick={() => setMenuOpen(true)}><Menu /></button><div><p className="kicker">PetID Admin / {view}</p><h1>{nav.find((item) => item.id === view)?.label}</h1></div><div className="top-actions"><button className="secondary-button" onClick={() => void loadData()} disabled={loading}><RefreshCw className={loading ? 'spin' : ''} /> Actualizar</button><button className="primary-button compact" onClick={() => setGenerateOpen(true)}><Plus /> Generar QR</button></div></header>
    {error && <div className="global-error"><AlertTriangle />{error}<button onClick={() => setError('')}><X /></button></div>}
    {view === 'overview' && <div className="view-stack enter"><section className="hero-strip"><div><span className="mission-pill"><Sparkles size={14} /> Pulso de la red</span><h2>Buenas, {user.name.split(' ')[0]}.</h2><p>La operación está sincronizada. Tenés una vista instantánea de todo lo que importa.</p></div><div className="hero-emblem"><PawPrint /><i /><i /><i /></div></section>
      <section className="stats-grid"><StatCard icon={<QrCode />} label="Códigos emitidos" value={Number(metrics.totals.qrs)} detail={`${metrics.qrs.find((item) => item.status === 'available')?.total ?? 0} listos para activar`} /><StatCard icon={<PawPrint />} label="Mascotas activas" value={Number(metrics.totals.pets)} detail="Perfiles vinculados" tone="violet" /><StatCard icon={<Users />} label="Personas" value={Number(metrics.totals.users)} detail="Cuentas registradas" tone="green" /><StatCard icon={<AlertTriangle />} label="Buscando volver" value={Number(metrics.totals.lostPets)} detail="Mascotas perdidas" tone="red" /></section>
      <section className="overview-grid"><article className="panel chart-panel"><div className="panel-head"><div><p className="kicker">Actividad</p><h3>Escaneos de los últimos 7 días</h3></div><div className="metric-chip"><Activity /> {Number(metrics.totals.scans).toLocaleString('es-AR')} total</div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="scanFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#49d9ff" stopOpacity={0.45}/><stop offset="100%" stopColor="#49d9ff" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#203243" vertical={false}/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#71879a', fontSize: 12 }}/><YAxis hide allowDecimals={false}/><Tooltip contentStyle={{ background: '#0d1822', border: '1px solid #263b4c', borderRadius: 14 }}/><Area type="monotone" dataKey="scans" stroke="#49d9ff" strokeWidth={3} fill="url(#scanFill)" /></AreaChart></ResponsiveContainer></div></article>
        <article className="panel"><div className="panel-head"><div><p className="kicker">Últimos eventos</p><h3>Actividad sensible</h3></div><button className="text-button" onClick={() => setView('audit')}>Ver todo <ChevronRight /></button></div><div className="event-list">{logs.slice(0, 5).map((log) => <div className="event" key={log.id}><span><CircleDot /></span><div><b>{log.action.replaceAll('.', ' · ')}</b><small>{log.entityType} / {log.entityId}</small></div><time>{formatDate(log.createdAt)}</time></div>)}{!logs.length && <div className="empty-state">Todavía no hay eventos.</div>}</div></article></section>
    </div>}
    {view === 'inventory' && <div className="view-stack enter"><section className="section-heading"><div><p className="kicker">Producción</p><h2>Lotes y medallas</h2><p>Generá códigos, seguí activaciones y descargá originales SVG para imprimir.</p></div><button className="primary-button" onClick={() => setGenerateOpen(true)}><Plus /> Nuevo lote</button></section>
      <section className="batch-grid">{batches.map((batch) => <article className="batch-card" key={batch.batch}><div className="batch-icon"><QrCode /></div><div className="batch-title"><small>Lote</small><h3>{batch.batch}</h3></div><div className="batch-numbers"><span><b>{batch.total}</b> códigos</span><span><b>{batch.activated}</b> activados</span></div><div className="progress"><i style={{ width: `${batch.total ? (batch.activated / batch.total) * 100 : 0}%` }} /></div><footer><time>{formatDate(batch.createdAt)}</time><button onClick={() => void downloadBatch(batch.batch)}><ArrowDownToLine /> SVG</button></footer></article>)}</section>
      <section className="panel table-panel"><div className="panel-head"><div><p className="kicker">Inventario</p><h3>Últimos 100 códigos</h3></div><div className="filters"><label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar código o lote" /></label><select value={status} onChange={(event) => setStatus(event.target.value as QrStatus | '')}><option value="">Todos</option><option value="available">Disponibles</option><option value="activated">Activados</option><option value="reserved">Reservados</option><option value="disabled">Desactivados</option></select></div></div><div className="table-scroll"><table><thead><tr><th>Código</th><th>Lote</th><th>Estado</th><th>Creado</th></tr></thead><tbody>{filteredQrs.map((qr) => <tr key={qr.id}><td><code>{qr.id}</code></td><td>{qr.batch || '—'}</td><td><span className={`status status-${qr.status}`}><i />{statusLabel(qr.status)}</span></td><td>{formatDate(qr.createdAt)}</td></tr>)}</tbody></table></div></section>
    </div>}
    {view === 'audit' && <div className="view-stack enter"><section className="section-heading"><div><p className="kicker">Trazabilidad</p><h2>Registro de auditoría</h2><p>Acciones administrativas y cambios sensibles, ordenados del más reciente.</p></div><div className="audit-seal"><ShieldCheck /> Integridad activa</div></section><section className="audit-stream">{logs.map((log, index) => <article className="audit-row" key={log.id}><div className="audit-index">{String(index + 1).padStart(2, '0')}</div><div className="audit-symbol"><FileClock /></div><div className="audit-main"><div><span>{log.action}</span><time>{formatDate(log.createdAt)}</time></div><h3>{log.entityType} <code>{log.entityId}</code></h3><p>{log.actor?.email || 'Sistema'} · {Object.keys(log.metadata || {}).length ? JSON.stringify(log.metadata) : 'Sin metadatos adicionales'}</p></div></article>)}{!logs.length && <div className="panel empty-state">No hay acciones registradas todavía.</div>}</section></div>}
  </main>{generateOpen && <GenerateModal onClose={() => setGenerateOpen(false)} onGenerated={loadData} />}</div>
}
export default App
