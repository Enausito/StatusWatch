import { Router } from "express"
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
