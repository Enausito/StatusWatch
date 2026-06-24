"use client"

import { api, setTokens, clearTokens } from "../lib/api"
import { useEffect, useReducer, useRef, useState } from "react"
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import {
  Activity,
  Play,
  Pencil,
  Trash2,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"

/* ------------------------------------------------------------------ */
/* Color system                                                        */
/* ------------------------------------------------------------------ */
const COLORS = {
  active: "#1D9E75",
  degraded: "#EF9F27",
  down: "#E24B4A",
  bg: "#F9FAFB",
  border: "#E5E7EB",
  text: "#111827",
  textMuted: "#6B7280",
}

const STATUS_META = {
  ACTIVE: { label: "Operational", color: COLORS.active, bg: "#E6F5EF" },
  DEGRADED: { label: "Degraded", color: COLORS.degraded, bg: "#FDF1DC" },
  DOWN: { label: "Down", color: COLORS.down, bg: "#FBE4E4" },
}

const SEVERITY_META = {
  MINOR: { label: "Minor", color: "#2563EB", bg: "#E0EAFD" },
  MAJOR: { label: "Major", color: COLORS.degraded, bg: "#FDF1DC" },
  CRITICAL: { label: "Critical", color: COLORS.down, bg: "#FBE4E4" },
}

const INCIDENT_STATUS_META = {
  INVESTIGATING: { label: "Investigating", color: COLORS.down, bg: "#FBE4E4" },
  IDENTIFIED: { label: "Identified", color: COLORS.degraded, bg: "#FDF1DC" },
  MONITORING: { label: "Monitoring", color: "#2563EB", bg: "#E0EAFD" },
  RESOLVED: { label: "Resolved", color: COLORS.active, bg: "#E6F5EF" },
}

/* ------------------------------------------------------------------ */
/* Mock data                                                           */
/* ------------------------------------------------------------------ */
function buildPingHistory(base) {
  const points = []
  const now = Date.now()
  for (let i = 19; i >= 0; i--) {
    const t = new Date(now - i * 60 * 60 * 1000 * 1.2)
    let value
    if (base === 0) {
      value = Math.random() < 0.3 ? Math.round(Math.random() * 120) : 0
    } else {
      const jitter = base * (0.5 + Math.random())
      value = Math.round(Math.max(20, jitter))
    }
    points.push({
      time: t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      responseTime: value,
    })
  }
  return points
}



/* ------------------------------------------------------------------ */
/* Small shared UI                                                     */
/* ------------------------------------------------------------------ */
function Dot({ status }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={{ backgroundColor: STATUS_META[status].color }}
      aria-hidden="true"
    />
  )
}

function Badge({ label, color, bg }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ color, backgroundColor: bg }}
    >
      {label}
    </span>
  )
}

function Logo({ className = "" }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Activity className="h-5 w-5" style={{ color: COLORS.active }} />
      <span className="text-lg font-semibold tracking-tight" style={{ color: COLORS.text }}>
        StatusWatch
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */
function Toast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [toast, onDone])

  if (!toast) return null
  const isError = toast.type === "error"
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div
        className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-xl transition-all"
        style={{ backgroundColor: isError ? COLORS.down : COLORS.active }}
        role="status"
      >
        {isError ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        {toast.message}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Modal base                                                          */
/* ------------------------------------------------------------------ */
function Modal({ open, title, onClose, children }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (open) {
      const t = requestAnimationFrame(() => setShow(true))
      return () => cancelAnimationFrame(t)
    }
    setShow(false)
  }, [open])

  if (!open) return null
  return (
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center p-4 transition-opacity duration-200 ${
        show ? "opacity-100" : "opacity-0"
      }`}
      style={{ backgroundColor: "rgba(17,24,39,0.5)" }}
      onClick={onClose}
    >
      <div
        className={`w-full max-w-[400px] rounded-lg bg-white p-6 shadow-xl transition-all duration-200 ${
          show ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: COLORS.text }}>
            {title}
          </h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-gray-100">
            <X className="h-4 w-4" style={{ color: COLORS.textMuted }} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const inputClass =
  "w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1D9E75]/40"
