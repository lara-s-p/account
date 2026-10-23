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
