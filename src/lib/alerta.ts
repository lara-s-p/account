import "server-only";
import { emojiNivel } from "@/components/Semaforo";
import { fechaCorta } from "./fechas";
import { cartera } from "./semana";
import { idCanal, publicarEnSlack, slackConfigurado } from "./slack";

export const urlPlataforma = () =>
  (process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")).replace(/\/$/, "");

const corto = (t: string | null | undefined, max = 110) => {
  const s = (t ?? "").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
};

/**
 * Mensaje corto para el canal de accounts: conteo por color y, agrupados por account, solo los clientes
 * en amarillo o rojo o que empeoraron mucho, con una línea cada uno. El detalle queda en la página Estado semanal.
 */
export async function armarAlerta(semana: string): Promise<string> {
  const filas = (await cartera(semana)).filter((f) => f.actual);
  const rojos = filas.filter((f) => f.actual!.nivel >= 5).length;
  const amarillos = filas.filter((f) => f.actual!.nivel === 3 || f.actual!.nivel === 4).length;
  const verdes = filas.filter((f) => f.actual!.nivel <= 2).length;
  const destacar = filas
    // Amarillos y rojos, más los que saltaron dos niveles o más (un 1 → 2 no amerita aviso).
    .filter((f) => f.actual!.nivel >= 3 || (f.anterior && f.actual!.nivel - f.anterior.nivel >= 2))
    .sort((a, b) => b.actual!.nivel - a.actual!.nivel);
  const porAccount = new Map<string, typeof destacar>();
  for (const f of destacar) {
    const a = f.cliente.account ?? "Sin account";
    porAccount.set(a, [...(porAccount.get(a) ?? []), f]);
  }
  const lineas = [`*Cartera · semana del ${fechaCorta(semana)}*`, `🔴 ${rojos} en riesgo alto o crítico · 🟡 ${amarillos} en atención · 🟢 ${verdes} estables`];
  if (!destacar.length) lineas.push("", "Ningún cliente en amarillo o rojo esta semana.");
  for (const [account, lista] of [...porAccount.entries()].sort()) {
    lineas.push("", `*${account}*`);
    for (const { cliente, actual, anterior } of lista) {
      const empeoro = anterior && actual!.nivel > anterior.nivel ? " ▲ empeoró" : "";
      const direccion = actual!.paraDireccion ? " · para dirección" : "";
      lineas.push(`${emojiNivel(actual!.nivel)} *${cliente.nombre}*${empeoro}${direccion}: ${corto(actual!.listas.foco[0] ?? actual!.motivo)}`);
    }
  }
  const sinAnalisis = (await cartera(semana)).length - filas.length;
  if (sinAnalisis) lineas.push("", `_${sinAnalisis} cliente(s) activos sin análisis esta semana._`);
  lineas.push("", `<${urlPlataforma()}/semana?semana=${semana}|Ver el análisis completo>`);
  return lineas.join("\n");
}

export async function enviarAlerta(semana: string): Promise<{ ok: boolean; error?: string }> {
  const canal = idCanal(process.env.SLACK_CANAL_ACCOUNTS);
  if (!slackConfigurado()) return { ok: false, error: "Slack no está conectado." };
  if (!canal) return { ok: false, error: "Falta SLACK_CANAL_ACCOUNTS (el canal interno de accounts)." };
  try {
    await publicarEnSlack(canal, await armarAlerta(semana));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo publicar la alerta." };
  }
}