const labelClass = "mb-1 block text-sm font-medium"

/* ------------------------------------------------------------------ */
/* Service Modal                                                       */
/* ------------------------------------------------------------------ */
function ServiceModal({ open, onClose, onSave, initial }) {
  const isEdit = Boolean(initial)
  const [form, setForm] = useState({
    name: "",
    url: "",
    interval: 5,
    expectedStatus: 200,
    keyword: "",
    failThreshold: 3,
  })
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setError("")
      setForm(
        initial
          ? {
              name: initial.name,
              url: initial.url,
              interval: initial.interval,
              expectedStatus: initial.expectedStatus ?? 200,
              keyword: initial.keyword ?? "",
              failThreshold: initial.failThreshold ?? 3,
            }
          : { name: "", url: "", interval: 5, expectedStatus: 200, keyword: "", failThreshold: 3 }
      )
    }
  }, [open, initial])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  function handleSave() {
    if (!form.name.trim() || !form.url.trim() || !form.expectedStatus || !form.failThreshold) {
      setError("Please fill in all required fields.")
      return
    }
    onSave({ ...(initial || {}), ...form, interval: Number(form.interval) })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Service" : "Add New Service"}>
      <div className="space-y-3">
        <div>
          <label className={labelClass} style={{ color: COLORS.text }}>Name</label>
          <input className={inputClass} style={{ borderColor: COLORS.border }} value={form.name} onChange={set("name")} />
        </div>
        <div>
          <label className={labelClass} style={{ color: COLORS.text }}>URL</label>
          <input className={inputClass} style={{ borderColor: COLORS.border }} placeholder="https://" value={form.url} onChange={set("url")} />
        </div>
        <div>
          <label className={labelClass} style={{ color: COLORS.text }}>Check interval</label>
          <select className={inputClass} style={{ borderColor: COLORS.border }} value={form.interval} onChange={set("interval")}>
            <option value={1}>1 min</option>
            <option value={5}>5 min</option>
            <option value={10}>10 min</option>
            <option value={30}>30 min</option>
          </select>
        </div>
        <div>
          <label className={labelClass} style={{ color: COLORS.text }}>Expected status</label>
          <input type="number" className={inputClass} style={{ borderColor: COLORS.border }} value={form.expectedStatus} onChange={set("expectedStatus")} />
        </div>
        <div>
          <label className={labelClass} style={{ color: COLORS.text }}>Keyword <span className="text-xs" style={{ color: COLORS.textMuted }}>(optional)</span></label>
          <input className={inputClass} style={{ borderColor: COLORS.border }} placeholder="e.g. ok" value={form.keyword} onChange={set("keyword")} />
        </div>
        <div>
          <label className={labelClass} style={{ color: COLORS.text }}>Fail threshold</label>
          <input type="number" className={inputClass} style={{ borderColor: COLORS.border }} value={form.failThreshold} onChange={set("failThreshold")} />
        </div>
        {error && <p className="text-sm" style={{ color: COLORS.down }}>{error}</p>}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium" style={{ backgroundColor: "#F3F4F6", color: COLORS.text }}>Cancel</button>
        <button onClick={handleSave} className="rounded-md px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: COLORS.active }}>Save</button>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Incident Modal                                                      */
/* ------------------------------------------------------------------ */
function IncidentModal({ open, onClose, onSave, initial, allServices }) {
  const isEdit = Boolean(initial)
  const [form, setForm] = useState({
    title: "",
    severity: "MINOR",
    services: [],
    message: "",
    status: "INVESTIGATING",
  })
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setError("")
      setForm(
        initial
          ? { title: initial.title, severity: initial.severity, services: initial.services || [], message: initial.message || "", status: initial.status }
          : { title: "", severity: "MINOR", services: [], message: "", status: "INVESTIGATING" }
      )
    }
  }, [open, initial])

  const toggleService = (name) =>
    setForm((f) => ({
      ...f,
      services: f.services.includes(name) ? f.services.filter((s) => s !== name) : [...f.services, name],
    }))

  function handleSave() {
    if (!form.title.trim()) {
      setError("Title is required.")
      return
    }
    onSave({ ...(initial || {}), ...form })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Incident" : "New Incident"}>
      <div className="space-y-3">
        <div>
          <label className={labelClass} style={{ color: COLORS.text }}>Title</label>
          <input className={inputClass} style={{ borderColor: COLORS.border }} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </div>
        <div>
          <label className={labelClass} style={{ color: COLORS.text }}>Severity</label>
          <select className={inputClass} style={{ borderColor: COLORS.border }} value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}>
            <option value="MINOR">Minor</option>
            <option value="MAJOR">Major</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
        <div>
          <label className={labelClass} style={{ color: COLORS.text }}>Affected services</label>
          <div className="space-y-1.5">
            {allServices.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm" style={{ color: COLORS.text }}>
                <input type="checkbox" checked={form.services.includes(s.name)} onChange={() => toggleService(s.name)} />
                {s.name}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass} style={{ color: COLORS.text }}>Message</label>
          <textarea rows={3} className={inputClass} style={{ borderColor: COLORS.border }} placeholder="Describe the incident..." value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
        </div>
        <div>
          <label className={labelClass} style={{ color: COLORS.text }}>Status</label>
          <select className={inputClass} style={{ borderColor: COLORS.border }} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            <option value="INVESTIGATING">Investigating</option>
            <option value="IDENTIFIED">Identified</option>
            <option value="MONITORING">Monitoring</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
        {error && <p className="text-sm" style={{ color: COLORS.down }}>{error}</p>}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium" style={{ backgroundColor: "#F3F4F6", color: COLORS.text }}>Cancel</button>
        <button onClick={handleSave} className="rounded-md px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: COLORS.down }}>{isEdit ? "Update" : "Publish"}</button>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Public status page                                                  */
