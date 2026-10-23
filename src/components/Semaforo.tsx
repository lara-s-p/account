import { NIVELES } from "@/db/schema";

const ESTILO: Record<number, string> = {
  1: "bg-ok-suave text-ok",
  2: "bg-[#d3ecdd] text-[#155c39]",
  3: "bg-alerta-suave text-alerta",
  4: "bg-[#ffe1a6] text-[#6d4300]",
  5: "bg-critico-suave text-critico",
  6: "bg-critico text-white",
};
const PUNTO: Record<number, string> = { 1: "🟢", 2: "🟢", 3: "🟡", 4: "🟡", 5: "🔴", 6: "🔴" };

export const infoNivel = (nivel: number) => NIVELES.find((n) => n.nivel === nivel)!;
export const emojiNivel = (nivel: number) => PUNTO[nivel];

/** Etiqueta del semáforo con el color de la escala de la planilla. */
export function PillNivel({ nivel, corto = false }: { nivel: number; corto?: boolean }) {
  const n = infoNivel(nivel);
  return (
    <span title={`${n.color}: ${n.queMirar}`} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${ESTILO[nivel]}`}>
      <span aria-hidden>{PUNTO[nivel]}</span>
      {corto ? n.color : n.nombre}
    </span>
  );
}

/** Cómo cambió respecto de la semana anterior. */
export function Tendencia({ actual, anterior }: { actual?: number | null; anterior?: number | null }) {
  if (actual == null || anterior == null) return <span className="text-xs text-suave">—</span>;
  if (actual > anterior) return <span className="text-xs font-semibold text-critico">▲ Empeoró</span>;
  if (actual < anterior) return <span className="text-xs font-semibold text-ok">▼ Mejoró</span>;
  return <span className="text-xs text-suave">= Igual</span>;
}
