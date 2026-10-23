"use client";

import { createContext, useCallback, useContext, useState } from "react";

type Aviso = { id: number; titulo: string; lineas: { texto: string; tono: "ok" | "critico" | "alerta" }[] };

const Contexto = createContext<((a: Omit<Aviso, "id">) => void) | null>(null);

/** Avisos a nivel de página: siguen visibles aunque desaparezca el grupo que los generó. */
export function AvisosProvider({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const agregar = useCallback((a: Omit<Aviso, "id">) => setAvisos((prev) => [{ ...a, id: Date.now() }, ...prev].slice(0, 5)), []);
  const COLOR = { ok: "text-ok", critico: "text-critico", alerta: "text-alerta" };
  return (
    <Contexto.Provider value={agregar}>
      {avisos.length > 0 && (
        <div className="mb-6 grid gap-2" role="status">
          {avisos.map((a) => (
            <div key={a.id} className="panel flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0 text-sm">
                <div className="font-semibold">{a.titulo}</div>
                {a.lineas.map((l) => (
                  <div key={l.texto} className={COLOR[l.tono]}>
                    {l.texto}
                  </div>
                ))}
              </div>
              <button className="text-sm text-suave hover:text-tinta" onClick={() => setAvisos((prev) => prev.filter((x) => x.id !== a.id))} aria-label="Cerrar aviso">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {children}
    </Contexto.Provider>
  );
}

export const useAvisos = () => useContext(Contexto);
