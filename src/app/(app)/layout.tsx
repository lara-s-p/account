import { signOut } from "@/auth";
import { Menu } from "@/components/Menu";
import { MODO_DESARROLLO, requerirUsuario } from "@/lib/sesion";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requerirUsuario();
  return (
    <div className="md:flex">
      <aside className="border-b border-linea bg-panel px-4 py-3 md:sticky md:top-0 md:flex md:h-screen md:w-56 md:shrink-0 md:flex-col md:border-r md:border-b-0 md:py-5">
        <div className="mb-3 flex items-baseline justify-between md:mb-6 md:block">
          <div className="text-lg font-extrabold tracking-tight">
            <span className="text-marca">Known</span> Account
          </div>
          <div className="text-xs text-suave">Área de Account MKT</div>
        </div>
        <Menu />
        <div className="mt-4 hidden border-t border-linea pt-4 text-xs text-suave md:mt-auto md:block">
          <div className="truncate font-medium text-tinta" title={usuario.email}>
            {usuario.nombre}
          </div>
          {MODO_DESARROLLO ? (
            <div>Sin login (desarrollo)</div>
          ) : (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button className="mt-1 text-marca-oscuro hover:underline">Cerrar sesión</button>
            </form>
          )}
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
