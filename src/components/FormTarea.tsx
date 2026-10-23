"use client";

import { useActionState } from "react";
import { crearTarea } from "@/app/acciones";
import { ETIQUETAS, PRIORIDADES } from "@/db/schema";

export function FormTarea({
  clientes,
  analistas,
  clienteInicial,
  reunionId,
}: {
  clientes: { id: string; nombre: string }[];
  analistas: { id: number; nombre: string }[];
  clienteInicial?: string;
  reunionId?: string;
}) {
  const [estado, accion, guardando] = useActionState(crearTarea, undefined);
  return (
    <form action={accion} className="panel grid gap-4 p-5">
      {reunionId && <input type="hidden" name="reunionId" value={reunionId} />}
      <label className="block">
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
        <span className="etiqueta-campo">Título *</span>
        <input id="titulo" name="titulo" required placeholder="Empezá con un verbo: Enviar, Revisar, Armar…" className="campo" />
      </label>
      <label className="block">
        <span className="etiqueta-campo">Descripción</span>
        <textarea id="descripcion" name="descripcion" rows={3} className="campo" />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="etiqueta-campo">Responsable</span>
          <select id="responsable" name="responsable" className="campo">
            <option value="Known">Known</option>
            <option value="Cliente">El cliente</option>
          </select>
        </label>
        <label className="block">
          <span className="etiqueta-campo">Etiqueta</span>
          <select id="etiqueta" name="etiqueta" className="campo">
            {ETIQUETAS.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="etiqueta-campo">Prioridad</span>
          <select id="prioridad" name="prioridad" defaultValue="Media" className="campo">
            {PRIORIDADES.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="etiqueta-campo">Analista</span>
          <select id="analistaId" name="analistaId" defaultValue="" className="campo">
            <option value="">El sugerido por historial</option>
            {analistas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="etiqueta-campo">Fecha límite</span>
          <input id="fechaLimite" name="fechaLimite" type="date" className="campo" />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button className="boton" disabled={guardando}>
          {guardando ? "Creando…" : "Crear tarea"}
        </button>
        {estado?.error && <span className="text-sm text-critico">{estado.error}</span>}
      </div>
    </form>
  );
}
