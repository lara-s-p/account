"use server";

import { and, desc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import {
  ACCIONES_JIRA,
  estadosSemanales,
  NIVELES,
  analistas,
  clientes,
  DECISIONES,
  ESTADOS_CLIENTE,
  ESTADOS_TAREA,
  ETIQUETAS,
  SERVICIOS,
  PRIORIDADES,
  RESPONSABLES,
  reuniones,
  tareaEventos,
  tareas,
  type Contacto,
} from "@/db/schema";
import { sugerenciasAnalista } from "@/lib/consultas";
import { fechaCorta } from "@/lib/fechas";
import { leerGoogleDoc } from "@/lib/google-docs";
import { comentarIssue, crearIssue, ErrorJira, issuesAbiertos, jiraConfigurado, urlIssue } from "@/lib/jira";
import { idCanal, publicarEnSlack, slackConfigurado } from "@/lib/slack";
import { crearTarjetaMinuta, idTablero, trelloConfigurado } from "@/lib/trello";
import { sincronizarJira } from "@/lib/sync-jira";
import { generarEstado, generarSemana } from "@/lib/semana";
import { enviarAlerta } from "@/lib/alerta";
import { proponerFicha, type PropuestaFicha } from "@/lib/propuesta-ficha";
import { procesarMinutaConClaude } from "@/lib/minuta";
import { requerirUsuario } from "@/lib/sesion";
import { claveNombre, formatoId } from "@/lib/texto";

type DB = Awaited<ReturnType<typeof getDb>>;

async function siguienteId(db: DB, tabla: "clientes" | "reuniones" | "tareas", prefijo: string, ancho: number) {
  const t = { clientes, reuniones, tareas }[tabla];
  const [{ max }] = await db.select({ max: sql<number>`coalesce(max(substring(${t.id} from '[0-9]+$')::int), 0)` }).from(t);
  return (n = 1) => formatoId(prefijo, Number(max) + n, ancho);
}

const texto = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v || null;
};

/* ===================== Clientes ===================== */

export type EstadoFormulario = { error?: string; ok?: string } | undefined;

