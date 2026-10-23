"use client";

import { useState, useTransition } from "react";
import { sincronizarAhora } from "@/app/acciones";
import type { ResumenSync } from "@/lib/sync-jira";

const formato = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" });

/** `cuandoUltima` viene formateada del servidor: formatearla acá daría otro texto que el del HTML inicial. */
export function BotonSincronizar({ ultima, cuandoUltima, conectado }: { ultima: ResumenSync | null; cuandoUltima: string | null; conectado: boolean }) {
  const [sincronizando, iniciar] = useTransition();
  const [resultado, setResultado] = useState<ResumenSync | null>(null);
  const r = resultado ?? ultima;
  const cuando = resultado ? formato.format(new Date(resultado.fecha)) : cuandoUltima;
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-suave">
        {!conectado
          ? "Jira no está conectado: los estados no se actualizan solos."
          : r
            ? r.error
              ? `Última sincronización con Jira (${cuando}) con error: ${r.error}`
              : `Estados de Jira al ${cuando}: ${r.revisadas} revisadas, ${r.actualizadas} con cambios.`
            : "Todavía no se sincronizó con Jira."}
      </span>
      {conectado && (
        <button className="boton-secundario" disabled={sincronizando} onClick={() => iniciar(async () => setResultado(await sincronizarAhora()))}>
          {sincronizando ? "Sincronizando…" : "Sincronizar ahora"}
        </button>
      )}
    </div>
  );
}
