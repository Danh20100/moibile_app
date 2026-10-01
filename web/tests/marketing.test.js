import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/marketing.css", import.meta.url), "utf8");

test("production web entry is marketing, not the legacy product SPA", () => {
  assert.match(html, /data-marketing-site/);
  assert.match(html, /src\/marketing\.css/);
  assert.doesNotMatch(html, /src\/app\.js|runtime-config\.js|login-form|signup-form|booking-form/);
});

test("marketing links only to non-operational sections", () => {
  assert.match(html, /id="features"/);
  assert.match(html, /id="journey"/);
  assert.match(html, /id="availability"/);
  assert.doesNotMatch(html, /href="\/(login|signup|tenant|landlord)/);
});

test("marketing page provides accessibility and responsive styles", () => {
  assert.match(html, /href="#content"/);
  assert.match(html, /lang="vi"/);
  assert.match(css, /max-width:560px/);
  assert.match(css, /prefers-reduced-motion/);
});
