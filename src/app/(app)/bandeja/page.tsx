import Link from "next/link";
import { AvisosProvider } from "@/components/Avisos";
import { BotonEnviar } from "@/components/BotonEnviar";
import { BotonesDecision } from "@/components/BotonesDecision";
import { Encabezado, Pill } from "@/components/Etiquetas";
import { CabeceraTareas, FilaTarea } from "@/components/FilaTarea";
import { listarAnalistas, listarBandeja } from "@/lib/consultas";
import { fechaCorta, hoyISO } from "@/lib/fechas";
import { jiraConfigurado } from "@/lib/jira";
import { slackConfigurado } from "@/lib/slack";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bandeja" };
// Enviar muchas tareas a Jira puede llevar varios segundos.
export const maxDuration = 120;

export default async function Bandeja() {
  const [grupos, analistas] = await Promise.all([listarBandeja(), listarAnalistas()]);
  const hoy = hoyISO();
  const total = grupos.reduce((s, g) => s + g.tareas.length, 0);

  return (
    <AvisosProvider>
      <Encabezado
        titulo="Bandeja"
        detalle="Las tareas nuevas de todas las minutas llegan acá. Revisá analista, etiqueta y fecha, marcá cuáles se cargan y envialas: se crean en Jira, se avisa en el Slack del cliente y pasan a su perfil."
      >
        <Link href="/reuniones/nueva" className="boton-secundario">
          Cargar minuta
        </Link>
      </Encabezado>

      {(!jiraConfigurado() || !slackConfigurado()) && (
        <p className="mb-4 rounded-lg bg-alerta-suave px-4 py-3 text-sm text-alerta">
          {!jiraConfigurado() && "Jira todavía no está conectado: las tareas de Known no se pueden enviar. "}
          {!slackConfigurado() && "Slack todavía no está conectado: no se van a publicar avisos."}
        </p>
      )}

      {!grupos.length && (
        <div className="panel p-10 text-center">
          <p className="font-semibold">La bandeja está vacía.</p>
          <p className="mt-1 text-suave">Cuando se procese una minuta, sus tareas aparecen acá para revisarlas.</p>
        </div>
      )}

      <div className="grid gap-6">
        {grupos.map((g) => {
          const pendientes = g.tareas.filter((t) => t.decision === "Pendiente").length;
          const aprobadas = g.tareas.filter((t) => t.decision === "Cargar").length;
          return (
            <section key={g.clave} id={g.clave} className="grid scroll-mt-4 gap-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold">
                    <Link href={`/clientes/${g.cliente.id}`} className="hover:underline">
                      {g.cliente.nombre}
                    </Link>
                  </h2>
                  <p className="flex flex-wrap items-center gap-2 text-sm text-suave">
                    {g.reunion ? (
                      <Link href={`/reuniones/${g.reunion.id}`} className="enlace">
                        Reunión del {fechaCorta(g.reunion.fecha)}
                      </Link>
                    ) : (
                      <span>Tareas cargadas a mano</span>
                    )}
                    <span>· {g.tareas.length} tareas</span>
                    {pendientes > 0 && <Pill tono="alerta">{pendientes} sin decidir</Pill>}
                    {g.cliente.jiraProjectKey ? <Pill>Jira {g.cliente.jiraProjectKey}</Pill> : <Pill tono="critico">Sin proyecto de Jira</Pill>}
                  </p>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  {g.reunion && <BotonesDecision reunionId={g.reunion.id} pendientes={pendientes} />}
                  <BotonEnviar clienteId={g.cliente.id} cliente={g.cliente.nombre} reunionId={g.reunion?.id ?? null} aprobadas={aprobadas} />
                </div>
              </div>
              <div className="panel overflow-x-auto">
                <table className="tabla">
                  <CabeceraTareas />
                  <tbody>
                    {g.tareas.map((t) => (
                      <FilaTarea key={t.id} tarea={t} analistas={analistas} hoy={hoy} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
      {total > 0 && <p className="mt-6 text-sm text-suave">{total} tareas en la bandeja.</p>}
    </AvisosProvider>
  );
}
