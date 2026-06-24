import nodemailer from "nodemailer"

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
