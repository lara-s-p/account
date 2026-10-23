import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const ESTADOS_CLIENTE = ["Activo", "Pausado", "Baja", "Revisar"] as const;
export const ETIQUETAS = ["SEO", "PAID", "EMAIL", "OTRO"] as const;
export const PRIORIDADES = ["Alta", "Media", "Baja"] as const;
export const DECISIONES = ["Pendiente", "Cargar", "No cargar", "Descartada"] as const;
export const ESTADOS_TAREA = ["Por hacer", "En curso", "Bloqueada", "Hecha", "Sin seguimiento"] as const;
export const RESPONSABLES = ["Known", "Cliente"] as const;
export const SEMAFOROS = ["Verde", "Amarillo", "Rojo"] as const;
/** Servicios que vende la agencia, con el código que usa la planilla de Gestión Interna. */
export const SERVICIOS = ["SEO", "Content", "Paid", "Email", "Diseño", "BI", "Soporte evolutivo", "Redes"] as const;
export const CODIGOS_SERVICIO: Record<string, (typeof SERVICIOS)[number]> = {
  S: "SEO",
  C: "Content",
  P: "Paid",
  A: "Email",
  D: "Diseño",
  B: "BI",
  E: "Soporte evolutivo",
  CM: "Redes",
};
/** Qué hacer en Jira con una tarea aprobada: crear un issue nuevo o comentar en uno existente. */
export const ACCIONES_JIRA = ["crear", "comentar"] as const;

export type Contacto = { nombre: string; cargo?: string; email?: string; telefono?: string };

const timestamps = {
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
};

export const clientes = pgTable("clientes", {
  id: text("id").primaryKey(), // CLI-001
  nombre: text("nombre").notNull().unique(),
  alias: text("alias").array().notNull().default(sql`'{}'::text[]`),
  estado: text("estado").notNull().default("Revisar"),
  account: text("account"),
  accountApoyo: text("account_apoyo"),
  prioridad: integer("prioridad"), // prioridad estratégica, 1 a 5
  // Negocio
  industria: text("industria"),
  pais: text("pais"),
  sitioWeb: text("sitio_web"),
  plataformaEcommerce: text("plataforma_ecommerce"),
  descripcionNegocio: text("descripcion_negocio"),
  objetivosNegocio: text("objetivos_negocio"),
  competidores: text("competidores"),
  // Servicio contratado
  servicios: text("servicios").array().notNull().default(sql`'{}'::text[]`),
  feeMensual: text("fee_mensual"),
  fechaInicio: date("fecha_inicio"),
  frecuenciaReunion: text("frecuencia_reunion"),
  // Equipo asignado
  analistaSeoId: integer("analista_seo_id"),
  analistaEmailId: integer("analista_email_id"),
  analistaPaidId: integer("analista_paid_id"),
  disenadora: text("disenadora"),
  redactora: text("redactora"),
  contactos: jsonb("contactos").$type<Contacto[]>().notNull().default([]),
  // Integraciones
  jiraProjectKey: text("jira_project_key"),
  jiraProjectId: text("jira_project_id"),
  jiraIssueType: text("jira_issue_type"),
  slackCanal: text("slack_canal"),
  trelloTablero: text("trello_tablero"),
  plataformaEmail: text("plataforma_email"),
  lookerStudio: text("looker_studio"),
  blueprint: text("blueprint"),
  notas: text("notas"),
  ...timestamps,
});

export const analistas = pgTable("analistas", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull().unique(),
  email: text("email"),
  jiraAccountId: text("jira_account_id"),
  area: text("area"),
  capacidadSemanal: integer("capacidad_semanal"),
  activo: boolean("activo").notNull().default(true),
  ...timestamps,
});

export const reuniones = pgTable(
  "reuniones",
  {
    id: text("id").primaryKey(), // REU-000001
    clienteId: text("cliente_id").notNull().references(() => clientes.id),
    fecha: date("fecha").notNull(),
    area: text("area").notNull().default("MKT"),
    tipo: text("tipo"),
    linkDoc: text("link_doc"),
    minutaDepurada: text("minuta_depurada"),
    minutaTrello: text("minuta_trello"),
    textoMinuta: text("texto_minuta"),
    procesada: boolean("procesada").notNull().default(false),
    resumen: text("resumen"),
    decisiones: text("decisiones").array().notNull().default(sql`'{}'::text[]`),
    compromisosCliente: text("compromisos_cliente").array().notNull().default(sql`'{}'::text[]`),
    oportunidades: text("oportunidades").array().notNull().default(sql`'{}'::text[]`),
    riesgos: text("riesgos").array().notNull().default(sql`'{}'::text[]`),
    minutaCompleta: text("minuta_completa"),
    resumenSlack: text("resumen_slack"),
    // Problemas al crear la tarjeta de Trello o publicar en Slack (no frenan la carga de la minuta).
    avisos: text("avisos").array().notNull().default(sql`'{}'::text[]`),
    tonoCliente: text("tono_cliente"),
    origen: text("origen").notNull().default("plataforma"), // plataforma | sheet
    creadoPor: text("creado_por"),
    ...timestamps,
  },
  (t) => [
    index("reuniones_cliente_fecha").on(t.clienteId, t.fecha),
    uniqueIndex("reuniones_link_doc").on(t.linkDoc),
  ]
);

