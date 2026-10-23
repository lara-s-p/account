"use client";

import { useState, useTransition } from "react";
import { actualizarTarea } from "@/app/acciones";

import type { Opcion } from "@/lib/opciones";

/** Un campo de la tarea que se guarda apenas se cambia, y queda registrado en el historial. */
export function CampoTarea({
  id,
  campo,
  valor,
  opciones,
  tipo = "select",
  vacio,
  etiqueta,
  className = "",
}: {
  id: string;
  campo: Parameters<typeof actualizarTarea>[1];
  valor: string | null;
  opciones?: Opcion[];
  tipo?: "select" | "date";
  vacio?: string;
  etiqueta: string;
  className?: string;
}) {
  const [actual, setActual] = useState(valor ?? "");
  const [recibido, setRecibido] = useState(valor);
  const [error, setError] = useState<string>();
  const [pendiente, iniciar] = useTransition();

  // Si el valor cambia desde el servidor (por ejemplo, una decisión en bloque), se muestra el nuevo.
  if (valor !== recibido) {
    setRecibido(valor);
    setActual(valor ?? "");
  }

  function guardar(nuevo: string) {
    const previo = actual;
    setActual(nuevo);
    setError(undefined);
    iniciar(async () => {
      const r = await actualizarTarea(id, campo, nuevo || null);
      if (r.error) {
        setActual(previo);
        setError(r.error);
      }
    });
  }

  const clase = `campo !w-auto !py-1 !px-2 text-xs ${pendiente ? "opacity-60" : ""} ${className}`;
  return (
    <span className="inline-flex flex-col">
      {tipo === "date" ? (
        <input type="date" aria-label={etiqueta} className={clase} value={actual} onChange={(e) => guardar(e.target.value)} disabled={pendiente} />
      ) : (
        <select aria-label={etiqueta} className={clase} value={actual} onChange={(e) => guardar(e.target.value)} disabled={pendiente}>
          {vacio !== undefined && <option value="">{vacio}</option>}
          {opciones?.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.texto}
            </option>
          ))}
        </select>
      )}
      {error && <span className="mt-0.5 text-xs text-critico">{error}</span>}
    </span>
  );
}
