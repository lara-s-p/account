import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { clientes, estadosSemanales, NIVELES, reuniones, tareas, type Cliente, type EstadoSemanal } from "@/db/schema";
import { diasEntre, fechaCorta, hoyISO, lunesDe, sumarDias } from "./fechas";

export type Metricas = {
  diasSinReunion: number | null;
  frecuenciaDias: number;
  reuniones30: number;
  abiertas: number;
  vencidas: number;
  vencenEstaSemana: number;
  sinDecidir: number;
  pendientesCliente: number;
  pendientesClienteVencidos: number;
  cerradas7: number;
  creadas7: number;
  temasRepetidos30: number;
  puntaje: number;
};

const ABIERTA = sql`${tareas.decision} = 'Cargar' and ${tareas.estado} in ('Por hacer','En curso','Bloqueada') and (${tareas.origen} <> 'plataforma' or ${tareas.enviadaEn} is not null)`;

/** "Semanales", "Quincenal", "Mensual"… → días esperados entre reuniones. */
function frecuenciaEnDias(texto: string | null): number {
  const t = (texto ?? "").toLowerCase();
  if (t.includes("seman")) return 7;
  if (t.includes("quincen")) return 14;
  if (t.includes("mensu")) return 30;
  return 14;
}

/**
 * Puntaje operativo de 0 (mal) a 100 (bien) con los pesos y umbrales del plan (pestaña Parámetros).
 * El cumplimiento de objetivos todavía no tiene datos, así que se reparte su peso entre el resto.
 */
function puntajeOperativo(m: Omit<Metricas, "puntaje">): number {
  const pts = (valor: number, verde: number, amarillo: number) => (valor <= verde ? 100 : valor <= amarillo ? 50 : 0);
  const reunion = m.diasSinReunion == null ? 0 : pts(m.diasSinReunion, m.frecuenciaDias + 3, m.frecuenciaDias * 2 + 3);
  const partes = [
    [reunion, 0.25],
    [pts(m.sinDecidir, 2, 8), 0.1],
    [pts(m.vencidas, 0, 3), 0.2],
    [pts(m.pendientesClienteVencidos, 0, 2), 0.15],
  ] as const;
  const peso = partes.reduce((s, [, w]) => s + w, 0);
  return Math.round(partes.reduce((s, [p, w]) => s + p * w, 0) / peso);
}

export async function metricasCliente(cliente: Cliente, hoy = hoyISO()): Promise<Metricas> {
  const db = await getDb();
  const finSemana = sumarDias(lunesDe(hoy), 6);
  const hace7 = sumarDias(hoy, -7);
  const hace30 = sumarDias(hoy, -30);
  const [r] = await db
    .select({
      ultima: sql<string | null>`max(${reuniones.fecha})::text`,
      ultimos30: sql<number>`count(*) filter (where ${reuniones.fecha} >= ${hace30}::date)::int`,
    })
    .from(reuniones)
    .where(eq(reuniones.clienteId, cliente.id));
  const [t] = await db
    .select({
      abiertas: sql<number>`count(*) filter (where ${ABIERTA})::int`,
      vencidas: sql<number>`count(*) filter (where ${ABIERTA} and ${tareas.fechaLimite} < ${hoy}::date)::int`,
      vencenEstaSemana: sql<number>`count(*) filter (where ${ABIERTA} and ${tareas.fechaLimite} between ${hoy}::date and ${finSemana}::date)::int`,
      sinDecidir: sql<number>`count(*) filter (where ${tareas.decision} = 'Pendiente')::int`,
      pendientesCliente: sql<number>`count(*) filter (where ${ABIERTA} and ${tareas.responsable} = 'Cliente')::int`,
      pendientesClienteVencidos: sql<number>`count(*) filter (where ${ABIERTA} and ${tareas.responsable} = 'Cliente' and ${tareas.fechaLimite} < ${sumarDias(hoy, -5)}::date)::int`,
      cerradas7: sql<number>`count(*) filter (where ${tareas.estado} = 'Hecha' and ${tareas.fechaCierre} >= ${hace7}::date)::int`,
      creadas7: sql<number>`count(*) filter (where ${tareas.origen} = 'plataforma' and ${tareas.creadoEn} >= ${hace7}::date)::int`,
      temasRepetidos30: sql<number>`count(*) filter (where ${tareas.accionJira} = 'comentar' and ${tareas.enviadaEn} >= ${hace30}::date)::int`,
    })
    .from(tareas)
    .where(eq(tareas.clienteId, cliente.id));
  const base = {
    diasSinReunion: r.ultima ? diasEntre(r.ultima, hoy) : null,
    frecuenciaDias: frecuenciaEnDias(cliente.frecuenciaReunion),
    reuniones30: r.ultimos30,
    ...t,
  };
  return { ...base, puntaje: puntajeOperativo(base) };
}

