import type { Cliente } from "@/db/schema";

/** Campos que hacen a una ficha completa, agrupados como se muestran en la pantalla. */
export const CAMPOS_FICHA: { campo: keyof Cliente; etiqueta: string }[] = [
  { campo: "account", etiqueta: "Account" },
  { campo: "industria", etiqueta: "Industria" },
  { campo: "pais", etiqueta: "País" },
  { campo: "sitioWeb", etiqueta: "Sitio web" },
  { campo: "plataformaEcommerce", etiqueta: "Plataforma e-commerce" },
  { campo: "descripcionNegocio", etiqueta: "Descripción del negocio" },
  { campo: "objetivosNegocio", etiqueta: "Objetivos del negocio" },
  { campo: "servicios", etiqueta: "Servicios contratados" },
  { campo: "fechaInicio", etiqueta: "Cliente desde" },
  { campo: "frecuenciaReunion", etiqueta: "Frecuencia de reunión" },
  { campo: "contactos", etiqueta: "Contactos" },
  { campo: "jiraProjectKey", etiqueta: "Proyecto de Jira" },
  { campo: "slackCanal", etiqueta: "Canal de Slack" },
  { campo: "trelloTablero", etiqueta: "Tablero de Trello" },
];

function tieneValor(v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0;
  return v != null && String(v).trim() !== "";
}

export function completitudFicha(c: Cliente): { porcentaje: number; faltan: string[] } {
  const faltan = CAMPOS_FICHA.filter(({ campo }) => !tieneValor(c[campo])).map((f) => f.etiqueta);
  if (c.estado === "Revisar") faltan.unshift("Estado");
  const total = CAMPOS_FICHA.length + 1;
  return { porcentaje: Math.round(((total - faltan.length) / total) * 100), faltan };
}
