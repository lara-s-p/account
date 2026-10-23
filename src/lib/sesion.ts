import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export type Usuario = { email: string; nombre: string; googleAccessToken?: string };

/** Sin credenciales de Google y fuera de producción, se entra como usuario de prueba. */
export const MODO_DESARROLLO = !process.env.AUTH_GOOGLE_ID && process.env.NODE_ENV !== "production";

export async function usuarioActual(): Promise<Usuario | null> {
  if (MODO_DESARROLLO) return { email: "desarrollo@knownonline.com", nombre: "Modo desarrollo" };
  const sesion = await auth();
  if (!sesion?.user?.email) return null;
  const vigente = sesion.googleExpira && sesion.googleExpira * 1000 > Date.now() + 60_000;
  return {
    email: sesion.user.email,
    nombre: sesion.user.name || sesion.user.email,
    googleAccessToken: vigente ? sesion.googleAccessToken : undefined,
  };
}

export async function requerirUsuario(): Promise<Usuario> {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/login");
  return usuario;
}
