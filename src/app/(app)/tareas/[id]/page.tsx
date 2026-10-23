import Link from "next/link";
import { notFound } from "next/navigation";
import { CampoTarea } from "@/components/CampoTarea";
import { opcionesDe } from "@/lib/opciones";
import { Dato, Encabezado, Pill, PillDecision, PillEstado } from "@/components/Etiquetas";
import { FormComentario } from "@/components/FormComentario";
import { DECISIONES, ESTADOS_TAREA, ETIQUETAS, PRIORIDADES, RESPONSABLES } from "@/db/schema";
import { listarAnalistas, obtenerTarea } from "@/lib/consultas";
import { diasEntre, fechaCorta, fechaHora, hoyISO } from "@/lib/fechas";

export const dynamic = "force-dynamic";

const NOMBRE_CAMPO: Record<string, string> = {
  decision: "la decisión",
  estado: "el estado",
  analistaId: "el analista",
  analista: "el analista",
  etiqueta: "la etiqueta",
  prioridad: "la prioridad",
  fechaLimite: "la fecha límite",
  responsable: "el responsable",
  titulo: "el título",
  descripcion: "la descripción",
  objetivo: "el objetivo",
  jira: "el issue de Jira",
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: (await params).id };
}

export default async function TareaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const datos = await obtenerTarea(id);
  if (!datos) notFound();
  const { tarea, cliente, reunion, eventos } = datos;
  const analistas = await listarAnalistas();
  const hoy = hoyISO();
  const creada = tarea.creadoEn.toISOString().slice(0, 10);
  const abierta = tarea.decision === "Cargar" && ["Por hacer", "En curso", "Bloqueada"].includes(tarea.estado);

  return (
    <div className="max-w-5xl">
      <Encabezado
        titulo={tarea.titulo}
        detalle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{tarea.id}</span>
            <Link href={`/clientes/${cliente.id}`} className="enlace">
              {cliente.nombre}
            </Link>
            <PillDecision valor={tarea.decision} />
            <PillEstado valor={tarea.estado} />
            {tarea.responsable === "Cliente" && <Pill tono="marca">Del cliente</Pill>}
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="panel grid content-start gap-4 p-5 lg:col-span-2">
          <Dato etiqueta="Descripción">{tarea.descripcion}</Dato>
          <div className="grid gap-4 sm:grid-cols-3">
            <Dato etiqueta="Origen">
              {reunion ? (
                <Link href={`/reuniones/${reunion.id}`} className="enlace">
                  Reunión del {fechaCorta(reunion.fecha)}
                </Link>
              ) : tarea.origen === "sheet" ? (
                "Importada del sheet"
              ) : (
                "Creada a mano"
              )}
            </Dato>
            <Dato etiqueta="Creada">{tarea.origen === "sheet" ? "Antes de la plataforma" : fechaCorta(creada)}</Dato>
            <Dato etiqueta={abierta ? "Abierta hace" : "Decidida"}>
              {abierta && tarea.origen !== "sheet" ? `${diasEntre(creada, hoy)} días` : tarea.fechaDecision ? fechaHora(tarea.fechaDecision) : null}
            </Dato>
            <Dato etiqueta="Jira">
              {tarea.jiraKey && (
                <a href={`https://knownonline.atlassian.net/browse/${tarea.jiraKey}`} target="_blank" rel="noreferrer" className="enlace">
                  {tarea.jiraKey}
                </a>
              )}
            </Dato>
            <Dato etiqueta="Estado en Jira">{tarea.estadoJira}</Dato>
            <Dato etiqueta="Cerrada">{tarea.fechaCierre ? fechaHora(tarea.fechaCierre) : null}</Dato>
          </div>

          <div className="border-t border-linea pt-4">
            <h2 className="mb-3 font-bold">Historial</h2>
            <FormComentario tareaId={tarea.id} />
            <ol className="mt-4 grid gap-3">
              {eventos.map((e) => (
                <li key={e.id} className="grid grid-cols-[auto_1fr] gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-marca" aria-hidden />
                  <div>
                    <div className="text-xs text-suave">
                      {fechaHora(e.fecha)} · {e.usuario ?? "Sistema"}
                    </div>
                    {e.tipo === "comentario" && <p className="mt-0.5 whitespace-pre-wrap">{e.comentario}</p>}
                    {e.tipo === "creada" && <p className="mt-0.5">{e.comentario ?? "Tarea creada"}</p>}
                    {e.tipo === "cambio" && (
                      <p className="mt-0.5">
                        Cambió {NOMBRE_CAMPO[e.campo ?? ""] ?? e.campo}
                        {e.valorAnterior && (
                          <>
                            {" "}
                            de <strong>{e.campo === "fechaLimite" ? fechaCorta(e.valorAnterior) : e.valorAnterior}</strong>
                          </>
                        )}{" "}
                        a <strong>{e.valorNuevo ? (e.campo === "fechaLimite" ? fechaCorta(e.valorNuevo) : e.valorNuevo) : "vacío"}</strong>
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <aside className="panel grid content-start gap-4 p-5">
          <h2 className="font-bold">Datos de la tarea</h2>
          {(
            [
              ["Decisión", <CampoTarea key="d" id={tarea.id} campo="decision" valor={tarea.decision} opciones={opcionesDe(DECISIONES)} etiqueta="Decisión" />],
              ["Estado", <CampoTarea key="e" id={tarea.id} campo="estado" valor={tarea.estado} opciones={opcionesDe(ESTADOS_TAREA)} etiqueta="Estado" />],
              ["Responsable", <CampoTarea key="r" id={tarea.id} campo="responsable" valor={tarea.responsable} opciones={opcionesDe(RESPONSABLES)} etiqueta="Responsable" />],
              [
                "Analista",
                <CampoTarea
                  key="a"
                  id={tarea.id}
                  campo="analistaId"
                  valor={tarea.analistaId ? String(tarea.analistaId) : null}
                  opciones={analistas.map((a) => ({ valor: String(a.id), texto: a.nombre }))}
                  vacio="Sin asignar"
                  etiqueta="Analista"
                />,
              ],
              ["Etiqueta", <CampoTarea key="t" id={tarea.id} campo="etiqueta" valor={tarea.etiqueta} opciones={opcionesDe(ETIQUETAS)} vacio="—" etiqueta="Etiqueta" />],
              ["Prioridad", <CampoTarea key="p" id={tarea.id} campo="prioridad" valor={tarea.prioridad} opciones={opcionesDe(PRIORIDADES)} etiqueta="Prioridad" />],
              ["Fecha límite", <CampoTarea key="f" id={tarea.id} campo="fechaLimite" valor={tarea.fechaLimite} tipo="date" etiqueta="Fecha límite" />],
            ] as const
          ).map(([texto, campo]) => (
            <div key={texto} className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-suave">{texto}</span>
              {campo}
            </div>
          ))}
          {tarea.fechaLimite && abierta && tarea.fechaLimite < hoy && (
            <p className="rounded-lg bg-critico-suave px-3 py-2 text-sm text-critico">Vencida hace {diasEntre(tarea.fechaLimite, hoy)} días.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
