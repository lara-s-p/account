import type { configuracionPendiente } from "@/lib/configuracion";

/** Pantalla que reemplaza a la plataforma mientras falten variables obligatorias en Vercel. */
export function ConfiguracionPendiente({ estado }: { estado: ReturnType<typeof configuracionPendiente> }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="panel w-full max-w-2xl p-8">
        <div className="text-2xl font-extrabold tracking-tight">
          <span className="text-marca">Known</span> Account
        </div>
        <h1 className="mt-4 text-lg font-bold">Falta terminar la configuración en Vercel</h1>
        <p className="mt-1 text-suave">
          Cargá estas variables en el proyecto de Vercel (Settings &gt; Environment Variables) y volvé a publicar (Deployments &gt; ⋯ &gt; Redeploy).
        </p>
        <ul className="mt-5 grid gap-3">
          {estado.faltan.map((v) => (
            <li key={v.nombre} className="rounded-lg border border-linea px-4 py-3">
              <code className="font-semibold text-critico">{v.nombre}</code>
              <p className="mt-0.5 text-sm text-suave">{v.ayuda}</p>
            </li>
          ))}
        </ul>
        {estado.opcionales.length > 0 && (
          <p className="mt-5 text-sm text-suave">
            Después se pueden sumar las integraciones (sin ellas la plataforma funciona y avisa qué falta): <code className="text-xs">{estado.opcionales.join(", ")}</code>.
          </p>
        )}
      </div>
    </div>
  );
}
