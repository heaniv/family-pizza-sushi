import { MENU } from "../data/menu.js";
export const ITEMS = MENU.flatMap((c) =>
  c.groups.flatMap((g) =>
    g.items.map((i) => ({
      ...i,
      category: c.id,
      categoryName: c.name,
      group: g.name,
    })),
  ),
);
export const itemById = new Map(ITEMS.map((i) => [i.id, i]));
export const normalize = (s) =>
  String(s)
    .toLocaleLowerCase("uk")
    .normalize("NFKC")
    .replace(/[’'`ʼ]/g, "")
    .trim();
export function findItems(category, group, query) {
  const q = normalize(query);
  return ITEMS.filter((i) =>
    q
      ? normalize(
          i.name + " " + (i.description || "") + " " + i.group,
        ).includes(q)
      : i.category === category && (!group || i.group === group),
  );
}
export function validCart(value) {
  if (!Array.isArray(value)) return [];
  const combined = new Map();
  for (const row of value) {
    if (
      !row ||
      !itemById.has(row.id) ||
      !Number.isInteger(row.qty) ||
      row.qty <= 0
    )
      continue;
    combined.set(row.id, Math.min(99, (combined.get(row.id) || 0) + row.qty));
  }
  return [...combined].map(([id, qty]) => ({ id, qty }));
}
export const total = (cart) =>
  cart.reduce((s, r) => s + (itemById.get(r.id)?.price || 0) * r.qty, 0);
export const money = (n) =>
  new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 }).format(n) + " ₴";
export function orderText(cart) {
  return (
    "Family Pizza Sushi\n" +
    cart
      .map((r) => {
        const i = itemById.get(r.id);
        return `${i.name} (${i.group}) × ${r.qty} — ${money(i.price * r.qty)}`;
      })
      .join("\n") +
    `\nОрієнтовна сума: ${money(total(cart))}\nБез вартості доставки. Ціну й наявність потрібно підтвердити в кафе.`
  );
}
