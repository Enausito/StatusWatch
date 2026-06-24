import { Request, Response, NextFunction } from "express"
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
