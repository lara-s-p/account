import { timingSafeEqual } from "node:crypto";
import { sincronizarJira } from "@/lib/sync-jira";

/**
 * Webhook de Jira (Configuración del sistema > Webhooks) para enterarse al instante cuando un issue cambia.
 * URL: https://<dominio>/api/jira/webhook?secreto=<JIRA_WEBHOOK_SECRET>, evento "issue updated".
 * No se confía en los datos del aviso: se vuelve a consultar el issue en Jira.
 */
function secretoValido(recibido: string | null) {
  const esperado = process.env.JIRA_WEBHOOK_SECRET;
  if (!esperado || !recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!secretoValido(new URL(req.url).searchParams.get("secreto"))) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const cuerpo = (await req.json().catch(() => null)) as { issue?: { key?: string } } | null;
  const key = cuerpo?.issue?.key;
  if (!key || !/^[A-Z][A-Z0-9]+-\d+$/.test(key)) return Response.json({ ok: true, ignorado: true });
  const resumen = await sincronizarJira({ claves: [key] });
  return Response.json({ ok: !resumen.error, actualizadas: resumen.actualizadas });
}
