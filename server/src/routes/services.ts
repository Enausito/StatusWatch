import { Router } from "express"
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
