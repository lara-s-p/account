import Link from "next/link";
import { Encabezado, Pill } from "@/components/Etiquetas";
import { listarClientesSimple, listarReuniones } from "@/lib/consultas";
import { fechaCorta } from "@/lib/fechas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reuniones" };

export default async function Reuniones({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const { cliente } = await searchParams;
  const [filas, clientes] = await Promise.all([listarReuniones({ clienteId: cliente, limite: 300 }), listarClientesSimple()]);
  return (
    <>
      <Encabezado titulo="Reuniones" detalle="Cada minuta cargada genera sus tareas para revisar.">
        <Link href="/reuniones/nueva" className="boton">
          Cargar minuta
        </Link>
      </Encabezado>
      <form className="mb-4 flex flex-wrap gap-2">
        <select name="cliente" defaultValue={cliente ?? ""} className="campo !w-auto" aria-label="Cliente">
          <option value="">Todos los clientes</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <button className="boton-secundario">Filtrar</button>
      </form>
      <div className="panel overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Resumen</th>
              <th className="text-right">Tareas</th>
              <th>Señales</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ reunion, cliente: nombre, cantTareas, sinDecidir }) => (
              <tr key={reunion.id}>
                <td className="whitespace-nowrap">
                  <Link href={`/reuniones/${reunion.id}`} className="enlace">
                    {fechaCorta(reunion.fecha)}
                  </Link>
                  <div className="text-xs text-suave">{reunion.id}</div>
                </td>
                <td className="whitespace-nowrap">{nombre}</td>
                <td className="max-w-xl text-suave">{reunion.resumen ?? (reunion.origen === "sheet" ? "Importada del sheet" : "—")}</td>
                <td className="numeros text-right whitespace-nowrap">
                  {cantTareas}
                  {sinDecidir > 0 && <div className="text-xs text-alerta">{sinDecidir} sin decidir</div>}
                </td>
                <td>
                  <span className="flex flex-wrap gap-1">
                    {reunion.oportunidades.length > 0 && <Pill tono="ok">{reunion.oportunidades.length} oportunidad(es)</Pill>}
                    {reunion.riesgos.length > 0 && <Pill tono="critico">{reunion.riesgos.length} riesgo(s)</Pill>}
                    {reunion.tonoCliente && <Pill>{reunion.tonoCliente}</Pill>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filas.length === 300 && <p className="mt-3 text-sm text-suave">Se muestran las 300 reuniones más recientes. Filtrá por cliente para ver el resto.</p>}
    </>
  );
}
