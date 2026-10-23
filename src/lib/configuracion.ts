import "server-only";
import { MODO_DESARROLLO } from "./sesion";

/** Variables sin las cuales la plataforma no puede funcionar en producción. */
const OBLIGATORIAS = [
  { nombre: "DATABASE_URL", ayuda: "Se crea sola al agregar una base Neon en Storage, dentro del proyecto de Vercel." },
  { nombre: "AUTH_SECRET", ayuda: "Un texto al azar de al menos 32 caracteres (por ejemplo, el resultado de openssl rand -base64 32)." },
  { nombre: "AUTH_GOOGLE_ID", ayuda: "Google Cloud Console > APIs y servicios > Credenciales > ID de cliente OAuth." },
  { nombre: "AUTH_GOOGLE_SECRET", ayuda: "Lo da Google junto con el ID de cliente." },
];

/** Integraciones que se pueden sumar después: sin ellas la plataforma funciona y avisa en cada sección. */
const OPCIONALES = ["ANTHROPIC_API_KEY", "JIRA_EMAIL", "JIRA_TOKEN", "SLACK_TOKEN", "SLACK_CANAL_ACCOUNTS", "TRELLO_KEY", "TRELLO_TOKEN", "CRON_SECRET", "JIRA_WEBHOOK_SECRET", "APP_URL"];

export function configuracionPendiente() {
  if (MODO_DESARROLLO) return { faltan: [], opcionales: [] };
  return {
    faltan: OBLIGATORIAS.filter((v) => !process.env[v.nombre]),
    opcionales: OPCIONALES.filter((v) => !process.env[v]),
  };
}