export async function guardarCliente(_prev: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirUsuario();
  const db = await getDb();
  const id = texto(fd, "id");
  const nombre = texto(fd, "nombre");
  if (!nombre) return { error: "El nombre del cliente es obligatorio." };

  const nombres = fd.getAll("contacto_nombre").map(String);
  const contactos: Contacto[] = nombres
    .map((n, i) => ({
      nombre: n.trim(),
      cargo: String(fd.getAll("contacto_cargo")[i] ?? "").trim() || undefined,
      email: String(fd.getAll("contacto_email")[i] ?? "").trim() || undefined,
      telefono: String(fd.getAll("contacto_telefono")[i] ?? "").trim() || undefined,
    }))
    .filter((c) => c.nombre);
  const estado = texto(fd, "estado") ?? "Revisar";
  const datos = {
    nombre,
    alias: String(fd.get("alias") ?? "").split(",").map((a) => a.trim()).filter(Boolean),
    estado: (ESTADOS_CLIENTE as readonly string[]).includes(estado) ? estado : "Revisar",
    account: texto(fd, "account"),
    accountApoyo: texto(fd, "accountApoyo"),
    prioridad: texto(fd, "prioridad") ? Number(texto(fd, "prioridad")) : null,
    analistaSeoId: texto(fd, "analistaSeoId") ? Number(texto(fd, "analistaSeoId")) : null,
    analistaPaidId: texto(fd, "analistaPaidId") ? Number(texto(fd, "analistaPaidId")) : null,
    analistaEmailId: texto(fd, "analistaEmailId") ? Number(texto(fd, "analistaEmailId")) : null,
    disenadora: texto(fd, "disenadora"),
    redactora: texto(fd, "redactora"),
    plataformaEmail: texto(fd, "plataformaEmail"),
    lookerStudio: texto(fd, "lookerStudio"),
    blueprint: texto(fd, "blueprint"),
    industria: texto(fd, "industria"),
    pais: texto(fd, "pais"),
    sitioWeb: texto(fd, "sitioWeb"),
    plataformaEcommerce: texto(fd, "plataformaEcommerce"),
    descripcionNegocio: texto(fd, "descripcionNegocio"),
    objetivosNegocio: texto(fd, "objetivosNegocio"),
    competidores: texto(fd, "competidores"),
    servicios: fd.getAll("servicios").map(String).filter((s) => (SERVICIOS as readonly string[]).includes(s)),
    feeMensual: texto(fd, "feeMensual"),
    fechaInicio: texto(fd, "fechaInicio"),
    frecuenciaReunion: texto(fd, "frecuenciaReunion"),
    contactos,
    jiraProjectKey: texto(fd, "jiraProjectKey"),
    jiraProjectId: texto(fd, "jiraProjectId"),
    jiraIssueType: texto(fd, "jiraIssueType"),
    slackCanal: texto(fd, "slackCanal"),
    trelloTablero: texto(fd, "trelloTablero"),
    notas: texto(fd, "notas"),
    actualizadoEn: new Date(),
  };

  const todos = await db.select({ id: clientes.id, nombre: clientes.nombre }).from(clientes);
  if (todos.some((c) => c.id !== id && claveNombre(c.nombre) === claveNombre(nombre))) {
    return { error: `Ya existe un cliente llamado "${nombre}".` };
  }

  let destino = id;
  if (id) {
    await db.update(clientes).set(datos).where(eq(clientes.id, id));
  } else {
    destino = (await siguienteId(db, "clientes", "CLI", 3))();
    await db.insert(clientes).values({ ...datos, id: destino });
  }
  console.info(`Cliente ${destino} guardado por ${usuario.email}`);
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${destino}`);
  if (!id) redirect(`/clientes/${destino}`);
  return { ok: "Ficha guardada." };
}

/* ===================== Tareas ===================== */

const CAMPOS_TAREA = {
  decision: DECISIONES,
  estado: ESTADOS_TAREA,
  etiqueta: ETIQUETAS,
  prioridad: PRIORIDADES,
  responsable: RESPONSABLES,
  accionJira: ACCIONES_JIRA,
} as const;

type CampoEditable = keyof typeof CAMPOS_TAREA | "analistaId" | "fechaLimite" | "titulo" | "descripcion" | "objetivo";

export async function actualizarTarea(id: string, campo: CampoEditable, valor: string | null): Promise<{ error?: string }> {
  const usuario = await requerirUsuario();
  const db = await getDb();
  const [tarea] = await db.select().from(tareas).where(eq(tareas.id, id));
  if (!tarea) return { error: "La tarea no existe." };

  const v = valor?.trim() || null;
  const cambios: Partial<typeof tareas.$inferInsert> = { actualizadoEn: new Date() };
  let anterior: string | null = null;
  let nuevo: string | null = v;

  if (campo in CAMPOS_TAREA) {
    const opciones = CAMPOS_TAREA[campo as keyof typeof CAMPOS_TAREA] as readonly string[];
    if (v && !opciones.includes(v)) return { error: "Valor no válido." };
    if (!v && campo !== "etiqueta") return { error: "Elegí un valor." };
    anterior = tarea[campo as keyof typeof CAMPOS_TAREA];
    Object.assign(cambios, { [campo]: v });
    if (campo === "decision") {
      cambios.fechaDecision = v === "Pendiente" ? null : new Date();
      if (v === "Cargar" && tarea.estado === "Sin seguimiento") cambios.estado = "Por hacer";
    }
    if (campo === "estado") cambios.fechaCierre = v === "Hecha" ? new Date() : null;
  } else if (campo === "analistaId") {
    const lista = await db.select({ id: analistas.id, nombre: analistas.nombre }).from(analistas);
    const nombre = (n: number | null) => lista.find((a) => a.id === n)?.nombre ?? null;
    const nuevoId = v ? Number(v) : null;
    if (nuevoId && !nombre(nuevoId)) return { error: "El analista no existe." };
    anterior = nombre(tarea.analistaId);
    nuevo = nombre(nuevoId);
    cambios.analistaId = nuevoId;
  } else if (campo === "fechaLimite") {
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { error: "Fecha no válida." };
    anterior = tarea.fechaLimite;
    cambios.fechaLimite = v;
  } else if (campo === "titulo" || campo === "descripcion" || campo === "objetivo") {
    if (campo === "titulo" && !v) return { error: "El título no puede quedar vacío." };
    anterior = tarea[campo];
    Object.assign(cambios, { [campo]: v });
  } else {
    return { error: "Campo no editable." };
  }

  if ((anterior ?? null) === (nuevo ?? null)) return {};
  await db.update(tareas).set(cambios).where(eq(tareas.id, id));
  await db.insert(tareaEventos).values({ tareaId: id, usuario: usuario.nombre, tipo: "cambio", campo, valorAnterior: anterior, valorNuevo: nuevo });
  revalidatePath("/tareas");
  revalidatePath("/bandeja");
  revalidatePath(`/tareas/${id}`);
  if (tarea.reunionId) revalidatePath(`/reuniones/${tarea.reunionId}`);
  return {};
}

export async function comentarTarea(_prev: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirUsuario();
  const id = texto(fd, "id");
  const comentario = texto(fd, "comentario");
  if (!id || !comentario) return { error: "Escribí un comentario." };
  const db = await getDb();
  await db.insert(tareaEventos).values({ tareaId: id, usuario: usuario.nombre, tipo: "comentario", comentario });
  revalidatePath(`/tareas/${id}`);
  return { ok: "Comentario agregado." };
}

export async function crearTarea(_prev: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirUsuario();
  const db = await getDb();
  const clienteId = texto(fd, "clienteId");
  const titulo = texto(fd, "titulo");
  if (!clienteId || !titulo) return { error: "Elegí el cliente y escribí el título." };
  const etiqueta = texto(fd, "etiqueta");
  const responsable = texto(fd, "responsable") ?? "Known";
  const sugerir = await sugerenciasAnalista(clienteId);
  const analistaElegido = texto(fd, "analistaId");
  const id = (await siguienteId(db, "tareas", "TAR", 6))();
  await db.insert(tareas).values({
    id,
    clienteId,
    reunionId: texto(fd, "reunionId"),
    titulo,
    descripcion: texto(fd, "descripcion"),
    responsable,
    etiqueta,
    analistaId: analistaElegido ? Number(analistaElegido) : responsable === "Known" ? sugerir(etiqueta) : null,
    analistaSugeridoId: sugerir(etiqueta),
    prioridad: texto(fd, "prioridad") ?? "Media",
    fechaLimite: texto(fd, "fechaLimite"),
  });
  await db.insert(tareaEventos).values({ tareaId: id, usuario: usuario.nombre, tipo: "creada", comentario: "Creada a mano" });
  revalidatePath("/tareas");
  redirect(`/tareas/${id}`);
}

/* ===================== Reuniones ===================== */

/**
 * Tareas abiertas del cliente con las que comparar las de la minuta nueva.
 * Si Jira está conectado se consultan ahí (estado real); si no, se usan las que la plataforma tiene con issue de Jira.
 */
async function tareasAbiertasParaComparar(cliente: typeof clientes.$inferSelect) {
  const proyecto = cliente.jiraProjectId || cliente.jiraProjectKey;
  if (jiraConfigurado() && proyecto) {
    try {
      return await issuesAbiertos(proyecto, 60);
    } catch (e) {
      console.error("No se pudieron leer las tareas abiertas de Jira", e);
    }
  }
  const db = await getDb();
  const filas = await db
    .select({ key: tareas.jiraKey, titulo: tareas.titulo, estado: tareas.estado })
    .from(tareas)
    .where(and(eq(tareas.clienteId, cliente.id), isNotNull(tareas.jiraKey), ne(tareas.estado, "Hecha"), eq(tareas.decision, "Cargar")))
    .orderBy(desc(tareas.id))
    .limit(60);
  return filas.map((f) => ({ key: f.key!, titulo: f.titulo, estado: f.estado }));
}

export async function cargarReunion(_prev: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirUsuario();
  const db = await getDb();
  const clienteId = texto(fd, "clienteId");
  const fecha = texto(fd, "fecha");
  const linkDoc = texto(fd, "linkDoc");
  let textoMinuta = texto(fd, "texto");
  if (!clienteId || !fecha) return { error: "Elegí el cliente y la fecha de la reunión." };
  if (!linkDoc && !textoMinuta) return { error: "Pegá el link de la minuta o su texto." };

  const [cliente] = await db.select().from(clientes).where(eq(clientes.id, clienteId));
  if (!cliente) return { error: "El cliente no existe." };
  if (linkDoc) {
    const [repetida] = await db.select({ id: reuniones.id }).from(reuniones).where(eq(reuniones.linkDoc, linkDoc));
    if (repetida) return { error: `Esa minuta ya está cargada (${repetida.id}).` };
  }

  try {
    if (!textoMinuta && linkDoc) {
      if (!usuario.googleAccessToken) {
        return { error: "Para leer el documento hace falta tu sesión de Google. Cerrá sesión y volvé a entrar, o pegá el texto de la minuta." };
      }
      textoMinuta = await leerGoogleDoc(linkDoc, usuario.googleAccessToken);
    }
    const listaAnalistas = await db.select().from(analistas).where(eq(analistas.activo, true));
    const abiertas = await tareasAbiertasParaComparar(cliente);
    const resultado = await procesarMinutaConClaude({
      abiertas,
      texto: textoMinuta!,
      cliente: cliente.nombre,
      fecha,
      analistas: listaAnalistas.map((a) => a.nombre),
      serviciosContratados: cliente.servicios,
    });

    const sugerir = await sugerenciasAnalista(clienteId);
    const porNombre = new Map(listaAnalistas.map((a) => [claveNombre(a.nombre), a.id]));
    const idReunion = (await siguienteId(db, "reuniones", "REU", 6))();
    const idTarea = await siguienteId(db, "tareas", "TAR", 6);

    await db.transaction(async (tx) => {
      await tx.insert(reuniones).values({
        id: idReunion,
        clienteId,
        fecha,
        tipo: texto(fd, "tipo"),
        linkDoc,
        textoMinuta,
        procesada: true,
        resumen: resultado.resumen,
        decisiones: resultado.decisiones,
        compromisosCliente: resultado.tareas.filter((t) => t.responsable === "Cliente").map((t) => t.titulo),
        oportunidades: resultado.oportunidades,
        riesgos: resultado.riesgos,
        minutaCompleta: resultado.minuta_completa,
        resumenSlack: resultado.resumen_slack,
        tonoCliente: resultado.tono_cliente,
        creadoPor: usuario.email,
      });
      if (resultado.tareas.length) {
        const filas = resultado.tareas.map((t, i) => {
          const sugerido = sugerir(t.etiqueta);
          const mencionado = t.analista_mencionado ? porNombre.get(claveNombre(t.analista_mencionado)) : undefined;
          const fechaValida = t.fecha_limite && /^\d{4}-\d{2}-\d{2}$/.test(t.fecha_limite) ? t.fecha_limite : null;
          const relacionada = t.responsable === "Known" && t.relacionada_con && abiertas.some((a) => a.key === t.relacionada_con) ? t.relacionada_con : null;
          return {
            id: idTarea(i + 1),
            clienteId,
            reunionId: idReunion,
            titulo: t.titulo,
            descripcion: t.descripcion,
            responsable: t.responsable,
            etiqueta: t.etiqueta,
            prioridad: t.prioridad,
            fechaLimite: fechaValida,
            analistaSugeridoId: t.responsable === "Known" ? sugerido : null,
            analistaId: t.responsable === "Known" ? mencionado ?? sugerido : null,
            jiraRelacionada: relacionada,
            motivoRelacion: relacionada ? t.motivo_relacion : null,
            accionJira: relacionada ? "comentar" : "crear",
          };
        });
        await tx.insert(tareas).values(filas);
        await tx.insert(tareaEventos).values(
          filas.map((t) => ({ tareaId: t.id, usuario: usuario.nombre, tipo: "creada", comentario: `Generada de la minuta del ${fechaCorta(fecha)}` }))
        );
      }
    });
    // Trello y Slack: si fallan no se pierde la minuta; el problema queda anotado en la reunión.
    const avisos = await publicarMinuta(cliente, idReunion, fecha, resultado.minuta_completa, resultado.resumen_slack);
    if (avisos.length) await db.update(reuniones).set({ avisos }).where(eq(reuniones.id, idReunion));
    revalidatePath("/reuniones");
    revalidatePath(`/clientes/${clienteId}`);
    redirect(`/bandeja#${idReunion}`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
    console.error("Error al procesar la minuta", e);
    return { error: e instanceof Error ? e.message : "No se pudo procesar la minuta. Probá de nuevo." };
  }
}

