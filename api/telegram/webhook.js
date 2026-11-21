import { timingSafeEqual } from "node:crypto";
import { handleTelegramUpdate } from "../../src/server/telegram-webhook.js";

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const receivedSecret = request.headers.get(
      "x-telegram-bot-api-secret-token",
    );
    const expectedBytes = Buffer.from(expectedSecret || "");
    const receivedBytes = Buffer.from(receivedSecret || "");
    if (
      !expectedBytes.length ||
      expectedBytes.length !== receivedBytes.length ||
      !timingSafeEqual(expectedBytes, receivedBytes)
    ) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    try {
      await handleTelegramUpdate(update);
      return Response.json({ ok: true });
    } catch (error) {
      console.error("Telegram update processing failed:", error.message);
      return Response.json(
        { error: "Update processing failed" },
        { status: 500 },
      );
    }
  },
};
