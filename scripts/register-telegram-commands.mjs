import {
  adminChatId,
  adminIds,
  telegram,
} from "../src/server/telegram-api.js";
import { loadLocalEnv } from "./load-env.mjs";

await loadLocalEnv();

const administrators = adminIds();
if (!administrators.size) {
  throw new Error("TELEGRAM_ADMIN_IDS must contain at least one numeric ID.");
}

const publicCommands = [
  { command: "start", description: "Відкрити Family Pizza Sushi" },
  { command: "menu", description: "Меню та оформлення замовлення" },
];

const adminCommands = [
  { command: "orders", description: "Показати активні замовлення" },
  { command: "chatid", description: "Показати ID цієї групи" },
];

await telegram("setMyCommands", {
  commands: publicCommands,
  scope: { type: "all_private_chats" },
  language_code: "uk",
});

const chatId = adminChatId();
for (const userId of administrators) {
  await telegram("setMyCommands", {
    commands: adminCommands,
    scope: {
      type: "chat_member",
      chat_id: chatId,
      user_id: Number(userId),
    },
    language_code: "uk",
  });
}

console.log("Telegram command menus updated.");
