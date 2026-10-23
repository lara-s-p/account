import "server-only";
import { and, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { ajustes, analistas, tareaEventos, tareas } from "@/db/schema";
import { datosDeIssues, jiraConfigurado, type DatosIssue } from "./jira";

export type ResumenSync = { fecha: string; revisadas: number; actualizadas: number; inexistentes: number; error?: string };

/** Estado de Jira → estado de la plataforma. */
export function estadoDesdeJira(i: Pick<DatosIssue, "categoria" | "estado">): string {
  if (i.categoria === "done") return "Hecha";
  if (i.categoria === "indeterminate") return /bloq|block|espera|hold|stand ?by/i.test(i.estado) ? "Bloqueada" : "En curso";
  return "Por hacer";
}

/**
 * Trae de Jira el estado de las tareas que tienen issue y no están terminadas (o solo de las claves indicadas).
 * Actualiza estado, estado en Jira, fecha de cierre, vencimiento (si la tarea no tenía) y analista
 * (si el issue se reasignó), y deja cada cambio de estado o de analista en el historial como hecho por "Jira".
 * A las tareas importadas del sheet les pone la fecha de creación real del issue.
 */
export async function sincronizarJira(opts: { claves?: string[] } = {}): Promise<ResumenSync> {
  const db = await getDb();
  const resumen: ResumenSync = { fecha: new Date().toISOString(), revisadas: 0, actualizadas: 0, inexistentes: 0 };
  if (!jiraConfigurado()) return { ...resumen, error: "Jira no está conectado." };

  const lista = await db
    .select()
    .from(tareas)
    .where(opts.claves ? inArray(tareas.jiraKey, opts.claves) : and(isNotNull(tareas.jiraKey), ne(tareas.estado, "Hecha")));
  const claves = [...new Set(lista.map((t) => t.jiraKey!))];
  if (!claves.length) return resumen;

  try {
    const { issues, inexistentes } = await datosDeIssues(claves);
    resumen.revisadas = issues.length;
    resumen.inexistentes = inexistentes.length;
    const porClave = new Map(issues.map((i) => [i.key, i]));
    const listaAnalistas = await db.select({ id: analistas.id, nombre: analistas.nombre, jira: analistas.jiraAccountId }).from(analistas);
    const analistaPorJira = new Map(listaAnalistas.filter((a) => a.jira).map((a) => [a.jira!, a]));
    const nombre = (id: number | null) => listaAnalistas.find((a) => a.id === id)?.nombre ?? null;

    for (const t of lista) {
      if (inexistentes.includes(t.jiraKey!)) {
        if (t.estadoJira !== "No existe en Jira") await db.update(tareas).set({ estadoJira: "No existe en Jira" }).where(eq(tareas.id, t.id));
        continue;
      }
      const i = porClave.get(t.jiraKey!);
      if (!i) continue;
      const estado = estadoDesdeJira(i);
      const cambios: Partial<typeof tareas.$inferInsert> = {};
      const eventos: (typeof tareaEventos.$inferInsert)[] = [];
      if (t.estadoJira !== i.estado) cambios.estadoJira = i.estado;
      if (t.estado !== estado) {
        cambios.estado = estado;
        eventos.push({ tareaId: t.id, usuario: "Jira", tipo: "cambio", campo: "estado", valorAnterior: t.estado, valorNuevo: estado });
      }
      const cierre = estado === "Hecha" && i.resuelta ? new Date(i.resuelta) : null;
      if ((t.fechaCierre?.getTime() ?? null) !== (cierre?.getTime() ?? null)) cambios.fechaCierre = cierre;
      if (!t.fechaLimite && i.vencimiento) cambios.fechaLimite = i.vencimiento;
      const responsable = i.responsableAccountId ? analistaPorJira.get(i.responsableAccountId) : undefined;
      if (responsable && responsable.id !== t.analistaId && t.responsable === "Known") {
        cambios.analistaId = responsable.id;
        eventos.push({ tareaId: t.id, usuario: "Jira", tipo: "cambio", campo: "analista", valorAnterior: nombre(t.analistaId), valorNuevo: responsable.nombre });
      }
      if (t.origen === "sheet" && i.creada && t.creadoEn.getTime() !== new Date(i.creada).getTime()) cambios.creadoEn = new Date(i.creada);
      if (!Object.keys(cambios).length) continue;
      await db.update(tareas).set({ ...cambios, actualizadoEn: new Date() }).where(eq(tareas.id, t.id));
      if (eventos.length) await db.insert(tareaEventos).values(eventos);
      resumen.actualizadas++;
    }
  } catch (e) {
    resumen.error = e instanceof Error ? e.message : "Error al sincronizar con Jira.";
  }

  if (!opts.claves) {
    await db
      .insert(ajustes)
      .values({ clave: "sync-jira", valor: resumen })
      .onConflictDoUpdate({ target: ajustes.clave, set: { valor: resumen, actualizadoEn: new Date() } });
  }
  return resumen;
}

export async function ultimaSincronizacion(): Promise<ResumenSync | null> {
  const db = await getDb();
  const [fila] = await db.select().from(ajustes).where(eq(ajustes.clave, "sync-jira"));
  return (fila?.valor as ResumenSync | undefined) ?? null;
}
