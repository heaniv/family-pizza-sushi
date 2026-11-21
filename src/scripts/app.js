import { icon } from "./icons.js";
import { MENU } from "../data/menu.js";
import { dishImage } from "../data/dish-images.js";
import {
  itemById,
  findItems,
  validCart,
  total,
  money,
  orderText,
} from "./core.js";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const STORAGE = "family-order-v1";
let category = "pizza",
  group = "Піца 30 см",
  query = "",
  limit = 6,
  cart = [],
  toastTimer,
  lastTrigger;
let pendingRequestId;
const telegramWebApp = window.Telegram?.WebApp;
const ordersEnabled =
  document.querySelector('meta[name="orders-enabled"]')?.content === "true";
telegramWebApp?.ready();
telegramWebApp?.expand();
if (!ordersEnabled) {
  $("#checkout-toggle").hidden = true;
  $("#telegram-order-link").hidden = true;
  $("#cart-explanation").textContent =
    "Щоб оформити замовлення, зателефонуйте нам. Вартість доставки підтвердить адміністратор; оплата — при отриманні.";
}
const telegramUsername = document
  .querySelector('meta[name="telegram-bot-username"]')
  ?.content.replace(/^@/, "");
if (
  ordersEnabled &&
  telegramUsername &&
  /^[A-Za-z0-9_]{5,32}$/.test(telegramUsername)
) {
  const telegramLink = $("#telegram-order-link");
  telegramLink.href = `https://t.me/${telegramUsername}`;
  telegramLink.hidden = false;
}
try {
  cart = validCart(JSON.parse(localStorage.getItem(STORAGE) || "[]"));
} catch {}
const categories = ["pizza", "sushi", "hot", "salads", "sides", "desserts"];
$("#categories").innerHTML = categories
  .map((id) => {
    const c = MENU.find((c) => c.id === id);
    return `<button class="category-tab" data-category="${id}" aria-pressed="${id === category}"><span class="category-icon" aria-hidden="true">${icon(id)}</span>${escape(c.name)}</button>`;
  })
  .join("");
