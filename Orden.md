Eres un desarrollador backend senior. Tu trabajo es implementar el backend completo para StatusWatch, una app Next.js existente que actualmente usa solo mock data. La app ya existe en la raíz del proyecto — no la toques salvo los archivos indicados.
Contexto de la app existente

components/status-watch-app.jsx — SPA React con useReducer y mock data (INITIAL_SERVICES, INITIAL_INCIDENTS)
AppShell maneja: isAuthenticated, services, incidents en state local
Login hardcodeado: admin@example.com / cualquier password → autentica
Rutas: / (público), /admin/login, /admin/dashboard


Lo que debes crear
PASO 1 — server/package.json
json{
  "name": "statuswatch-server",
  "version": "1.0.0",
  "scripts": {
    "dev": "ts-node-dev --respawn src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:migrate": "prisma migrate dev",
    "db:seed": "ts-node prisma/seed.ts"
  },
  "dependencies": {
    "@prisma/client": "^5.14.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "node-cron": "^3.0.3",
    "nodemailer": "^6.9.14"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/node": "^20.14.2",
    "@types/node-cron": "^3.0.11",
    "@types/nodemailer": "^6.4.15",
    "prisma": "^5.14.0",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.4.5"
  }
}

PASO 2 — server/tsconfig.json
json{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "dist",
    "rootDir": "src",
    "strict": false,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src", "prisma"]
}

PASO 3 — server/prisma/schema.prisma
prismagenerator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           Int      @id @default(autoincrement())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
}

model Service {
  id           Int       @id @default(autoincrement())
  name         String
  url          String
  status       String    @default("ACTIVE")
  uptime       Float     @default(100)
  responseTime Int       @default(0)
  interval     Int       @default(5)
  createdAt    DateTime  @default(now())
  logs         PingLog[]
}

model PingLog {
  id           Int      @id @default(autoincrement())
  serviceId    Int
  service      Service  @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  responseTime Int
  ok           Boolean
  checkedAt    DateTime @default(now())
}

model Incident {
  id        Int      @id @default(autoincrement())
  title     String
  severity  String   @default("MINOR")
  status    String   @default("INVESTIGATING")
  message   String   @default("")
  createdAt DateTime @default(now())
}

PASO 4 — server/prisma/seed.ts
Crea el usuario admin inicial con password admin123 hasheado con bcrypt:
typescriptimport { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const hash = await bcrypt.hash("admin123", 10)
  await prisma.user.upsert({
    where: { email: "admin@statuswatch.com" },
    update: {},
    create: { email: "admin@statuswatch.com", passwordHash: hash },
  })

  await prisma.service.createMany({
    data: [
      { name: "API Gateway", url: "https://httpbin.org/status/200", status: "ACTIVE", uptime: 99.98, responseTime: 145, interval: 5 },
      { name: "Auth Service", url: "https://httpbin.org/status/200", status: "ACTIVE", uptime: 100, responseTime: 89, interval: 5 },
    ],
    skipDuplicates: true,
  })

  console.log("Seed completo")
}

main().catch(console.error).finally(() => prisma.$disconnect())

PASO 5 — server/src/index.ts
typescriptimport express from "express"
import cors from "cors"
import { authRouter } from "./routes/auth"
import { servicesRouter } from "./routes/services"
import { incidentsRouter } from "./routes/incidents"
import { statusRouter } from "./routes/status"
import { startMonitor } from "./jobs/monitor"

const app = express()
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }))
app.use(express.json())

app.use("/api/auth", authRouter)
app.use("/api/services", servicesRouter)
app.use("/api/incidents", incidentsRouter)
app.use("/api/status", statusRouter)

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  startMonitor()
})

PASO 6 — server/src/middleware/auth.ts
typescriptimport { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No token" })
    return
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!)
    ;(req as any).user = payload
    next()
  } catch {
    res.status(401).json({ error: "Invalid token" })
  }
}

PASO 7 — server/src/routes/auth.ts
typescriptimport { Router } from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { PrismaClient } from "@prisma/client"

const router = Router()
const prisma = new PrismaClient()

