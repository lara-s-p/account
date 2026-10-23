/**
 * Importa el sheet "Automatizacion - Tareas account MKT" a la plataforma.
 *
 * Uso:
 *   npm run importar -- <sheet.xlsx> [plan.xlsx]
 *
 * - sheet.xlsx: el sheet descargado (Archivo > Descargar > Microsoft Excel).
 * - plan.xlsx (opcional): Plan_Automatizacion_Account, para tomar IDs, alias, estado y account
 *   de "Maestro Clientes" y el área de "Maestro Analistas".
 *
 * Se puede correr todas las veces que haga falta mientras el sheet siga en uso: las reuniones se
 * reconocen por el link de la minuta y las tareas por su fila de origen, así que no se duplican.
 * Si en el sheet cambió la decisión, el analista o el link de Jira de una tarea ya importada,
 * se actualiza y queda registrado en el historial de la tarea.
 */
import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { eq } from "drizzle-orm";
import { conectar } from "../src/db/conexion";
import { analistas, clientes, reuniones, tareaEventos, tareas } from "../src/db/schema";
import { claveNombre, formatoId, jiraKeyDeLink, limpiar, numeroDeId } from "../src/lib/texto";

type Fila = Record<string, unknown>;

function valorCelda(v: ExcelJS.CellValue): unknown {
  if (v && typeof v === "object") {
    if (v instanceof Date) return v;
    if ("text" in v) return (v as { text: unknown }).text; // hipervínculos
    if ("result" in v) return (v as { result: unknown }).result; // fórmulas
    if ("richText" in v) return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
  }
  return v;
}

/** Lee una pestaña como lista de objetos usando la fila de encabezados indicada. */
function leerHoja(wb: ExcelJS.Workbook, nombre: string, filaEncabezado = 1): Fila[] {
  const ws = wb.getWorksheet(nombre);
  if (!ws) return [];
  const encabezados: string[] = [];
  ws.getRow(filaEncabezado).eachCell({ includeEmpty: true }, (c, i) => {
    encabezados[i] = String(valorCelda(c.value) ?? "").trim();
  });
  const filas: Fila[] = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n <= filaEncabezado) return;
    const f: Fila = {};
    row.eachCell({ includeEmpty: true }, (c, i) => {
      if (encabezados[i]) f[encabezados[i]] = valorCelda(c.value);
    });
    if (Object.values(f).some((v) => limpiar(v))) filas.push(f);
  });
  return filas;
}

