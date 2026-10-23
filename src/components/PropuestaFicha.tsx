"use client";

import { useState, useTransition } from "react";
import { proponerFichaAccion } from "@/app/acciones";
import type { PropuestaFicha as Propuesta } from "@/lib/propuesta-ficha";

const CAMPOS: { campo: keyof Omit<Propuesta, "fuentes" | "avisos">; etiqueta: string }[] = [
  { campo: "industria", etiqueta: "Industria" },
  { campo: "pais", etiqueta: "País" },
  { campo: "plataformaEcommerce", etiqueta: "Plataforma e-commerce" },
  { campo: "descripcionNegocio", etiqueta: "Descripción del negocio" },
  { campo: "objetivosNegocio", etiqueta: "Objetivos del negocio" },
  { campo: "competidores", etiqueta: "Competidores" },
];

/** Pasa un valor al campo del formulario de la ficha (no guarda: eso lo hace el account con "Guardar ficha"). */
function usar(campo: string, valor: string) {
  const el = document.getElementById(campo) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!el) return;
  el.value = valor;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.classList.add("!border-marca");
}

export function PropuestaFicha({ clienteId }: { clienteId: string }) {
  const [cargando, iniciar] = useTransition();
  const [resultado, setResultado] = useState<{ propuesta?: Propuesta; error?: string }>();
  const [usados, setUsados] = useState<Set<string>>(new Set());
  const p = resultado?.propuesta;
  const sugerencias = p ? CAMPOS.filter((c) => p[c.campo]) : [];

  function aplicar(campo: string, valor: string) {
    usar(campo, valor);
    setUsados((u) => new Set(u).add(campo));
  }

  return (
    <section className="panel mb-5 grid gap-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold">¿No hay blueprint o la ficha está incompleta?</h2>
          <p className="text-sm text-suave">
            Claude arma un borrador con las tareas, las reuniones, las notas del account, el sitio web y el Blueprint si hay. Revisalo, pasá lo que sirva a la ficha y guardá.
          </p>
        </div>
        <button type="button" className="boton-secundario" disabled={cargando} onClick={() => iniciar(async () => setResultado(await proponerFichaAccion(clienteId)))}>
          {cargando ? "Armando la propuesta…" : p ? "Volver a proponer" : "Proponer ficha con IA"}
        </button>
      </div>
      {resultado?.error && <p className="text-sm text-critico">{resultado.error}</p>}
      {p && (
        <>
          <p className="text-xs text-suave">
            Fuentes: {p.fuentes.join(", ")}.{p.avisos.length > 0 && <span className="text-alerta"> {p.avisos.join(" ")}</span>}
          </p>
          {!sugerencias.length && <p className="text-sm text-suave">Con la información disponible no se pudo deducir ningún campo con claridad.</p>}
          <ul className="grid gap-3">
            {sugerencias.map(({ campo, etiqueta }) => (
              <li key={campo} className="grid gap-1 rounded-lg border border-linea p-3 sm:grid-cols-[1fr_auto] sm:items-start">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-suave">{etiqueta}</div>
                  <p className="text-sm">{p[campo]}</p>
                </div>
                <button type="button" className="boton-secundario" disabled={usados.has(campo)} onClick={() => aplicar(campo, p[campo]!)}>
                  {usados.has(campo) ? "Pasado a la ficha" : "Usar"}
                </button>
              </li>
            ))}
          </ul>
          {sugerencias.length > 1 && (
            <button type="button" className="boton-secundario justify-self-start" onClick={() => sugerencias.forEach(({ campo }) => aplicar(campo, p[campo]!))}>
              Usar todo
            </button>
          )}
          {usados.size > 0 && <p className="text-sm text-alerta">Los campos marcados en naranja todavía no están guardados: revisalos y tocá &quot;Guardar ficha&quot;.</p>}
        </>
      )}
    </section>
  );
}
