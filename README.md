# Known Account

Plataforma del área de Account MKT de Known Online. Reemplaza al sheet "Automatizacion - Tareas account MKT" y suma lo que el sheet no tenía: fecha límite, trazabilidad y un historial de cada tarea y de cada cliente.

## Qué hace hoy

- **Clientes**: listado con última reunión, tareas abiertas, vencidas y sin decidir, y qué tan completa está la ficha. La ficha tiene datos del negocio, servicios contratados, contactos e integraciones (Jira, Slack, Trello).
- **Reuniones**: se carga la minuta (link de Google Docs o texto) y Claude extrae el resumen, las decisiones, las oportunidades de upsell, los riesgos para escalar y las tareas. Cada tarea trae responsable (Known o cliente), etiqueta, prioridad, fecha límite si se dijo y analista sugerido según el historial. La pantalla de la reunión muestra además qué quedó abierto de la reunión anterior.
- **Tareas**: vistas de abiertas, vencidas, sin fecha y sin decidir, con filtros. Decisión, analista, etiqueta, prioridad, fecha límite y estado se editan en la tabla. Cada cambio queda en el historial de la tarea, junto con los comentarios.
- **Inicio**: números del día y los clientes que conviene atender primero.

Próximas etapas: estado semanal por cliente (semáforo, problemas, foco, upsell y temas para la dirección), objetivos mensuales, informe pre-reunión, sincronización con Jira y Trello, y alertas en Slack.

## Tecnología

Next.js 16 (App Router, server actions), Postgres con Drizzle ORM, Auth.js con Google y la API de Claude. Se publica en Vercel con una base Postgres de Neon.

En desarrollo, si no hay `DATABASE_URL`, se usa PGlite (un Postgres embebido que guarda los datos en `.data/`). Si no hay credenciales de Google, se entra sin login como "Modo desarrollo". En producción las dos cosas son obligatorias.

## Correr en local

```bash
npm install
cp .env.example .env.local   # completar ANTHROPIC_API_KEY para procesar minutas
npm run importar -- ruta/al/sheet.xlsx ruta/al/Plan_Automatizacion_Account.xlsx
npm run dev
```

## Importar el sheet

1. En el sheet: Archivo > Descargar > Microsoft Excel (.xlsx).
2. `npm run importar -- sheet.xlsx Plan_Automatizacion_Account.xlsx` (el segundo archivo es opcional: aporta IDs, alias, estado y account de "Maestro Clientes" y el área de "Maestro Analistas").

Mientras el sheet siga en uso se puede volver a correr: no duplica reuniones ni tareas, y si en el sheet cambió la decisión, el analista o el link de Jira de una tarea, lo actualiza y lo deja en el historial. Para importar a producción, correrlo con la `DATABASE_URL` de Neon.

Las tareas del sheet entran como "Sin seguimiento" porque el sheet no guarda su estado. Pasan a tener estado real cuando se conecte la sincronización con Jira.

## Publicar en Vercel

1. **Proyecto**: en Vercel, Add New > Project > importar este repositorio. Framework: Next.js.
2. **Base de datos**: en el proyecto, Storage > Create Database > Neon (Postgres). Vercel agrega `DATABASE_URL` sola. Las tablas se crean en cada build (`scripts/migrar.ts`).
3. **Login con Google**: en Google Cloud Console > APIs y servicios:
   - Pantalla de consentimiento: tipo **Interno** (solo cuentas de la organización).
   - Habilitar la **Google Docs API**.
   - Credenciales > ID de cliente OAuth > Aplicación web. URI de redirección: `https://<tu-dominio>.vercel.app/api/auth/callback/google`.
4. **Variables de entorno** (Settings > Environment Variables):
   - `AUTH_SECRET`: un valor al azar (`npx auth secret` o `openssl rand -base64 32`).
   - `AUTH_GOOGLE_ID` y `AUTH_GOOGLE_SECRET`: del paso 3.
   - `AUTH_DOMINIO`: `knownonline.com`.
   - `ANTHROPIC_API_KEY`: la clave de la API de Claude.
5. **Deploy** y después importar el sheet a la base de producción (ver arriba).

## Estructura

- `src/db/schema.ts`: tablas (clientes, analistas, reuniones, tareas, historial de tareas y estado semanal).
- `src/lib/consultas.ts`: consultas que usan las pantallas.
- `src/app/acciones.ts`: acciones del servidor (guardar ficha, editar tareas, procesar minutas).
- `src/lib/minuta.ts`: el pedido a Claude para procesar una minuta.
- `scripts/importar-sheet.ts`: importación del sheet.
- `drizzle/`: migraciones de la base. Después de cambiar el esquema: `npm run db:generate`.
