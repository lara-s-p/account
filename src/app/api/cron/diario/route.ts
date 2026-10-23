import { enviarAlerta } from "@/lib/alerta";
import { hoyISO, lunesDe } from "@/lib/fechas";
import { generarSemana } from "@/lib/semana";
import { sincronizarJira } from "@/lib/sync-jira";

// Sincronizar con Jira y, los lunes, analizar todos los clientes con Claude lleva varios minutos.
export const maxDuration = 300;

/**
 * Tarea programada diaria (vercel.json, 9:00 de Argentina). Vercel manda CRON_SECRET en Authorization.
 * - Todos los días: trae de Jira el estado de las tareas.
 * - Los lunes: arma el estado semanal de cada cliente activo y publica la alerta en el canal de accounts.
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const hoy = hoyISO();
  const jira = await sincronizarJira();
  const forzarLunes = new URL(req.url).searchParams.get("lunes") === "1";
  if (hoy !== lunesDe(hoy) && !forzarLunes) return Response.json({ jira });
  const semana = lunesDe(hoy);
  const estados = await generarSemana(semana, { limiteMs: 220_000 });
  const alerta = await enviarAlerta(semana);
  return Response.json({ jira, estados, alerta });
}
