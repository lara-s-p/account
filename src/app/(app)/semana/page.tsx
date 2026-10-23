import Link from "next/link";
import { BotonAlerta, BotonGenerarSemana } from "@/components/AccionesSemana";
import { Encabezado, Pill } from "@/components/Etiquetas";
import { emojiNivel, PillNivel, Tendencia } from "@/components/Semaforo";
import { NIVELES } from "@/db/schema";
import { fechaCorta, hoyISO, lunesDe } from "@/lib/fechas";
import { cartera, semanasConDatos } from "@/lib/semana";

export const dynamic = "force-dynamic";
export const metadata = { title: "Estado semanal" };
// Analizar todos los clientes con Claude puede llevar varios minutos.
export const maxDuration = 300;

export default async function Semana({ searchParams }: { searchParams: Promise<{ semana?: string; account?: string }> }) {
  const p = await searchParams;
  const actual = lunesDe(hoyISO());
  const semana = p.semana && /^\d{4}-\d{2}-\d{2}$/.test(p.semana) ? lunesDe(p.semana) : actual;
  const [filas, semanas] = await Promise.all([cartera(semana), semanasConDatos()]);
  const opcionesSemana = [...new Set([actual, ...semanas])].sort().reverse();
  const accounts = [...new Set(filas.map((f) => f.cliente.account).filter((a): a is string => !!a))].sort();
  const visibles = filas.filter((f) => !p.account || f.cliente.account === p.account);
  const conEstado = visibles.filter((f) => f.actual).sort((a, b) => b.actual!.nivel - a.actual!.nivel || (b.cliente.prioridad ?? 0) - (a.cliente.prioridad ?? 0));
  const sinEstado = visibles.filter((f) => !f.actual);
  const direccion = conEstado.filter((f) => f.actual!.paraDireccion);
  const upsell = conEstado.filter((f) => f.actual!.listas.oportunidades.length);
  const faltanTodos = filas.filter((f) => !f.actual).length;

  return (
    <>
      <Encabezado titulo="Estado semanal" detalle={`Semana del ${fechaCorta(semana)} · ${conEstado.length} de ${visibles.length} clientes activos analizados`}>
        {semana === actual && <BotonGenerarSemana semana={semana} faltan={faltanTodos} />}
        {conEstado.length > 0 && <BotonAlerta semana={semana} />}
      </Encabezado>

      <form className="mb-4 flex flex-wrap gap-2">
        <select name="semana" defaultValue={semana} className="campo !w-auto" aria-label="Semana">
          {opcionesSemana.map((s) => (
            <option key={s} value={s}>
              Semana del {fechaCorta(s)}
              {s === actual ? " (actual)" : ""}
            </option>
          ))}
        </select>
        <select name="account" defaultValue={p.account ?? ""} className="campo !w-auto" aria-label="Account">
          <option value="">Todos los accounts</option>
          {accounts.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <button className="boton-secundario">Ver</button>
      </form>

      <div className="mb-6 flex flex-wrap gap-2">
        {NIVELES.slice()
          .reverse()
          .map((n) => {
            const cant = conEstado.filter((f) => f.actual!.nivel === n.nivel).length;
            return (
              <span key={n.nivel} className={`panel flex items-center gap-2 px-3 py-2 text-sm ${cant ? "" : "opacity-50"}`}>
                <span aria-hidden>{emojiNivel(n.nivel)}</span>
                <span className="numeros font-bold">{cant}</span>
                <span className="text-suave">{n.nombre}</span>
              </span>
            );
          })}
      </div>

      {(direccion.length > 0 || upsell.length > 0) && (
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          {direccion.length > 0 && (
            <section className="panel p-5">
              <h2 className="mb-3 font-bold">Para la dirección</h2>
              <ul className="grid gap-3">
                {direccion.map(({ cliente, actual: e }) => (
                  <li key={cliente.id} className="text-sm">
                    <Link href={`/clientes/${cliente.id}?tab=historial`} className="enlace">
                      {cliente.nombre}
                    </Link>{" "}
                    <PillNivel nivel={e!.nivel} />
                    <p className="mt-0.5">{e!.paraDireccion}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {upsell.length > 0 && (
            <section className="panel p-5">
              <h2 className="mb-3 font-bold">Oportunidades de upsell</h2>
              <ul className="grid gap-3">
                {upsell.map(({ cliente, actual: e }) => (
                  <li key={cliente.id} className="text-sm">
                    <Link href={`/clientes/${cliente.id}?tab=historial`} className="enlace">
                      {cliente.nombre}
                    </Link>
                    <ul className="mt-0.5 list-disc pl-5">
                      {e!.listas.oportunidades.map((o) => (
                        <li key={o}>{o}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <div className="panel overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr>
              <th>Semáforo</th>
              <th>Cliente</th>
              <th>Respecto de la anterior</th>
              <th>Motivo</th>
              <th>Foco de la semana</th>
            </tr>
          </thead>
          <tbody>
            {conEstado.map(({ cliente, actual: e, anterior }) => (
              <tr key={cliente.id}>
                <td>
                  <PillNivel nivel={e!.nivel} />
                  {e!.ajustadoPor && <div className="mt-1 text-xs text-suave">Ajustado por {e!.ajustadoPor}</div>}
                </td>
                <td className="min-w-40">
                  <Link href={`/clientes/${cliente.id}?tab=historial`} className="enlace">
                    {cliente.nombre}
                  </Link>
                  <div className="text-xs text-suave">{cliente.account ?? "Sin account"}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {e!.paraDireccion && <Pill tono="critico">Dirección</Pill>}
                    {e!.listas.oportunidades.length > 0 && <Pill tono="ok">Upsell</Pill>}
                  </div>
                </td>
                <td>
                  <Tendencia actual={e!.nivel} anterior={anterior?.nivel} />
                </td>
                <td className="max-w-sm">{e!.motivo}</td>
                <td className="max-w-md">
                  <ul className="list-disc pl-4 text-suave">
                    {e!.listas.foco.slice(0, 3).map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
            {!conEstado.length && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-suave">
                  Todavía no hay estados para esta semana.
                  {semana === actual && " Se generan solos los lunes a la mañana, o con el botón de arriba."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {sinEstado.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-bold">Sin análisis esta semana</h2>
          <ul className="flex flex-wrap gap-2">
            {sinEstado.map(({ cliente, anterior }) => (
              <li key={cliente.id} className="panel flex items-center gap-2 px-3 py-1.5 text-sm">
                <Link href={`/clientes/${cliente.id}?tab=historial`} className="enlace">
                  {cliente.nombre}
                </Link>
                {anterior ? <PillNivel nivel={anterior.nivel} corto /> : <span className="text-xs text-suave">sin historial</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
