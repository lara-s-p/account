import Link from "next/link";
import { BotonSincronizar } from "@/components/BotonSincronizar";
import { Encabezado } from "@/components/Etiquetas";
import { CabeceraTareas, FilaTarea } from "@/components/FilaTarea";
import { DECISIONES, ESTADOS_TAREA, RESPONSABLES } from "@/db/schema";
import { listarAnalistas, listarClientesSimple, listarTareas, POR_PAGINA, type FiltrosTareas } from "@/lib/consultas";
import { fechaHora, hoyISO } from "@/lib/fechas";
import { jiraConfigurado } from "@/lib/jira";
import { ultimaSincronizacion } from "@/lib/sync-jira";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tareas" };

const VISTAS = [
  { id: "abiertas", texto: "Abiertas" },
  { id: "vencidas", texto: "Vencidas" },
  { id: "sin-fecha", texto: "Sin fecha límite" },
  { id: "sin-decidir", texto: "Sin decidir" },
  { id: "todas", texto: "Todas" },
] as const;

type Params = Record<string, string | undefined>;

export default async function Tareas({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  const vista = (VISTAS.find((v) => v.id === p.vista)?.id ?? "abiertas") as FiltrosTareas["vista"];
  const filtros: FiltrosTareas = {
    vista,
    cliente: p.cliente,
    analista: p.analista,
    decision: p.decision,
    estado: p.estado,
    responsable: p.responsable,
    q: p.q,
    pagina: Number(p.pagina) || 1,
  };
  const [{ filas, total, pagina }, analistas, clientes, ultima] = await Promise.all([
    listarTareas(filtros),
    listarAnalistas(),
    listarClientesSimple(),
    ultimaSincronizacion(),
  ]);
  const hoy = hoyISO();
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const url = (cambios: Params) => {
    const q = new URLSearchParams(Object.entries({ ...p, ...cambios }).filter(([, v]) => v) as [string, string][]);
    return `/tareas?${q}`;
  };

  return (
    <>
      <Encabezado titulo="Tareas" detalle={`${total.toLocaleString("es-AR")} tareas con estos filtros`}>
        <Link href={`/tareas/nueva${p.cliente ? `?cliente=${p.cliente}` : ""}`} className="boton">
          Nueva tarea
        </Link>
      </Encabezado>

      <div className="mb-4">
        <BotonSincronizar ultima={ultima} cuandoUltima={ultima ? fechaHora(ultima.fecha) : null} conectado={jiraConfigurado()} />
      </div>

      <nav className="mb-4 flex flex-wrap gap-1" aria-label="Vistas">
        {VISTAS.map((v) => (
          <Link
            key={v.id}
            href={url({ vista: v.id, pagina: undefined })}
            aria-current={vista === v.id ? "page" : undefined}
            className={`rounded-full px-3 py-1 text-sm font-medium ${vista === v.id ? "bg-tinta text-white" : "border border-linea bg-panel text-tinta hover:border-marca"}`}
          >
            {v.texto}
          </Link>
        ))}
      </nav>

      <form className="mb-4 flex flex-wrap gap-2">
        <input type="hidden" name="vista" value={vista} />
        <input name="q" defaultValue={p.q} placeholder="Buscar por título, ID o Jira" className="campo max-w-xs" aria-label="Buscar" />
        <select name="cliente" defaultValue={p.cliente ?? ""} className="campo !w-auto" aria-label="Cliente">
          <option value="">Todos los clientes</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <select name="analista" defaultValue={p.analista ?? ""} className="campo !w-auto" aria-label="Analista">
          <option value="">Todos los analistas</option>
          <option value="sin">Sin asignar</option>
          {analistas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
        <select name="decision" defaultValue={p.decision ?? ""} className="campo !w-auto" aria-label="Decisión">
          <option value="">Toda decisión</option>
          {DECISIONES.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select name="estado" defaultValue={p.estado ?? ""} className="campo !w-auto" aria-label="Estado">
          <option value="">Todo estado</option>
          {ESTADOS_TAREA.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select name="responsable" defaultValue={p.responsable ?? ""} className="campo !w-auto" aria-label="Responsable">
          <option value="">Known y cliente</option>
          {RESPONSABLES.map((d) => (
            <option key={d} value={d}>
              {d === "Known" ? "Solo Known" : "Solo del cliente"}
            </option>
          ))}
        </select>
        <button className="boton-secundario">Filtrar</button>
        <Link href={`/tareas?vista=${vista}`} className="boton-secundario">
          Limpiar
        </Link>
      </form>

      {vista === "abiertas" && !p.cliente && total === 0 && (
        <p className="mb-4 rounded-lg bg-alerta-suave px-4 py-3 text-sm text-alerta">
          Las tareas importadas del sheet figuran como &quot;Sin seguimiento&quot; hasta que se sincronicen con Jira. Las tareas que se envían desde la bandeja sí aparecen acá.
        </p>
      )}

      <div className="panel overflow-x-auto">
        <table className="tabla">
          <CabeceraTareas />
          <tbody>
            {filas.map(({ tarea, cliente }) => (
              <FilaTarea key={tarea.id} tarea={tarea} analistas={analistas} hoy={hoy} cliente={cliente} mostrarCliente />
            ))}
            {!filas.length && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-suave">
                  No hay tareas con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {paginas > 1 && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          {pagina > 1 && (
            <Link href={url({ pagina: String(pagina - 1) })} className="boton-secundario">
              Anterior
            </Link>
          )}
          <span className="text-suave">
            Página {pagina} de {paginas}
          </span>
          {pagina < paginas && (
            <Link href={url({ pagina: String(pagina + 1) })} className="boton-secundario">
              Siguiente
            </Link>
          )}
        </div>
      )}
    </>
  );
}
