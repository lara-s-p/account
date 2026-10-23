# Known Account

Plataforma del área de Account MKT de Known Online. Reemplaza al sheet "Automatizacion - Tareas account MKT" y suma lo que el sheet no tenía: fecha límite, trazabilidad y un historial de cada tarea y de cada cliente.

## Qué hace hoy

- **Clientes**: listado con última reunión, tareas abiertas, vencidas y sin decidir, y qué tan completa está la ficha. La ficha tiene datos del negocio, servicios contratados, contactos e integraciones (Jira, Slack, Trello).
- **Bandeja**: las tareas que salen de las minutas llegan primero acá, de todos los clientes. Se revisa analista (sugerido por el equipo del cliente o, si no hay, por historial), etiqueta y fecha, se marca cuáles se cargan y se envían: las de Known se crean en Jira asignadas al analista, las que repiten una tarea abierta se agregan como comentario en ese issue, las del cliente quedan como pendientes suyos, y se avisa en el canal de Slack del cliente. Recién ahí pasan al perfil del cliente.
- **Reuniones**: se carga la minuta (link de Google Docs o texto) y Claude extrae el resumen, las decisiones, las oportunidades de upsell, los riesgos para escalar y las tareas, y compara cada una con las tareas abiertas del cliente en Jira para no duplicarlas. Cada tarea trae responsable (Known o cliente), etiqueta, prioridad, fecha límite si se dijo y analista sugerido según el historial. La pantalla de la reunión muestra además qué quedó abierto de la reunión anterior.
- **Tareas**: vistas de abiertas, vencidas, sin fecha y sin decidir, con filtros. Decisión, analista, etiqueta, prioridad, fecha límite y estado se editan en la tabla. Cada cambio queda en el historial de la tarea, junto con los comentarios.
- **Inicio**: números del día y los clientes que conviene atender primero.

Próximas etapas: tarjeta de la minuta en Trello y resumen en Slack al procesar, estado de las tareas desde Jira, alerta semanal de los lunes, estado semanal por cliente (semáforo, problemas, foco, upsell y temas para la dirección), objetivos mensuales, informe pre-reunión, sincronización con Jira y Trello, y alertas en Slack.

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

## Completar las fichas con la planilla de Gestión Interna

`npm run importar:clientes -- gestion.xlsx` (la planilla "Account Manager - Gestión Interna" descargada como Excel). Marca activos e inactivos, y toma accounts, equipo por área y prioridad estratégica; el resto de los datos (país, servicios, sitio, contactos, plataformas, Looker, Blueprint) solo completa lo que esté vacío. Conviene correrlo después de `npm run importar`.

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
   - `JIRA_EMAIL` y `JIRA_TOKEN`: el usuario con el que se crean las tareas y su token de API (`JIRA_BASE` ya apunta a knownonline.atlassian.net).
   - `SLACK_TOKEN`: el token del bot de Slack (`xoxb-…`), con permiso `chat:write` y agregado a los canales de los clientes.
5. **Deploy** y después importar el sheet a la base de producción (ver arriba).

## Estructura

- `src/db/schema.ts`: tablas (clientes, analistas, reuniones, tareas, historial de tareas y estado semanal).
- `src/lib/consultas.ts`: consultas que usan las pantallas.
- `src/app/acciones.ts`: acciones del servidor (guardar ficha, editar tareas, procesar minutas).
- `src/lib/minuta.ts`: el pedido a Claude para procesar una minuta.
- `src/lib/jira.ts` y `src/lib/slack.ts`: conexiones con Jira y Slack.
- `scripts/importar-sheet.ts` y `scripts/importar-clientes.ts`: importación del sheet de automatización y de la planilla de Gestión Interna.
- `drizzle/`: migraciones de la base. Después de cambiar el esquema: `npm run db:generate`.