function aFechaISO(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const m = String(v ?? "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function idCanalSlack(url: unknown): string | null {
  const t = limpiar(url);
  return t ? t : null;
}

async function main() {
  const [rutaSheet, rutaPlan] = process.argv.slice(2);
  if (!rutaSheet) {
    console.error("Uso: npm run importar -- <sheet.xlsx> [plan.xlsx]");
    process.exit(1);
  }
  const sheet = new ExcelJS.Workbook();
  await sheet.xlsx.readFile(rutaSheet);
  const plan = rutaPlan ? await new ExcelJS.Workbook().xlsx.readFile(rutaPlan) : null;

  const db = await conectar();
  const resumen = { clientesNuevos: 0, analistasNuevos: 0, reunionesNuevas: 0, tareasNuevas: 0, tareasActualizadas: 0 };

  /* ---------- Clientes ---------- */
  const existentes = await db.select().from(clientes);
  const porClave = new Map<string, (typeof existentes)[number]>();
  const indexar = (c: (typeof existentes)[number]) => {
    porClave.set(claveNombre(c.nombre), c);
    c.alias.forEach((a) => porClave.set(claveNombre(a), c));
  };
  existentes.forEach(indexar);
  let ultimoCliente = Math.max(0, ...existentes.map((c) => numeroDeId(c.id)));

  const filasDescartadas: string[] = [];
  /** Un nombre de cliente nuevo de más de 60 caracteres es casi seguro una fila corrida en el sheet. */
  function pareceCliente(nombre: string, hoja: string): boolean {
    if (porClave.has(claveNombre(nombre)) || nombre.length <= 60) return true;
    filasDescartadas.push(`${hoja}: "${nombre.slice(0, 70)}…"`);
    return false;
  }

  async function asegurarCliente(nombre: string, datos: Partial<typeof clientes.$inferInsert> = {}) {
    const clave = claveNombre(nombre);
    const previo = porClave.get(clave);
    if (previo) {
      // Completa solo los campos vacíos: lo que se editó en la plataforma no se pisa.
      const cambios: Partial<typeof clientes.$inferInsert> = {};
      for (const [k, v] of Object.entries(datos) as [keyof typeof previo, unknown][]) {
        const actual = previo[k];
        const vacio = actual == null || actual === "" || (Array.isArray(actual) && !actual.length) || (k === "estado" && actual === "Revisar");
        if (v != null && v !== "" && !(Array.isArray(v) && !v.length) && vacio) (cambios as Record<string, unknown>)[k] = v;
      }
      if (Object.keys(cambios).length) {
        const [act] = await db.update(clientes).set({ ...cambios, actualizadoEn: new Date() }).where(eq(clientes.id, previo.id)).returning();
        indexar(act);
        return act;
      }
      return previo;
    }
    const id = (datos.id as string | undefined) && !existentes.some((c) => c.id === datos.id) ? (datos.id as string) : formatoId("CLI", ++ultimoCliente, 3);
    ultimoCliente = Math.max(ultimoCliente, numeroDeId(id));
    const [nuevo] = await db.insert(clientes).values({ ...datos, id, nombre: nombre.trim() }).returning();
    existentes.push(nuevo);
    indexar(nuevo);
    resumen.clientesNuevos++;
    return nuevo;
  }

  if (plan) {
    for (const f of leerHoja(plan, "Maestro Clientes", 4)) {
      const nombre = limpiar(f["Cliente"]);
      if (!nombre) continue;
      const alias = String(f["Alias encontrados"] ?? "").split("|").map((a) => a.trim()).filter((a) => a && claveNombre(a) !== claveNombre(nombre));
      const servicios = ["SEO", "PAID", "EMAIL"].filter((s) => /^(si|sí|x|1|true)$/i.test(String(f[s] ?? "").trim()));
      const estado = limpiar(f["Estado"]);
      await asegurarCliente(nombre, {
        id: limpiar(f["ID_Cliente"]) ?? undefined,
        alias,
        estado: estado && ["Activo", "Pausado", "Baja", "Revisar"].includes(estado) ? estado : "Revisar",
        account: limpiar(f["Account"]),
        servicios,
        jiraProjectKey: limpiar(f["Project Key Jira"]) === "Completar" ? null : limpiar(f["Project Key Jira"]),
        jiraProjectId: limpiar(f["ProjectId"]),
        jiraIssueType: limpiar(f["IssueType"]),
        slackCanal: idCanalSlack(f["Canal Slack"]),
        trelloTablero: limpiar(f["Tablero Trello"]),
      });
    }
  }
  for (const f of leerHoja(sheet, "Asignación JIRA y Slack")) {
    const nombre = limpiar(f["Cliente"]);
    if (!nombre) continue;
    await asegurarCliente(nombre, {
      jiraProjectKey: limpiar(f["ProjectKey"]),
      jiraProjectId: limpiar(f["ProjectI"]) ?? limpiar(f["ProjectId"]),
      jiraIssueType: limpiar(f["IssueTy"]) ?? limpiar(f["IssueType"]),
      slackCanal: idCanalSlack(f["Slack channel"]),
      trelloTablero: limpiar(f["Trello"]),
    });
  }

  /* ---------- Analistas ---------- */
  const analistasDb = await db.select().from(analistas);
  const analistaPorClave = new Map(analistasDb.map((a) => [claveNombre(a.nombre), a]));
  async function asegurarAnalista(nombre: string, datos: Partial<typeof analistas.$inferInsert> = {}) {
    const clave = claveNombre(nombre);
    const previo = analistaPorClave.get(clave);
    if (previo) {
      const cambios: Partial<typeof analistas.$inferInsert> = {};
      if (!previo.jiraAccountId && datos.jiraAccountId) cambios.jiraAccountId = datos.jiraAccountId;
      if (!previo.area && datos.area) cambios.area = datos.area;
      if (Object.keys(cambios).length) {
        const [act] = await db.update(analistas).set(cambios).where(eq(analistas.id, previo.id)).returning();
        analistaPorClave.set(clave, act);
        return act;
      }
      return previo;
    }
    const [nuevo] = await db.insert(analistas).values({ ...datos, nombre: nombre.trim() }).returning();
    analistaPorClave.set(clave, nuevo);
    resumen.analistasNuevos++;
    return nuevo;
  }
  if (plan) {
    for (const f of leerHoja(plan, "Maestro Analistas", 4)) {
      const nombre = limpiar(f["Analista"]);
      if (!nombre) continue;
      const accountId = limpiar(f["AccountId Jira"]);
      await asegurarAnalista(nombre, {
        jiraAccountId: accountId === "FALTA" ? null : accountId,
        area: limpiar(f["Área"]) ?? limpiar(f["Etiqueta principal"]),
      });
    }
  }
  for (const f of leerHoja(sheet, "Analistas")) {
    const nombre = limpiar(f["Analista"]);
    if (nombre) await asegurarAnalista(nombre, { jiraAccountId: limpiar(f["AnalistaAccountId"]) });
  }

  /* ---------- Reuniones ---------- */
  const reunionesDb = await db.select({ id: reuniones.id, linkDoc: reuniones.linkDoc }).from(reuniones);
  const links = new Set(reunionesDb.map((r) => r.linkDoc).filter(Boolean));
  let ultimaReunion = Math.max(0, ...reunionesDb.map((r) => numeroDeId(r.id)));
  const nuevasReuniones: (typeof reuniones.$inferInsert)[] = [];
  let reunionesSinDatos = 0;
  for (const f of leerHoja(sheet, "Reuniones")) {
    const nombre = limpiar(f["Cliente"]);
    const fecha = aFechaISO(f["Fecha"]);
    const link = limpiar(f["LinkDoc"]);
    if (!nombre || !fecha || !link) {
      reunionesSinDatos++;
      continue;
    }
    if (links.has(link) || !pareceCliente(nombre, "Reuniones")) continue;
    links.add(link);
    const cliente = await asegurarCliente(nombre);
    const trello = limpiar(f["Minuta Trello"]);
    nuevasReuniones.push({
      id: formatoId("REU", ++ultimaReunion),
      clienteId: cliente.id,
      fecha,
      area: limpiar(f["AREA"]) ?? "MKT",
      linkDoc: link,
      minutaDepurada: limpiar(f["Minuta depurada"]),
      minutaTrello: trello && trello !== "No configurado" ? trello : null,
      procesada: String(f["Estado"] ?? "").toUpperCase() === "PROCESADO",
      origen: "sheet",
    });
  }
  for (let i = 0; i < nuevasReuniones.length; i += 500) {
    await db.insert(reuniones).values(nuevasReuniones.slice(i, i + 500));
  }
  resumen.reunionesNuevas = nuevasReuniones.length;

  /* ---------- Tareas ---------- */
  const tareasDb = await db
    .select({ id: tareas.id, origenClave: tareas.origenClave, decision: tareas.decision, analistaId: tareas.analistaId, jiraKey: tareas.jiraKey, etiqueta: tareas.etiqueta })
    .from(tareas);
  const tareaPorClave = new Map(tareasDb.filter((t) => t.origenClave).map((t) => [t.origenClave!, t]));
  let ultimaTarea = Math.max(0, ...tareasDb.map((t) => numeroDeId(t.id)));
  const vistas = new Map<string, number>();
  const nuevasTareas: (typeof tareas.$inferInsert)[] = [];
  const eventos: (typeof tareaEventos.$inferInsert)[] = [];
  const DECISION: Record<string, string> = { SI: "Cargar", SÍ: "Cargar", NO: "No cargar", DESCARTADA: "Descartada" };

  for (const f of leerHoja(sheet, "Tareas")) {
    const nombre = limpiar(f["Cliente"]);
    const titulo = limpiar(f["Titulo"]);
    if (!nombre || !titulo || !pareceCliente(nombre, "Tareas")) continue;
    const descripcion = limpiar(f["Descripción"]);
    // La fila del sheet no tiene ID: se identifica por su contenido (y el número de repetición si hay filas iguales).
    const base = createHash("sha1").update([claveNombre(nombre), titulo, descripcion ?? ""].join("|")).digest("hex").slice(0, 16);
    const rep = (vistas.get(base) ?? 0) + 1;
    vistas.set(base, rep);
    const clave = `sheet:${base}:${rep}`;

    const cliente = await asegurarCliente(nombre);
    const nombreAnalista = limpiar(f["Analista"]);
    const analista = nombreAnalista ? await asegurarAnalista(nombreAnalista) : null;
    const decision = DECISION[String(f["Cargar"] ?? "").trim().toUpperCase()] ?? "Pendiente";
    const jiraKey = jiraKeyDeLink(f["JIRA LINK"]);
    const etiquetaSheet = limpiar(f["Etiqueta"])?.toUpperCase() ?? null;
    const etiqueta = etiquetaSheet && ["SEO", "PAID", "EMAIL", "OTRO"].includes(etiquetaSheet) ? etiquetaSheet : null;

    const previa = tareaPorClave.get(clave);
    if (!previa) {
      nuevasTareas.push({
        id: formatoId("TAR", ++ultimaTarea),
        clienteId: cliente.id,
        titulo,
        descripcion,
        etiqueta,
        analistaId: analista?.id ?? null,
        decision,
        jiraKey,
        // Sin sync de Jira no se sabe si la tarea se terminó: queda "Sin seguimiento" hasta conectarlo.
        estado: decision === "Cargar" ? "Sin seguimiento" : "Por hacer",
        origen: "sheet",
        origenClave: clave,
      });
      continue;
    }
    const cambios: Partial<typeof tareas.$inferInsert> = {};
    const registrar = (campo: string, antes: unknown, despues: unknown) =>
      eventos.push({ tareaId: previa.id, usuario: "Importación del sheet", tipo: "cambio", campo, valorAnterior: antes == null ? null : String(antes), valorNuevo: despues == null ? null : String(despues) });
    if (previa.decision !== decision && decision !== "Pendiente") {
      cambios.decision = decision;
      registrar("decision", previa.decision, decision);
    }
    if (analista && previa.analistaId !== analista.id) {
      cambios.analistaId = analista.id;
      registrar("analista", previa.analistaId, analista.nombre);
    }
    if (jiraKey && previa.jiraKey !== jiraKey) {
      cambios.jiraKey = jiraKey;
      registrar("jira", previa.jiraKey, jiraKey);
    }
    if (etiqueta && previa.etiqueta !== etiqueta) {
      cambios.etiqueta = etiqueta;
      registrar("etiqueta", previa.etiqueta, etiqueta);
    }
    if (Object.keys(cambios).length) {
      await db.update(tareas).set({ ...cambios, actualizadoEn: new Date() }).where(eq(tareas.id, previa.id));
      resumen.tareasActualizadas++;
    }
  }
  for (let i = 0; i < nuevasTareas.length; i += 500) {
    const lote = nuevasTareas.slice(i, i + 500);
    await db.insert(tareas).values(lote);
    await db.insert(tareaEventos).values(
      lote.map((t) => ({ tareaId: t.id!, usuario: "Importación del sheet", tipo: "creada", comentario: "Importada del sheet de automatización" }))
    );
  }
  if (eventos.length) await db.insert(tareaEventos).values(eventos);
  resumen.tareasNuevas = nuevasTareas.length;

  console.log("Importación terminada:", resumen);
  if (filasDescartadas.length) console.log("Filas omitidas porque la columna Cliente no tiene un cliente válido:\n  " + filasDescartadas.join("\n  "));
  if (reunionesSinDatos) console.log(`Se omitieron ${reunionesSinDatos} filas de Reuniones sin cliente, fecha o link.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
