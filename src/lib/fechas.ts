const ZONA = "America/Argentina/Buenos_Aires";

/** Fecha de hoy en Argentina, en formato YYYY-MM-DD. */
export function hoyISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());
}

export function sumarDias(iso: string, dias: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diasEntre(desdeISO: string, hastaISO: string): number {
  return Math.round((Date.parse(hastaISO + "T12:00:00Z") - Date.parse(desdeISO + "T12:00:00Z")) / 86_400_000);
}

/** 2026-10-23 → 23/10/2026 */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function fechaHora(fecha: Date | string | null | undefined): string {
  if (!fecha) return "—";
  return new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, dateStyle: "short", timeStyle: "short" }).format(new Date(fecha));
}
