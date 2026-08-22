#!/usr/bin/env node
/**
 * Headless render gate — used by every native/build CI workflow.
 *
 * Runs `npx serve <output_dir>`, opens Chromium headless, waits for
 * `networkidle`, and asserts that the page is not blank. Captures a
 * screenshot and exits non-zero when the render is empty.
 *
 * Usage in the CI job:
 *   node scripts/ci-templates/render-check.mjs <output_dir>
 *
 * The workflow can then upload `render.png` as an artifact and POST it
 * to the `verify-render` edge function.
 */
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const outputDir = process.argv[2] || "dist";
const port = 4173;
const url = `http://127.0.0.1:${port}`;

console.log(`[render-check] serving ${outputDir} on ${url}`);
const server = spawn("npx", ["serve", "-p", String(port), "-s", outputDir], {
  stdio: ["ignore", "inherit", "inherit"],
});

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("static server never became ready");
}

async function main() {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => console.error("[render-check] pageerror:", e.message));
  page.on("console", (m) => m.type() === "error" && console.error("[render-check] console:", m.text()));
  await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(750);
  const text = (await page.evaluate(() => document.body?.innerText?.trim() || "")).slice(0, 500);
  const variance = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 64; c.height = 64;
    const ctx = c.getContext("2d");
    ctx.drawImage(document.documentElement.querySelector("html") ? document.body : document.documentElement, 0, 0, 64, 64);
    const px = ctx.getImageData(0, 0, 64, 64).data;
    let sum = 0, sum2 = 0, n = 0;
    for (let i = 0; i < px.length; i += 4) {
      const v = (px[i] + px[i + 1] + px[i + 2]) / 3;
      sum += v; sum2 += v * v; n++;
    }
    const mean = sum / n;
    return (sum2 / n - mean * mean) / (255 * 255);
  }).catch(() => 0);
  await page.screenshot({ path: "render.png", fullPage: false });
  await browser.close();
  server.kill();

  const nonBlank = text.length > 0 || variance > 0.02;
  const payload = {
    passed: nonBlank,
    text_sample: text,
    pixel_variance: variance,
    screenshot: "render.png",
  };
  console.log("[render-check]", JSON.stringify(payload));
  if (!nonBlank) {
    console.error("[render-check] ❌ blank render");
    process.exit(2);
  }
  console.log("[render-check] ✅ render OK");
}

main().catch((e) => {
  console.error("[render-check] fatal:", e);
  server.kill();
  process.exit(1);
});
