const EXAMPLE = {
  titulo: "Zapatillas Urbanas Azul Eléctrico, Livianas y Cómodas",
  descripcion: "Pensadas para moverte por la ciudad sin pensar en los pies. Su capellada de malla respirable mantiene la frescura y la suela de goma con amortiguación absorbe cada paso.\n\nCombinan con jeans, joggers o bermudas, y el azul eléctrico le da un toque de color a cualquier outfit. Ideales para el día a día, caminar o viajar.",
  puntos: ["Capellada de malla respirable", "Suela de goma con amortiguación", "Livianas: ideales para uso diario", "Talles del 38 al 45"],
  meta: "Zapatillas urbanas azul eléctrico, livianas y respirables, con suela amortiguada. Comodidad para todo el día. Envío gratis desde $100.000.",
  faltantes: [],
};

const $ = (id) => document.getElementById(id);
let current = EXAMPLE;

function listItems(items) {
  return items.map((text) => Object.assign(document.createElement("li"), { textContent: text }));
}

function render(data, isExample) {
  current = data;
  $("badge").textContent = isExample ? "Ejemplo" : "Listo";
  $("out-titulo").textContent = data.titulo;
  $("out-descripcion").textContent = data.descripcion;
  $("out-meta").textContent = data.meta;
  $("title-count").textContent = `${data.titulo.length} / 70 caracteres`;
  $("title-count").classList.toggle("over", data.titulo.length > 70);
  $("meta-count").textContent = `${data.meta.length} / 155 caracteres`;
  $("meta-count").classList.toggle("over", data.meta.length > 155);
  $("out-puntos").replaceChildren(...listItems(data.puntos));
  $("puntos-block").hidden = !data.puntos.length;
  $("out-faltantes").replaceChildren(...listItems(data.faltantes));
  $("faltantes-block").hidden = !data.faltantes.length;
}

function showNotice(message) {
  $("notice").textContent = message;
  $("notice").hidden = !message;
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 1800);
}

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const url = $("url").value.trim();
  if (!/^https?:\/\/\S+\.\S+/.test(url)) {
    showNotice("Pegá un link completo, que empiece con https://");
    $("url").focus();
    return;
  }

  showNotice("");
  $("submit").disabled = true;
  $("status").hidden = false;
  try {
    const res = await fetch("/api/redactar", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Codigo-Acceso": $("code").value },
      body: JSON.stringify({
        url,
        info: $("info").value,
        tone: $("tone").value,
        length: $("length").value,
        keyword: $("keyword").value,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showNotice(data.error || "No se pudo completar la redacción. Probá de nuevo en un momento.");
      return;
    }
    render(data, false);
    if (!data.paginaLeida) {
      showNotice("No pude leer la página, así que el texto se basa solo en la información que pegaste.");
    }
  } catch {
    showNotice("No hay conexión con el servidor. Revisá que la página esté publicada en Vercel.");
  } finally {
    $("submit").disabled = false;
    $("status").hidden = true;
  }
});

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-copy]");
  if (!btn) return;
  const key = btn.dataset.copy;
  const text = key === "puntos" ? current.puntos.map((p) => "• " + p).join("\n") : current[key];
  try {
    await navigator.clipboard.writeText(text);
    toast("Copiado");
  } catch {
    toast("No se pudo copiar. Seleccioná el texto y copialo a mano.");
  }
});

render(EXAMPLE, true);
