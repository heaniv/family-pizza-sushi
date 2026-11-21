import {
  assignCourier,
  changeOrderStatus,
  createDeliveryFeeRequest,
  deleteDeliveryFeeRequest,
  findDeliveryFeeRequest,
  getOrder,
  listOpenOrders,
  setAdminMessage,
  setDeliveryFee,
} from "./orders.js";
import { adminIds, couriers, siteUrl, telegram } from "./telegram-api.js";
import {
  courierKeyboard,
  formatUah,
  orderKeyboard,
  orderSummary,
} from "./order-message.js";

function isAdmin(userId) {
  return adminIds().has(String(userId));
}

function isAdminChat(chatId) {
  return String(chatId) === String(process.env.TELEGRAM_ADMIN_CHAT_ID || "");
}

async function answerCallback(callbackId, text, showAlert = false) {
  await telegram("answerCallbackQuery", {
    callback_query_id: callbackId,
    text,
    show_alert: showAlert,
  });
}

async function editOrderMessage(chatId, order) {
  await telegram("editMessageText", {
    chat_id: chatId,
    message_id: order.admin_message_id,
    text: orderSummary(order),
    reply_markup: orderKeyboard(order),
  });
}

async function notifyCustomer(order, message) {
  if (!order.telegram_user_id) return;
  await telegram("sendMessage", {
    chat_id: order.telegram_user_id,
    text: message,
  });
}

async function handleStart(message) {
  const userId = message.from?.id;
  if (!userId || message.chat.type !== "private") return;

  await telegram("sendMessage", {
    chat_id: message.chat.id,
    text: `Вітаємо у Family Pizza Sushi!\nВаш Telegram ID: ${userId}\n\nНатисніть кнопку нижче, щоб обрати страви й оформити замовлення.`,
    reply_markup: {
      keyboard: [
        [{ text: "🍕 Меню та замовлення", web_app: { url: siteUrl() } }],
      ],
      resize_keyboard: true,
      is_persistent: true,
    },
  });
}

async function handleOrdersCommand(message) {
  if (!isAdmin(message.from?.id) || !isAdminChat(message.chat.id)) return;

  const openOrders = await listOpenOrders();
  if (!openOrders.length) {
    await telegram("sendMessage", {
      chat_id: message.chat.id,
      text: "Активних замовлень немає.",
    });
    return;
  }

  await telegram("sendMessage", {
    chat_id: message.chat.id,
    text: `Активних замовлень: ${openOrders.length}. Показую останні:`,
  });

  for (const order of openOrders) {
    const sent = await telegram("sendMessage", {
      chat_id: message.chat.id,
      text: orderSummary(order),
      reply_markup: orderKeyboard(order),
    });
    await setAdminMessage(order.id, sent.message_id);
  }
}

async function handleChatIdCommand(message) {
  if (!isAdmin(message.from?.id)) return;
  await telegram("sendMessage", {
    chat_id: message.chat.id,
    text: `Chat ID: ${message.chat.id}`,
    reply_parameters: { message_id: message.message_id },
  });
}

async function handleDeliveryFeeReply(message) {
  const promptMessageId = message.reply_to_message?.message_id;
  if (
    !promptMessageId ||
    !isAdmin(message.from?.id) ||
    !isAdminChat(message.chat.id)
  ) {
    return false;
  }

  const feeRequest = await findDeliveryFeeRequest({
    promptMessageId,
    chatId: message.chat.id,
    adminId: message.from.id,
  });
  if (!feeRequest) return false;

  const amount = message.text?.trim();
  if (!/^\d{1,5}$/.test(amount || "") || Number(amount) > 5000) {
    await telegram("sendMessage", {
      chat_id: message.chat.id,
      text: "Введіть вартість доставки цілим числом від 0 до 5000 грн у відповіді на це повідомлення.",
      reply_parameters: { message_id: promptMessageId },
    });
    return true;
  }

  const order = await getOrder(feeRequest.order_id);
  if (!order) {
    await deleteDeliveryFeeRequest(promptMessageId);
    return true;
  }

  const changed = await setDeliveryFee(order, Number(amount), message.from.id);
  await deleteDeliveryFeeRequest(promptMessageId);
  if (!changed) {
    await telegram("sendMessage", {
      chat_id: message.chat.id,
      text: "Вартість доставки для цього замовлення вже не можна змінити.",
    });
    return true;
  }

  const updatedOrder = await getOrder(order.id);
  await editOrderMessage(message.chat.id, updatedOrder);
  await notifyCustomer(
    updatedOrder,
    `Замовлення №${String(order.order_number).padStart(5, "0")}: вартість доставки — ${formatUah(amount)}. До сплати при отриманні — ${formatUah(Number(order.subtotal_uah) + Number(amount))}.`,
  ).catch((error) =>
    console.error("Customer delivery fee update failed:", error.message),
  );
  await telegram("sendMessage", {
    chat_id: message.chat.id,
    text: `Вартість доставки для замовлення №${String(order.order_number).padStart(5, "0")} оновлено.`,
  });
  return true;
}

