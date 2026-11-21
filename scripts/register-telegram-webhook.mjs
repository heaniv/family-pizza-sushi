import { botToken, siteUrl } from "../src/server/telegram-api.js";
import { loadLocalEnv } from "./load-env.mjs";

await loadLocalEnv();

const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
if (!secret || !/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
  throw new Error(
    "Set TELEGRAM_WEBHOOK_SECRET to a random 1–256 character token.",
  );
}

const response = await fetch(
  `https://api.telegram.org/bot${botToken()}/setWebhook`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url: `${siteUrl()}/api/telegram/webhook`,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
    }),
  },
);

const result = await response.json();
if (!response.ok || !result.ok) {
  throw new Error(
    `Telegram could not register the webhook (${response.status}).`,
  );
}

console.log(`Webhook registered: ${siteUrl()}/api/telegram/webhook`);
