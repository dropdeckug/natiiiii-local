#!/usr/bin/env node
/**
 * NativeBridge custom Android asset generator.
 * Replaces `npx capacitor-assets generate --android` with a deterministic
 * scanner+regenerator that:
 *
 *   1. Walks android/app/src/main/res for every PNG launcher/splash file.
 *   2. Reads each PNG's exact dimensions.
 *   3. Generates a replacement at the SAME width/height using the supplied
 *      source icon, applying role-specific masks (square/round/adaptive/splash).
 *   4. Writes the replacement back in place — preserving the Capacitor
 *      folder structure so the IDE keeps reflecting the correct assets.
 *
 * Usage:
 *   node scripts/nativebridge-generate-android-assets.cjs \
 *     --source ./icon.png \
 *     --res ./android/app/src/main/res \
 *     [--background "#4285F4"] \
 *     [--splash ./splash.png]
 */

const fs = require("fs");
const path = require("path");

let sharp;
try { sharp = require("sharp"); }
catch (e) {
  console.error("[assets] sharp is required. Install with: npm install --save-dev sharp --legacy-peer-deps");
  process.exit(1);
}

function parseArgs(argv) {
  const out = { background: "#FFFFFF" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--source") out.source = argv[++i];
    else if (a === "--res") out.res = argv[++i];
    else if (a === "--background") out.background = argv[++i];
    else if (a === "--splash") out.splash = argv[++i];
    else if (a === "--foreground-padding") out.foregroundPadding = parseFloat(argv[++i]);
  }
  if (!out.source || !out.res) {
    console.error("Usage: --source <icon.png> --res <android/app/src/main/res>");
    process.exit(1);
  }
  return out;
}

function walk(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, results);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) results.push(full);
  }
  return results;
}

function classifyRole(filePath) {
  const name = path.basename(filePath).toLowerCase();
  const dir = path.basename(path.dirname(filePath));
  if (name.includes("foreground")) return "adaptiveForeground";
  if (name.includes("background")) return "adaptiveBackground";
  if (name.includes("round")) return "launcherRound";
  if (name.includes("splash")) return "splash";
  if (dir.startsWith("mipmap")) return "launcher";
  if (dir.startsWith("drawable") && name.startsWith("ic_")) return "launcher";
  return "other";
}

async function generateForRole(buffer, role, width, height, opts) {
  const bg = opts.background || "#FFFFFF";
  if (role === "launcher") {
    return await sharp(buffer)
      .resize(width, height, { fit: "cover", position: "center" })
      .png()
      .toBuffer();
  }
  if (role === "launcherRound") {
    const circle = Buffer.from(
      `<svg width="${width}" height="${height}"><circle cx="${width/2}" cy="${height/2}" r="${Math.min(width,height)/2}" fill="white"/></svg>`
    );
    const base = await sharp(buffer)
      .resize(width, height, { fit: "cover", position: "center" })
      .png()
      .toBuffer();
    return await sharp(base)
      .composite([{ input: circle, blend: "dest-in" }])
      .png()
      .toBuffer();
  }
  if (role === "adaptiveForeground") {
    // Safe-zone padding: 66/108 of the canvas
    const safe = Math.round(width * (66 / 108));
    const offset = Math.round((width - safe) / 2);
    return await sharp({
      create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        {
          input: await sharp(buffer).resize(safe, safe, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
          left: offset, top: offset,
        },
      ])
      .png()
      .toBuffer();
  }
  if (role === "adaptiveBackground") {
    return await sharp({ create: { width, height, channels: 4, background: bg } }).png().toBuffer();
  }
  if (role === "splash") {
    const splashSrc = opts.splashBuffer || buffer;
    return await sharp({ create: { width, height, channels: 4, background: bg } })
      .composite([{
        input: await sharp(splashSrc).resize(Math.round(width * 0.4), Math.round(height * 0.4), { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
        gravity: "center",
      }])
      .png()
      .toBuffer();
  }
  return await sharp(buffer).resize(width, height, { fit: "cover" }).png().toBuffer();
}

async function main() {
  const args = parseArgs(process.argv);
  if (!fs.existsSync(args.source)) { console.error(`Source icon not found: ${args.source}`); process.exit(1); }
  if (!fs.existsSync(args.res))    { console.error(`Res directory not found: ${args.res}`); process.exit(1); }

  const sourceBuffer = fs.readFileSync(args.source);
  const splashBuffer = args.splash && fs.existsSync(args.splash) ? fs.readFileSync(args.splash) : null;

  const pngs = walk(args.res);
  console.log(`[assets] Found ${pngs.length} PNG file(s) in ${args.res}`);

  let replaced = 0;
  const manifest = [];

  for (const file of pngs) {
    try {
      const meta = await sharp(file).metadata();
      if (!meta.width || !meta.height) continue;
      const role = classifyRole(file);
      const out = await generateForRole(sourceBuffer, role, meta.width, meta.height, {
        background: args.background,
        splashBuffer,
      });
      fs.writeFileSync(file, out);
      replaced++;
      manifest.push({ path: file, width: meta.width, height: meta.height, role });
    } catch (err) {
      console.warn(`[assets] Skipped ${file}: ${err.message}`);
    }
  }

  console.log(`[assets] Replaced ${replaced}/${pngs.length} PNG asset(s).`);
  fs.writeFileSync(
    path.join(args.res, "..", "..", "..", "..", "nativebridge-assets-manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
  console.log("[assets] Wrote nativebridge-assets-manifest.json");
}

main().catch(err => { console.error(err); process.exit(1); });
