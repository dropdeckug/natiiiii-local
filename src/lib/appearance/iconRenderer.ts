/**
 * Shared canvas-based icon renderer.
 * Single source of truth for padding/composition — used by both
 * the AppearancePanel preview and the BuildPipeline pre-zip step,
 * so what the user sees is exactly what ships in the APK.
 */

export type IconRole =
  | "launcher"          // ic_launcher.png        — cover
  | "launcherRound"     // ic_launcher_round.png  — circle mask
  | "adaptiveForeground"// ic_launcher_foreground.png — 66/108 safe zone
  | "adaptiveBackground"// ic_launcher_background.png — solid bg
  | "splash";           // splash.png — centered 40%

export interface AppearanceConfig {
  iconForegroundUrl?: string | null; // data URL or remote URL
  iconBackgroundColor: string;
  iconPaddingPct: number;     // 0-40
  iconCornerRadiusPct: number;// 0-50
  iconLetterFallback?: string | null;
  splashBgColor: string;
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  radiusPx: number
) => {
  const r = Math.min(radiusPx, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(w - r, 0);
  ctx.quadraticCurveTo(w, 0, w, r);
  ctx.lineTo(w, h - r);
  ctx.quadraticCurveTo(w, h, w - r, h);
  ctx.lineTo(r, h);
  ctx.quadraticCurveTo(0, h, 0, h - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
};

const drawForeground = async (
  ctx: CanvasRenderingContext2D,
  cfg: AppearanceConfig,
  size: number,
  paddingPct: number
) => {
  const pad = (paddingPct / 100) * size;
  const inner = size - pad * 2;
  if (cfg.iconForegroundUrl) {
    const img = await loadImage(cfg.iconForegroundUrl);
    // Fit contain
    const ratio = Math.min(inner / img.width, inner / img.height);
    const dw = img.width * ratio;
    const dh = img.height * ratio;
    ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
  } else {
    const letter = (cfg.iconLetterFallback || "A").charAt(0).toUpperCase();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold ${size * 0.45}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, size / 2, size / 2 + size * 0.03);
  }
};

export async function renderRole(
  cfg: AppearanceConfig,
  role: IconRole,
  size: number,
  targetCanvas?: HTMLCanvasElement
): Promise<HTMLCanvasElement> {
  const canvas = targetCanvas ?? document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);

  if (role === "splash") {
    ctx.fillStyle = cfg.splashBgColor;
    ctx.fillRect(0, 0, size, size);
    // Centered logo at 40%
    const logoSize = size * 0.4;
    const offsetCanvas = document.createElement("canvas");
    offsetCanvas.width = logoSize;
    offsetCanvas.height = logoSize;
    const oCtx = offsetCanvas.getContext("2d")!;
    oCtx.fillStyle = cfg.iconBackgroundColor;
    oCtx.fillRect(0, 0, logoSize, logoSize);
    await drawForeground(oCtx, cfg, logoSize, cfg.iconPaddingPct);
    ctx.drawImage(offsetCanvas, (size - logoSize) / 2, (size - logoSize) / 2);
    return canvas;
  }

  if (role === "adaptiveBackground") {
    // Adaptive background MUST be fully opaque — Android composites the
    // foreground over this layer. Validate the color and fall back to white
    // if missing/invalid so we never emit a transparent (= "blank/black") PNG.
    const raw = (cfg.iconBackgroundColor || "").trim();
    const valid = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(raw);
    ctx.fillStyle = valid ? raw : "#FFFFFF";
    ctx.fillRect(0, 0, size, size);
    return canvas;
  }

  if (role === "adaptiveForeground") {
    // 66/108 safe zone — no background
    const safe = Math.round(size * (66 / 108));
    const pad = (size - safe) / 2;
    const subCanvas = document.createElement("canvas");
    subCanvas.width = safe;
    subCanvas.height = safe;
    const sCtx = subCanvas.getContext("2d")!;
    await drawForeground(sCtx, cfg, safe, cfg.iconPaddingPct);
    ctx.drawImage(subCanvas, pad, pad);
    return canvas;
  }

  // launcher / launcherRound — full bg + foreground at user padding
  if (role === "launcherRound") {
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = cfg.iconBackgroundColor;
    ctx.fillRect(0, 0, size, size);
    await drawForeground(ctx, cfg, size, cfg.iconPaddingPct);
    ctx.restore();
    return canvas;
  }

  // launcher (rounded square per editor radius)
  ctx.save();
  const radiusPx = (cfg.iconCornerRadiusPct / 100) * (size / 2);
  drawRoundedRect(ctx, size, size, radiusPx);
  ctx.clip();
  ctx.fillStyle = cfg.iconBackgroundColor;
  ctx.fillRect(0, 0, size, size);
  await drawForeground(ctx, cfg, size, cfg.iconPaddingPct);
  ctx.restore();
  return canvas;
}

export async function renderRoleToBlob(
  cfg: AppearanceConfig,
  role: IconRole,
  size: number,
  type: "image/png" | "image/jpeg" = "image/png"
): Promise<Blob> {
  const canvas = await renderRole(cfg, role, size);
  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), type)
  );
}

export const ANDROID_DENSITIES = [
  { name: "mdpi", size: 48 },
  { name: "hdpi", size: 72 },
  { name: "xhdpi", size: 96 },
  { name: "xxhdpi", size: 144 },
  { name: "xxxhdpi", size: 192 },
] as const;
