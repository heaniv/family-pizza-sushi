export function botToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  return token;
}

export async function telegram(method, payload) {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken()}/${method}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    },
  );

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    throw new Error(`Telegram ${method} failed (${response.status})`);
  }

  return result.result;
}

export function adminIds() {
  return new Set(
    (process.env.TELEGRAM_ADMIN_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => /^\d+$/.test(id)),
  );
}

export function adminChatId() {
  const value = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!value) throw new Error("TELEGRAM_ADMIN_CHAT_ID is not configured");
  return value;
}

export function couriers() {
  try {
    const value = JSON.parse(process.env.TELEGRAM_COURIERS || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter(
      (courier) =>
        /^\d+$/.test(String(courier.id)) &&
        typeof courier.name === "string" &&
        courier.name.trim(),
    );
  } catch {
    return [];
  }
}

export function siteUrl() {
  const value =
    process.env.SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;
  if (!value) throw new Error("SITE_URL is not configured");

  const url = new URL(value.includes("://") ? value : `https://${value}`);
  if (url.protocol !== "https:") {
    throw new Error("The Telegram Mini App requires an HTTPS SITE_URL");
  }
  return url.origin;
}
