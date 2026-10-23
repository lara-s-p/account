"use client";

import { useTransition } from "react";
import { decidirPendientes } from "@/app/acciones";

export function BotonesDecision({ reunionId, pendientes }: { reunionId: string; pendientes: number }) {
  const [enviando, iniciar] = useTransition();
  if (!pendientes) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <button className="boton" disabled={enviando} onClick={() => iniciar(() => decidirPendientes(reunionId, "Cargar"))}>
        Cargar las {pendientes} pendientes
      </button>
      <button className="boton-secundario" disabled={enviando} onClick={() => iniciar(() => decidirPendientes(reunionId, "No cargar"))}>
        No cargar ninguna
      </button>
    </div>
  );
}