/** Crea la tarjeta de la minuta en Trello y publica el resumen en el canal de Slack del cliente. Devuelve los problemas. */
async function publicarMinuta(cliente: typeof clientes.$inferSelect, reunionId: string, fecha: string, minutaCompleta: string, resumen: string) {
  const db = await getDb();
  const avisos: string[] = [];
  const tablero = idTablero(cliente.trelloTablero);
  if (!trelloConfigurado()) avisos.push("Trello no está conectado: no se creó la tarjeta de la minuta.");
  else if (!tablero) avisos.push(`${cliente.nombre} no tiene tablero de Trello en la ficha: no se creó la tarjeta.`);
  else {
    try {
      const url = await crearTarjetaMinuta(tablero, `${cliente.nombre} - ${fechaCorta(fecha)}`, minutaCompleta);
      await db.update(reuniones).set({ minutaTrello: url }).where(eq(reuniones.id, reunionId));
    } catch (e) {
      avisos.push(`Trello: ${e instanceof Error ? e.message : "no se pudo crear la tarjeta."}`);
    }
  }
  const canal = idCanal(cliente.slackCanal);
  if (!slackConfigurado()) avisos.push("Slack no está conectado: no se publicó el resumen.");
  else if (!canal) avisos.push(`${cliente.nombre} no tiene canal de Slack en la ficha: no se publicó el resumen.`);
  else {
    try {
      await publicarEnSlack(canal, `*Minuta del ${fechaCorta(fecha)}*\n${resumen}`);
    } catch (e) {
      avisos.push(`Slack: ${e instanceof Error ? e.message : "no se pudo publicar el resumen."}`);
    }
  }
  return avisos;
}

