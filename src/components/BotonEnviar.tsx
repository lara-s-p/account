"use client";

import { useState, useTransition } from "react";
import { enviarTareas, type ResultadoEnvio } from "@/app/acciones";
import { useAvisos } from "@/components/Avisos";

function lineas(r: ResultadoEnvio) {
  const hechas = [
    r.enviadas && `${r.enviadas} creada(s) en Jira`,
    r.comentadas && `${r.comentadas} comentada(s) en tareas existentes`,
    r.delCliente && `${r.delCliente} pendiente(s) del cliente confirmadas`,
  ].filter((x): x is string => Boolean(x));
  return [
    ...(hechas.length ? [{ texto: hechas.join(" · ") + ".", tono: "ok" as const }] : []),
    ...r.errores.map((e) => ({ texto: e, tono: "critico" as const })),
    ...(r.avisoSlack ? [{ texto: r.avisoSlack, tono: "alerta" as const }] : []),
  ];
}

export function BotonEnviar({ clienteId, cliente, reunionId, aprobadas }: { clienteId: string; cliente: string; reunionId: string | null; aprobadas: number }) {
  const [enviando, iniciar] = useTransition();
  const [resultado, setResultado] = useState<ResultadoEnvio>();
  const avisar = useAvisos();

  function enviar() {
    iniciar(async () => {
      const r = await enviarTareas({ clienteId, reunionId });
      // En la bandeja el grupo puede desaparecer al enviarse: el resultado va a los avisos de la página.
      if (avisar) avisar({ titulo: `Envío de ${cliente}`, lineas: lineas(r) });
      else setResultado(r);
    });
  }

  return (
    <div className="grid justify-items-end gap-1 text-right">
      <button className="boton" disabled={enviando || !aprobadas} onClick={enviar} title={aprobadas ? undefined : "Marcá como Cargar las tareas que van"}>
        {enviando ? "Enviando…" : `Enviar ${aprobadas || ""} aprobada${aprobadas === 1 ? "" : "s"} a Jira`}
      </button>
      {resultado &&
        lineas(resultado).map((l) => (
          <span key={l.texto} className={`max-w-md text-sm ${l.tono === "ok" ? "text-ok" : l.tono === "critico" ? "text-critico" : "text-alerta"}`}>
            {l.texto}
          </span>
        ))}
    </div>
  );
}
