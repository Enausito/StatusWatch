import express from "express"
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