/** Aplica la misma decisión a todas las tareas pendientes de una reunión. */
export async function decidirPendientes(reunionId: string, decision: "Cargar" | "No cargar") {
  const usuario = await requerirUsuario();
  const db = await getDb();
  const pendientes = await db
    .select({ id: tareas.id, estado: tareas.estado })
    .from(tareas)
    .where(and(eq(tareas.reunionId, reunionId), eq(tareas.decision, "Pendiente")));
  if (!pendientes.length) return;
  for (const t of pendientes) {
    await db.update(tareas).set({ decision, fechaDecision: new Date(), actualizadoEn: new Date() }).where(eq(tareas.id, t.id));
  }
  await db.insert(tareaEventos).values(
    pendientes.map((t) => ({ tareaId: t.id, usuario: usuario.nombre, tipo: "cambio", campo: "decision", valorAnterior: "Pendiente", valorNuevo: decision }))
  );
  revalidatePath(`/reuniones/${reunionId}`);
  revalidatePath("/bandeja");
  revalidatePath("/tareas");
}

/* ===================== Bandeja: envío a Jira y Slack ===================== */

export type ResultadoEnvio = { enviadas: number; comentadas: number; delCliente: number; errores: string[]; avisoSlack?: string };

/**
 * Envía las tareas aprobadas de una reunión (o las cargadas a mano de un cliente):
 * - las de Known se crean en Jira asignadas al analista, o se comentan en el issue existente si son repetidas;
 * - las del cliente no van a Jira: pasan directo a su perfil;
 * - al final se avisa en el canal de Slack del cliente con la lista y los links.
 * Las que fallan quedan en la bandeja con el motivo, para corregir y volver a enviar.
 */