/* ===================== Análisis con Claude ===================== */

type Analisis = {
  nivel: number;
  motivo: string;
  resumen: string;
  problemas: string[];
  foco: string[];
  oportunidades: string[];
  para_direccion: string | null;
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["nivel", "motivo", "resumen", "problemas", "foco", "oportunidades", "para_direccion"],
  properties: {
    nivel: { type: "integer", enum: [1, 2, 3, 4, 5, 6] },
    motivo: { type: "string" },
    resumen: { type: "string" },
    problemas: { type: "array", items: { type: "string" } },
    foco: { type: "array", items: { type: "string" } },
    oportunidades: { type: "array", items: { type: "string" } },
    para_direccion: { type: ["string", "null"] },
  },
};

let anthropic: Anthropic | null = null;

async function analizarConClaude(cliente: Cliente, semana: string, m: Metricas): Promise<Analisis> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Falta configurar ANTHROPIC_API_KEY.");
  anthropic ??= new Anthropic();
  const db = await getDb();
  const hoy = hoyISO();
  const [historial, recientes, vencidas, abiertas] = await Promise.all([
    db.select().from(estadosSemanales).where(and(eq(estadosSemanales.clienteId, cliente.id), lt(estadosSemanales.semana, semana))).orderBy(desc(estadosSemanales.semana)).limit(4),
    db.select().from(reuniones).where(and(eq(reuniones.clienteId, cliente.id), gte(reuniones.fecha, sumarDias(hoy, -45)))).orderBy(desc(reuniones.fecha)).limit(6),
    db.select({ titulo: tareas.titulo, fecha: tareas.fechaLimite, responsable: tareas.responsable }).from(tareas).where(and(eq(tareas.clienteId, cliente.id), ABIERTA, lt(tareas.fechaLimite, hoy))).limit(15),
    db.select({ titulo: tareas.titulo, estado: tareas.estado }).from(tareas).where(and(eq(tareas.clienteId, cliente.id), ABIERTA)).orderBy(desc(tareas.actualizadoEn)).limit(15),
  ]);

  const escala = NIVELES.map((n) => `${n.nivel} = ${n.color}, "${n.nombre}": ${n.queMirar}`).join("\n");
  const prompt = `Sos el analista de cartera del área de Account de Known Online, una agencia de marketing digital. Armá el estado de la semana del ${fechaCorta(semana)} del cliente ${cliente.nombre}.

Escala de criticidad (semáforo):
${escala}

Ficha: servicios ${cliente.servicios.join(", ") || "sin datos"} · prioridad estratégica ${cliente.prioridad ?? "sin definir"} (5 es la máxima) · reuniones ${cliente.frecuenciaReunion ?? "sin frecuencia definida"} · account ${cliente.account ?? "sin asignar"}.

Números de la semana:
- Días desde la última reunión: ${m.diasSinReunion ?? "nunca hubo reunión registrada"} (frecuencia esperada: cada ${m.frecuenciaDias} días). Reuniones en los últimos 30 días: ${m.reuniones30}.
- Tareas abiertas: ${m.abiertas}; vencidas: ${m.vencidas}; vencen esta semana: ${m.vencenEstaSemana}; sin decidir: ${m.sinDecidir}.
- Pendientes del cliente abiertos: ${m.pendientesCliente}; vencidos hace más de 5 días: ${m.pendientesClienteVencidos}.
- Cerradas en los últimos 7 días: ${m.cerradas7}; temas que volvieron a aparecer en reuniones (últimos 30 días): ${m.temasRepetidos30}.
- Puntaje operativo: ${m.puntaje}/100.

Estados de semanas anteriores (el más reciente primero):
${historial.length ? historial.map((h) => `- ${fechaCorta(h.semana)}: nivel ${h.nivel} (${h.semaforo})${h.motivo ? ` — ${h.motivo}` : ""}${h.origen === "planilla" ? " [de la planilla de gestión]" : h.ajustadoPor ? ` [ajustado por ${h.ajustadoPor}]` : ""}`).join("\n") : "(sin historial)"}

Reuniones de las últimas 6 semanas:
${recientes.length ? recientes.map((r) => `- ${fechaCorta(r.fecha)}${r.tonoCliente ? ` (cliente ${r.tonoCliente.toLowerCase()})` : ""}: ${r.resumen ?? "sin resumen (importada del sheet)"}${r.decisiones.length ? ` Decisiones: ${r.decisiones.join("; ")}.` : ""}${r.riesgos.length ? ` Riesgos: ${r.riesgos.join("; ")}.` : ""}${r.oportunidades.length ? ` Oportunidades: ${r.oportunidades.join("; ")}.` : ""}`).join("\n") : "(no hubo reuniones)"}

Tareas vencidas:
${vencidas.length ? vencidas.map((v) => `- ${v.titulo} (${v.responsable === "Cliente" ? "del cliente" : "de Known"}, vencía ${fechaCorta(v.fecha)})`).join("\n") : "(ninguna)"}

Tareas abiertas más recientes:
${abiertas.length ? abiertas.map((a) => `- ${a.titulo} (${a.estado})`).join("\n") : "(ninguna)"}

Notas históricas del account (planilla de gestión):
${cliente.contextoHistorico ? cliente.contextoHistorico.slice(-3000) : "(sin notas)"}

Devolvé:
- nivel: de 1 a 6 según la escala. Pesan más las señales de la relación y de los resultados (tono, quejas, recortes, pedidos de baja, riesgos de las reuniones, notas del account) que los números operativos. Si no hay información nueva, mantené el nivel de la semana anterior.
- motivo: una oración con la razón principal del nivel.
- resumen: 2 a 4 oraciones con cómo está el cliente esta semana y qué cambió respecto de la anterior.
- problemas: los problemas concretos que hay hoy (lista vacía si no hay).
- foco: de 1 a 3 cosas que el account tiene que mirar o hacer esta semana, accionables.
- oportunidades: oportunidades de upsell o de nuevos servicios que surgen de las reuniones (lista vacía si no hay).
- para_direccion: solo si hay algo que la dirección de la agencia tiene que saber (riesgo de baja, conflicto, pedido comercial importante); si no, null.
Escribí en español, directo, sin inventar nada que no esté en los datos.`;

  const res = await anthropic.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: prompt }],
  });
  if (res.stop_reason === "refusal") throw new Error("Claude no pudo analizar este cliente.");
  const texto = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const a = JSON.parse(texto) as Analisis;
  a.nivel = Math.min(6, Math.max(1, Math.round(a.nivel)));
  return a;
}

