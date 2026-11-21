import { couriers } from "./telegram-api.js";

const STATUS_LABELS = {
  new: "Нове",
  accepted: "Прийняте",
  preparing: "Готується",
  ready: "Готове",
  on_delivery: "У дорозі",
  delivered: "Доставлене",
  cancelled: "Скасоване",
};

const STATUS_ACTIONS = {
  new: [
    ["✅ Прийняти", "accepted"],
    ["❌ Скасувати", "cancelled"],
  ],
  accepted: [
    ["🍳 Почати готувати", "preparing"],
    ["❌ Скасувати", "cancelled"],
  ],
  preparing: [
    ["✅ Готове", "ready"],
    ["❌ Скасувати", "cancelled"],
  ],
  ready: [],
  on_delivery: [["✅ Доставлено", "delivered"]],
  delivered: [],
  cancelled: [],
};

export function formatUah(value) {
  return `${new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 }).format(Number(value) || 0)} ₴`;
}

export function orderSummary(order) {
  const number = String(order.order_number).padStart(5, "0");
  const createdAt = order.created_at
    ? new Intl.DateTimeFormat("uk-UA", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "Europe/Kyiv",
      }).format(new Date(order.created_at))
    : null;
  const lines = [
    `Замовлення №${number}`,
    `Статус: ${STATUS_LABELS[order.status] || order.status}`,
    ...(createdAt ? [`Час: ${createdAt}`] : []),
    `Клієнт: ${order.customer_name}`,
    `Телефон: ${order.phone}`,
    `Тип: ${order.fulfillment_type === "delivery" ? "Доставка" : "Самовивіз"}`,
  ];

  if (order.delivery_address) lines.push(`Адреса: ${order.delivery_address}`);
  if (order.customer_note) lines.push(`Коментар: ${order.customer_note}`);
  lines.push("", "Страви:");

  for (const item of order.items || []) {
    lines.push(
      `• ${item.item_name} (${item.item_group}) × ${item.quantity} — ${formatUah(item.line_total_uah)}`,
    );
  }

  lines.push(`\nСума страв: ${formatUah(order.subtotal_uah)}`);
  if (order.fulfillment_type === "delivery") {
    lines.push(
      order.delivery_fee_uah == null
        ? "Доставка: вартість уточнює адміністратор"
        : `Доставка: ${formatUah(order.delivery_fee_uah)}`,
    );
  }
  const total =
    Number(order.subtotal_uah) + Number(order.delivery_fee_uah || 0);
  lines.push(`Разом: ${formatUah(total)}`, "Оплата: при отриманні");
  if (order.assigned_courier_name) {
    lines.push(`Кур’єр: ${order.assigned_courier_name}`);
  }

  return lines.join("\n");
}

export function orderKeyboard(order) {
  const rows = (STATUS_ACTIONS[order.status] || []).map(
    ([label, nextStatus]) => [
      {
        text: label,
        callback_data: `os:${order.id}:${nextStatus}`,
      },
    ],
  );

  if (order.status === "ready") {
    rows.push([
      order.fulfillment_type === "delivery"
        ? { text: "🛵 У дорозі", callback_data: `os:${order.id}:on_delivery` }
        : {
            text: "✅ Видати замовлення",
            callback_data: `os:${order.id}:delivered`,
          },
    ]);
    rows.push([
      { text: "❌ Скасувати", callback_data: `os:${order.id}:cancelled` },
    ]);
  }

  if (
    order.fulfillment_type === "delivery" &&
    !["delivered", "cancelled"].includes(order.status)
  ) {
    rows.push([
      {
        text:
          order.delivery_fee_uah == null
            ? "💸 Вказати доставку"
            : "💸 Змінити доставку",
        callback_data: `of:${order.id}`,
      },
    ]);
    if (["accepted", "preparing", "ready"].includes(order.status)) {
      rows.push([
        {
          text: order.assigned_courier_name
            ? `🛵 Кур’єр: ${order.assigned_courier_name}`
            : "🛵 Призначити кур’єра",
          callback_data: `oa:${order.id}`,
        },
      ]);
    }
  }

  return { inline_keyboard: rows };
}

export function courierKeyboard(order) {
  const available = couriers();
  if (!available.length) return null;

  return {
    inline_keyboard: available.map((courier) => [
      {
        text: courier.name,
        callback_data: `oc:${order.id}:${courier.id}`,
      },
    ]),
  };
}
