import { createHmac, timingSafeEqual } from "node:crypto";

function encodeOrderNumber(value) {
  const orderNumber = BigInt(String(value));
  if (orderNumber < 1n) throw new Error("Invalid order number");
  return orderNumber.toString(36);
}

function decodeOrderNumber(value) {
  let result = 0n;
  for (const character of value.toLowerCase()) {
    const digit = Number.parseInt(character, 36);
    if (!Number.isInteger(digit) || digit < 0 || digit >= 36) return null;
    result = result * 36n + BigInt(digit);
  }
  return result > 0n ? result.toString() : null;
}

function signature(order, secret) {
  const orderNumber = encodeOrderNumber(order.order_number);
  return createHmac("sha256", secret)
    .update(`${order.id}:${orderNumber}`)
    .digest("base64url");
}

export function createOrderTrackingPayload(order, secret) {
  if (!secret) throw new Error("A tracking signing secret is required");
  const orderNumber = encodeOrderNumber(order.order_number);
  const payload = `o${orderNumber}_${signature(order, secret)}`;
  if (payload.length > 64) throw new Error("Tracking link is too long");
  return payload;
}

export function parseOrderTrackingPayload(payload) {
  if (typeof payload !== "string" || payload.length > 64) return null;
  const match = /^o([0-9a-z]{1,13})_([A-Za-z0-9_-]{43})$/i.exec(payload);
  if (!match) return null;
  const orderNumber = decodeOrderNumber(match[1]);
  return orderNumber ? { orderNumber, providedSignature: match[2] } : null;
}

export function verifyOrderTrackingPayload(payload, order, secret) {
  const parsed = parseOrderTrackingPayload(payload);
  if (!parsed || !order || !secret) return false;
  if (parsed.orderNumber !== String(order.order_number)) return false;

  const expected = Buffer.from(signature(order, secret));
  const provided = Buffer.from(parsed.providedSignature);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export function createOrderTrackingLink(order) {
  const username = (process.env.TELEGRAM_BOT_USERNAME || "").replace(/^@/, "");
  const secret = process.env.TELEGRAM_BOT_TOKEN;
  if (!/^[A-Za-z0-9_]{5,32}$/.test(username) || !secret) return null;
  return `https://t.me/${username}?start=${createOrderTrackingPayload(order, secret)}`;
}
