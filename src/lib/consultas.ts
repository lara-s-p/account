import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNotNull, lt, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { analistas, clientes, reuniones, tareaEventos, tareas } from "@/db/schema";
import { hoyISO } from "./fechas";

export const ESTADOS_ABIERTOS = ["Por hacer", "En curso", "Bloqueada"];

const abierta = and(eq(tareas.decision, "Cargar"), inArray(tareas.estado, ESTADOS_ABIERTOS));

export async function listarAnalistas() {
  const db = await getDb();
  return db.select().from(analistas).orderBy(asc(analistas.nombre));
}

export async function listarClientesSimple() {
  const db = await getDb();
  return db.select({ id: clientes.id, nombre: clientes.nombre, estado: clientes.estado }).from(clientes).orderBy(asc(clientes.nombre));
}

/** Clientes con los números que importan para saber cómo están. */
export async function listarClientes() {
  const db = await getDb();
  const hoy = hoyISO();
  const filas = await db
    .select({
      cliente: clientes,
      ultimaReunion: sql<string | null>`(select max(r.fecha)::text from reuniones r where r.cliente_id = "clientes"."id")`,
      reuniones90: sql<number>`(select count(*)::int from reuniones r where r.cliente_id = "clientes"."id" and r.fecha >= ${hoy}::date - 90)`,
      abiertas: sql<number>`(select count(*)::int from tareas t where t.cliente_id = "clientes"."id" and t.decision = 'Cargar' and t.estado in ('Por hacer','En curso','Bloqueada'))`,
      vencidas: sql<number>`(select count(*)::int from tareas t where t.cliente_id = "clientes"."id" and t.decision = 'Cargar' and t.estado in ('Por hacer','En curso','Bloqueada') and t.fecha_limite < ${hoy}::date)`,
      sinDecidir: sql<number>`(select count(*)::int from tareas t where t.cliente_id = "clientes"."id" and t.decision = 'Pendiente')`,
      pendientesCliente: sql<number>`(select count(*)::int from tareas t where t.cliente_id = "clientes"."id" and t.responsable = 'Cliente' and t.estado in ('Por hacer','En curso','Bloqueada') and t.decision <> 'Descartada')`,
    })
    .from(clientes)
    .orderBy(asc(clientes.nombre));
  return filas;
}

export async function obtenerCliente(id: string) {
  const db = await getDb();
  const [c] = await db.select().from(clientes).where(eq(clientes.id, id));
  return c ?? null;
}

export async function listarReuniones(opts: { clienteId?: string; limite?: number } = {}) {
  const db = await getDb();
  return db
    .select({
      reunion: reuniones,
      cliente: clientes.nombre,
      // Subconsultas con alias y la columna externa calificada: sin calificar, "id" se resolvería contra la tabla interna.
      cantTareas: sql<number>`(select count(*)::int from tareas t where t.reunion_id = "reuniones"."id")`,
      sinDecidir: sql<number>`(select count(*)::int from tareas t where t.reunion_id = "reuniones"."id" and t.decision = 'Pendiente')`,
    })
    .from(reuniones)
    .innerJoin(clientes, eq(clientes.id, reuniones.clienteId))
    .where(opts.clienteId ? eq(reuniones.clienteId, opts.clienteId) : undefined)
    .orderBy(desc(reuniones.fecha), desc(reuniones.id))
    .limit(opts.limite ?? 200);
}

export async function obtenerReunion(id: string) {
  const db = await getDb();
  const [fila] = await db
    .select({ reunion: reuniones, cliente: clientes })
    .from(reuniones)
    .innerJoin(clientes, eq(clientes.id, reuniones.clienteId))
    .where(eq(reuniones.id, id));
  return fila ?? null;
}

/** La reunión anterior del mismo cliente, para mostrar qué quedó pendiente. */
export async function reunionAnterior(clienteId: string, fecha: string, id: string) {
  const db = await getDb();
  const [r] = await db
    .select()
    .from(reuniones)
    .where(and(eq(reuniones.clienteId, clienteId), or(lt(reuniones.fecha, fecha), and(eq(reuniones.fecha, fecha), lt(reuniones.id, id)))))
    .orderBy(desc(reuniones.fecha), desc(reuniones.id))
    .limit(1);
  return r ?? null;
}

export type FiltrosTareas = {
  cliente?: string;
  analista?: string;
  decision?: string;
  estado?: string;
  responsable?: string;
  vista?: "abiertas" | "vencidas" | "sin-decidir" | "sin-fecha" | "todas";
  q?: string;
  reunion?: string;
  pagina?: number;
};

export const POR_PAGINA = 50;

