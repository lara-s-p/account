const products = [
  { id: 1, name: "Remera básica", category: "Ropa", price: 12999, oldPrice: 15999, emoji: "👕" },
  { id: 2, name: "Jean clásico", category: "Ropa", price: 34999, emoji: "👖" },
  { id: 3, name: "Zapatillas urbanas", category: "Calzado", price: 59999, oldPrice: 69999, emoji: "👟" },
  { id: 4, name: "Botas de cuero", category: "Calzado", price: 84999, emoji: "🥾" },
  { id: 5, name: "Auriculares inalámbricos", category: "Tecnología", price: 45999, emoji: "🎧" },
  { id: 6, name: "Smartwatch", category: "Tecnología", price: 99999, oldPrice: 119999, emoji: "⌚" },
  { id: 7, name: "Mochila urbana", category: "Accesorios", price: 27999, emoji: "🎒" },
  { id: 8, name: "Anteojos de sol", category: "Accesorios", price: 18999, emoji: "🕶️" },
  { id: 9, name: "Lámpara de escritorio", category: "Hogar", price: 22999, emoji: "💡" },
  { id: 10, name: "Taza de cerámica", category: "Hogar", price: 6999, oldPrice: 8999, emoji: "☕" },
];

const cart = new Map();
let currentCategory = "Todos";
let searchTerm = "";

const $ = (sel) => document.querySelector(sel);
const formatPrice = (n) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

function renderFilters() {
  const categories = ["Todos", ...new Set(products.map((p) => p.category))];
  $("#filters").innerHTML = categories
    .map((c) => `<button class="chip ${c === currentCategory ? "active" : ""}" data-category="${c}">${c}</button>`)
    .join("");
}

function renderProducts() {
  const list = products.filter(
    (p) =>
      (currentCategory === "Todos" ||
        p.category === currentCategory ||
        (currentCategory === "Ofertas" && p.oldPrice)) &&
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  $("#products-title").textContent = currentCategory === "Todos" ? "Todos los productos" : currentCategory;
  $("#products").innerHTML = list.length
    ? list
        .map(
          (p) => `
      <article class="card">
        <div class="card-img">${p.emoji}</div>
        <div class="card-body">
          <span class="card-cat">${p.category}</span>
          <span class="card-title">${p.name}</span>
          <span class="card-price">${formatPrice(p.price)}${p.oldPrice ? `<s>${formatPrice(p.oldPrice)}</s>` : ""}</span>
          <button class="btn" data-add="${p.id}">Agregar al carrito</button>
        </div>
      </article>`
        )
        .join("")
    : `<p class="empty">No encontramos productos para tu búsqueda.</p>`;
}

function renderCart() {
  const items = [...cart.values()];
  const count = items.reduce((sum, i) => sum + i.qty, 0);
  const total = items.reduce((sum, i) => sum + i.qty * i.product.price, 0);
  $("#cart-count").textContent = count;
  $("#cart-total").textContent = formatPrice(total);
  $("#cart-items").innerHTML = items.length
    ? items
        .map(
          ({ product: p, qty }) => `
      <li class="cart-item">
        <span class="emoji">${p.emoji}</span>
        <div class="info"><strong>${p.name}</strong><br>${formatPrice(p.price)}</div>
        <div class="qty">
          <button data-dec="${p.id}">−</button>${qty}<button data-inc="${p.id}">+</button>
        </div>
      </li>`
        )
        .join("")
    : `<li class="empty">Tu carrito está vacío.</li>`;
}

function changeQty(id, delta) {
  const product = products.find((p) => p.id === id);
  const item = cart.get(id) || { product, qty: 0 };
  item.qty += delta;
  if (item.qty <= 0) cart.delete(id);
  else cart.set(id, item);
  renderCart();
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 1800);
}

function selectCategory(category) {
  currentCategory = category;
  renderFilters();
  renderProducts();
  $("#productos").scrollIntoView({ behavior: "smooth" });
}

function toggleCart(show) {
  $("#cart").classList.toggle("show", show);
  $("#overlay").classList.toggle("show", show);
}

document.addEventListener("click", (e) => {
  const t = e.target;
  if (t.dataset.category) selectCategory(t.dataset.category);
  if (t.dataset.add) {
    changeQty(Number(t.dataset.add), 1);
    toast("Producto agregado al carrito");
  }
  if (t.dataset.inc) changeQty(Number(t.dataset.inc), 1);
  if (t.dataset.dec) changeQty(Number(t.dataset.dec), -1);
});

$("#cart-btn").addEventListener("click", () => toggleCart(true));
$("#cart-close").addEventListener("click", () => toggleCart(false));
$("#overlay").addEventListener("click", () => toggleCart(false));
$("#menu-toggle").addEventListener("click", () => $("#nav").classList.toggle("open"));
$("#categories-btn").addEventListener("click", (e) => e.currentTarget.parentElement.classList.toggle("open"));
$("#search").addEventListener("submit", (e) => {
  e.preventDefault();
  searchTerm = $("#search-input").value.trim();
  renderProducts();
  $("#productos").scrollIntoView({ behavior: "smooth" });
});
$("#checkout").addEventListener("click", () => {
  if (!cart.size) return toast("Agregá productos antes de finalizar");
  cart.clear();
  renderCart();
  toggleCart(false);
  toast("¡Gracias por tu compra! (demo)");
});

renderFilters();
renderProducts();
renderCart();