export async function enviarTareas(grupo: { clienteId: string; reunionId: string | null }): Promise<ResultadoEnvio> {
  const usuario = await requerirUsuario();
  const db = await getDb();
  const resultado: ResultadoEnvio = { enviadas: 0, comentadas: 0, delCliente: 0, errores: [] };
  const [cliente] = await db.select().from(clientes).where(eq(clientes.id, grupo.clienteId));
  if (!cliente) return { ...resultado, errores: ["El cliente no existe."] };
  const [reunion] = grupo.reunionId ? await db.select().from(reuniones).where(and(eq(reuniones.id, grupo.reunionId), eq(reuniones.clienteId, cliente.id))) : [];
  if (grupo.reunionId && !reunion) return { ...resultado, errores: ["La reunión no existe."] };

  const aprobadas = await db
    .select({ tarea: tareas, analista: analistas })
    .from(tareas)
    .leftJoin(analistas, eq(analistas.id, tareas.analistaId))
    .where(
      and(
        eq(tareas.clienteId, cliente.id),
        reunion ? eq(tareas.reunionId, reunion.id) : isNull(tareas.reunionId),
        eq(tareas.origen, "plataforma"),
        eq(tareas.decision, "Cargar"),
        isNull(tareas.enviadaEn)
      )
    )
    .orderBy(tareas.id);
  if (!aprobadas.length) return { ...resultado, errores: ["No hay tareas aprobadas para enviar. Marcá como \"Cargar\" las que van."] };

  const deKnown = aprobadas.filter((a) => a.tarea.responsable === "Known");
  if (deKnown.length && !jiraConfigurado()) return { ...resultado, errores: ["Jira no está conectado todavía (faltan JIRA_EMAIL y JIRA_TOKEN)."] };
  if (deKnown.length && !cliente.jiraProjectId && !cliente.jiraProjectKey) {
    return { ...resultado, errores: [`${cliente.nombre} no tiene proyecto de Jira en la ficha.`] };
  }

  const lineas: string[] = [];
  const lineasCliente: string[] = [];
  const origen = reunion ? `la reunión del ${fechaCorta(reunion.fecha)}` : "tareas cargadas a mano";
  for (const { tarea, analista } of aprobadas) {
    const evento = (comentario: string) => db.insert(tareaEventos).values({ tareaId: tarea.id, usuario: usuario.nombre, tipo: "cambio", campo: "envio", comentario });
    try {
      if (tarea.responsable === "Cliente") {
        await db.update(tareas).set({ enviadaEn: new Date(), errorEnvio: null, estado: "Por hacer", actualizadoEn: new Date() }).where(eq(tareas.id, tarea.id));
        await evento("Confirmada como pendiente del cliente");
        lineasCliente.push(`• ${tarea.titulo}${tarea.fechaLimite ? ` (para el ${fechaCorta(tarea.fechaLimite)})` : ""}`);
        resultado.delCliente++;
        continue;
      }
      if (tarea.accionJira === "comentar" && tarea.jiraRelacionada) {
        const comentario = [`Seguimiento (${origen}): ${tarea.titulo}`, tarea.motivoRelacion ?? tarea.descripcion ?? ""].filter(Boolean).join("\n");
        await comentarIssue(tarea.jiraRelacionada, comentario);
        await db
          .update(tareas)
          .set({ jiraKey: tarea.jiraRelacionada, enviadaEn: new Date(), errorEnvio: null, estado: "Por hacer", actualizadoEn: new Date() })
          .where(eq(tareas.id, tarea.id));
        await evento(`Comentada en ${tarea.jiraRelacionada}`);
        lineas.push(`• Seguimiento en <${urlIssue(tarea.jiraRelacionada)}|${tarea.jiraRelacionada}>: ${tarea.titulo}`);
        resultado.comentadas++;
        continue;
      }
      if (!analista) throw new ErrorJira("No tiene analista asignado.");
      if (!analista.jiraAccountId) throw new ErrorJira(`${analista.nombre} no tiene su usuario de Jira cargado.`);
      const key = await crearIssue({
        proyectoId: cliente.jiraProjectId,
        proyectoKey: cliente.jiraProjectKey,
        tipoIssueId: cliente.jiraIssueType,
        titulo: tarea.titulo,
        descripcion: [tarea.descripcion, reunion ? `Surgió en ${origen}.` : null].filter(Boolean).join("\n"),
        responsableAccountId: analista.jiraAccountId,
        vencimiento: tarea.fechaLimite,
        etiqueta: tarea.etiqueta,
      });
      await db.update(tareas).set({ jiraKey: key, enviadaEn: new Date(), errorEnvio: null, estado: "Por hacer", actualizadoEn: new Date() }).where(eq(tareas.id, tarea.id));
      await evento(`Creada en Jira como ${key}`);
      lineas.push(`• <${urlIssue(key)}|${key}> ${tarea.titulo} — ${analista.nombre}${tarea.fechaLimite ? ` (vence ${fechaCorta(tarea.fechaLimite)})` : ""}`);
      resultado.enviadas++;
    } catch (e) {
      const motivo = e instanceof Error ? e.message : "Error desconocido";
      await db.update(tareas).set({ errorEnvio: motivo }).where(eq(tareas.id, tarea.id));
      resultado.errores.push(`${tarea.titulo}: ${motivo}`);
    }
  }

  // Aviso en el canal del cliente
  if (lineas.length || lineasCliente.length) {
    const canal = idCanal(cliente.slackCanal);
    const texto = [
      reunion ? `*Tareas de ${origen}*` : `*Tareas nuevas de ${cliente.nombre}*`,
      ...lineas,
      lineasCliente.length ? `\n*Pendientes de ${cliente.nombre}*` : "",
      ...lineasCliente,
    ]
      .filter(Boolean)
      .join("\n");
    if (!slackConfigurado()) resultado.avisoSlack = "Slack no está conectado: no se avisó en el canal.";
    else if (!canal) resultado.avisoSlack = `${cliente.nombre} no tiene canal de Slack en la ficha: no se avisó.`;
    else {
      try {
        await publicarEnSlack(canal, texto);
      } catch (e) {
        resultado.avisoSlack = e instanceof Error ? e.message : "No se pudo avisar en Slack.";
      }
    }
  }
  revalidatePath("/bandeja");
  revalidatePath("/tareas");
  if (reunion) revalidatePath(`/reuniones/${reunion.id}`);
  revalidatePath(`/clientes/${cliente.id}`);
  return resultado;
}

