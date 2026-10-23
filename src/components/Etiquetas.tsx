const TONOS: Record<string, string> = {
  ok: "bg-ok-suave text-ok",
  alerta: "bg-alerta-suave text-alerta",
  critico: "bg-critico-suave text-critico",
  marca: "bg-marca-suave text-marca-oscuro",
  neutro: "bg-fondo text-suave border border-linea",
};

export function Pill({ children, tono = "neutro", titulo }: { children: React.ReactNode; tono?: keyof typeof TONOS; titulo?: string }) {
  return (
    <span title={titulo} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${TONOS[tono]}`}>
      {children}
    </span>
  );
}

const TONO_DECISION: Record<string, keyof typeof TONOS> = { Pendiente: "alerta", Cargar: "ok", "No cargar": "neutro", Descartada: "neutro" };
const TONO_ESTADO: Record<string, keyof typeof TONOS> = { "Por hacer": "neutro", "En curso": "marca", Bloqueada: "critico", Hecha: "ok", "Sin seguimiento": "neutro" };
const TONO_CLIENTE: Record<string, keyof typeof TONOS> = { Activo: "ok", Pausado: "alerta", Baja: "neutro", Revisar: "alerta" };

export const PillDecision = ({ valor }: { valor: string }) => <Pill tono={TONO_DECISION[valor]}>{valor}</Pill>;
export const PillEstado = ({ valor }: { valor: string }) => <Pill tono={TONO_ESTADO[valor]}>{valor}</Pill>;
export const PillCliente = ({ valor }: { valor: string }) => <Pill tono={TONO_CLIENTE[valor]}>{valor}</Pill>;

export function Encabezado({ titulo, detalle, children }: { titulo: string; detalle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight">{titulo}</h1>
        {detalle && <div className="mt-1 text-suave">{detalle}</div>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-semibold text-suave">{etiqueta}</div>
      <div className="mt-0.5 break-words">{children || <span className="text-suave">—</span>}</div>
    </div>
  );
}
