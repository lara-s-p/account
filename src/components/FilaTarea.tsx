import Link from "next/link";
import { CampoTarea } from "@/components/CampoTarea";
import { opcionesDe } from "@/lib/opciones";
import { Pill } from "@/components/Etiquetas";
import { DECISIONES, ESTADOS_TAREA, ETIQUETAS, PRIORIDADES, type Analista, type Tarea } from "@/db/schema";
import { fechaCorta } from "@/lib/fechas";

/** Fila editable de tarea: se usa en la revisión de una reunión y en el listado de tareas. */
export function FilaTarea({
  tarea,
  analistas,
  hoy,
  cliente,
  mostrarCliente = false,
}: {
  tarea: Tarea;
  analistas: Analista[];
  hoy: string;
  cliente?: string;
  mostrarCliente?: boolean;
}) {
  const vencida = tarea.fechaLimite && tarea.fechaLimite < hoy && !["Hecha", "Sin seguimiento"].includes(tarea.estado) && tarea.decision === "Cargar";
  const sugerido = analistas.find((a) => a.id === tarea.analistaSugeridoId);
  const opcionesAnalista = analistas.filter((a) => a.activo || a.id === tarea.analistaId).map((a) => ({ valor: String(a.id), texto: a.nombre }));
  return (
    <tr>
      <td className="min-w-64">
        <Link href={`/tareas/${tarea.id}`} className="enlace">
          {tarea.titulo}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-suave">
          <span>{tarea.id}</span>
          {mostrarCliente && cliente && <span>· {cliente}</span>}
          {tarea.jiraKey && (
            <a href={`https://knownonline.atlassian.net/browse/${tarea.jiraKey}`} target="_blank" rel="noreferrer" className="enlace">
              · {tarea.jiraKey}
            </a>
          )}
          {tarea.responsable === "Cliente" && <Pill tono="marca">Del cliente</Pill>}
          {tarea.prioridad === "Alta" && <Pill tono="critico">Alta</Pill>}
        </div>
        {tarea.descripcion && <p className="mt-1 line-clamp-2 max-w-xl text-xs text-suave">{tarea.descripcion}</p>}
      </td>
      <td>
        <CampoTarea id={tarea.id} campo="decision" valor={tarea.decision} opciones={opcionesDe(DECISIONES)} etiqueta="Decisión" />
      </td>
      <td>
        {tarea.responsable === "Known" ? (
          <>
            <CampoTarea id={tarea.id} campo="analistaId" valor={tarea.analistaId ? String(tarea.analistaId) : null} opciones={opcionesAnalista} vacio="Sin asignar" etiqueta="Analista" />
            {sugerido && sugerido.id !== tarea.analistaId && <div className="mt-0.5 text-xs text-suave">Sugerido: {sugerido.nombre}</div>}
          </>
        ) : (
          <span className="text-xs text-suave">Lo hace el cliente</span>
        )}
      </td>
      <td>
        <CampoTarea id={tarea.id} campo="etiqueta" valor={tarea.etiqueta} opciones={opcionesDe(ETIQUETAS)} vacio="—" etiqueta="Etiqueta" />
      </td>
      <td>
        <CampoTarea id={tarea.id} campo="prioridad" valor={tarea.prioridad} opciones={opcionesDe(PRIORIDADES)} etiqueta="Prioridad" />
      </td>
      <td>
        <CampoTarea id={tarea.id} campo="fechaLimite" valor={tarea.fechaLimite} tipo="date" etiqueta="Fecha límite" className={vencida ? "!border-critico !text-critico" : ""} />
        {vencida && <div className="mt-0.5 text-xs font-semibold text-critico">Vencida</div>}
      </td>
      <td>
        <CampoTarea id={tarea.id} campo="estado" valor={tarea.estado} opciones={opcionesDe(ESTADOS_TAREA)} etiqueta="Estado" />
        {tarea.estado === "Hecha" && tarea.fechaCierre && <div className="mt-0.5 text-xs text-suave">{fechaCorta(tarea.fechaCierre.toISOString())}</div>}
      </td>
    </tr>
  );
}

export function CabeceraTareas() {
  return (
    <thead>
      <tr>
        <th>Tarea</th>
        <th>Decisión</th>
        <th>Analista</th>
        <th>Etiqueta</th>
        <th>Prioridad</th>
        <th>Fecha límite</th>
        <th>Estado</th>
      </tr>
    </thead>
  );
}
