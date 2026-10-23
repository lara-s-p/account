import { redirect } from "next/navigation";
import { DOMINIO, signIn } from "@/auth";
import { usuarioActual } from "@/lib/sesion";

export const metadata = { title: "Ingresar" };

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await usuarioActual()) redirect("/");
  const { error } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="panel w-full max-w-sm p-8">
        <div className="text-2xl font-extrabold tracking-tight">
          <span className="text-marca">Known</span> Account
        </div>
        <p className="mt-1 mb-6 text-suave">Clientes, reuniones y tareas del área de Account MKT.</p>
        {error && (
          <p className="mb-4 rounded-lg bg-critico-suave px-3 py-2 text-sm text-critico">
            {error === "AccessDenied" ? `Solo pueden entrar cuentas @${DOMINIO}.` : "No se pudo iniciar sesión. Probá de nuevo."}
          </p>
        )}
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button className="boton w-full">Ingresar con Google</button>
        </form>
        <p className="mt-4 text-xs text-suave">Usá tu cuenta @{DOMINIO}.</p>
      </div>
    </div>
  );
}
