import Link from "next/link";
import { Encabezado, Pill, PillCliente } from "@/components/Etiquetas";
import { ESTADOS_CLIENTE } from "@/db/schema";
import { listarClientes } from "@/lib/consultas";
import { diasEntre, fechaCorta, hoyISO } from "@/lib/fechas";
import { completitudFicha } from "@/lib/ficha";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clientes" };

export default async function Clientes({ searchParams }: { searchParams: Promise<{ estado?: string; q?: string }> }) {
  const { estado, q } = await searchParams;
  const hoy = hoyISO();
  const todos = await listarClientes();
  const filas = todos.filter(
    (c) => (!estado || c.cliente.estado === estado) && (!q || c.cliente.nombre.toLowerCase().includes(q.toLowerCase()))
  );
  const incompletas = todos.filter((c) => completitudFicha(c.cliente).porcentaje < 100).length;

  return (
    <>
      <Encabezado titulo="Clientes" detalle={`${todos.length} clientes · ${incompletas} con la ficha incompleta`}>
        <Link href="/clientes/nuevo" className="boton">
          Nuevo cliente
        </Link>
      </Encabezado>

      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar cliente" className="campo max-w-xs" aria-label="Buscar cliente" />
        <select name="estado" defaultValue={estado ?? ""} className="campo !w-auto" aria-label="Estado">
          <option value="">Todos los estados</option>
          {ESTADOS_CLIENTE.map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
        <button className="boton-secundario">Filtrar</button>
      </form>

      <div className="panel overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Estado</th>
              <th>Account</th>
              <th>Servicios</th>
              <th>Última reunión</th>
              <th className="text-right">Abiertas</th>
              <th className="text-right">Vencidas</th>
              <th className="text-right">Sin decidir</th>
              <th>Ficha</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((c) => {
              const ficha = completitudFicha(c.cliente);
              const dias = c.ultimaReunion ? diasEntre(c.ultimaReunion, hoy) : null;
              return (
                <tr key={c.cliente.id}>
                  <td>
                    <Link href={`/clientes/${c.cliente.id}`} className="enlace">
                      {c.cliente.nombre}
                    </Link>
                    <div className="text-xs text-suave">{c.cliente.id}</div>
                  </td>
                  <td>
                    <PillCliente valor={c.cliente.estado} />
                  </td>
                  <td>{c.cliente.account ?? <span className="text-suave">—</span>}</td>
                  <td className="whitespace-nowrap">{c.cliente.servicios.join(" · ") || <span className="text-suave">—</span>}</td>
                  <td className="whitespace-nowrap">
                    {fechaCorta(c.ultimaReunion)}
                    {dias != null && <div className={`text-xs ${dias > 30 ? "text-critico" : dias > 15 ? "text-alerta" : "text-suave"}`}>hace {dias} días</div>}
                  </td>
                  <td className="numeros text-right">{c.abiertas}</td>
                  <td className={`numeros text-right ${c.vencidas ? "font-bold text-critico" : ""}`}>{c.vencidas}</td>
                  <td className={`numeros text-right ${c.sinDecidir > 8 ? "font-bold text-alerta" : ""}`}>{c.sinDecidir}</td>
                  <td>
                    <Pill tono={ficha.porcentaje === 100 ? "ok" : ficha.porcentaje >= 60 ? "alerta" : "critico"} titulo={ficha.faltan.length ? "Falta: " + ficha.faltan.join(", ") : undefined}>
                      {ficha.porcentaje}%
                    </Pill>
                  </td>
                </tr>
              );
            })}
            {!filas.length && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-suave">
                  No hay clientes con esos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