/**
 * Genera (o regenera) el estado semanal de un cliente.
 * No pisa un estado que un account ajustó a mano, salvo que se pida explícitamente.
 */
export async function generarEstado(cliente: Cliente, semana: string, opts: { pisarAjustes?: boolean } = {}): Promise<EstadoSemanal | null> {
  const db = await getDb();
  const [previo] = await db.select().from(estadosSemanales).where(and(eq(estadosSemanales.clienteId, cliente.id), eq(estadosSemanales.semana, semana)));
  if (previo?.ajustadoPor && !opts.pisarAjustes) return previo;
  const metricas = await metricasCliente(cliente);
  const a = await analizarConClaude(cliente, semana, metricas);
  const nivel = NIVELES.find((n) => n.nivel === a.nivel)!;
  const datos = {
    clienteId: cliente.id,
    semana,
    nivel: a.nivel,
    semaforo: nivel.nombre,
    nivelSugerido: null,
    motivo: a.motivo,
    origen: "ia",
    ajustadoPor: null,
    puntaje: metricas.puntaje,
    resumen: a.resumen,
    problemas: a.problemas.join("\n") || null,
    foco: a.foco.join("\n") || null,
    oportunidades: a.oportunidades.join("\n") || null,
    paraDireccion: a.para_direccion,
    listas: { problemas: a.problemas, foco: a.foco, oportunidades: a.oportunidades },
    metricas: metricas as unknown as Record<string, number | string | null>,
    creadoPor: "Claude",
  };
  const [fila] = await db
    .insert(estadosSemanales)
    .values(datos)
    .onConflictDoUpdate({ target: [estadosSemanales.clienteId, estadosSemanales.semana], set: { ...datos, actualizadoEn: new Date() } })
    .returning();
  return fila;
}

