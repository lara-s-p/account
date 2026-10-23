"use client";

import { useActionState, useState, useTransition } from "react";
import { ajustarEstado, analizarClienteSemana, enviarAlertaAhora, generarEstadosSemana } from "@/app/acciones";
import { NIVELES } from "@/db/schema";

export function BotonGenerarSemana({ semana, faltan }: { semana: string; faltan: number }) {
  const [generando, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ texto: string; error?: boolean }>();
  if (!faltan && !msg) return null;
  return (
    <div className="grid justify-items-end gap-1 text-right">
      <button
        className="boton"
        disabled={generando || !faltan}
        onClick={() =>
          iniciar(async () => {
            const r = await generarEstadosSemana(semana);
            const partes = [`${r.generados} cliente(s) analizados.`];
            if (r.faltan) partes.push(`Faltan ${r.faltan}: volvé a tocar el botón para seguir.`);
            if (r.errores.length) partes.push(r.errores.join(" · "));
            setMsg({ texto: partes.join(" "), error: r.errores.length > 0 });
          })
        }
      >
        {generando ? "Analizando clientes…" : `Analizar los ${faltan} clientes sin estado`}
      </button>
      {generando && <span className="text-xs text-suave">Claude revisa reuniones, tareas e historial de cada cliente. Puede tardar unos minutos.</span>}
      {msg && <span className={`max-w-md text-sm ${msg.error ? "text-critico" : "text-ok"}`}>{msg.texto}</span>}
    </div>
  );
}

export function BotonAnalizarCliente({ clienteId, semana, existe }: { clienteId: string; semana: string; existe: boolean }) {
  const [analizando, iniciar] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        className="boton-secundario"
        disabled={analizando}
        onClick={() => iniciar(async () => setError((await analizarClienteSemana(clienteId, semana)).error))}
      >
        {analizando ? "Analizando…" : existe ? "Volver a analizar" : "Analizar esta semana"}
      </button>
      {error && <span className="text-xs text-critico">{error}</span>}
    </span>
  );
}

export function FormAjuste({ clienteId, semana, nivel, motivo }: { clienteId: string; semana: string; nivel?: number | null; motivo?: string | null }) {
  const [estado, accion, guardando] = useActionState(ajustarEstado, undefined);
  return (
    <form action={accion} className="grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-end">
      <input type="hidden" name="clienteId" value={clienteId} />
      <input type="hidden" name="semana" value={semana} />
      <label className="block">
        <span className="etiqueta-campo">Semáforo</span>
        <select id="nivel" name="nivel" defaultValue={nivel ?? ""} className="campo" required>
          <option value="" disabled>
            Elegí el nivel
          </option>
          {NIVELES.map((n) => (
            <option key={n.nivel} value={n.nivel}>
              {n.nivel} · {n.color} · {n.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="block min-w-0">
        <span className="etiqueta-campo">Motivo</span>
        <input id="motivo" name="motivo" defaultValue={motivo ?? ""} placeholder="Por qué está en este nivel" className="campo" />
      </label>
      <button className="boton-secundario" disabled={guardando}>
        {guardando ? "Guardando…" : "Ajustar"}
      </button>
      {(estado?.error || estado?.ok) && <span className={`text-sm sm:col-span-3 ${estado.error ? "text-critico" : "text-ok"}`}>{estado.error ?? estado.ok}</span>}
    </form>
  );
}

export function BotonAlerta({ semana }: { semana: string }) {
  const [enviando, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ texto: string; error?: boolean }>();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        className="boton-secundario"
        disabled={enviando}
        onClick={() =>
          iniciar(async () => {
            const r = await enviarAlertaAhora(semana);
            setMsg(r.ok ? { texto: "Alerta publicada en el canal de accounts." } : { texto: r.error ?? "No se pudo enviar.", error: true });
          })
        }
      >
        {enviando ? "Enviando…" : "Enviar alerta a Slack"}
      </button>
      {msg && <span className={`text-xs ${msg.error ? "text-critico" : "text-ok"}`}>{msg.texto}</span>}
    </span>
  );
}
