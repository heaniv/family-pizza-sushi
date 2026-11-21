import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_AUTH_AGE_SECONDS = 60 * 60 * 24;

export function verifyWebAppInitData(initData, botToken, now = Date.now()) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  const userValue = params.get("user");

  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) return null;
  if (!Number.isInteger(authDate)) return null;

  const age = Math.floor(now / 1000) - authDate;
  if (age < -60 || age > MAX_AUTH_AGE_SECONDS) return null;

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash" && key !== "signature")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const expectedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest();
  const actualHash = Buffer.from(receivedHash, "hex");

  if (
    actualHash.length !== expectedHash.length ||
    !timingSafeEqual(actualHash, expectedHash)
  ) {
    return null;
  }

  try {
    const user = JSON.parse(userValue || "null");
    if (!Number.isSafeInteger(user?.id) || user.id <= 0) return null;
    return user;
  } catch {
    return null;
  }
}
