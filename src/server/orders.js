import { randomUUID } from "node:crypto";
import { itemById } from "../scripts/core.js";
import { db } from "./database.js";

const MAX_ORDER_ITEMS = 20;
const MAX_ORDER_TOTAL_UAH = 250_000;
const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHONE_PATTERN = /^\+?[0-9 ()-]{7,20}$/;

export class OrderInputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function requiredText(value, label, maxLength) {
  if (typeof value !== "string") {
    throw new OrderInputError(`Перевірте поле «${label}».`);
  }

  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new OrderInputError(`Перевірте поле «${label}».`);
  }
  return normalized;
}

function normalizeItems(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new OrderInputError("Додайте страви до замовлення.");
  }
  if (value.length > MAX_ORDER_ITEMS) {
    throw new OrderInputError(
      `В одному замовленні можна обрати до ${MAX_ORDER_ITEMS} різних страв.`,
    );
  }

  const quantities = new Map();
  for (const row of value) {
    if (
      !row ||
      typeof row.id !== "string" ||
      !Number.isInteger(row.quantity) ||
      row.quantity < 1 ||
      row.quantity > 99
    ) {
      throw new OrderInputError("Перевірте кількість страв у замовленні.");
    }

    const item = itemById.get(row.id);
    if (!item)
      throw new OrderInputError("У меню змінилася страва. Оновіть сторінку.");
    quantities.set(
      row.id,
      Math.min(99, (quantities.get(row.id) || 0) + row.quantity),
    );
  }

  const items = [...quantities].map(([id, quantity]) => {
    const item = itemById.get(id);
    return {
      id,
      name: item.name,
      group: item.group,
      quantity,
      unitPrice: item.price,
      lineTotal: item.price * quantity,
    };
  });
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

  if (subtotal > MAX_ORDER_TOTAL_UAH) {
    throw new OrderInputError("Сума замовлення перевищує ліміт.");
  }

  return { items, subtotal };
}

export function validateOrderPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new OrderInputError("Некоректне замовлення.");
  }

  if (!REQUEST_ID_PATTERN.test(payload.requestId || "")) {
    throw new OrderInputError("Оновіть сторінку та спробуйте ще раз.");
  }

  const name = requiredText(payload.customer?.name, "ім’я", 100);
  const phone = requiredText(payload.customer?.phone, "телефон", 30);
  if (!PHONE_PATTERN.test(phone) || phone.replace(/\D/g, "").length < 9) {
    throw new OrderInputError("Введіть коректний номер телефону.");
  }

  const fulfillment = payload.fulfillment;
  if (fulfillment !== "delivery" && fulfillment !== "pickup") {
    throw new OrderInputError("Оберіть доставку або самовивіз.");
  }

  const address =
    fulfillment === "delivery"
      ? requiredText(payload.address, "адреса доставки", 300)
      : null;
  const note =
    payload.note == null || payload.note === ""
      ? null
      : requiredText(payload.note, "коментар", 500);
  const { items, subtotal } = normalizeItems(payload.items);

  return {
    requestId: payload.requestId,
    name,
    phone,
    fulfillment,
    address,
    note,
    items,
    subtotal,
  };
}

