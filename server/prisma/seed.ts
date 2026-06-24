import { PrismaClient } from "@prisma/client"
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