export const tareas = pgTable(
  "tareas",
  {
    id: text("id").primaryKey(), // TAR-000001
    clienteId: text("cliente_id").notNull().references(() => clientes.id),
    reunionId: text("reunion_id").references(() => reuniones.id),
    titulo: text("titulo").notNull(),
    descripcion: text("descripcion"),
    responsable: text("responsable").notNull().default("Known"),
    etiqueta: text("etiqueta"),
    analistaId: integer("analista_id").references(() => analistas.id),
    analistaSugeridoId: integer("analista_sugerido_id").references(() => analistas.id),
    prioridad: text("prioridad").notNull().default("Media"),
    fechaLimite: date("fecha_limite"),
    decision: text("decision").notNull().default("Pendiente"),
    fechaDecision: timestamp("fecha_decision", { withTimezone: true }),
    estado: text("estado").notNull().default("Por hacer"),
    fechaCierre: timestamp("fecha_cierre", { withTimezone: true }),
    objetivo: text("objetivo"),
    jiraKey: text("jira_key"),
    estadoJira: text("estado_jira"),
    // Si se parece a un issue abierto, se puede comentar ahí en vez de crear uno nuevo.
    accionJira: text("accion_jira").notNull().default("crear"),
    jiraRelacionada: text("jira_relacionada"),
    motivoRelacion: text("motivo_relacion"),
    enviadaEn: timestamp("enviada_en", { withTimezone: true }),
    errorEnvio: text("error_envio"),
    origen: text("origen").notNull().default("plataforma"),
    origenClave: text("origen_clave").unique(), // fila del sheet, para no duplicar al reimportar
    ...timestamps,
  },
  (t) => [
    index("tareas_cliente").on(t.clienteId),
    index("tareas_reunion").on(t.reunionId),
    index("tareas_analista").on(t.analistaId),
  ]
);

/** Historial de cada tarea: quién cambió qué y cuándo. */
export const tareaEventos = pgTable(
  "tarea_eventos",
  {
    id: serial("id").primaryKey(),
    tareaId: text("tarea_id").notNull().references(() => tareas.id, { onDelete: "cascade" }),
    fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
    usuario: text("usuario"),
    tipo: text("tipo").notNull(), // creada | cambio | comentario
    campo: text("campo"),
    valorAnterior: text("valor_anterior"),
    valorNuevo: text("valor_nuevo"),
    comentario: text("comentario"),
  },
  (t) => [index("tarea_eventos_tarea").on(t.tareaId, t.fecha)]
);

/** Estado semanal de cada cliente: el historial de cartera. */
export const estadosSemanales = pgTable(
  "estados_semanales",
  {
    id: serial("id").primaryKey(),
    clienteId: text("cliente_id").notNull().references(() => clientes.id),
    semana: date("semana").notNull(), // lunes de la semana
    semaforo: text("semaforo").notNull(),
    puntaje: integer("puntaje"),
    resumen: text("resumen"),
    problemas: text("problemas"),
    foco: text("foco"),
    oportunidades: text("oportunidades"),
    paraDireccion: text("para_direccion"),
    metricas: jsonb("metricas").$type<Record<string, number | string | null>>().notNull().default({}),
    creadoPor: text("creado_por"),
    ...timestamps,
  },
  (t) => [uniqueIndex("estados_semanales_cliente_semana").on(t.clienteId, t.semana)]
);

/** Datos sueltos de funcionamiento, por ejemplo la última sincronización con Jira. */
export const ajustes = pgTable("ajustes", {
  clave: text("clave").primaryKey(),
  valor: jsonb("valor").$type<Record<string, unknown>>().notNull().default({}),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
});

export type Cliente = typeof clientes.$inferSelect;
export type Analista = typeof analistas.$inferSelect;
export type Reunion = typeof reuniones.$inferSelect;
export type Tarea = typeof tareas.$inferSelect;
export type TareaEvento = typeof tareaEventos.$inferSelect;
export type EstadoSemanal = typeof estadosSemanales.$inferSelect;
