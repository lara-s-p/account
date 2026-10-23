/**
 * Completa las fichas de clientes con la planilla "Account Manager - Gestión Interna".
 *
 * Uso:
 *   npm run importar:clientes -- <gestion.xlsx>
 *
 * - Pestaña "Clientes": estado (ACTIVO/INACTIVO), país, servicios, inicio, sitio, contactos, accounts,
 *   analistas por área, diseño, redacción, frecuencia de reunión, plataformas, Looker, Blueprint,
 *   Jira, Trello y Handover.
 * - Pestaña "División Clientes": prioridad estratégica.
 *
 * El estado, los accounts y el equipo se toman siempre de la planilla (es la fuente de verdad de quién
 * lleva cada cliente). El resto de los campos solo se completa si en la plataforma está vacío, para no
 * pisar lo que se haya editado a mano. Los clientes activos que no existan se crean.
 */
import ExcelJS from "exceljs";
import { eq } from "drizzle-orm";
import { conectar } from "../src/db/conexion";
import { analistas, clientes, CODIGOS_SERVICIO, type Contacto } from "../src/db/schema";
import { claveNombre, formatoId, limpiar, numeroDeId } from "../src/lib/texto";
import { valorCelda } from "./excel";

/** Nombres de la planilla que en la plataforma (y en el sheet de minutas) figuran distinto. */
const EQUIVALENCIAS: Record<string, string> = {
  "121 - pacifico idiomas": "pacifico idiomas",
  "bakian - mitiga solutions": "mitiga",
  "simmons ec": "simmons",
  "swiss trading group": "swiss",
  "anura ar/pe": "anura argentina",
  acws: "animal care",
  "colloky chile": "colgram chile colloky",
  "opaline chile": "colgram chile opaline",
  chaide: "chaide chaide",
  "manar - molderil": "manar molderil",
  "bratopia/french": "bratopia / french postcard",
};

const VACIOS = new Set(["n/a", "-", "no tiene", "no posee", "no", ""]);
const texto = (v: unknown) => {
  const t = limpiar(v);
  return t && !VACIOS.has(t.toLowerCase()) ? t : null;
};

function link(celda: ExcelJS.Cell): string | null {
  const v = celda.value as { hyperlink?: string } | null;
  return v && typeof v === "object" && v.hyperlink ? v.hyperlink : null;
}

function servicios(v: unknown): { lista: string[]; sinCodigo: string | null } {
  const raw = texto(v);
  if (!raw) return { lista: [], sinCodigo: null };
  const antesDeParentesis = raw.split("(")[0];
  const codigos = antesDeParentesis.split(/[,\s]+/).map((c) => c.trim().toUpperCase()).filter(Boolean);
  const lista = [...new Set(codigos.map((c) => CODIGOS_SERVICIO[c]).filter(Boolean))];
  return { lista, sinCodigo: lista.length && !raw.includes("(") ? null : raw };
}

/**
 * La columna de contactos es texto libre: "Nombre <mail>", "mail (Nombre)", "mail /Nombre cargo/" o solo mails.
 * Cada mail toma la descripción que tiene pegada: la de antes si viene como "Nombre <mail>", si no la de después
 * en la misma línea, y si no hay, la de antes.
 */
export function contactos(v: unknown): Contacto[] {
  const raw = limpiar(v);
  if (!raw) return [];
  const mails = [...raw.matchAll(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g)];
  const limpio = (t: string) => t.replace(/[<>()/,;:|\n]+/g, " ").replace(/\s+/g, " ").trim();
  if (!mails.length) return raw.split(/\n+/).map((l) => limpio(l)).filter(Boolean).map((nombre) => ({ nombre }));
  const salida: Contacto[] = [];
  let libreDesde = 0;
  mails.forEach((m, i) => {
    const inicio = m.index!;
    const fin = inicio + m[0].length;
    const antes = raw.slice(libreDesde, inicio);
    // Lo que sigue al mail solo cuenta si está en la misma línea: lo de la línea siguiente es de otro contacto.
    const despues = raw.slice(fin, i + 1 < mails.length ? mails[i + 1].index : raw.length).split("\n")[0];
    let nombre: string;
    if (/<\s*$/.test(antes) && limpio(antes)) {
      nombre = limpio(antes);
      libreDesde = fin;
    } else if (limpio(despues)) {
      nombre = limpio(despues);
      libreDesde = fin + despues.length;
    } else {
      nombre = limpio(antes);
      libreDesde = fin;
    }
    salida.push({ nombre: nombre || m[0].split("@")[0], email: m[0] });
  });
  return salida;
}

