// Intelligent icon analysis: detect content bounding box, padding, and dominant
// background of an uploaded image, then derive settings that make the final
// composited icon match Capacitor's default specs (adaptive icon 66/108 safe
// zone => ~19.4% padding, square launcher with full bleed + soft corners).

export interface IconAnalysis {
  contentPaddingPct: number;       // existing transparent padding in the uploaded image (0-50)
  suggestedPaddingPct: number;     // padding to apply so result matches Capacitor safe zone
  dominantEdgeColor: string | null; // hex of opaque edge pixels (if image is non-transparent)
  hasAlpha: boolean;
  aspectRatio: number;             // width / height of detected content
  width: number;
  height: number;
}

// Capacitor / Android adaptive icon safe zone: foreground content lives inside
// a 66dp circle within a 108dp canvas => padding ≈ (108-66)/2 / 108 = 19.44%.
export const CAPACITOR_SAFE_ZONE_PADDING_PCT = 19;

const ALPHA_THRESHOLD = 16;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function analyzeIcon(dataUrl: string): Promise<IconAnalysis> {
  const img = await loadImage(dataUrl);
  const W = img.naturalWidth || img.width;
  const H = img.naturalHeight || img.height;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, W, H);

  let minX = W, minY = H, maxX = -1, maxY = -1;
  let hasAlpha = false;
  // dominant edge color from opaque pixels along the 4 borders
  const colorBuckets = new Map<string, number>();
  const sampleEdge = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    const a = data[i + 3];
    if (a < 250) return;
    const r = data[i] & 0xf0, g = data[i + 1] & 0xf0, b = data[i + 2] & 0xf0;
    const key = `${r},${g},${b}`;
    colorBuckets.set(key, (colorBuckets.get(key) || 0) + 1);
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = data[(y * W + x) * 4 + 3];
      if (a < 255) hasAlpha = true;
      if (a > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  for (let x = 0; x < W; x++) { sampleEdge(x, 0); sampleEdge(x, H - 1); }
  for (let y = 0; y < H; y++) { sampleEdge(0, y); sampleEdge(W - 1, y); }

  let dominantEdgeColor: string | null = null;
  if (!hasAlpha || colorBuckets.size > 0) {
    let best = ""; let bestCount = 0;
    for (const [k, v] of colorBuckets) if (v > bestCount) { best = k; bestCount = v; }
    if (best) {
      const [r, g, b] = best.split(",").map(Number);
      dominantEdgeColor = "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
    }
  }

  if (maxX < 0) {
    // empty / fully transparent
    return {
      contentPaddingPct: 0,
      suggestedPaddingPct: CAPACITOR_SAFE_ZONE_PADDING_PCT,
      dominantEdgeColor,
      hasAlpha,
      aspectRatio: 1,
      width: W,
      height: H,
    };
  }

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  // existing padding around content, as % of the longest side
  const padLeft = minX, padRight = W - 1 - maxX;
  const padTop = minY, padBottom = H - 1 - maxY;
  const avgPad = (padLeft + padRight + padTop + padBottom) / 4;
  const contentPaddingPct = Math.round((avgPad / Math.max(W, H)) * 100);

  // We want final padding ≈ 19% (Capacitor safe zone). If the user's image
  // already has built-in padding, subtract it so we don't double-pad.
  const suggestedPaddingPct = Math.max(
    0,
    Math.min(40, CAPACITOR_SAFE_ZONE_PADDING_PCT - contentPaddingPct)
  );

  return {
    contentPaddingPct,
    suggestedPaddingPct,
    dominantEdgeColor,
    hasAlpha,
    aspectRatio: cw / ch,
    width: W,
    height: H,
  };
}
