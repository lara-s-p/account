import "server-only";
import { lookup } from "node:dns/promises";
import net from "node:net";

function ipPrivada(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const x = ip.toLowerCase();
  return x === "::1" || x === "::" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80") || (x.startsWith("::ffff:") && ipPrivada(x.slice(7)));
}

/** Texto visible de la página de inicio del sitio del cliente (solo sitios públicos). */
export async function textoDelSitio(url: string): Promise<string | null> {
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    if (ipPrivada((await lookup(u.hostname)).address)) return null;
    const res = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Mozilla/5.0 (KnownAccount)" } });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) return null;
    if (ipPrivada((await lookup(new URL(res.url).hostname)).address)) return null;
    const html = (await res.text()).slice(0, 1_500_000);
    const titulo = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
    const descripcion = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)/i)?.[1] ?? "";
    const cuerpo = html
      .replace(/<(head|script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
    return [titulo && `Título: ${titulo}`, descripcion && `Descripción: ${descripcion}`, `Texto: ${cuerpo}`].filter(Boolean).join("\n").slice(0, 6000);
  } catch {
    return null;
  }
}

/**
 * Contenido de un Blueprint en Google Sheets, leído con la cuenta de Google de quien usa la plataforma.
 * Los blueprints subidos como .xlsx a Drive no se pueden leer así: se avisa.
 */
export async function textoDelBlueprint(url: string, accessToken: string | undefined): Promise<{ texto: string | null; aviso?: string }> {
  const id = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1];
  if (!id) return { texto: null, aviso: "El link del Blueprint no es de Google Sheets." };
  if (!accessToken) return { texto: null, aviso: "Para leer el Blueprint hace falta tu sesión de Google: cerrá sesión y volvé a entrar." };
  const auth = { Authorization: `Bearer ${accessToken}` };
  const meta = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=sheets.properties.title`, { headers: auth, signal: AbortSignal.timeout(10_000) });
  if (meta.status === 400) return { texto: null, aviso: "El Blueprint es un Excel subido a Drive: abrilo y guardalo como Hoja de cálculo de Google para poder leerlo." };
  if (!meta.ok) return { texto: null, aviso: "No se pudo abrir el Blueprint con tu cuenta de Google." };
  const hojas = ((await meta.json()) as { sheets: { properties: { title: string } }[] }).sheets.map((s) => s.properties.title).slice(0, 8);
  const rangos = hojas.map((h) => `ranges=${encodeURIComponent(`'${h}'!A1:L120`)}`).join("&");
  const valores = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchGet?${rangos}`, { headers: auth, signal: AbortSignal.timeout(10_000) });
  if (!valores.ok) return { texto: null, aviso: "No se pudo leer el contenido del Blueprint." };
  const datos = (await valores.json()) as { valueRanges: { range: string; values?: string[][] }[] };
  const texto = datos.valueRanges
    .map((r) => `### ${r.range.split("!")[0].replace(/'/g, "")}\n` + (r.values ?? []).map((fila) => fila.filter(Boolean).join(" | ")).filter(Boolean).join("\n"))
    .join("\n\n");
  return { texto: texto.slice(0, 15_000) };
}