/* ===================== Jira → plataforma ===================== */

export async function sincronizarAhora() {
  await requerirUsuario();
  const resumen = await sincronizarJira();
  revalidatePath("/tareas");
  revalidatePath("/");
  return resumen;
}

/* ===================== Estado semanal ===================== */

export async function generarEstadosSemana(semana: string) {
  await requerirUsuario();
  const r = await generarSemana(semana, { limiteMs: 270_000 });
  revalidatePath("/semana");
  return r;
}

export async function analizarClienteSemana(clienteId: string, semana: string): Promise<{ error?: string }> {
  await requerirUsuario();
  const db = await getDb();
  const [cliente] = await db.select().from(clientes).where(eq(clientes.id, clienteId));
  if (!cliente) return { error: "El cliente no existe." };
  try {
    await generarEstado(cliente, semana, { pisarAjustes: true });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo analizar el cliente." };
  }
  revalidatePath("/semana");
  revalidatePath(`/clientes/${clienteId}`);
  return {};
}

/** El account corrige el nivel o el motivo: queda registrado quién lo ajustó y qué había propuesto Claude. */
export async function ajustarEstado(_prev: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirUsuario();
  const db = await getDb();
  const clienteId = texto(fd, "clienteId");
  const semana = texto(fd, "semana");
  const nivel = Number(texto(fd, "nivel"));
  const motivo = texto(fd, "motivo");
  const info = NIVELES.find((n) => n.nivel === nivel);
  if (!clienteId || !semana || !info) return { error: "Elegí un nivel." };
  const [previo] = await db.select().from(estadosSemanales).where(and(eq(estadosSemanales.clienteId, clienteId), eq(estadosSemanales.semana, semana)));
  if (previo) {
    await db
      .update(estadosSemanales)
      .set({
        nivel,
        semaforo: info.nombre,
        motivo: motivo ?? previo.motivo,
        nivelSugerido: previo.origen === "ia" ? (previo.nivelSugerido ?? previo.nivel) : previo.nivelSugerido,
        ajustadoPor: usuario.nombre,
        actualizadoEn: new Date(),
      })
      .where(eq(estadosSemanales.id, previo.id));
  } else {
    await db.insert(estadosSemanales).values({ clienteId, semana, nivel, semaforo: info.nombre, motivo, origen: "manual", ajustadoPor: usuario.nombre, creadoPor: usuario.nombre });
  }
  revalidatePath("/semana");
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: "Semáforo actualizado." };
}

export async function enviarAlertaAhora(semana: string) {
  await requerirUsuario();
  return enviarAlerta(semana);
}

/* ===================== Propuesta de ficha ===================== */

export async function proponerFichaAccion(clienteId: string): Promise<{ propuesta?: PropuestaFicha; error?: string }> {
  const usuario = await requerirUsuario();
  const db = await getDb();
  const [cliente] = await db.select().from(clientes).where(eq(clientes.id, clienteId));
  if (!cliente) return { error: "El cliente no existe." };
  try {
    return { propuesta: await proponerFicha(cliente, usuario.googleAccessToken) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo armar la propuesta." };
  }
}
