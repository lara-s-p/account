import Link from "next/link";
import { notFound } from "next/navigation";
import { BotonesDecision } from "@/components/BotonesDecision";
import { Dato, Encabezado, Pill, PillEstado } from "@/components/Etiquetas";
import { CabeceraTareas, FilaTarea } from "@/components/FilaTarea";
import { ESTADOS_ABIERTOS, listarAnalistas, listarTareas, obtenerReunion, reunionAnterior } from "@/lib/consultas";
import { fechaCorta, hoyISO } from "@/lib/fechas";

export const dynamic = "force-dynamic";

function Lista({ titulo, items, tono }: { titulo: string; items: string[]; tono?: "ok" | "critico" }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold text-suave">{titulo}</h3>
      <ul className="grid gap-1">
        {items.map((i) => (
          <li key={i} className="flex gap-2">
            {tono ? <Pill tono={tono}>{tono === "ok" ? "Oportunidad" : "Riesgo"}</Pill> : <span className="text-marca">•</span>}
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function ReunionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fila = await obtenerReunion(id);
  if (!fila) notFound();
  const { reunion, cliente } = fila;
  const hoy = hoyISO();
  const [{ filas }, analistas, anterior] = await Promise.all([
    listarTareas({ reunion: id }),
    listarAnalistas(),
    reunionAnterior(cliente.id, reunion.fecha, reunion.id),
  ]);
  const pendientes = filas.filter((f) => f.tarea.decision === "Pendiente").length;
  // Continuidad: qué quedó abierto de la reunión anterior.
  const deLaAnterior = anterior ? (await listarTareas({ reunion: anterior.id })).filas.filter((f) => f.tarea.decision === "Cargar") : [];
  const abiertasAnterior = deLaAnterior.filter((f) => ESTADOS_ABIERTOS.includes(f.tarea.estado));

  return (
    <>
      <Encabezado
        titulo={`Reunión con ${cliente.nombre}`}
        detalle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{fechaCorta(reunion.fecha)}</span>
            <span>· {reunion.id}</span>
            {reunion.tipo && <Pill>{reunion.tipo}</Pill>}
            {reunion.tonoCliente && <Pill tono={["Preocupado", "Molesto"].includes(reunion.tonoCliente) ? "critico" : "neutro"}>Cliente {reunion.tonoCliente.toLowerCase()}</Pill>}
          </span>
        }
      >
        <Link href={`/clientes/${cliente.id}`} className="boton-secundario">
          Ver cliente
        </Link>
        {reunion.linkDoc && (
          <a href={reunion.linkDoc} target="_blank" rel="noreferrer" className="boton-secundario">
            Abrir minuta
          </a>
        )}
      </Encabezado>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <section className="panel grid content-start gap-4 p-5 lg:col-span-2">
          {reunion.resumen ? (
            <>
              <Dato etiqueta="Resumen">{reunion.resumen}</Dato>
              <Lista titulo="Decisiones" items={reunion.decisiones} />
              <Lista titulo="Compromisos del cliente" items={reunion.compromisosCliente} />
              <Lista titulo="Oportunidades" items={reunion.oportunidades} tono="ok" />
              <Lista titulo="Riesgos y temas para escalar" items={reunion.riesgos} tono="critico" />
            </>
          ) : (
            <p className="text-suave">
              Reunión importada del sheet: no tiene resumen ni decisiones extraídas.
              {reunion.minutaDepurada && (
                <>
                  {" "}
                  <a href={reunion.minutaDepurada} target="_blank" rel="noreferrer" className="enlace">
                    Ver minuta depurada
                  </a>
                </>
              )}
            </p>
          )}
        </section>

        <section className="panel content-start p-5">
          <h2 className="font-bold">Lo que venía de la reunión anterior</h2>
          {anterior ? (
            <>
              <p className="mb-3 text-xs text-suave">
                <Link href={`/reuniones/${anterior.id}`} className="enlace">
                  Reunión del {fechaCorta(anterior.fecha)}
                </Link>{" "}
                · {deLaAnterior.length} tareas cargadas, {abiertasAnterior.length} siguen abiertas
              </p>
              {abiertasAnterior.length ? (
                <ul className="grid gap-2">
                  {abiertasAnterior.map(({ tarea }) => (
                    <li key={tarea.id} className="flex items-start justify-between gap-2">
                      <Link href={`/tareas/${tarea.id}`} className="enlace min-w-0">
                        {tarea.titulo}
                      </Link>
                      <PillEstado valor={tarea.estado} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-suave">No quedó nada abierto con seguimiento.</p>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-suave">Es la primera reunión registrada con este cliente.</p>
          )}
        </section>
      </div>

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Tareas de esta reunión</h2>
          <p className="text-sm text-suave">
            Revisá analista, etiqueta y fecha límite. Las que marques como &quot;Cargar&quot; pasan a seguimiento.
          </p>
        </div>
        <BotonesDecision reunionId={id} pendientes={pendientes} />
      </div>
      <div className="panel overflow-x-auto">
        <table className="tabla">
          <CabeceraTareas />
          <tbody>
            {filas.map(({ tarea }) => (
              <FilaTarea key={tarea.id} tarea={tarea} analistas={analistas} hoy={hoy} />
            ))}
            {!filas.length && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-suave">
                  {reunion.origen === "sheet" ? "Las tareas importadas del sheet no tienen la reunión de origen registrada." : "Esta reunión no generó tareas."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm">
        <Link href={`/tareas/nueva?cliente=${cliente.id}&reunion=${id}`} className="enlace">
          Agregar una tarea a mano
        </Link>
      </p>
    </>
  );
}
