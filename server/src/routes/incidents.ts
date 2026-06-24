import { Router } from "express"
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
