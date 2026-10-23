import { sincronizarJira } from "@/lib/sync-jira";

// La primera sincronización revisa todas las tareas con issue (más de 2.000): puede tardar.
export const maxDuration = 300;

/** Tarea programada de Vercel (ver vercel.json). Vercel manda CRON_SECRET en el encabezado Authorization. */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const resumen = await sincronizarJira();
  return Response.json(resumen, { status: resumen.error ? 500 : 200 });
}
