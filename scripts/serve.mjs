import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./load-env.mjs";
import ordersApi from "../api/orders.js";
import telegramWebhookApi from "../api/telegram/webhook.js";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const outputRoot = path.join(projectRoot, "dist");
const MAX_REQUEST_BYTES = 64 * 1024;

await loadLocalEnv();

const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
]);
const apiRoutes = new Map([
  ["/api/orders", ordersApi],
  ["/api/telegram/webhook", telegramWebhookApi],
]);

async function readRequestBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) throw new Error("Request body too large");
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function handleApiRequest(request, response, pathname) {
  const handler = apiRoutes.get(pathname);
  if (!handler) return false;

  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (Array.isArray(value)) headers.set(key, value.join(", "));
      else if (value !== undefined) headers.set(key, value);
    }

    const body =
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await readRequestBody(request);
    const webRequest = new Request(
      new URL(request.url, `http://${request.headers.host}`),
      {
        method: request.method,
        headers,
        body: body?.length ? body : undefined,
      },
    );
    const webResponse = await handler.fetch(webRequest);

    response.writeHead(
      webResponse.status,
      Object.fromEntries(webResponse.headers),
    );
    response.end(
      request.method === "HEAD"
        ? undefined
        : Buffer.from(await webResponse.arrayBuffer()),
    );
  } catch (error) {
    const status = error.message === "Request body too large" ? 413 : 500;
    response.writeHead(status, {
      "content-type": "application/json; charset=utf-8",
    });
    response.end(
      JSON.stringify({
        error: status === 413 ? "Запит завеликий." : "Помилка сервера.",
      }),
    );
  }

  return true;
}

const server = createServer(async (request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  if (pathname.startsWith("/api/")) {
    const handled = await handleApiRequest(request, response, pathname);
    if (!handled) {
      response.writeHead(404);
      response.end("Not found");
    }
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method not allowed");
    return;
  }

  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.resolve(outputRoot, relativePath);
  const relativeToRoot = path.relative(outputRoot, filePath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "Cache-Control": "no-cache",
      "Content-Type":
        contentTypes.get(path.extname(filePath)) || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch (error) {
    const status =
      error.code === "ENOENT" || error.code === "EISDIR" ? 404 : 500;
    response.writeHead(status);
    response.end(status === 404 ? "Not found" : "Internal server error");
  }
});

server.listen(port, host, () => {
  console.log(`Local preview and API: http://${host}:${port}`);
});
