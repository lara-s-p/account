"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", texto: "Inicio" },
  { href: "/bandeja", texto: "Bandeja" },
  { href: "/clientes", texto: "Clientes" },
  { href: "/reuniones", texto: "Reuniones" },
  { href: "/tareas", texto: "Tareas" },
];

const PROXIMAMENTE = ["Estado semanal", "Objetivos", "Pre-reunión"];

export function Menu({ enBandeja }: { enBandeja: number }) {
  const ruta = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible" aria-label="Secciones">
      {ITEMS.map((i) => {
        const activo = i.href === "/" ? ruta === "/" : ruta.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={activo ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap ${
              activo ? "bg-marca-suave text-marca-oscuro" : "text-tinta hover:bg-fondo"
            }`}
          >
            {i.texto}
            {i.href === "/bandeja" && enBandeja > 0 && (
              <span className="numeros ml-2 rounded-full bg-marca px-1.5 py-0.5 text-xs font-bold text-white">{enBandeja}</span>
            )}
          </Link>
        );
      })}
      <div className="mt-4 hidden px-3 text-xs font-semibold tracking-wide text-suave uppercase md:block">Próximamente</div>
      {PROXIMAMENTE.map((t) => (
        <span key={t} className="hidden px-3 py-1.5 text-sm text-suave/80 md:block">
          {t}
        </span>
      ))}
    </nav>
  );
}
