import Link from "next/link";
import { Encabezado, Pill } from "@/components/Etiquetas";
import { listarClientes, listarReuniones, resumenInicio } from "@/lib/consultas";
import { diasEntre, fechaCorta, hoyISO } from "@/lib/fechas";

export const dynamic = "force-dynamic";

function Numero({ valor, texto, href, tono }: { valor: number; texto: string; href: string; tono?: "critico" | "alerta" }) {
  const color = tono === "critico" && valor ? "text-critico" : tono === "alerta" && valor ? "text-alerta" : "text-tinta";
  return (
    <Link href={href} className="panel block p-4 hover:border-marca">
      <div className={`numeros text-3xl font-extrabold ${color}`}>{valor.toLocaleString("es-AR")}</div>
      <div className="mt-1 text-sm text-suave">{texto}</div>
    </Link>
  );
}

export default async function Inicio() {
  const hoy = hoyISO();
  const [r, clientes, ultimas] = await Promise.all([resumenInicio(), listarClientes(), listarReuniones({ limite: 8 })]);

  // Qué clientes atender primero: activos con señales de alerta, de más a menos grave.
  const atencion = clientes
    .filter((c) => c.cliente.estado === "Activo")
    .map((c) => {
      const dias = c.ultimaReunion ? diasEntre(c.ultimaReunion, hoy) : null;
      const motivos: { texto: string; peso: number }[] = [];
      if (c.vencidas) motivos.push({ texto: `${c.vencidas} vencidas`, peso: 3 * c.vencidas });
      if (dias == null) motivos.push({ texto: "sin reuniones", peso: 6 });
      else if (dias > 30) motivos.push({ texto: `${dias} días sin reunión`, peso: dias / 10 });
      if (c.sinDecidir > 8) motivos.push({ texto: `${c.sinDecidir} sin decidir`, peso: c.sinDecidir / 4 });
      return { ...c, dias, motivos, peso: motivos.reduce((s, m) => s + m.peso, 0) };
    })
    .filter((c) => c.motivos.length)
    .sort((a, b) => b.peso - a.peso)
    .slice(0, 10);

  return (
    <>
      <Encabezado titulo="Inicio" detalle={`Hoy ${fechaCorta(hoy)}`}>
        <Link href="/reuniones/nueva" className="boton">
          Cargar minuta
        </Link>
      </Encabezado>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Numero valor={r.sinDecidir} texto="Tareas sin decidir" href="/tareas?vista=sin-decidir" tono="alerta" />
        <Numero valor={r.vencidas} texto="Tareas vencidas" href="/tareas?vista=vencidas" tono="critico" />
        <Numero valor={r.abiertas} texto="Tareas abiertas" href="/tareas?vista=abiertas" />
        <Numero valor={r.sinFecha} texto="Abiertas sin fecha límite" href="/tareas?vista=sin-fecha" tono="alerta" />
        <Numero valor={r.reunionesSemana} texto="Reuniones en los últimos 7 días" href="/reuniones" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="panel min-w-0 p-5">
          <h2 className="font-bold">Clientes para atender primero</h2>
          <p className="mb-3 text-xs text-suave">Clientes activos con tareas vencidas, muchos días sin reunión o muchas tareas sin decidir.</p>
          {atencion.length ? (
            <ul className="divide-y divide-linea">
              {atencion.map((c) => (
                <li key={c.cliente.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/clientes/${c.cliente.id}`} className="enlace">
                    {c.cliente.nombre}
                  </Link>
                  <span className="flex flex-wrap gap-1">
                    {c.motivos.map((m) => (
                      <Pill key={m.texto} tono={m.texto.includes("vencidas") ? "critico" : "alerta"}>
                        {m.texto}
                      </Pill>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-suave">Ningún cliente activo tiene alertas.</p>
          )}
        </section>

        <section className="panel min-w-0 p-5">
          <h2 className="mb-3 font-bold">Últimas reuniones</h2>
          <ul className="divide-y divide-linea">
            {ultimas.map(({ reunion, cliente, cantTareas, sinDecidir }) => (
              <li key={reunion.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/reuniones/${reunion.id}`} className="min-w-0">
                  <span className="enlace">{cliente}</span>
                  <span className="ml-2 text-suave">{fechaCorta(reunion.fecha)}</span>
                </Link>
                <span className="flex gap-1">
                  <Pill>{cantTareas} tareas</Pill>
                  {sinDecidir > 0 && <Pill tono="alerta">{sinDecidir} sin decidir</Pill>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
