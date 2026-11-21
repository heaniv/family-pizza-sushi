import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const output = path.resolve("dist");
const html = fs.readFileSync(path.join(output, "index.html"), "utf8");

test("local page assets and font files exist in the build output", () => {
  for (const match of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
    assert.ok(fs.existsSync(path.join(output, match[1])), match[1]);
  }

  const fonts = fs.readFileSync(path.join(output, "styles/fonts.css"), "utf8");
  for (const match of fonts.matchAll(/url\(\.\.\/assets\/([^)]+)\)/g)) {
    assert.ok(fs.existsSync(path.join(output, "assets", match[1])), match[1]);
  }
});

test("anchor targets and outbound links are valid", () => {
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const match of html.matchAll(/href="#([^"]+)"/g)) {
    assert.ok(ids.includes(match[1]), match[1]);
  }
  assert.ok(
    !/href="(?:#|javascript:)/.test(html.replace(/href="#([^"]+)"/g, "")),
  );
  for (const match of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
    assert.match(match[0], /rel="noopener noreferrer"/);
  }
});

test("restaurant schema and page language match the cafe details", () => {
  assert.match(html, /<html lang="uk">/);
  const schema = JSON.parse(
    html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1],
  );
  assert.equal(schema.telephone, "+380997206560");
  assert.equal(schema.openingHours, "Mo-Su 11:00-22:00");
  assert.equal(schema.address.addressLocality, "Богородчани");
  assert.equal((html.match(/<h1>/g) || []).length, 1);
});