async function handleMessage(message) {
  if (!message?.chat || !message.from) return;
  const command = message.text?.split(/\s+/, 1)[0]?.split("@")[0];

  if (command === "/start") {
    await handleStart(message);
    return;
  }
  if (command === "/orders") {
    await handleOrdersCommand(message);
    return;
  }
  if (command === "/chatid") {
    await handleChatIdCommand(message);
    return;
  }
  if (message.reply_to_message) {
    await handleDeliveryFeeReply(message);
  }
}

async function handleCallback(callback) {
  const actorId = callback.from?.id;
  const chatId = callback.message?.chat?.id;
  if (!isAdmin(actorId) || !isAdminChat(chatId)) {
    await answerCallback(
      callback.id,
      "Немає доступу до керування замовленнями.",
      true,
    );
    return;
  }

  const [, action, orderId, value] =
    /^(o[asfc]):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?::([a-z_0-9-]+))?$/i.exec(
      callback.data || "",
    ) || [];
  if (!action || !orderId) {
    await answerCallback(
      callback.id,
      "Кнопка застаріла. Оновіть список замовлень.",
      true,
    );
    return;
  }

  const order = await getOrder(orderId);
  if (
    !order ||
    Number(order.admin_message_id) !== Number(callback.message.message_id)
  ) {
    await answerCallback(
      callback.id,
      "Замовлення не знайдено. Оновіть список.",
      true,
    );
    return;
  }

  if (action === "of") {
    const prompt = await telegram("sendMessage", {
      chat_id: chatId,
      text: `Введіть вартість доставки для замовлення №${String(order.order_number).padStart(5, "0")} цілим числом у гривнях (0–5000).`,
      reply_parameters: { message_id: callback.message.message_id },
      reply_markup: {
        force_reply: true,
        input_field_placeholder: "Наприклад, 80",
      },
    });
    await createDeliveryFeeRequest({
      promptMessageId: prompt.message_id,
      chatId,
      adminId: actorId,
      orderId,
    });
    await answerCallback(
      callback.id,
      "Введіть суму у відповідь на повідомлення бота.",
    );
    return;
  }

  if (action === "oa") {
    const keyboard = courierKeyboard(order);
    if (!keyboard) {
      await answerCallback(
        callback.id,
        "Додайте кур’єрів у TELEGRAM_COURIERS.",
        true,
      );
      return;
    }
    await telegram("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: callback.message.message_id,
      reply_markup: keyboard,
    });
    await answerCallback(callback.id, "Оберіть кур’єра.");
    return;
  }

  if (action === "oc") {
    const courier = couriers().find((entry) => String(entry.id) === value);
    if (!courier) {
      await answerCallback(callback.id, "Кур’єра не знайдено.", true);
      return;
    }

    const assigned = await assignCourier(order, courier, actorId);
    if (!assigned) {
      await answerCallback(
        callback.id,
        "Кур’єра можна призначити після прийняття замовлення.",
        true,
      );
      return;
    }

    const updatedOrder = await getOrder(order.id);
    await editOrderMessage(chatId, updatedOrder);
    try {
      await telegram("sendMessage", {
        chat_id: courier.id,
        text: `Вам призначено замовлення №${String(order.order_number).padStart(5, "0")}\n\n${orderSummary(updatedOrder)}`,
      });
      await answerCallback(callback.id, `Призначено: ${courier.name}`);
    } catch {
      await answerCallback(
        callback.id,
        "Кур’єра призначено, але бот не зміг написати йому. Попросіть кур’єра відкрити бота командою /start.",
        true,
      );
    }
    return;
  }

  if (action === "os") {
    const nextStatus = value;
    if (
      nextStatus === "on_delivery" &&
      (order.fulfillment_type !== "delivery" || !order.assigned_courier_id)
    ) {
      await answerCallback(
        callback.id,
        "Спочатку оберіть кур’єра для доставки.",
        true,
      );
      return;
    }
    const changed = await changeOrderStatus(order, nextStatus, actorId);
    if (!changed) {
      await answerCallback(
        callback.id,
        "Статус уже змінився або цей перехід недоступний.",
        true,
      );
      return;
    }

    const updatedOrder = await getOrder(order.id);
    await editOrderMessage(chatId, updatedOrder);
    const statusMessages = {
      accepted: "Замовлення прийняте в роботу.",
      preparing: "Ваше замовлення готується.",
      ready:
        order.fulfillment_type === "delivery"
          ? "Ваше замовлення готове до доставки. Адміністратор уточнить час прибуття."
          : "Ваше замовлення готове до самовивозу.",
      on_delivery: "Ваше замовлення вже в дорозі.",
      delivered: "Замовлення доставлено. Смачного!",
      cancelled:
        "Замовлення скасовано. Зателефонуйте нам, якщо це сталося помилково.",
    };
    if (statusMessages[nextStatus]) {
      await notifyCustomer(
        updatedOrder,
        `Замовлення №${String(order.order_number).padStart(5, "0")}: ${statusMessages[nextStatus]}`,
      ).catch((error) =>
        console.error("Customer order update failed:", error.message),
      );
    }
    await answerCallback(callback.id, "Статус замовлення оновлено.");
  }
}

export async function handleTelegramUpdate(update) {
  if (update.message) await handleMessage(update.message);
  if (update.callback_query) await handleCallback(update.callback_query);
}
