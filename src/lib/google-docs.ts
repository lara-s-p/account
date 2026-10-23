import "server-only";

type Elemento = { paragraph?: { elements?: { textRun?: { content?: string } }[] }; table?: { tableRows?: { tableCells?: { content?: Elemento[] }[] }[] } };
type Pestana = { tabProperties?: { tabId?: string }; documentTab?: { body?: { content?: Elemento[] } }; childTabs?: Pestana[] };

export function idDeDocumento(link: string): string | null {
  return link.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? null;
}

function textoDe(contenido: Elemento[] = []): string {
  return contenido
    .map((e) => {
      if (e.paragraph) return (e.paragraph.elements ?? []).map((x) => x.textRun?.content ?? "").join("");
      if (e.table) return (e.table.tableRows ?? []).map((f) => (f.tableCells ?? []).map((c) => textoDe(c.content).trim()).join(" | ")).join("\n") + "\n";
      return "";
    })
    .join("");
}

function aplanar(pestanas: Pestana[] = []): Pestana[] {
  return pestanas.flatMap((p) => [p, ...aplanar(p.childTabs)]);
}

/**
 * Lee el texto de una minuta de Google Docs con la cuenta de Google de quien está usando la plataforma.
 * Si el link apunta a una pestaña (?tab=t.xxx), lee solo esa pestaña.
 */
export async function leerGoogleDoc(link: string, accessToken: string): Promise<string> {
  const id = idDeDocumento(link);
  if (!id) throw new Error("El link no es de un documento de Google Docs.");
  const res = await fetch(`https://docs.googleapis.com/v1/documents/${id}?includeTabsContent=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("Tu sesión de Google venció. Cerrá sesión y volvé a entrar, o pegá el texto de la minuta.");
  if (res.status === 403 || res.status === 404) throw new Error("No tenés acceso a ese documento con tu cuenta de Google, o el link no existe.");
  if (!res.ok) throw new Error("Google Docs no respondió. Probá de nuevo o pegá el texto de la minuta.");
  const doc = (await res.json()) as { tabs?: Pestana[] };
  const todas = aplanar(doc.tabs);
  const tabId = link.match(/[?&]tab=([^&#]+)/)?.[1];
  const elegidas = tabId ? todas.filter((p) => p.tabProperties?.tabId === tabId) : todas;
  const texto = (elegidas.length ? elegidas : todas).map((p) => textoDe(p.documentTab?.body?.content)).join("\n\n").trim();
  if (!texto) throw new Error("El documento está vacío.");
  return texto;
}