function fechaISO(v: unknown): string | null {
  return v instanceof Date ? v.toISOString().slice(0, 10) : null;
}

function sitio(v: unknown, celda: ExcelJS.Cell): string | null {
  const t = link(celda) ?? texto(v)?.split(/[\s,]+/)[0];
  if (!t) return null;
  return /^https?:\/\//.test(t) ? t : `https://${t}`;
}

async function main() {
  if (process.argv[2] === "--probar-contactos") {
    for (const t of process.argv.slice(3)) console.log(JSON.stringify(contactos(t)));
    process.exit(0);
  }
  const ruta = process.argv[2];
  if (!ruta) {
    console.error("Uso: npm run importar:clientes -- <gestion.xlsx>");
    process.exit(1);
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ruta);
  const hoja = wb.getWorksheet("Clientes");
  if (!hoja) throw new Error('No se encontró la pestaña "Clientes".');

  const db = await conectar();
  const lista = await db.select().from(clientes);
  const porClave = new Map<string, (typeof lista)[number]>();
  for (const c of lista) {
    porClave.set(claveNombre(c.nombre), c);
    c.alias.forEach((a) => porClave.set(claveNombre(a), c));
  }
  const buscar = (nombre: string) => {
    const k = claveNombre(nombre);
    return porClave.get(k) ?? porClave.get(EQUIVALENCIAS[k] ?? "");
  };

  const listaAnalistas = await db.select().from(analistas);
  const primerNombre = (s: string) => claveNombre(s).split(/[\s.]+/)[0];
  const analistasNoEncontrados = new Set<string>();
  const analistaId = (v: unknown, area: string): number | null => {
    const t = texto(v);
    if (!t || /lider|one shot/i.test(t)) return null;
    const candidatos = listaAnalistas.filter((a) => primerNombre(a.nombre) === primerNombre(t));
    if (candidatos.length === 1) return candidatos[0].id;
    analistasNoEncontrados.add(`${t} (${area})`);
    return null;
  };

  // Prioridad estratégica desde "División Clientes"
  const prioridades = new Map<string, number>();
  wb.getWorksheet("División Clientes")?.eachRow((row, n) => {
    if (n === 1) return;
    const nombre = limpiar(valorCelda(row.getCell(1).value));
    const prioridad = Number(valorCelda(row.getCell(2).value));
    if (!nombre || !prioridad) return;
    const k = claveNombre(nombre);
    prioridades.set(EQUIVALENCIAS[k] ?? k, prioridad);
    if (k === "anura ar/pe") prioridades.set("anura peru", prioridad);
  });

  let ultimoId = Math.max(0, ...lista.map((c) => numeroDeId(c.id)));
  const resumen = { actualizados: 0, creados: 0, activos: 0, inactivos: 0, noEstanEnPlataforma: [] as string[], clavesJiraDistintas: [] as string[] };

  for (let n = 4; n <= hoja.rowCount; n++) {
    const fila = hoja.getRow(n);
    const v = (i: number) => valorCelda(fila.getCell(i).value);
    const nombre = limpiar(v(1));
    const estadoPlanilla = texto(v(2))?.toUpperCase();
    if (!nombre || !estadoPlanilla) continue;
    const activo = estadoPlanilla === "ACTIVO";
    activo ? resumen.activos++ : resumen.inactivos++;

    const previo = buscar(nombre);
    if (!previo && !activo) {
      resumen.noEstanEnPlataforma.push(nombre);
      continue;
    }

    const serv = servicios(v(4));
    const jiraLink = link(fila.getCell(18));
    const jiraKey = jiraLink?.match(/projects\/([A-Z0-9]+)|browse\/([A-Z0-9]+)$/)?.slice(1).find(Boolean) ?? null;
    const handover = link(fila.getCell(25));
    const prioridad = prioridades.get(claveNombre(previo?.nombre ?? nombre)) ?? prioridades.get(claveNombre(nombre)) ?? null;

    // Siempre desde la planilla: quién lleva al cliente y si está activo.
    const siempre = {
      estado: activo ? "Activo" : "Baja",
      account: texto(v(8)),
      accountApoyo: texto(v(9)),
      analistaSeoId: analistaId(v(10), "SEO"),
      analistaEmailId: analistaId(v(11), "Email"),
      analistaPaidId: analistaId(v(12), "Paid"),
      disenadora: texto(v(13)),
      redactora: texto(v(14)),
      prioridad,
    };
    // Solo si en la plataforma está vacío.
    const siVacio = {
      pais: texto(v(3)),
      servicios: serv.lista,
      fechaInicio: fechaISO(v(5)),
      sitioWeb: sitio(v(6), fila.getCell(6)),
      contactos: contactos(v(7)),
      frecuenciaReunion: texto(v(19)),
      trelloTablero: link(fila.getCell(20)),
      plataformaEcommerce: texto(v(21)),
      plataformaEmail: texto(v(22)),
      lookerStudio: link(fila.getCell(23)),
      blueprint: link(fila.getCell(17)),
      jiraProjectKey: jiraKey,
      notas: [
        serv.sinCodigo ? `Servicios según la planilla: ${serv.sinCodigo}` : null,
        texto(v(16)) && texto(v(15)) === "Si" ? `Soporte evolutivo: ${texto(v(16))}` : null,
        handover ? `Handover: ${handover}` : null,
        texto(v(25)) && !handover ? `Observaciones: ${texto(v(25))}` : null,
      ]
        .filter(Boolean)
        .join("\n") || null,
    };

    if (previo) {
      const cambios: Record<string, unknown> = { ...siempre, actualizadoEn: new Date() };
      for (const [k, val] of Object.entries(siVacio)) {
        const actual = previo[k as keyof typeof previo];
        const vacio = actual == null || actual === "" || (Array.isArray(actual) && !actual.length);
        if (vacio && val != null && !(Array.isArray(val) && !val.length)) cambios[k] = val;
      }
      if (jiraKey && previo.jiraProjectKey && previo.jiraProjectKey !== jiraKey) {
        resumen.clavesJiraDistintas.push(`${previo.nombre}: sheet de minutas ${previo.jiraProjectKey}, planilla ${jiraKey}`);
      }
      if (claveNombre(nombre) !== claveNombre(previo.nombre) && !previo.alias.some((a) => claveNombre(a) === claveNombre(nombre))) {
        cambios.alias = [...previo.alias, nombre.trim()];
      }
      await db.update(clientes).set(cambios).where(eq(clientes.id, previo.id));
      resumen.actualizados++;
    } else {
      const id = formatoId("CLI", ++ultimoId, 3);
      await db.insert(clientes).values({ id, nombre: nombre.trim(), ...siempre, ...siVacio });
      resumen.creados++;
    }
  }

  // Clientes de la plataforma que no figuran en la planilla: quedan como estaban, para revisar.
  const enPlanilla = new Set<string>();
  for (let n = 4; n <= hoja.rowCount; n++) {
    const nombre = limpiar(valorCelda(hoja.getRow(n).getCell(1).value));
    const c = nombre ? buscar(nombre) : undefined;
    if (c) enPlanilla.add(c.id);
  }
  const fuera = (await db.select({ id: clientes.id, nombre: clientes.nombre }).from(clientes)).filter((c) => !enPlanilla.has(c.id));

  console.log("Fichas completadas:", { actualizados: resumen.actualizados, creados: resumen.creados, activosEnPlanilla: resumen.activos, inactivosEnPlanilla: resumen.inactivos });
  if (fuera.length) console.log("En la plataforma pero no en la planilla (quedan sin cambios):", fuera.map((c) => c.nombre).join(", "));
  if (resumen.noEstanEnPlataforma.length) console.log("Inactivos de la planilla que no se crean:", resumen.noEstanEnPlataforma.join(", "));
  if (analistasNoEncontrados.size) console.log("Analistas de la planilla sin coincidencia en la plataforma:", [...analistasNoEncontrados].join(", "));
  if (resumen.clavesJiraDistintas.length) console.log("Proyecto de Jira distinto entre el sheet y la planilla:\n  " + resumen.clavesJiraDistintas.join("\n  "));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
