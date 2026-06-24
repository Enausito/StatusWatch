import cron from "node-cron"
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