router.post("/login", async (req, res) => {
  const { email, password } = req.body
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Credenciales inválidas" })
    return
  }
  const accessToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: "15m" })
  const refreshToken = jwt.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET!, { expiresIn: "7d" })
  res.json({ accessToken, refreshToken })
})

router.post("/refresh", (req, res) => {
  const { refreshToken } = req.body
  if (!refreshToken) { res.status(401).json({ error: "No refresh token" }); return }
  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any
    const accessToken = jwt.sign({ userId: payload.userId }, process.env.JWT_SECRET!, { expiresIn: "15m" })
    res.json({ accessToken })
  } catch {
    res.status(401).json({ error: "Refresh token inválido" })
  }
})

export { router as authRouter }

PASO 8 — server/src/routes/services.ts
typescriptimport { Router } from "express"
import { PrismaClient } from "@prisma/client"
import { requireAuth } from "../middleware/auth"
import { pingService } from "../jobs/monitor"

const router = Router()
const prisma = new PrismaClient()

router.get("/", requireAuth, async (_req, res) => {
  const services = await prisma.service.findMany({ orderBy: { createdAt: "asc" } })
  res.json(services)
})

router.post("/", requireAuth, async (req, res) => {
  const { name, url, interval } = req.body
  const service = await prisma.service.create({ data: { name, url, interval: interval || 5 } })
  res.json(service)
})

router.put("/:id", requireAuth, async (req, res) => {
  const service = await prisma.service.update({
    where: { id: Number(req.params.id) },
    data: req.body,
  })
  res.json(service)
})

router.delete("/:id", requireAuth, async (req, res) => {
  await prisma.service.delete({ where: { id: Number(req.params.id) } })
  res.json({ ok: true })
})

router.post("/:id/ping", requireAuth, async (req, res) => {
  const service = await prisma.service.findUnique({ where: { id: Number(req.params.id) } })
  if (!service) { res.status(404).json({ error: "Not found" }); return }
  const result = await pingService(service)
  res.json(result)
})

export { router as servicesRouter }

PASO 9 — server/src/routes/incidents.ts
typescriptimport { Router } from "express"
import { PrismaClient } from "@prisma/client"
import { requireAuth } from "../middleware/auth"

const router = Router()
const prisma = new PrismaClient()

router.get("/", requireAuth, async (_req, res) => {
  const incidents = await prisma.incident.findMany({ orderBy: { createdAt: "desc" } })
  res.json(incidents)
})

router.post("/", requireAuth, async (req, res) => {
  const incident = await prisma.incident.create({ data: req.body })
  res.json(incident)
})

router.put("/:id", requireAuth, async (req, res) => {
  const incident = await prisma.incident.update({
    where: { id: Number(req.params.id) },
    data: req.body,
  })
  res.json(incident)
})

router.delete("/:id", requireAuth, async (req, res) => {
  await prisma.incident.delete({ where: { id: Number(req.params.id) } })
  res.json({ ok: true })
})

export { router as incidentsRouter }

PASO 10 — server/src/routes/status.ts
typescriptimport { Router } from "express"
import { PrismaClient } from "@prisma/client"

const router = Router()
const prisma = new PrismaClient()

router.get("/", async (_req, res) => {
  const [services, incidents] = await Promise.all([
    prisma.service.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.incident.findMany({
      where: { status: { not: "RESOLVED" } },
      orderBy: { createdAt: "desc" },
    }),
  ])
  res.json({ services, incidents })
})

export { router as statusRouter }

PASO 11 — server/src/jobs/monitor.ts
typescriptimport cron from "node-cron"
import { PrismaClient } from "@prisma/client"
import { sendAlert } from "../mailer/alerts"

const prisma = new PrismaClient()

export async function pingService(service: { id: number; url: string; name: string }) {
  const start = Date.now()
  let ok = false
  let responseTime = 0

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(service.url, { signal: controller.signal })
    clearTimeout(timeout)
    responseTime = Date.now() - start
    ok = res.ok
  } catch {
    responseTime = 0
    ok = false
  }

  const status = !ok ? "DOWN" : responseTime > 2000 ? "DEGRADED" : "ACTIVE"

  const prev = await prisma.service.findUnique({ where: { id: service.id } })

  await prisma.service.update({
    where: { id: service.id },
    data: { status, responseTime },
  })

  await prisma.pingLog.create({
    data: { serviceId: service.id, responseTime, ok },
  })

  if (prev?.status !== "DOWN" && status === "DOWN") {
    sendAlert(service.name).catch(console.error)
  }

  return { status, responseTime, ok }
}