export async function listarTareas(f: FiltrosTareas) {
  const db = await getDb();
  const hoy = hoyISO();
  const cond: (SQL | undefined)[] = [];
  if (f.cliente) cond.push(eq(tareas.clienteId, f.cliente));
  if (f.reunion) cond.push(eq(tareas.reunionId, f.reunion));
  if (f.analista === "sin") cond.push(sql`${tareas.analistaId} is null`);
  else if (f.analista) cond.push(eq(tareas.analistaId, Number(f.analista)));
  if (f.decision) cond.push(eq(tareas.decision, f.decision));
  if (f.estado) cond.push(eq(tareas.estado, f.estado));
  if (f.responsable) cond.push(eq(tareas.responsable, f.responsable));
  if (f.q) cond.push(or(ilike(tareas.titulo, `%${f.q}%`), ilike(tareas.descripcion, `%${f.q}%`), ilike(tareas.id, `%${f.q}%`), ilike(tareas.jiraKey, `%${f.q}%`)));
  switch (f.vista) {
    case "abiertas":
      cond.push(abierta);
      break;
    case "vencidas":
      cond.push(abierta, lt(tareas.fechaLimite, hoy));
      break;
    case "sin-decidir":
      cond.push(eq(tareas.decision, "Pendiente"));
      break;
    case "sin-fecha":
      cond.push(abierta, sql`${tareas.fechaLimite} is null`);
      break;
  }
  const where = and(...cond.filter(Boolean));
  const pagina = Math.max(1, f.pagina ?? 1);
  const [filas, [{ total }]] = await Promise.all([
    db
      .select({ tarea: tareas, cliente: clientes.nombre, reunionFecha: reuniones.fecha })
      .from(tareas)
      .innerJoin(clientes, eq(clientes.id, tareas.clienteId))
      .leftJoin(reuniones, eq(reuniones.id, tareas.reunionId))
      .where(where)
      .orderBy(sql`${tareas.fechaLimite} asc nulls last`, desc(tareas.creadoEn), desc(tareas.id))
      .limit(POR_PAGINA)
      .offset((pagina - 1) * POR_PAGINA),
    db.select({ total: sql<number>`count(*)::int` }).from(tareas).where(where),
  ]);
  return { filas, total, pagina };
}

export async function obtenerTarea(id: string) {
  const db = await getDb();
  const [fila] = await db
    .select({ tarea: tareas, cliente: clientes, reunion: reuniones })
    .from(tareas)
    .innerJoin(clientes, eq(clientes.id, tareas.clienteId))
    .leftJoin(reuniones, eq(reuniones.id, tareas.reunionId))
    .where(eq(tareas.id, id));
  if (!fila) return null;
  const eventos = await db.select().from(tareaEventos).where(eq(tareaEventos.tareaId, id)).orderBy(desc(tareaEventos.fecha), desc(tareaEventos.id));
  return { ...fila, eventos };
}

/**
 * Analista sugerido: el que más tareas tomó de ese cliente con esa etiqueta.
 * Si no hay historial para la etiqueta, el que más tareas tomó de ese cliente.
 */
export async function sugerenciasAnalista(clienteId: string) {
  const db = await getDb();
  const filas = await db
    .select({ etiqueta: tareas.etiqueta, analistaId: tareas.analistaId, n: sql<number>`count(*)::int` })
    .from(tareas)
    .where(and(eq(tareas.clienteId, clienteId), isNotNull(tareas.analistaId), eq(tareas.decision, "Cargar")))
    .groupBy(tareas.etiqueta, tareas.analistaId);
  const mejor = new Map<string, { analistaId: number; n: number }>();
  const total = new Map<number, number>();
  for (const f of filas) {
    total.set(f.analistaId!, (total.get(f.analistaId!) ?? 0) + f.n);
    if (!f.etiqueta) continue;
    const previo = mejor.get(f.etiqueta);
    if (!previo || f.n > previo.n) mejor.set(f.etiqueta, { analistaId: f.analistaId!, n: f.n });
  }
  const general = [...total.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return (etiqueta: string | null | undefined) => (etiqueta && mejor.get(etiqueta)?.analistaId) || general;
}

export async function resumenInicio() {
  const db = await getDb();
  const hoy = hoyISO();
  const [conteos] = await db
    .select({
      sinDecidir: sql<number>`count(*) filter (where ${tareas.decision} = 'Pendiente')::int`,
      abiertas: sql<number>`count(*) filter (where ${tareas.decision} = 'Cargar' and ${tareas.estado} in ('Por hacer','En curso','Bloqueada'))::int`,
      vencidas: sql<number>`count(*) filter (where ${tareas.decision} = 'Cargar' and ${tareas.estado} in ('Por hacer','En curso','Bloqueada') and ${tareas.fechaLimite} < ${hoy}::date)::int`,
      sinFecha: sql<number>`count(*) filter (where ${tareas.decision} = 'Cargar' and ${tareas.estado} in ('Por hacer','En curso','Bloqueada') and ${tareas.fechaLimite} is null)::int`,
    })
    .from(tareas);
  const [reus] = await db
    .select({ semana: sql<number>`count(*) filter (where ${reuniones.fecha} >= ${hoy}::date - 7)::int` })
    .from(reuniones);
  return { ...conteos, reunionesSemana: reus.semana };
}
