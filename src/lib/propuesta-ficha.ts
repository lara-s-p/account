import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { reuniones, tareas, type Cliente } from "@/db/schema";
import { fechaCorta } from "./fechas";
import { textoDelBlueprint, textoDelSitio } from "./fuentes-ficha";

export type PropuestaFicha = {
  industria: string | null;
  pais: string | null;
  plataformaEcommerce: string | null;
  descripcionNegocio: string | null;
  objetivosNegocio: string | null;
  competidores: string | null;
  fuentes: string[];
  avisos: string[];
};

const CAMPO = { type: ["string", "null"] };
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["industria", "pais", "plataformaEcommerce", "descripcionNegocio", "objetivosNegocio", "competidores"],
  properties: { industria: CAMPO, pais: CAMPO, plataformaEcommerce: CAMPO, descripcionNegocio: CAMPO, objetivosNegocio: CAMPO, competidores: CAMPO },
};

let anthropic: Anthropic | null = null;

/** Borrador de ficha para clientes sin blueprint: sale de lo que ya se trabajó con ellos. No guarda nada. */
export async function proponerFicha(cliente: Cliente, googleToken?: string): Promise<PropuestaFicha> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Falta configurar ANTHROPIC_API_KEY.");
  anthropic ??= new Anthropic();
  const db = await getDb();
  const fuentes: string[] = [];
  const avisos: string[] = [];

  const [listaTareas, listaReuniones] = await Promise.all([
    db.select({ titulo: tareas.titulo, descripcion: tareas.descripcion, etiqueta: tareas.etiqueta }).from(tareas).where(eq(tareas.clienteId, cliente.id)).orderBy(desc(tareas.id)).limit(150),
    db.select().from(reuniones).where(eq(reuniones.clienteId, cliente.id)).orderBy(desc(reuniones.fecha)).limit(20),
  ]);
  if (listaTareas.length) fuentes.push(`${listaTareas.length} tareas`);
  const conResumen = listaReuniones.filter((r) => r.resumen);
  if (conResumen.length) fuentes.push(`${conResumen.length} reuniones`);
  if (cliente.contextoHistorico) fuentes.push("notas de la planilla de gestión");

  const sitio = cliente.sitioWeb ? await textoDelSitio(cliente.sitioWeb) : null;
  if (sitio) fuentes.push("sitio web");
  else if (cliente.sitioWeb) avisos.push("No se pudo leer el sitio web.");

  let blueprint: string | null = null;
  if (cliente.blueprint) {
    const b = await textoDelBlueprint(cliente.blueprint, googleToken);
    blueprint = b.texto;
    if (blueprint) fuentes.push("Blueprint");
    if (b.aviso) avisos.push(b.aviso);
  }
  if (!fuentes.length) throw new Error("No hay información de este cliente para proponer la ficha: cargá al menos el sitio web o una minuta.");

  const prompt = `Sos del área de Account de Known Online, una agencia de marketing digital. Armá un borrador de la ficha del cliente ${cliente.nombre} con la información que hay. Lo va a revisar un account antes de guardarlo.

Datos que ya tiene la ficha: servicios ${cliente.servicios.join(", ") || "sin datos"}, país ${cliente.pais ?? "sin dato"}, plataforma ${cliente.plataformaEcommerce ?? "sin dato"}, sitio ${cliente.sitioWeb ?? "sin dato"}.

${blueprint ? `Blueprint del cliente:\n${blueprint}\n` : ""}
${sitio ? `Sitio web:\n${sitio}\n` : ""}
${cliente.contextoHistorico ? `Notas del account:\n${cliente.contextoHistorico.slice(-4000)}\n` : ""}
Reuniones recientes:
${conResumen.map((r) => `- ${fechaCorta(r.fecha)}: ${r.resumen}${r.decisiones.length ? ` Decisiones: ${r.decisiones.join("; ")}.` : ""}`).join("\n") || "(sin resúmenes)"}

Tareas que se trabajaron (las más recientes primero):
${listaTareas.map((t) => `- [${t.etiqueta ?? "-"}] ${t.titulo}${t.descripcion ? `: ${t.descripcion.slice(0, 160)}` : ""}`).join("\n") || "(sin tareas)"}

Completá cada campo solo si se deduce con claridad de la información; si no, null:
- industria: rubro en pocas palabras (por ejemplo "Retail de indumentaria infantil").
- pais: país o países donde opera.
- plataformaEcommerce: plataforma del sitio (VTEX, Shopify, Magento…) si se menciona.
- descripcionNegocio: 2 a 4 oraciones: qué vende, a quién, canales y temporadas fuertes.
- objetivosNegocio: qué busca lograr el cliente con Known, según lo que se habló y trabajó.
- competidores: los que se mencionen, separados por coma.
No inventes datos.`;

  const res = await anthropic.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: prompt }],
  });
  if (res.stop_reason === "refusal") throw new Error("Claude no pudo armar la propuesta.");
  const datos = JSON.parse(res.content.map((b) => (b.type === "text" ? b.text : "")).join("")) as Omit<PropuestaFicha, "fuentes" | "avisos">;
  return { ...datos, fuentes, avisos };
}
