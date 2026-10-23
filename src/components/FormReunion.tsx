"use client";

import { useActionState } from "react";
import { cargarReunion } from "@/app/acciones";

export function FormReunion({ clientes, clienteInicial, hoy }: { clientes: { id: string; nombre: string }[]; clienteInicial?: string; hoy: string }) {
  const [estado, accion, procesando] = useActionState(cargarReunion, undefined);
  return (
    <form action={accion} className="panel grid gap-4 p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block sm:col-span-2">
          <span className="etiqueta-campo">Cliente *</span>
          <select id="clienteId" name="clienteId" defaultValue={clienteInicial ?? ""} required className="campo">
            <option value="" disabled>
              Elegí el cliente
            </option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="etiqueta-campo">Fecha de la reunión *</span>
          <input id="fecha" name="fecha" type="date" defaultValue={hoy} required className="campo" />
        </label>
      </div>
      <label className="block">
        <span className="etiqueta-campo">Tipo de reunión</span>
        <select id="tipo" name="tipo" defaultValue="Seguimiento" className="campo">
          <option>Seguimiento</option>
          <option>Kickoff</option>
          <option>Resultados mensuales</option>
          <option>Estrategia / QBR</option>
          <option>Urgente</option>
        </select>
      </label>
      <label className="block">
        <span className="etiqueta-campo">Link de la minuta en Google Docs</span>
        <input id="linkDoc" name="linkDoc" type="url" placeholder="https://docs.google.com/document/d/…" className="campo" />
      </label>
      <label className="block">
        <span className="etiqueta-campo">O pegá el texto de la minuta</span>
        <textarea id="texto" name="texto" rows={8} placeholder="Si pegás el texto, no hace falta el link (igual conviene guardarlo)." className="campo" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button className="boton" disabled={procesando}>
          {procesando ? "Procesando la minuta…" : "Procesar minuta"}
        </button>
        {procesando && <span className="text-sm text-suave">Claude está leyendo la minuta y armando las tareas. Puede tardar hasta un minuto.</span>}
        {estado?.error && <span className="text-sm text-critico">{estado.error}</span>}
      </div>
    </form>
  );
}