function groups() {
  const c = MENU.find((c) => c.id === category);
  $("#group-select").innerHTML =
    `<option value="">Усі розділи · ${escape(c.name)}</option>` +
    c.groups
      .map(
        (g) => `<option value="${escape(g.name)}">${escape(g.name)}</option>`,
      )
      .join("");
  $("#group-select").value = group;
}
function renderMenu() {
  let result = findItems(category, group, query);
  if (!query && category === "pizza" && group === "Піца 30 см")
    result = [
      ...result.filter((i) => !i.name.startsWith("Фокача")),
      ...result.filter((i) => i.name.startsWith("Фокача")),
    ];
  $("#menu-title").textContent = query
    ? "Результати пошуку"
    : group || MENU.find((c) => c.id === category).name;
  $("#results-count").textContent =
    `${Math.min(limit, result.length)} із ${result.length} позицій`;
  $("#clear-search").hidden = !query;
  $("#group-select").disabled = !!query;
  $("#menu-items").innerHTML = result.length
    ? result
        .slice(0, limit)
        .map(
          (i) =>
            `<article class="dish"><div class="dish-photo"><img src="${dishImage(i)}" alt="Ілюстративне фото: ${escape(i.group)}" loading="lazy" decoding="async"><span class="dish-photo-label">${escape(i.group)}</span></div><div class="dish-content"><div class="dish-meta"><span>${escape(i.weight || i.group)}</span>${i.tag ? `<span class="dish-tag">${escape(i.tag)}</span>` : ""}</div><h4>${escape(i.name)}</h4>${i.description ? `<p class="dish-description">${escape(i.description)}</p>` : `<p class="dish-description">${escape(i.group)}</p>`}<div class="dish-bottom"><span class="dish-price">${i.price} <small>₴</small></span><button class="dish-add" data-add="${i.id}" aria-label="Додати: ${escape(i.name)}, ${escape(i.group)}">${icon("plus")}</button></div></div></article>`,
        )
        .join("")
    : `<div class="empty-state"><span class="empty-icon" aria-hidden="true">${icon("search")}</span><h3>Такої страви не знайшли</h3><p>Спробуйте іншу назву або інгредієнт.</p><button class="button button-outline" data-reset-search>Повернутися до меню</button></div>`;
  $("#load-more").hidden = result.length <= limit;
  $("#load-more").innerHTML =
    `Показати ще ${Math.min(6, result.length - limit)} <span>${icon("down")}</span>`;
}
function setCategory(id) {
  if (!categories.includes(id)) return;
  category = id;
  group = MENU.find((c) => c.id === id).groups[0].name;
  query = "";
  limit = 6;
  $("#search").value = "";
  $$(".category-tab").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.category === id)),
  );
  groups();
  renderMenu();
}
function notify(text) {
  clearTimeout(toastTimer);
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 2700);
}
function animateAdded(button) {
  const card = button.closest(".dish");
  if (!card) return;
  card.classList.remove("is-adding");
  button.classList.remove("is-added");
  void card.offsetWidth;
  card.classList.add("is-adding");
  button.classList.add("is-added");
  setTimeout(() => {
    card.classList.remove("is-adding");
    button.classList.remove("is-added");
  }, 700);
}
function save() {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(cart));
  } catch {}
  renderCart();
}
function renderCart() {
  const count = cart.reduce((n, i) => n + i.qty, 0);
  $$("[data-count]").forEach((el) => (el.textContent = count));
  $(".bag-button").setAttribute(
    "aria-label",
    `Відкрити список замовлення: ${count} шт.`,
  );
  $("#cart-footer").hidden = !cart.length;
  $("#copy-fallback").hidden = true;
  $("#cart-total").textContent = money(total(cart));
  $("#cart-items").innerHTML = cart.length
    ? cart
        .map((r) => {
          const i = itemById.get(r.id);
          return `<article class="cart-line"><div class="cart-line-top"><div><h3>${escape(i.name)}</h3><small>${escape(i.group)}${i.weight ? " · " + escape(i.weight) : ""} · ${money(i.price)}</small></div><button data-remove="${r.id}" aria-label="Видалити: ${escape(i.name)}, ${escape(i.group)}"><svg class="close-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div><div class="cart-line-bottom"><div class="quantity"><button data-qty="${r.id}" data-change="-1" aria-label="Зменшити кількість: ${escape(i.name)}">${icon("minus")}</button><span aria-label="Кількість">${r.qty}</span><button data-qty="${r.id}" data-change="1" aria-label="Збільшити кількість: ${escape(i.name)}" ${r.qty >= 99 ? "disabled" : ""}>${icon("plus")}</button></div><strong>${money(i.price * r.qty)}</strong></div></article>`;
        })
        .join("")
    : `<div class="cart-empty"><span class="empty-icon" aria-hidden="true">${icon("bag")}</span><h3>Поки що порожньо</h3><p>Знайдемо щось смачне?<br>Додайте страви з меню до свого списку.</p><button class="button button-dark" data-back-menu>Обрати страви <span>${icon("arrow")}</span></button></div>`;
}
function openCart(trigger) {
  lastTrigger = trigger;
  $("#order-result").hidden = true;
  $("#cart-footer").classList.remove("checkout-open");
  $("#checkout-form").hidden = true;
  $("#checkout-toggle").hidden = !ordersEnabled;
  $("#checkout-error").hidden = true;
  $("#cart-dialog").showModal();
  document.body.classList.add("modal-open");
  $("#close-cart").focus();
}
function closeCart() {
  $("#cart-dialog").close();
}
$("#cart-dialog").addEventListener("close", () => {
  document.body.classList.remove("modal-open");
  lastTrigger?.focus();
});
$("#close-cart").addEventListener("click", closeCart);
$("#checkout-toggle").addEventListener("click", () => {
  $("#checkout-form").hidden = false;
  $("#checkout-toggle").hidden = true;
  $("#cart-footer").classList.add("checkout-open");
  $("#checkout-form [name=customerName]").focus();
});
$("#checkout-form [name=fulfillment]").addEventListener("change", (event) => {
  const isDelivery = event.target.value === "delivery";
  const addressField = $("#delivery-address-field");
  addressField.hidden = !isDelivery;
  addressField.querySelector("textarea").required = isDelivery;
});
$("#checkout-form").addEventListener("input", () => {
  pendingRequestId = null;
  $("#checkout-error").hidden = true;
});
$("#checkout-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!cart.length) return;

  const form = event.currentTarget;
  const submitButton = $("#submit-order");
  const errorMessage = $("#checkout-error");
  const originalLabel = submitButton.textContent;
  const values = new FormData(form);
  pendingRequestId ||= crypto.randomUUID();
  submitButton.disabled = true;
  submitButton.textContent = "Надсилаємо…";
  errorMessage.hidden = true;

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestId: pendingRequestId,
        customer: {
          name: values.get("customerName"),
          phone: values.get("phone"),
        },
        fulfillment: values.get("fulfillment"),
        address: values.get("address"),
        note: values.get("note"),
        items: cart.map((item) => ({ id: item.id, quantity: item.qty })),
        telegramInitData: telegramWebApp?.initData || undefined,
      }),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "Не вдалося надіслати замовлення.");

    cart = [];
    pendingRequestId = null;
    try {
      localStorage.setItem(STORAGE, JSON.stringify(cart));
    } catch {}
    renderCart();
    $("#cart-footer").hidden = true;
    $("#order-result").innerHTML =
      `<h3>Дякуємо за замовлення!</h3><p>Номер замовлення: <strong>№${escape(result.orderNumber)}</strong></p><p>Адміністратор підтвердить замовлення та вартість доставки. Оплата — при отриманні.</p>${result.notificationPending ? '<p>Для швидкого підтвердження телефонуйте <a href="tel:+380997206560">099 720 65 60</a>.</p>' : ""}`;
    $("#order-result").hidden = false;
  } catch (error) {
    errorMessage.textContent = error.message;
    errorMessage.hidden = false;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalLabel;
  }
});
$("#cart-dialog").addEventListener("click", (e) => {
  if (e.target === $("#cart-dialog")) {
    const r = e.target.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      closeCart();
  }
});
document.addEventListener("click", (e) => {
  const b = e.target.closest("button,a");
  if (!b) return;
  if (b.hasAttribute("data-open-cart")) openCart(b);
  if (b.dataset.category) setCategory(b.dataset.category);
  if (b.dataset.add) {
    const i = itemById.get(b.dataset.add);
    if (!i) return;
    const r = cart.find((r) => r.id === i.id);
    if (r && r.qty >= 99) {
      notify("У списку вже 99 порцій цієї страви");
      return;
    }
    if (r) r.qty++;
    else cart.push({ id: i.id, qty: 1 });
    save();
    animateAdded(b);
    notify(`${i.name} — додано до списку`);
  }
  if (b.dataset.remove) {
    cart = cart.filter((r) => r.id !== b.dataset.remove);
    save();
    notify("Страву видалено зі списку");
  }
  if (b.dataset.qty) {
    const id = b.dataset.qty;
    const r = cart.find((r) => r.id === id);
    if (!r) return;
    r.qty = Math.min(99, r.qty + Number(b.dataset.change));
    cart = cart.filter((r) => r.qty > 0);
    save();
    const replacement = $(
      `[data-qty="${id}"][data-change="${b.dataset.change}"]`,
    );
    (replacement || $("#close-cart")).focus();
  }
  if (b.hasAttribute("data-back-menu")) {
    closeCart();
    $("#menu").scrollIntoView();
    $(".category-tab").focus({ preventScroll: true });
  }
  if (b.hasAttribute("data-reset-search")) {
    query = "";
    limit = 6;
    $("#search").value = "";
    renderMenu();
    $("#search").focus();
  }
});
$("#group-select").addEventListener("change", (e) => {
  group = e.target.value;
  limit = 6;
  renderMenu();
});
$("#search").addEventListener("input", (e) => {
  query = e.target.value.trim();
  limit = 6;
  renderMenu();
});
$("#clear-search").addEventListener("click", () => {
  query = "";
  limit = 6;
  $("#search").value = "";
  renderMenu();
  $("#search").focus();
});
$("#load-more").addEventListener("click", () => {
  const old = limit;
  limit += 6;
  renderMenu();
  const first = $$(".dish-add")[old];
  first?.focus({ preventScroll: true });
});
$("#clear-cart").addEventListener("click", () => {
  cart = [];
  save();
  notify("Список очищено");
  $("[data-back-menu]").focus();
});
$("#copy-order").addEventListener("click", async () => {
  const text = orderText(cart);
  try {
    if (!navigator.clipboard?.writeText) throw Error();
    await navigator.clipboard.writeText(text);
    notify("Список скопійовано");
    $("#copy-order").innerHTML = `Скопійовано ${icon("check")}`;
    setTimeout(
      () =>
        ($("#copy-order").innerHTML =
          `Скопіювати список <span>${icon("arrow")}</span>`),
      2300,
    );
  } catch {
    $("#copy-fallback").value = text;
    $("#copy-fallback").hidden = false;
    $("#copy-fallback").focus();
    $("#copy-fallback").select();
    notify("Виділіть і скопіюйте текст зі списку");
  }
});
const toggle = $(".nav-toggle"),
  nav = $("#mobile-nav");
function closeNav() {
  nav.hidden = true;
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "Відкрити навігацію");
}
toggle.addEventListener("click", () => {
  nav.hidden = !nav.hidden;
  toggle.setAttribute("aria-expanded", String(!nav.hidden));
  toggle.setAttribute(
    "aria-label",
    nav.hidden ? "Відкрити навігацію" : "Закрити навігацію",
  );
});
nav.addEventListener("click", (e) => {
  if (e.target.closest("a")) closeNav();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !nav.hidden) {
    closeNav();
    toggle.focus();
  }
});
window.addEventListener("resize", () => {
  if (innerWidth > 800) closeNav();
});
window.addEventListener("storage", (e) => {
  if (e.key === STORAGE) {
    try {
      cart = validCart(JSON.parse(e.newValue || "[]"));
    } catch {
      cart = [];
    }
    renderCart();
  }
});
$("#year").textContent = new Date().getFullYear();
groups();
renderMenu();
renderCart();
