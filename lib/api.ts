const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

let accessToken: string | null = null
let refreshToken: string | null = null

export function setTokens(at: string, rt: string) {
  accessToken = at
  refreshToken = rt
}

export function clearTokens() {
  accessToken = null
  refreshToken = null
}

async function request(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`

  let res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (res.status === 401 && refreshToken) {
    const r = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
    if (r.ok) {
      const data = await r.json()
      accessToken = data.accessToken
      headers["Authorization"] = `Bearer ${accessToken}`
      res = await fetch(`${BASE}${path}`, { ...options, headers })
    }
  }

  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const api = {
  login: (email: string, password: string) =>
    fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).then((r) => { if (!r.ok) throw new Error("Credenciales inválidas"); return r.json() }),

  getStatus: () => request("/api/status"),
  getServices: () => request("/api/services"),
  createService: (data: any) => request("/api/services", { method: "POST", body: JSON.stringify(data) }),
  updateService: (id: number, data: any) => request(`/api/services/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteService: (id: number) => request(`/api/services/${id}`, { method: "DELETE" }),
  pingService: (id: number) => request(`/api/services/${id}/ping`, { method: "POST" }),

  getIncidents: () => request("/api/incidents"),
  createIncident: (data: any) => request("/api/incidents", { method: "POST", body: JSON.stringify(data) }),
  updateIncident: (id: number, data: any) => request(`/api/incidents/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteIncident: (id: number) => request(`/api/incidents/${id}`, { method: "DELETE" }),
}
