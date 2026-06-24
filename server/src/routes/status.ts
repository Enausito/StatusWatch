import { Router } from "express"
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