export function startMonitor() {
  cron.schedule("* * * * *", async () => {
    const services = await prisma.service.findMany()
    await Promise.all(services.map(pingService))
  })
  console.log("Monitor started")
}

PASO 12 — server/src/mailer/alerts.ts
typescriptimport nodemailer from "nodemailer"

export async function sendAlert(serviceName: string) {
  if (!process.env.SMTP_HOST) return // Sin config SMTP, no enviar

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })

  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: process.env.ALERT_EMAIL,
    subject: `[StatusWatch] ${serviceName} está caído`,
    text: `El servicio "${serviceName}" no responde. Hora: ${new Date().toISOString()}`,
  })
}

PASO 13 — server/.env.example
envDATABASE_URL=postgresql://postgres:postgres@localhost:5432/statuswatch
JWT_SECRET=cambia_esto
JWT_REFRESH_SECRET=otro_secreto
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu@email.com
SMTP_PASS=tu_app_password
ALERT_EMAIL=destino@email.com
PORT=4000
FRONTEND_URL=http://localhost:3000
Copia este archivo como server/.env y rellena los valores reales.

PASO 14 — server/Dockerfile
dockerfileFROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build
CMD ["npm", "start"]

PASO 15 — Dockerfile (raíz, para el frontend Next.js)
dockerfileFROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml .
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
CMD ["pnpm", "start"]

PASO 16 — docker-compose.yml (raíz)
yamlservices:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: statuswatch
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./server
    depends_on:
      - db
    ports:
      - "4000:4000"
    env_file:
      - ./server/.env
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/statuswatch

  frontend:
    build: .
    depends_on:
      - backend
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:4000

volumes:
  postgres_data:

PASO 17 — lib/api.ts (frontend, archivo nuevo)
typescriptconst BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

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

PASO 18 — Modificar components/status-watch-app.jsx
Realiza exactamente estos cambios sobre el archivo existente:
1. Al inicio del archivo, añade el import:
jsimport { api, setTokens, clearTokens } from "../lib/api"
2. Elimina INITIAL_SERVICES e INITIAL_INCIDENTS (las constantes con mock data).
3. Reemplaza AppShell completo por este:
jsxfunction AppShell() {
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
4. En AdminLogin, la función handleSubmit actual llama a onLogin() sin args. Cámbiala para pasar email y password:
jsx// Busca donde está onLogin() y reemplaza por:
async function handleSubmit(e) {
  e.preventDefault()
  setError("")
  try {
    await onLogin(email, password)
  } catch {
    setError("Credenciales inválidas")
  }
}
5. En AdminDashboard, reemplaza las llamadas a dispatchServices y dispatchIncidents por llamadas a onServiceAction y onIncidentAction. Por ejemplo:

dispatchServices({ type: "ping", payload: svc }) → onServiceAction("ping", svc).then(() => showToast("Ping realizado")).catch(() => showToast("Error", "error"))
dispatchServices({ type: "delete", payload: svc }) → onServiceAction("delete", svc)
En los modales onSave: si data.id → onIncidentAction("update", data), else → onIncidentAction("add", data)
Igual para services

6. Elimina las funciones servicesReducer e incidentsReducer ya que no se usan.

Orden de ejecución tras implementar todo:
bash# 1. Instalar dependencias del backend
cd server && npm install

# 2. Copiar .env
cp .env.example .env   # y editar valores

# 3. Levantar DB localmente (o con docker)
docker run -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=statuswatch -p 5432:5432 -d postgres:16-alpine

# 4. Migrar y seedear
npx prisma migrate dev --name init
npm run db:seed

# 5. Levantar backend
npm run dev

# 6. En otra terminal, levantar frontend
cd .. && pnpm dev

# O todo con Docker:
docker-compose up --build