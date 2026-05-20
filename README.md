# StatusWatch

**Panel de Monitoreo de Servicios en Tiempo Real**

StatusWatch es una aplicación web ligera para monitorear la disponibilidad y el rendimiento de servicios web, APIs y servidores en tiempo real. Ofrece una página de estado pública accesible para cualquier usuario y un panel de administración privado para gestionar servicios, consultar historial y configurar alertas.

---

## Problema que resuelve

Los equipos pequeños y medianos se enteran de las caídas por reportes de sus propios usuarios. Las herramientas empresariales (Datadog, PagerDuty) son costosas y sobredimensionadas; las gratuitas (UptimeRobot) limitan la frecuencia de verificación y almacenan datos en servidores de terceros. StatusWatch cubre ese vacío con una solución autohospedada, minimalista y lista para desplegar en menos de 10 minutos con Docker.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite + TypeScript |
| Backend | Node.js + Express + TypeScript |
| Base de datos | PostgreSQL (Prisma ORM) |
| Motor de monitoreo | node-cron |
| Autenticación | JWT + refresh tokens |
| Contenedores | Docker + Docker Compose |
| Alertas | Nodemailer + SMTP |

---

## Funcionalidades principales

- Verificaciones HTTP/HTTPS periódicas con intervalos configurables (1, 5, 10 o 30 minutos)
- Validación de código de estado HTTP y palabra clave opcional en el cuerpo de la respuesta
- Marcado automático como CAÍDO luego de N fallas consecutivas (umbral configurable, por defecto: 3)
- Cálculo de porcentaje de disponibilidad sobre ventana de 30 días
- Gestión de incidentes con niveles de severidad y estados (Investigando / Identificado / Monitoreando / Resuelto)
- Notificaciones automáticas por correo al transicionar entre ACTIVO ↔ CAÍDO
- Página de estado pública responsiva, sin autenticación, con actualización automática cada 60 segundos
- Panel de administración protegido por JWT con historial de pings y gráficas de tiempo de respuesta

---

## Páginas y pantallas

### Página de estado pública
- Banner de estado general del sistema
- Lista de servicios con indicadores individuales (ACTIVO / CAÍDO / DEGRADADO)
- Porcentaje de disponibilidad por servicio (últimos 30 días)
- Historial de incidentes con fecha, descripción y estado de resolución

### Panel de administración
- Agregar, editar y eliminar servicios monitoreados
- Ver historial de pings y gráficas de tiempo de respuesta (últimas 24 horas)
- Ejecutar verificación manual inmediata
- Crear, actualizar y resolver incidentes con notas públicas
- Configurar alertas por correo (SMTP)
- Gestionar credenciales del administrador

---

## Instalación rápida

```bash
git clone https://github.com/enau/statuswatch
cd statuswatch
cp .env.example .env
# Edita .env con tus credenciales
docker compose up -d
```

La aplicación estará disponible en `http://localhost:3000`.

---

## Variables de entorno

Copia `.env.example` a `.env` y completa los valores. El repositorio **nunca** incluye credenciales — toda configuración sensible se gestiona exclusivamente mediante variables de entorno.

```env
DATABASE_URL=
JWT_SECRET=
JWT_REFRESH_SECRET=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
ALERT_FROM=
ALERT_TO=
```

---

## Fuera del alcance — v1.0

- Alertas por Slack / Webhook / SMS (planificado para v2.0)
- Múltiples roles de administrador
- Dominio personalizado para la página de estado
- Monitoreo de certificados SSL

---

## Seguridad

- El repositorio es público y no contiene credenciales, tokens ni claves
- El archivo `.env` está excluido del control de versiones (`.gitignore`)
- Solo se incluye `.env.example` con los nombres de las variables sin valores

---

*Proyecto académico — Desarrollo de Software 2025 · Autor: Sebastian Benavides*