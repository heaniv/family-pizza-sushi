import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./load-env.mjs";

await loadLocalEnv();

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceRoot = path.join(projectRoot, "src");
const outputRoot = path.join(projectRoot, "dist");

await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(outputRoot, { recursive: true });

await Promise.all([
  fs.copyFile(
    path.join(sourceRoot, "pages/index.html"),
    path.join(outputRoot, "index.html"),
  ),
  fs.cp(path.join(sourceRoot, "scripts"), path.join(outputRoot, "scripts"), {
    recursive: true,
  }),
  fs.cp(path.join(sourceRoot, "styles"), path.join(outputRoot, "styles"), {
    recursive: true,
  }),
  fs.cp(path.join(sourceRoot, "data"), path.join(outputRoot, "data"), {
    recursive: true,
  }),
  fs.cp(path.join(sourceRoot, "assets"), path.join(outputRoot, "assets"), {
    recursive: true,
  }),
]);

await fs.copyFile(
  path.join(sourceRoot, "assets/favicon.svg"),
  path.join(outputRoot, "favicon.svg"),
);

const configuredHost =
  process.env.SITE_URL ||
  process.env.VERCEL_PROJECT_PRODUCTION_URL ||
  process.env.VERCEL_URL;
const htmlFile = path.join(outputRoot, "index.html");
let html = await fs.readFile(htmlFile, "utf8");

const ordersEnabled = process.env.ORDERS_ENABLED === "true";
html = html.replace(
  /<meta name="orders-enabled" content="(?:true|false)"\s*\/?\s*>/,
  `<meta name="orders-enabled" content="${ordersEnabled}">`,
);

const botUsername = (process.env.TELEGRAM_BOT_USERNAME || "").replace(/^@/, "");
if (botUsername && !/^[A-Za-z0-9_]{5,32}$/.test(botUsername)) {
  throw new Error("TELEGRAM_BOT_USERNAME must be a valid public bot username.");
}
if (botUsername) {
  html = html.replace(
    "</head>",
    `<meta name="telegram-bot-username" content="${botUsername}"></head>`,
  );
}

if (configuredHost) {
  const url = new URL(
    configuredHost.includes("://")
      ? configuredHost
      : `https://${configuredHost}`,
  );

  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    throw new Error("SITE_URL must be an HTTP(S) address");
  }

  const origin = url.origin;
  html = html.replace(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    (_, json) => {
      const schema = JSON.parse(json);
      schema.url = `${origin}/`;
      return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
    },
  );
  html = html.replace(
    "</head>",
    `<link rel="canonical" href="${origin}/"><meta property="og:url" content="${origin}/"><meta property="og:image" content="${origin}/assets/sushi.webp"></head>`,
  );
}

await fs.writeFile(htmlFile, html);

console.log(
  `Static site built in dist/${configuredHost ? ` for ${configuredHost}` : ""}`,
);
console.log(`Online ordering: ${ordersEnabled ? "enabled" : "disabled"}`);
