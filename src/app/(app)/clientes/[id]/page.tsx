import Link from "next/link";
import { notFound } from "next/navigation";
import { Dato, Encabezado, Pill, PillCliente, PillDecision, PillEstado } from "@/components/Etiquetas";
import { FormCliente } from "@/components/FormCliente";
import { listarClientes, listarReuniones, listarTareas, obtenerCliente } from "@/lib/consultas";
import { diasEntre, fechaCorta, hoyISO } from "@/lib/fechas";
import { completitudFicha } from "@/lib/ficha";

export const dynamic = "force-dynamic";

const PESTANAS = [
  { id: "resumen", texto: "Resumen" },
  { id: "ficha", texto: "Ficha" },
  { id: "reuniones", texto: "Reuniones" },
];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const c = await obtenerCliente((await params).id);
  return { title: c?.nombre ?? "Cliente" };
}

export default async function ClientePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab = "resumen" } = await searchParams;
  const cliente = await obtenerCliente(id);
  if (!cliente) notFound();

  const ficha = completitudFicha(cliente);
  const hoy = hoyISO();
  const [todos, reunionesCliente, abiertas, sinDecidir] = await Promise.all([
    listarClientes(),
    listarReuniones({ clienteId: id, limite: 100 }),
    listarTareas({ cliente: id, vista: "abiertas" }),
    listarTareas({ cliente: id, vista: "sin-decidir" }),
  ]);
  const metricas = todos.find((c) => c.cliente.id === id)!;
  const accounts = [...new Set(todos.map((c) => c.cliente.account).filter((a): a is string => !!a))].sort();
  const dias = metricas.ultimaReunion ? diasEntre(metricas.ultimaReunion, hoy) : null;
  const recientes = reunionesCliente.filter((r) => r.reunion.oportunidades.length || r.reunion.riesgos.length).slice(0, 5);

  return (
    <>
      <Encabezado
        titulo={cliente.nombre}
        detalle={
          <span className="flex flex-wrap items-center gap-2">
            <PillCliente valor={cliente.estado} />
            <span>{cliente.id}</span>
            {cliente.account && <span>· Account: {cliente.account}</span>}
            <Pill tono={ficha.porcentaje === 100 ? "ok" : "alerta"}>Ficha {ficha.porcentaje}%</Pill>
          </span>
        }
      >
        <Link href={`/reuniones/nueva?cliente=${id}`} className="boton">
          Cargar minuta
        </Link>
      </Encabezado>

      <nav className="mb-6 flex gap-1 border-b border-linea" aria-label="Secciones del cliente">
        {PESTANAS.map((p) => (
          <Link
            key={p.id}
            href={`/clientes/${id}?tab=${p.id}`}
            aria-current={tab === p.id ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === p.id ? "border-marca text-marca-oscuro" : "border-transparent text-suave hover:text-tinta"}`}
          >
            {p.texto}
          </Link>
        ))}
        <Link href={`/tareas?cliente=${id}`} className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-semibold text-suave hover:text-tinta">
          Tareas →
        </Link>
      </nav>

      {tab === "ficha" && (
        <div className="max-w-4xl">
          {ficha.faltan.length > 0 && (
            <p className="mb-4 rounded-lg bg-alerta-suave px-4 py-3 text-sm text-alerta">Falta completar: {ficha.faltan.join(", ")}.</p>
          )}
          <FormCliente cliente={cliente} accounts={accounts} />
        </div>
      )}

      {tab === "reuniones" && (
        <div className="panel overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Reunión</th>
                <th>Resumen</th>
                <th className="text-right">Tareas</th>
                <th>Minuta</th>
              </tr>
            </thead>
            <tbody>
              {reunionesCliente.map(({ reunion, cantTareas, sinDecidir }) => (
                <tr key={reunion.id}>
                  <td className="whitespace-nowrap">{fechaCorta(reunion.fecha)}</td>
                  <td>
                    <Link href={`/reuniones/${reunion.id}`} className="enlace">
                      {reunion.id}
                    </Link>
                  </td>
                  <td className="max-w-xl text-suave">{reunion.resumen ?? (reunion.origen === "sheet" ? "Importada del sheet" : "—")}</td>
                  <td className="numeros text-right whitespace-nowrap">
                    {cantTareas}
                    {sinDecidir > 0 && <div className="text-xs text-alerta">{sinDecidir} sin decidir</div>}
                  </td>
                  <td>
                    {reunion.linkDoc && (
                      <a href={reunion.linkDoc} target="_blank" rel="noreferrer" className="enlace">
                        Abrir
                      </a>
                    )}
                  </td>
                </tr>
              ))}
              {!reunionesCliente.length && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-suave">
                    Todavía no hay reuniones cargadas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "resumen" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="grid content-start gap-6 lg:col-span-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { v: dias == null ? "—" : `${dias} d`, t: "Desde la última reunión", mal: dias != null && dias > 30 },
                { v: metricas.abiertas, t: "Tareas abiertas", mal: false },
                { v: metricas.vencidas, t: "Vencidas", mal: metricas.vencidas > 0 },
                { v: metricas.pendientesCliente, t: "Pendientes del cliente", mal: false },
              ].map((k) => (
                <div key={k.t} className="panel p-4">
                  <div className={`numeros text-2xl font-extrabold ${k.mal ? "text-critico" : ""}`}>{k.v}</div>
                  <div className="text-xs text-suave">{k.t}</div>
                </div>
              ))}
            </div>

            <section className="panel p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-bold">Tareas abiertas</h2>
                <Link href={`/tareas?cliente=${id}&vista=abiertas`} className="enlace text-sm">
                  Ver todas ({abiertas.total})
                </Link>
              </div>
              {abiertas.filas.length ? (
                <ul className="divide-y divide-linea">
                  {abiertas.filas.slice(0, 10).map(({ tarea }) => (
                    <li key={tarea.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <Link href={`/tareas/${tarea.id}`} className="enlace min-w-0">
                        {tarea.titulo}
                      </Link>
                      <span className="flex gap-1">
                        {tarea.responsable === "Cliente" && <Pill tono="marca">Cliente</Pill>}
                        <PillEstado valor={tarea.estado} />
                        <Pill tono={tarea.fechaLimite && tarea.fechaLimite < hoy ? "critico" : "neutro"}>
                          {tarea.fechaLimite ? `vence ${fechaCorta(tarea.fechaLimite)}` : "sin fecha"}
                        </Pill>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-suave">
                  No hay tareas abiertas con seguimiento. Las tareas importadas del sheet figuran como &quot;Sin seguimiento&quot; hasta conectar Jira.
                </p>
              )}
            </section>

            {sinDecidir.total > 0 && (
              <section className="panel p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-bold">Sin decidir</h2>
                  <Link href={`/tareas?cliente=${id}&vista=sin-decidir`} className="enlace text-sm">
                    Decidir ({sinDecidir.total})
                  </Link>
                </div>
                <ul className="divide-y divide-linea">
                  {sinDecidir.filas.slice(0, 5).map(({ tarea }) => (
                    <li key={tarea.id} className="flex items-center justify-between gap-2 py-2">
                      <Link href={`/tareas/${tarea.id}`} className="enlace min-w-0">
                        {tarea.titulo}
                      </Link>
                      <PillDecision valor={tarea.decision} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {recientes.length > 0 && (
              <section className="panel p-5">
                <h2 className="mb-3 font-bold">Oportunidades y riesgos de las últimas reuniones</h2>
                <ul className="grid gap-3">
                  {recientes.map(({ reunion }) => (
                    <li key={reunion.id}>
                      <Link href={`/reuniones/${reunion.id}`} className="text-xs font-semibold text-suave hover:underline">
                        {fechaCorta(reunion.fecha)}
                      </Link>
                      {reunion.oportunidades.map((o) => (
                        <div key={o} className="mt-1 flex gap-2">
                          <Pill tono="ok">Oportunidad</Pill>
                          <span>{o}</span>
                        </div>
                      ))}
                      {reunion.riesgos.map((o) => (
                        <div key={o} className="mt-1 flex gap-2">
                          <Pill tono="critico">Riesgo</Pill>
                          <span>{o}</span>
                        </div>
                      ))}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="panel grid content-start gap-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Ficha</h2>
              <Link href={`/clientes/${id}?tab=ficha`} className="enlace text-sm">
                Editar
              </Link>
            </div>
            <Dato etiqueta="Servicios">{cliente.servicios.join(" · ")}</Dato>
            <Dato etiqueta="Industria">{cliente.industria}</Dato>
            <Dato etiqueta="Sitio web">
              {cliente.sitioWeb && (
                <a href={cliente.sitioWeb} target="_blank" rel="noreferrer" className="enlace">
                  {cliente.sitioWeb.replace(/^https?:\/\//, "")}
                </a>
              )}
            </Dato>
            <Dato etiqueta="Plataforma">{cliente.plataformaEcommerce}</Dato>
            <Dato etiqueta="Objetivos del negocio">{cliente.objetivosNegocio}</Dato>
            <Dato etiqueta="Contactos">
              {cliente.contactos.length > 0 &&
                cliente.contactos.map((c) => (
                  <div key={c.nombre}>
                    {c.nombre}
                    {c.cargo && <span className="text-suave"> · {c.cargo}</span>}
                  </div>
                ))}
            </Dato>
            <div className="flex flex-wrap gap-3 border-t border-linea pt-4 text-sm">
              {cliente.slackCanal && (
                <a href={cliente.slackCanal} target="_blank" rel="noreferrer" className="enlace">
                  Slack
                </a>
              )}
              {cliente.trelloTablero && (
                <a href={cliente.trelloTablero} target="_blank" rel="noreferrer" className="enlace">
                  Trello
                </a>
              )}
              {cliente.jiraProjectKey && (
                <a href={`https://knownonline.atlassian.net/jira/software/c/projects/${cliente.jiraProjectKey}/issues`} target="_blank" rel="noreferrer" className="enlace">
                  Jira ({cliente.jiraProjectKey})
                </a>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
