import "server-only";

/** Publica en Slack con el bot configurado en SLACK_TOKEN (permiso chat:write). */
export const slackConfigurado = () => Boolean(process.env.SLACK_TOKEN);

/** De "https://app.slack.com/client/T3VD3NACD/C07JEK4GAUV" saca "C07JEK4GAUV". */
export function idCanal(valor: string | null | undefined): string | null {
  const t = String(valor ?? "").trim();
  return t.match(/\b([CG][A-Z0-9]{6,})\/?$/)?.[1] ?? (/^[CG][A-Z0-9]{6,}$/.test(t) ? t : null);
}

export async function publicarEnSlack(canal: string, texto: string): Promise<void> {
  if (!slackConfigurado()) throw new Error("Slack no está conectado: falta SLACK_TOKEN.");
  const res = await fetch((process.env.SLACK_API_BASE || "https://slack.com/api") + "/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SLACK_TOKEN}`, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ channel: canal, text: texto, unfurl_links: false, unfurl_media: false }),
    signal: AbortSignal.timeout(15_000),
  });
  const r = (await res.json()) as { ok: boolean; error?: string };
  if (!r.ok) throw new Error(r.error === "not_in_channel" ? "El bot de Slack no está en el canal del cliente." : `Slack respondió: ${r.error}`);
}
