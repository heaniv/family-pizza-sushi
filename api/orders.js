import {
  createOrder,
  findOrderByRequestId,
  getOrder,
  setAdminMessage,
  validateOrderPayload,
} from "../src/server/orders.js";
import { verifyWebAppInitData } from "../src/server/telegram-auth.js";
import { adminChatId, telegram } from "../src/server/telegram-api.js";
import { orderKeyboard, orderSummary } from "../src/server/order-message.js";
import { createOrderTrackingLink } from "../src/server/order-tracking.js";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const MAX_BODY_BYTES = 32 * 1024;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function isAllowedOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function notifyAdministrators(order) {
  const message = await telegram("sendMessage", {
    chat_id: adminChatId(),
    text: orderSummary(order),
    reply_markup: orderKeyboard(order),
  });
  return message.message_id;
}

export default {
  async fetch(request) {
    if (process.env.ORDERS_ENABLED !== "true") {
      return jsonResponse(
        { error: "Онлайн-замовлення ще не налаштовані." },
        503,
      );
    }
    if (request.method !== "POST") {
      return jsonResponse({ error: "Метод не підтримується." }, 405);
    }
    if (!isAllowedOrigin(request)) {
      return jsonResponse({ error: "Запит з цього сайту не дозволений." }, 403);
    }
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return jsonResponse({ error: "Очікується JSON-запит." }, 415);
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return jsonResponse({ error: "Запит завеликий." }, 413);
    }

    let payload;
    try {
      const rawBody = await request.text();
      if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
        return jsonResponse({ error: "Запит завеликий." }, 413);
      }
      payload = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: "Некоректний формат замовлення." }, 400);
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return jsonResponse({ error: "Некоректне замовлення." }, 400);
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    let telegramUser = null;
    if (payload.telegramInitData) {
      telegramUser = verifyWebAppInitData(payload.telegramInitData, botToken);
      if (!telegramUser) {
        return jsonResponse(
          { error: "Не вдалося перевірити сесію Telegram." },
          401,
        );
      }
    }

    let orderInput;
    try {
      orderInput = validateOrderPayload(payload);
    } catch (error) {
      return jsonResponse(
        { error: error.message || "Перевірте дані замовлення." },
        error.status || 400,
      );
    }

    let order;
    let created = false;
    try {
      order = await findOrderByRequestId(orderInput.requestId);
      if (!order) {
        order = await createOrder({
          ...orderInput,
          telegramUserId: telegramUser?.id || null,
        });
        created = true;
      } else if (!order.admin_message_id) {
        created = true;
      }
    } catch (error) {
      if (error.code === "23505") {
        order = await findOrderByRequestId(orderInput.requestId).catch(
          () => null,
        );
      }
      if (!order) {
        console.error("Order persistence failed:", error.message);
        return jsonResponse(
          { error: "Не вдалося зберегти замовлення. Спробуйте ще раз." },
          503,
        );
      }
    }

    let notificationPending = false;
    if (created) {
      try {
        const fullOrder = await getOrder(order.id);
        const messageId = await notifyAdministrators(fullOrder);
        await setAdminMessage(order.id, messageId);

        if (fullOrder.telegram_user_id) {
          await telegram("sendMessage", {
            chat_id: fullOrder.telegram_user_id,
            text: `Дякуємо! Замовлення №${String(fullOrder.order_number).padStart(5, "0")} отримано. Адміністратор підтвердить його та вартість доставки. Оплата — при отриманні.`,
          }).catch((error) =>
            console.error("Customer confirmation failed:", error.message),
          );
        }
      } catch (error) {
        notificationPending = true;
        console.error("Order notification pending:", error.message);
      }
    }

    return jsonResponse(
      {
        orderNumber: String(order.order_number).padStart(5, "0"),
        status: order.status,
        subtotal: Number(order.subtotal_uah),
        deliveryFee:
          order.delivery_fee_uah == null
            ? null
            : Number(order.delivery_fee_uah),
        telegramLink: createOrderTrackingLink(order),
        notificationPending,
      },
      created ? 201 : 200,
    );
  },
};