/**
 * Genera el estado de la semana de todos los clientes activos que todavía no lo tienen,
 * de a varios a la vez y sin pasarse del tiempo disponible (lo que falte se completa en otra corrida).
 */
export async function generarSemana(semana: string, opts: { limiteMs?: number; clienteIds?: string[] } = {}) {
  const db = await getDb();
  const inicio = Date.now();
  const limite = opts.limiteMs ?? 240_000;
  const activos = await db
    .select()
    .from(clientes)
    .where(opts.clienteIds ? inArray(clientes.id, opts.clienteIds) : eq(clientes.estado, "Activo"));
  const hechos = new Set(
    (await db.select({ id: estadosSemanales.clienteId }).from(estadosSemanales).where(eq(estadosSemanales.semana, semana))).map((e) => e.id)
  );
  const pendientes = opts.clienteIds ? activos : activos.filter((c) => !hechos.has(c.id));
  const resultado = { generados: 0, errores: [] as string[], faltan: 0 };
  const cola = [...pendientes];
  async function trabajador() {
    while (cola.length) {
      if (Date.now() - inicio > limite) return;
      const c = cola.shift()!;
      try {
        await generarEstado(c, semana);
        resultado.generados++;
      } catch (e) {
        resultado.errores.push(`${c.nombre}: ${e instanceof Error ? e.message : "error"}`);
      }
    }
  }
  await Promise.all(Array.from({ length: 5 }, trabajador));
  resultado.faltan = cola.length;
  return resultado;
}

/* ===================== Consultas para las pantallas ===================== */

export async function semanasConDatos(): Promise<string[]> {
  const db = await getDb();
  const filas = await db.selectDistinct({ semana: estadosSemanales.semana }).from(estadosSemanales).orderBy(desc(estadosSemanales.semana)).limit(26);
  return filas.map((f) => f.semana);
}

/** Estado de cada cliente activo en una semana, con el de la semana anterior para ver la tendencia. */
export async function cartera(semana: string) {
  const db = await getDb();
  const activos = await db.select().from(clientes).where(eq(clientes.estado, "Activo"));
  const estados = await db.select().from(estadosSemanales).where(and(inArray(estadosSemanales.clienteId, activos.map((c) => c.id)), sql`${estadosSemanales.semana} <= ${semana}`)).orderBy(desc(estadosSemanales.semana));
  return activos.map((cliente) => {
    const propios = estados.filter((e) => e.clienteId === cliente.id);
    const actual = propios.find((e) => e.semana === semana) ?? null;
    const anterior = propios.find((e) => e.semana < semana) ?? null;
    return { cliente, actual, anterior };
  });
}

export async function historialCliente(clienteId: string) {
  const db = await getDb();
  return db.select().from(estadosSemanales).where(eq(estadosSemanales.clienteId, clienteId)).orderBy(desc(estadosSemanales.semana));
}

/** Último estado conocido de cada cliente (para listados). */
export async function ultimosEstados(): Promise<Map<string, EstadoSemanal>> {
  const db = await getDb();
  const filas = await db
    .selectDistinctOn([estadosSemanales.clienteId])
    .from(estadosSemanales)
    .orderBy(estadosSemanales.clienteId, desc(estadosSemanales.semana));
  return new Map(filas.map((f) => [f.clienteId, f]));
}