/* ------------------------------------------------------------------ */
function PublicStatusPage({ services, incidents }) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const hasDown = services.some((s) => s.status === "DOWN")
  const hasDegraded = services.some((s) => s.status === "DEGRADED")
  const banner = hasDown
    ? { text: "Major outage", color: COLORS.down, bg: "#FBE4E4" }
    : hasDegraded
    ? { text: "Partial outage", color: COLORS.degraded, bg: "#FDF1DC" }
    : { text: "All systems operational", color: COLORS.active, bg: "#E6F5EF" }

  return (
    <main className="mx-auto min-h-screen max-w-[900px] px-4 py-8 sm:py-12">
      <header className="mb-8 flex items-center justify-between">
        <Logo />
        <span className="text-sm" style={{ color: COLORS.textMuted }}>
          Updated {seconds} second{seconds === 1 ? "" : "s"} ago
        </span>
      </header>

      <div
        className="mb-10 flex items-center gap-3 rounded-lg px-5 py-4"
        style={{ backgroundColor: banner.bg }}
      >
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: banner.color }} />
        <span className="text-base font-semibold" style={{ color: banner.color }}>
          {banner.text}
        </span>
      </div>

      <section className="mb-12">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: COLORS.textMuted }}>
          Services
        </h2>
        <div className="overflow-hidden rounded-lg border bg-white" style={{ borderColor: COLORS.border }}>
          {services.map((s, i) => (
            <div
              key={s.id}
              className="flex items-center justify-between px-5 py-4"
              style={{ borderTop: i === 0 ? "none" : `1px solid ${COLORS.border}` }}
            >
              <div className="flex items-center gap-3">
                <Dot status={s.status} />
                <span className="font-medium" style={{ color: COLORS.text }}>{s.name}</span>
                <Badge {...STATUS_META[s.status]} />
              </div>
              <span className="text-sm tabular-nums" style={{ color: COLORS.textMuted }}>
                {s.uptime.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: COLORS.textMuted }}>
          Incident History
        </h2>
        <div className="overflow-hidden rounded-lg border bg-white" style={{ borderColor: COLORS.border }}>
          {incidents.map((inc, i) => (
            <div
              key={inc.id}
              className="flex items-center justify-between gap-4 px-5 py-4"
              style={{ borderTop: i === 0 ? "none" : `1px solid ${COLORS.border}` }}
            >
              <div className="flex min-w-0 items-center gap-4">
                <span className="shrink-0 text-sm tabular-nums" style={{ color: COLORS.textMuted }}>{inc.date}</span>
                <span className="truncate font-medium" style={{ color: COLORS.text }}>{inc.title}</span>
              </div>
              <Badge {...INCIDENT_STATUS_META[inc.status]} />
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

/* ------------------------------------------------------------------ */
/* Admin login                                                         */
/* ------------------------------------------------------------------ */
function AdminLogin({ onLogin }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    try {
      await onLogin(email, password)
    } catch {
      setError("Credenciales inválidas")
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-[400px] rounded-lg border bg-white p-8 shadow-sm" style={{ borderColor: COLORS.border }}>
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass} style={{ color: COLORS.text }}>Email</label>
            <input className={inputClass} style={{ borderColor: COLORS.border }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
          </div>
          <div>
            <label className={labelClass} style={{ color: COLORS.text }}>Password</label>
            <input className={inputClass} style={{ borderColor: COLORS.border }} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm" style={{ color: COLORS.down }}>{error}</p>}
          <button type="submit" className="w-full rounded-md py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: COLORS.active }}>
            Sign in
          </button>
        </form>
      </div>
    </main>
  )
}

/* ------------------------------------------------------------------ */
/* Response time chart                                                 */
/* ------------------------------------------------------------------ */
function barColor(v) {
  if (v === 0 || v > 1000) return COLORS.down
  if (v >= 300) return COLORS.degraded
  return COLORS.active
}

function ResponseChart({ service }) {
  if (!service) return null
  return (
    <div className="rounded-lg border bg-white p-5" style={{ borderColor: COLORS.border }}>
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold" style={{ color: COLORS.text }}>Response Time — Last 24h</h3>
        <span className="text-sm" style={{ color: COLORS.textMuted }}>{service.name}</span>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={service.history} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
            <XAxis dataKey="time" tick={{ fontSize: 11, fill: COLORS.textMuted }} interval={3} tickLine={false} axisLine={{ stroke: COLORS.border }} />
            <YAxis tick={{ fontSize: 11, fill: COLORS.textMuted }} tickLine={false} axisLine={{ stroke: COLORS.border }} unit="ms" width={48} />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
              contentStyle={{ borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 12 }}
              formatter={(v) => [`${v} ms`, "Response"]}
            />
            <Bar dataKey="responseTime" radius={[3, 3, 0, 0]}>
              {service.history.map((p, i) => (
                <Cell key={i} fill={barColor(p.responseTime)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Admin dashboard                                                     */
/* ------------------------------------------------------------------ */
function AdminDashboard({ services, incidents, onServiceAction, onIncidentAction, onLogout, showToast }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState("services")

  const [selectedId, setSelectedId] = useState(services[0]?.id ?? null)
  const selectedService = services.find((s) => s.id === selectedId) || services[0]

  const [serviceModal, setServiceModal] = useState({ open: false, initial: null })
  const [incidentModal, setIncidentModal] = useState({ open: false, initial: null })

  function handleLogout() {
    onLogout()
    navigate("/admin/login")
  }

  function deleteService(s) {
    if (window.confirm(`Delete "${s.name}"? This cannot be undone.`)) {
      onServiceAction("delete", s)
    }
  }

  const tabs = [
    { key: "services", label: "Services" },
    { key: "incidents", label: "Incidents" },
    { key: "settings", label: "Settings" },
  ]

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="border-b bg-white" style={{ borderColor: COLORS.border }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <Logo />
            <div className="flex items-center gap-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="border-b-2 px-3 py-4 text-sm font-medium transition-colors"
                  style={{
                    borderColor: tab === t.key ? COLORS.active : "transparent",
                    color: tab === t.key ? COLORS.text : COLORS.textMuted,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleLogout} className="text-sm font-medium" style={{ color: COLORS.textMuted }}>
            Logout
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {tab === "services" && (
          <>
            <div className="mb-5 flex items-center justify-between">
              <h1 className="text-xl font-semibold" style={{ color: COLORS.text }}>Services</h1>
              <button
                onClick={() => setServiceModal({ open: true, initial: null })}
                className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: COLORS.active }}
              >
                <Plus className="h-4 w-4" /> Add Service
              </button>
            </div>

            <div className="mb-8 overflow-x-auto rounded-lg border bg-white" style={{ borderColor: COLORS.border }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: COLORS.textMuted }} className="text-left">
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">URL</th>
                    <th className="px-4 py-3 text-right font-medium">Uptime</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className="cursor-pointer border-t transition-colors hover:bg-gray-50"
                      style={{ borderColor: COLORS.border, backgroundColor: selectedService?.id === s.id ? "#F3FAF7" : "transparent" }}
                    >
                      <td className="px-4 py-3"><Dot status={s.status} /></td>
                      <td className="px-4 py-3 font-semibold" style={{ color: COLORS.text }}>{s.name}</td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: COLORS.textMuted }}>
                        <span className="block max-w-[180px] truncate">{s.url}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums" style={{ color: COLORS.text }}>{s.uptime.toFixed(2)}%</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => { onServiceAction("ping", { id: s.id }).then(() => showToast(`Ping realizado`)).catch(() => showToast(`Error`, `error`)) }} aria-label="Ping" className="rounded p-1.5 hover:bg-gray-100">
                            <Play className="h-4 w-4" style={{ color: COLORS.active }} />
                          </button>
                          <button onClick={() => setServiceModal({ open: true, initial: s })} aria-label="Edit" className="rounded p-1.5 hover:bg-gray-100">
                            <Pencil className="h-4 w-4" style={{ color: COLORS.textMuted }} />
                          </button>
                          <button onClick={() => deleteService(s)} aria-label="Delete" className="rounded p-1.5 hover:bg-gray-100">
                            <Trash2 className="h-4 w-4" style={{ color: COLORS.down }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ResponseChart service={selectedService} />
          </>
        )}

        {tab === "incidents" && (
          <>
            <div className="mb-5 flex items-center justify-between">
              <h1 className="text-xl font-semibold" style={{ color: COLORS.text }}>Incidents</h1>
              <button
                onClick={() => setIncidentModal({ open: true, initial: null })}
                className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: COLORS.active }}
              >
                <Plus className="h-4 w-4" /> New Incident
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border bg-white" style={{ borderColor: COLORS.border }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: COLORS.textMuted }} className="text-left">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Affected Services</th>
                    <th className="px-4 py-3 font-medium">Severity</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((inc) => (
                    <tr key={inc.id} className="border-t" style={{ borderColor: COLORS.border }}>
                      <td className="px-4 py-3 tabular-nums" style={{ color: COLORS.textMuted }}>{inc.date}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: COLORS.text }}>{inc.title}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {inc.services.map((name) => (
                            <span key={name} className="rounded px-2 py-0.5 text-xs" style={{ backgroundColor: "#F3F4F6", color: COLORS.textMuted }}>{name}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3"><Badge {...SEVERITY_META[inc.severity]} /></td>
                      <td className="px-4 py-3"><Badge {...INCIDENT_STATUS_META[inc.status]} /></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <button onClick={() => setIncidentModal({ open: true, initial: inc })} aria-label="Edit" className="rounded p-1.5 hover:bg-gray-100">
                            <Pencil className="h-4 w-4" style={{ color: COLORS.textMuted }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "settings" && <SettingsTab showToast={showToast} />}
      </main>

      <ServiceModal
        open={serviceModal.open}
        initial={serviceModal.initial}
        onClose={() => setServiceModal({ open: false, initial: null })}
        onSave={(data) => {
          if (data.id) {
            onServiceAction("update", data)
          } else {
            onServiceAction("add", data)
          }
        }}
      />
      <IncidentModal
        open={incidentModal.open}
        initial={incidentModal.initial}
        allServices={services}
        onClose={() => setIncidentModal({ open: false, initial: null })}
        onSave={(data) => {
          if (data.id) {
            onIncidentAction("update", data)
          } else {
            onIncidentAction("add", data)
          }
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Settings tab                                                        */
/* ------------------------------------------------------------------ */
function SettingsTab({ showToast }) {
  const [pw, setPw] = useState("")
  const [confirm, setConfirm] = useState("")

  function handleSave(e) {
    e.preventDefault()
    if (pw !== confirm) {
      showToast("Passwords do not match", "error")
      return
    }
    showToast("Credentials updated")
    setPw("")
    setConfirm("")
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-5 text-xl font-semibold" style={{ color: COLORS.text }}>Admin Credentials</h1>
      <form onSubmit={handleSave} className="space-y-4 rounded-lg border bg-white p-6" style={{ borderColor: COLORS.border }}>
        <div>
          <label className={labelClass} style={{ color: COLORS.text }}>Email</label>
          <input className={`${inputClass} bg-gray-50`} style={{ borderColor: COLORS.border, color: COLORS.textMuted }} value="admin@example.com" readOnly />
        </div>
        <div>
          <label className={labelClass} style={{ color: COLORS.text }}>New password</label>
          <input type="password" className={inputClass} style={{ borderColor: COLORS.border }} value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <div>
          <label className={labelClass} style={{ color: COLORS.text }}>Confirm password</label>
          <input type="password" className={inputClass} style={{ borderColor: COLORS.border }} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <button type="submit" className="rounded-md px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: COLORS.active }}>
          Save Changes
        </button>
      </form>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Guard                                                               */
/* ------------------------------------------------------------------ */
function RequireAuth({ isAuthenticated, children }) {
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />
  return children
}

/* ------------------------------------------------------------------ */
/* Root                                                                */
/* ------------------------------------------------------------------ */
function AppShell() {
  const [services, setServices] = useState([])
  const [incidents, setIncidents] = useState([])
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const toastId = useRef(0)

  function showToast(message, type = "success") {
    toastId.current += 1
    setToast({ id: toastId.current, message, type })
  }

  useEffect(() => {
    api.getStatus().then((data) => {
      setServices(data.services)
      setIncidents(data.incidents)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    function refresh() {
      api.getServices().then(setServices).catch(() => {})
      api.getIncidents().then(setIncidents).catch(() => {})
    }
    refresh()
    const id = setInterval(refresh, 30000)
    return () => clearInterval(id)
  }, [isAuthenticated])

  async function handleLogin(email, password) {
    const { accessToken, refreshToken } = await api.login(email, password)
    setTokens(accessToken, refreshToken)
    setIsAuthenticated(true)
  }

  async function handleServiceAction(action, payload) {
    if (action === "add") {
      const s = await api.createService(payload)
      setServices((prev) => [...prev, s])
    } else if (action === "update") {
      const s = await api.updateService(payload.id, payload)
      setServices((prev) => prev.map((x) => x.id === s.id ? s : x))
    } else if (action === "delete") {
      await api.deleteService(payload.id)
      setServices((prev) => prev.filter((x) => x.id !== payload.id))
    } else if (action === "ping") {
      const result = await api.pingService(payload.id)
      setServices((prev) => prev.map((x) => x.id === payload.id ? { ...x, ...result } : x))
    }
  }

  async function handleIncidentAction(action, payload) {
    if (action === "add") {
      const i = await api.createIncident(payload)
      setIncidents((prev) => [i, ...prev])
    } else if (action === "update") {
      const i = await api.updateIncident(payload.id, payload)
      setIncidents((prev) => prev.map((x) => x.id === i.id ? i : x))
    } else if (action === "delete") {
      await api.deleteIncident(payload.id)
      setIncidents((prev) => prev.filter((x) => x.id !== payload.id))
    }
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<PublicStatusPage services={services} incidents={incidents} />} />
        <Route path="/admin/login" element={<AdminLogin onLogin={handleLogin} />} />
        <Route
          path="/admin/dashboard"
          element={
            <RequireAuth isAuthenticated={isAuthenticated}>
              <AdminDashboard
                services={services}
                incidents={incidents}
                onServiceAction={handleServiceAction}
                onIncidentAction={handleIncidentAction}
                onLogout={() => { clearTokens(); setIsAuthenticated(false) }}
                showToast={showToast}
              />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toast toast={toast} onDone={() => setToast(null)} />
    </>
  )
}

export default function StatusWatchApp() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
