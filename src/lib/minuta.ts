import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export type TareaExtraida = {
  titulo: string;
  descripcion: string;
  responsable: "Known" | "Cliente";
  etiqueta: "SEO" | "PAID" | "EMAIL" | "OTRO";
  prioridad: "Alta" | "Media" | "Baja";
  fecha_limite: string | null;
  analista_mencionado: string | null;
  relacionada_con: string | null;
  motivo_relacion: string | null;
};

export type MinutaProcesada = {
  resumen: string;
  tono_cliente: "Positivo" | "Neutral" | "Preocupado" | "Molesto";
  decisiones: string[];
  oportunidades: string[];
  riesgos: string[];
  tareas: TareaExtraida[];
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["resumen", "tono_cliente", "decisiones", "oportunidades", "riesgos", "tareas"],
  properties: {
    resumen: { type: "string" },
    tono_cliente: { type: "string", enum: ["Positivo", "Neutral", "Preocupado", "Molesto"] },
    decisiones: { type: "array", items: { type: "string" } },
    oportunidades: { type: "array", items: { type: "string" } },
    riesgos: { type: "array", items: { type: "string" } },
    tareas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["titulo", "descripcion", "responsable", "etiqueta", "prioridad", "fecha_limite", "analista_mencionado", "relacionada_con", "motivo_relacion"],
        properties: {
          titulo: { type: "string" },
          descripcion: { type: "string" },
          responsable: { type: "string", enum: ["Known", "Cliente"] },
          etiqueta: { type: "string", enum: ["SEO", "PAID", "EMAIL", "OTRO"] },
          prioridad: { type: "string", enum: ["Alta", "Media", "Baja"] },
          fecha_limite: { type: ["string", "null"] },
          analista_mencionado: { type: ["string", "null"] },
          relacionada_con: { type: ["string", "null"] },
          motivo_relacion: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

let cliente: Anthropic | null = null;

export async function procesarMinutaConClaude(opts: {
  texto: string;
  cliente: string;
  fecha: string;
  analistas: string[];
  serviciosContratados: string[];
  /** Tareas abiertas del cliente en Jira, para no duplicar las que se repiten. */
  abiertas: { key: string; titulo: string; estado: string }[];
}): Promise<MinutaProcesada> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Falta configurar ANTHROPIC_API_KEY para procesar minutas.");
  cliente ??= new Anthropic();

  const prompt = `Sos el asistente del área de Account de Known Online, una agencia de marketing digital (SEO, Paid media y Email marketing). Procesá la minuta de una reunión con un cliente.

Cliente: ${opts.cliente}
Fecha de la reunión: ${opts.fecha}
Servicios que el cliente tiene contratados: ${opts.serviciosContratados.join(", ") || "sin datos"}
Analistas del equipo: ${opts.analistas.join(", ")}

Tareas que este cliente ya tiene abiertas en Jira:
${opts.abiertas.length ? opts.abiertas.map((t) => `- ${t.key}: ${t.titulo} (${t.estado})`).join("\n") : "(ninguna)"}

<minuta>
${opts.texto.slice(0, 60000)}
</minuta>

Devolvé:
- resumen: 2 a 4 oraciones con lo central de la reunión.
- tono_cliente: cómo se mostró el cliente.
- decisiones: lo que se decidió en la reunión.
- oportunidades: oportunidades de upsell o de nuevos servicios que surjan (por ejemplo, el cliente menciona una necesidad que cubre un servicio que no tiene contratado). Lista vacía si no hay.
- riesgos: señales de alerta (insatisfacción, demoras, caída de resultados, recortes de presupuesto, temas para escalar a la dirección). Lista vacía si no hay.
- tareas: cada acción concreta que surgió.
  - responsable "Known" si la hace el equipo de la agencia, "Cliente" si es algo que el cliente se comprometió a entregar o hacer.
  - titulo: corto, empieza con un verbo en infinitivo (por ejemplo "Enviar propuesta de keywords").
  - descripcion: qué hay que hacer y el contexto necesario para hacerlo sin leer la minuta.
  - etiqueta: SEO, PAID (medios pagos, campañas, Google Ads, Meta), EMAIL (email marketing, CRM, automatizaciones) u OTRO.
  - prioridad según la urgencia o el impacto que se mencionó.
  - fecha_limite en formato AAAA-MM-DD solo si en la minuta se dijo una fecha o un plazo (calculala a partir de la fecha de la reunión); si no se dijo, null.
  - analista_mencionado: el nombre exacto de la lista de analistas si la minuta dice quién la hace; si no, null.
  - relacionada_con: si la tarea es la misma o la continuación de una de las tareas abiertas en Jira de la lista de arriba, su clave (por ejemplo "ATKMKT-1056"); así se agrega como comentario en vez de crear una tarea repetida. Solo claves de esa lista; si no hay una que corresponda claramente, null.
  - motivo_relacion: si hay relacionada_con, en una oración qué tiene de nuevo esta reunión sobre esa tarea (va como comentario en Jira); si no, null.
No inventes tareas ni datos que no estén en la minuta.`;

  const respuesta = await cliente.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> } },
    messages: [{ role: "user", content: prompt }],
  });
  if (respuesta.stop_reason === "refusal") throw new Error("Claude no pudo procesar esta minuta. Revisá el texto y probá de nuevo.");
  if (respuesta.stop_reason === "max_tokens") throw new Error("La minuta es demasiado larga para procesarla de una vez. Dividila y cargala en partes.");
  const texto = respuesta.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return JSON.parse(texto) as MinutaProcesada;
}
