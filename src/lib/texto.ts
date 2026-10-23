/** Clave para comparar nombres: sin tildes, sin mayúsculas y sin espacios de más. */
export function claveNombre(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function limpiar(s: unknown): string | null {
  const t = String(s ?? "").trim();
  return t && t !== "|||" ? t : null;
}

export function jiraKeyDeLink(link: unknown): string | null {
  const m = String(link ?? "").match(/browse\/([A-Z0-9]+-\d+)/);
  return m ? m[1] : null;
}

export function formatoId(prefijo: string, n: number, ancho = 6): string {
  return `${prefijo}-${String(n).padStart(ancho, "0")}`;
}

export function numeroDeId(id: string | null | undefined): number {
  const m = String(id ?? "").match(/-(\d+)$/);
  return m ? Number(m[1]) : 0;
}
