import Anthropic from "@anthropic-ai/sdk";
import { lookup } from "node:dns/promises";
import net from "node:net";

// La clave se lee de la variable de entorno ANTHROPIC_API_KEY configurada en Vercel.
const client = new Anthropic();

const MAX_PAGE_CHARS = 15000;
const MAX_INFO_CHARS = 15000;

const SCHEMA = {
  type: "object",
  properties: {
    titulo: { type: "string" },
    descripcion: { type: "string" },
    puntos: { type: "array", items: { type: "string" } },
    meta: { type: "string" },
    faltantes: { type: "array", items: { type: "string" } },
  },
  required: ["titulo", "descripcion", "puntos", "meta", "faltantes"],
  additionalProperties: false,
};

const LARGOS = {
  corta: "un párrafo de 2 a 3 oraciones",
  media: "dos párrafos breves",
  larga: "tres párrafos",
};
const TONOS = ["cercano", "profesional", "persuasivo", "premium"];

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const low = ip.toLowerCase();
  return low === "::1" || low === "::" || low.startsWith("fc") || low.startsWith("fd") ||
    low.startsWith("fe80") || low.startsWith("::ffff:") && isPrivateIp(low.slice(7));
}

// Solo se leen páginas públicas: se rechazan direcciones internas de la red.
async function assertPublicUrl(url) {
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("bad_url");
  const { address } = await lookup(url.hostname);
  if (isPrivateIp(address)) throw new Error("bad_url");
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

// Extrae lo útil de la página: título, metadatos, datos estructurados de producto y el texto visible.
function extractText(html) {
  const parts = [];
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) parts.push("Título de la página: " + decodeEntities(title[1].trim()));
  for (const m of html.matchAll(/<meta[^>]+(?:name|property)=["'](description|og:title|og:description|product:price:amount|product:price:currency)["'][^>]*>/gi)) {
    const content = m[0].match(/content=["']([^"']*)["']/i);
    if (content) parts.push(`${m[1]}: ${decodeEntities(content[1])}`);
  }
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (/"Product"/.test(m[1])) parts.push("Datos estructurados del producto: " + m[1].trim().slice(0, 4000));
  }
  const body = decodeEntities(
    html
      .replace(/<(head|script|style|noscript|svg|header|footer|nav)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim();
  parts.push("Texto de la página: " + body);
  return parts.join("\n").slice(0, MAX_PAGE_CHARS);
}

async function readProductPage(rawUrl) {
  const url = new URL(rawUrl);
  await assertPublicUrl(url);
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MiTiendaRedactor/1.0)", "Accept-Language": "es-AR,es;q=0.9" },
  });
  if (!res.ok) throw new Error("fetch_failed");
  await assertPublicUrl(new URL(res.url));
  const type = res.headers.get("content-type") || "";
  if (!type.includes("text/html")) throw new Error("fetch_failed");
  return extractText((await res.text()).slice(0, 2_000_000));
}

function buildPrompt({ url, pageText, info, tone, length, keyword }) {
  return `Sos redactor/a de e-commerce en Argentina. Escribí el contenido de una página de producto para una tienda online, en español rioplatense (usá "vos" si te dirigís al cliente).

Link de la página: ${url}

Contenido leído de la página (puede incluir menús, textos legales u otros productos; usá solo lo que describe ESTE producto):
"""
${pageText || "(no se pudo leer la página)"}
"""

Información adicional que agregó la tienda:
"""
${info || "(ninguna)"}
"""

Tono: ${tone}
Largo de la descripción: ${LARGOS[length]}
${keyword ? `Palabra clave a incluir de forma natural en el título y la descripción: ${keyword}\n` : ""}
Reglas:
- No inventes características, materiales, medidas, talles, precios ni garantías que no aparezcan en el contenido. Si hay poca información, mantené el texto general.
- titulo: máximo 70 caracteres, claro y buscable (producto + atributo principal).
- descripcion: párrafos separados por una línea en blanco.
- puntos: de 3 a 5 beneficios o características concretas, cortos.
- meta: meta descripción para Google, máximo 155 caracteres.
- faltantes: datos importantes que no tenías y que mejorarían la ficha (por ejemplo medidas, material, talles). Lista vacía si no falta nada.`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Usá POST." });
  }

  const accessCode = process.env.REDACTOR_CODIGO;
  if (accessCode && req.headers["x-codigo-acceso"] !== accessCode) {
    return res.status(401).json({ error: "El código de acceso no es correcto." });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const url = String(body.url || "").trim();
  const info = String(body.info || "").trim().slice(0, MAX_INFO_CHARS);
  const tone = TONOS.includes(body.tone) ? body.tone : "cercano";
  const length = LARGOS[body.length] ? body.length : "media";
  const keyword = String(body.keyword || "").trim().slice(0, 100);

  if (!/^https?:\/\/\S+\.\S+/.test(url)) {
    return res.status(400).json({ error: "Pegá un link completo, que empiece con https://" });
  }

  let pageText = "";
  let pageRead = true;
  try {
    pageText = await readProductPage(url);
  } catch {
    pageRead = false;
  }
  if (!pageRead && !info) {
    return res.status(422).json({
      error: "No pude leer esa página (puede estar protegida o no ser pública). Pegá la información del producto en el campo de texto y probá de nuevo.",
    });
  }

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: SCHEMA },
      },
      messages: [{ role: "user", content: buildPrompt({ url, pageText, info, tone, length, keyword }) }],
    });

    if (response.stop_reason === "refusal") {
      return res.status(422).json({ error: "Claude no pudo redactar con esa información. Revisá el link o el texto y probá de nuevo." });
    }
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const data = JSON.parse(text);
    return res.status(200).json({ ...data, paginaLeida: pageRead });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(500).json({ error: "La clave de Claude no es válida. Revisá ANTHROPIC_API_KEY en Vercel." });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "Se hicieron muchos pedidos seguidos. Esperá un momento y probá de nuevo." });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Error de la API de Claude:", err.status, err.message);
      return res.status(502).json({ error: "Claude no respondió bien. Probá de nuevo en un momento." });
    }
    console.error(err);
    return res.status(500).json({ error: "No se pudo completar la redacción. Probá de nuevo en un momento." });
  }
}
