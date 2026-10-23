import "server-only";

/** Crea tarjetas en Trello con TRELLO_KEY y TRELLO_TOKEN (trello.com/power-ups/admin > API key). */
const BASE = process.env.TRELLO_API_BASE || "https://api.trello.com/1";
const LISTA_MINUTAS = "minutas";
const MAX_DESCRIPCION = 16_000; // Trello admite hasta 16.384 caracteres

export const trelloConfigurado = () => Boolean(process.env.TRELLO_KEY && process.env.TRELLO_TOKEN);

/** De "https://trello.com/b/N1oXAr21/animal-care-ko" saca "N1oXAr21". */
export function idTablero(url: string | null | undefined): string | null {
  return String(url ?? "").match(/trello\.com\/b\/([A-Za-z0-9]+)/)?.[1] ?? null;
}

async function trello<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const sep = ruta.includes("?") ? "&" : "?";
  const url = `${BASE}${ruta}${sep}key=${process.env.TRELLO_KEY}&token=${process.env.TRELLO_TOKEN}`;
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init.headers }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Trello rechazó la key o el token.");
    if (res.status === 404) throw new Error("No se encontró el tablero de Trello del cliente (o el usuario no tiene acceso).");
    throw new Error(`Trello respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

/** Crea la tarjeta de la minuta en la lista "Minutas" del tablero del cliente y devuelve su link. */
export async function crearTarjetaMinuta(tablero: string, titulo: string, descripcion: string): Promise<string> {
  if (!trelloConfigurado()) throw new Error("Trello no está conectado: faltan TRELLO_KEY y TRELLO_TOKEN.");
  const listas = await trello<{ id: string; name: string }[]>(`/boards/${tablero}/lists?filter=open`);
  const lista = listas.find((l) => l.name.trim().toLowerCase().startsWith(LISTA_MINUTAS));
  if (!lista) throw new Error('El tablero de Trello no tiene una lista llamada "Minutas".');
  const desc = descripcion.length > MAX_DESCRIPCION ? descripcion.slice(0, MAX_DESCRIPCION) + "\n\n(Minuta recortada por el límite de Trello)" : descripcion;
  const tarjeta = await trello<{ shortUrl: string }>("/cards", {
    method: "POST",
    body: JSON.stringify({ idList: lista.id, name: titulo, desc, pos: "top" }),
  });
  return tarjeta.shortUrl;
}
