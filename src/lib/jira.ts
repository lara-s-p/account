import "server-only";

/**
 * Cliente mínimo de la API REST de Jira Cloud.
 * Se configura con JIRA_BASE (por defecto knownonline.atlassian.net), JIRA_EMAIL y JIRA_TOKEN:
 * el mail y el token de API del usuario con el que se crean las tareas.
 */
const BASE = (process.env.JIRA_BASE || "https://knownonline.atlassian.net").replace(/\/$/, "");

export const jiraConfigurado = () => Boolean(process.env.JIRA_EMAIL && process.env.JIRA_TOKEN);

export const urlIssue = (key: string) => `${BASE}/browse/${key}`;

export class ErrorJira extends Error {}

async function jira<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  if (!jiraConfigurado()) throw new ErrorJira("Jira no está conectado: faltan JIRA_EMAIL y JIRA_TOKEN.");
  const auth = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`).toString("base64");
  const res = await fetch(BASE + ruta, {
    ...init,
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json", "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const cuerpo = await res.text();
    let detalle = cuerpo.slice(0, 300);
    try {
      const j = JSON.parse(cuerpo) as { errorMessages?: string[]; errors?: Record<string, string> };
      detalle = [...(j.errorMessages ?? []), ...Object.entries(j.errors ?? {}).map(([k, v]) => `${k}: ${v}`)].join("; ") || detalle;
    } catch {}
    if (res.status === 401) throw new ErrorJira("Jira rechazó el usuario o el token.");
    throw new ErrorJira(`Jira respondió ${res.status}: ${detalle}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Texto plano a Atlassian Document Format (un párrafo por línea). */
function adf(texto: string) {
  return {
    type: "doc",
    version: 1,
    content: texto
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => ({ type: "paragraph", content: [{ type: "text", text: l }] })),
  };
}

export type IssueAbierto = { key: string; titulo: string; estado: string };

/** Issues sin terminar de un proyecto, los más recientes primero. */
export async function issuesAbiertos(proyecto: string, limite = 50): Promise<IssueAbierto[]> {
  const r = await jira<{ issues: { key: string; fields: { summary: string; status: { name: string } } }[] }>("/rest/api/3/search/jql", {
    method: "POST",
    body: JSON.stringify({
      jql: `project = "${proyecto}" AND statusCategory != Done ORDER BY updated DESC`,
      fields: ["summary", "status"],
      maxResults: limite,
    }),
  });
  return r.issues.map((i) => ({ key: i.key, titulo: i.fields.summary, estado: i.fields.status.name }));
}

export async function crearIssue(datos: {
  proyectoId?: string | null;
  proyectoKey?: string | null;
  tipoIssueId?: string | null;
  titulo: string;
  descripcion: string;
  responsableAccountId?: string | null;
  vencimiento?: string | null;
  etiqueta?: string | null;
}): Promise<string> {
  const proyecto = datos.proyectoId ? { id: datos.proyectoId } : { key: datos.proyectoKey };
  const fields: Record<string, unknown> = {
    project: proyecto,
    issuetype: datos.tipoIssueId ? { id: datos.tipoIssueId } : { name: "Task" },
    summary: datos.titulo.slice(0, 250),
    description: adf(datos.descripcion || datos.titulo),
  };
  if (datos.responsableAccountId) fields.assignee = { accountId: datos.responsableAccountId };
  if (datos.vencimiento) fields.duedate = datos.vencimiento;
  if (datos.etiqueta) fields.labels = [datos.etiqueta];
  const r = await jira<{ key: string }>("/rest/api/3/issue", { method: "POST", body: JSON.stringify({ fields }) });
  return r.key;
}

export async function comentarIssue(key: string, texto: string): Promise<void> {
  await jira(`/rest/api/3/issue/${encodeURIComponent(key)}/comment`, { method: "POST", body: JSON.stringify({ body: adf(texto) }) });
}

export type DatosIssue = {
  key: string;
  estado: string;
  categoria: "new" | "indeterminate" | "done" | string;
  vencimiento: string | null;
  resuelta: string | null;
  creada: string | null;
  responsableAccountId: string | null;
};

type IssueApi = {
  key: string;
  fields: {
    status: { name: string; statusCategory: { key: string } };
    duedate: string | null;
    resolutiondate: string | null;
    created: string | null;
    assignee: { accountId: string } | null;
  };
};

async function buscarLote(claves: string[]): Promise<IssueApi[]> {
  const r = await jira<{ issues: IssueApi[] }>("/rest/api/3/search/jql", {
    method: "POST",
    body: JSON.stringify({
      jql: `key in (${claves.join(",")})`,
      fields: ["status", "duedate", "resolutiondate", "created", "assignee"],
      maxResults: claves.length,
    }),
  });
  return r.issues;
}

/**
 * Trae el estado de muchos issues en lotes de 100.
 * Si un lote falla porque alguna clave ya no existe (Jira rechaza toda la búsqueda), se parte en dos
 * hasta aislarla; las claves que no existen se devuelven aparte.
 */
export async function datosDeIssues(claves: string[]): Promise<{ issues: DatosIssue[]; inexistentes: string[] }> {
  const issues: IssueApi[] = [];
  const inexistentes: string[] = [];
  async function procesar(lote: string[]): Promise<void> {
    try {
      issues.push(...(await buscarLote(lote)));
    } catch (e) {
      if (!(e instanceof ErrorJira) || !/ 400:/.test(e.message)) throw e;
      if (lote.length === 1) {
        inexistentes.push(lote[0]);
        return;
      }
      const mitad = Math.ceil(lote.length / 2);
      await procesar(lote.slice(0, mitad));
      await procesar(lote.slice(mitad));
    }
  }
  for (let i = 0; i < claves.length; i += 100) await procesar(claves.slice(i, i + 100));
  return {
    inexistentes,
    issues: issues.map((i) => ({
      key: i.key,
      estado: i.fields.status.name,
      categoria: i.fields.status.statusCategory.key,
      vencimiento: i.fields.duedate,
      resuelta: i.fields.resolutiondate,
      creada: i.fields.created,
      responsableAccountId: i.fields.assignee?.accountId ?? null,
    })),
  };
}