export async function findOrderByRequestId(requestId) {
  const sql = db();
  const rows = await sql`
    SELECT id, order_number, status, subtotal_uah, delivery_fee_uah,
           admin_message_id
    FROM orders
    WHERE idempotency_key = ${requestId}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function createOrder(order) {
  const sql = db();
  const orderId = randomUUID();
  const statements = [
    sql`
      INSERT INTO orders (
        id, idempotency_key, customer_name, phone,
        fulfillment_type, delivery_address, customer_note,
        subtotal_uah, telegram_user_id
      ) VALUES (
        ${orderId}, ${order.requestId}, ${order.name}, ${order.phone},
        ${order.fulfillment}, ${order.address}, ${order.note},
        ${order.subtotal}, ${order.telegramUserId}
      )
      RETURNING id, order_number, status, subtotal_uah, delivery_fee_uah
    `,
    ...order.items.map(
      (item) => sql`
        INSERT INTO order_items (
          order_id, menu_item_id, item_name, item_group,
          quantity, unit_price_uah, line_total_uah
        ) VALUES (
          ${orderId}, ${item.id}, ${item.name}, ${item.group},
          ${item.quantity}, ${item.unitPrice}, ${item.lineTotal}
        )
      `,
    ),
    sql`
      INSERT INTO order_events (order_id, event_type, new_value)
      VALUES (${orderId}, 'created', 'new')
    `,
  ];

  const results = await sql.transaction(statements);
  return results[0][0];
}

export async function getOrder(orderId) {
  const sql = db();
  const orders = await sql`
    SELECT * FROM orders WHERE id = ${orderId} LIMIT 1
  `;
  if (!orders[0]) return null;

  const items = await sql`
    SELECT menu_item_id, item_name, item_group, quantity,
           unit_price_uah, line_total_uah
    FROM order_items
    WHERE order_id = ${orderId}
    ORDER BY id
  `;
  return { ...orders[0], items };
}

export async function listOpenOrders(limit = 20) {
  const sql = db();
  return sql`
    SELECT orders.*,
      COALESCE(
        json_agg(json_build_object(
          'menu_item_id', order_items.menu_item_id,
          'item_name', order_items.item_name,
          'item_group', order_items.item_group,
          'quantity', order_items.quantity,
          'unit_price_uah', order_items.unit_price_uah,
          'line_total_uah', order_items.line_total_uah
        )) FILTER (WHERE order_items.id IS NOT NULL),
        '[]'::json
      ) AS items
    FROM orders
    LEFT JOIN order_items ON order_items.order_id = orders.id
    WHERE orders.status NOT IN ('delivered', 'cancelled')
    GROUP BY orders.id
    ORDER BY orders.created_at DESC
    LIMIT ${limit}
  `;
}

export async function setAdminMessage(orderId, messageId) {
  const sql = db();
  await sql`
    UPDATE orders
    SET admin_message_id = ${messageId}, updated_at = NOW()
    WHERE id = ${orderId}
  `;
}

export async function createDeliveryFeeRequest({
  promptMessageId,
  chatId,
  adminId,
  orderId,
}) {
  const sql = db();
  await sql`
    INSERT INTO delivery_fee_requests (prompt_message_id, chat_id, admin_telegram_id, order_id)
    VALUES (${promptMessageId}, ${chatId}, ${adminId}, ${orderId})
    ON CONFLICT (prompt_message_id) DO NOTHING
  `;
}

export async function findDeliveryFeeRequest({
  promptMessageId,
  chatId,
  adminId,
}) {
  const sql = db();
  const rows = await sql`
    SELECT prompt_message_id, order_id
    FROM delivery_fee_requests
    WHERE prompt_message_id = ${promptMessageId}
      AND chat_id = ${chatId}
      AND admin_telegram_id = ${adminId}
      AND created_at > NOW() - INTERVAL '30 minutes'
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function deleteDeliveryFeeRequest(promptMessageId) {
  const sql = db();
  await sql`DELETE FROM delivery_fee_requests WHERE prompt_message_id = ${promptMessageId}`;
}

const NEXT_STATUS = {
  new: new Set(["accepted", "cancelled"]),
  accepted: new Set(["preparing", "cancelled"]),
  preparing: new Set(["ready", "cancelled"]),
  ready: new Set(["on_delivery", "delivered", "cancelled"]),
  on_delivery: new Set(["delivered", "cancelled"]),
  delivered: new Set(),
  cancelled: new Set(),
};

export function canMoveOrderStatus(currentStatus, nextStatus) {
  return Boolean(NEXT_STATUS[currentStatus]?.has(nextStatus));
}

export async function changeOrderStatus(order, nextStatus, actorId) {
  if (!canMoveOrderStatus(order.status, nextStatus)) return null;

  const sql = db();
  const rows = await sql`
    WITH changed AS (
      UPDATE orders
      SET status = ${nextStatus}, updated_at = NOW()
      WHERE id = ${order.id} AND status = ${order.status}
      RETURNING id, status
    ), event AS (
      INSERT INTO order_events (order_id, actor_telegram_id, event_type, old_value, new_value)
      SELECT id, ${actorId}, 'status_changed', ${order.status}, status
      FROM changed
    )
    SELECT id, status FROM changed
  `;
  return rows[0] || null;
}

export async function assignCourier(order, courier, actorId) {
  const sql = db();
  const rows = await sql`
    WITH changed AS (
      UPDATE orders
      SET assigned_courier_id = ${String(courier.id)},
          assigned_courier_name = ${courier.name},
          updated_at = NOW()
      WHERE id = ${order.id} AND status IN ('accepted', 'preparing', 'ready')
      RETURNING id, assigned_courier_id, assigned_courier_name
    ), event AS (
      INSERT INTO order_events (order_id, actor_telegram_id, event_type, old_value, new_value)
      SELECT id, ${actorId}, 'courier_assigned', NULL, assigned_courier_name
      FROM changed
    )
    SELECT id, assigned_courier_id, assigned_courier_name FROM changed
  `;
  return rows[0] || null;
}

export async function setDeliveryFee(order, fee, actorId) {
  if (order.fulfillment_type !== "delivery" || order.status === "cancelled") {
    return null;
  }

  const sql = db();
  const rows = await sql`
    WITH changed AS (
      UPDATE orders
      SET delivery_fee_uah = ${fee}, updated_at = NOW()
      WHERE id = ${order.id} AND status NOT IN ('delivered', 'cancelled')
      RETURNING id, delivery_fee_uah
    ), event AS (
      INSERT INTO order_events (order_id, actor_telegram_id, event_type, old_value, new_value)
      SELECT id, ${actorId}, 'delivery_fee_set', ${order.delivery_fee_uah}, delivery_fee_uah::TEXT
      FROM changed
    )
    SELECT id, delivery_fee_uah FROM changed
  `;
  return rows[0] || null;
}
