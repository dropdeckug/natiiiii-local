// Canvas-based Android icon generator
// Generates PNG ArrayBuffers for all 5 Android density buckets

export interface IconDensity {
  name: string;
  size: number;
  folder: string;
}

export const ICON_DENSITIES: IconDensity[] = [
  { name: "mdpi", size: 48, folder: "mipmap-mdpi" },
  { name: "hdpi", size: 72, folder: "mipmap-hdpi" },
  { name: "xhdpi", size: 96, folder: "mipmap-xhdpi" },
  { name: "xxhdpi", size: 144, folder: "mipmap-xxhdpi" },
  { name: "xxxhdpi", size: 192, folder: "mipmap-xxxhdpi" },
];

export interface GeneratedIcon {
  folder: string;
  squareBlob: ArrayBuffer;
  roundBlob: ArrayBuffer;
}

// Resize an image to a specific size and return PNG ArrayBuffer
const resizeImage = (
  img: HTMLImageElement,
  size: number,
  circular: boolean
): Promise<ArrayBuffer> => {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    if (circular) {
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
    }

    ctx.drawImage(img, 0, 0, size, size);

    canvas.toBlob((blob) => {
      blob!.arrayBuffer().then(resolve);
    }, "image/png");
  });
};

// Load an image from a data URL or File
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

// Generate all density icons from an uploaded image
export const generateIconsFromImage = async (
  imageDataUrl: string
): Promise<GeneratedIcon[]> => {
  const img = await loadImage(imageDataUrl);
  const icons: GeneratedIcon[] = [];

  for (const density of ICON_DENSITIES) {
    const [squareBlob, roundBlob] = await Promise.all([
      resizeImage(img, density.size, false),
      resizeImage(img, density.size, true),
    ]);
    icons.push({ folder: density.folder, squareBlob, roundBlob });
  }

  return icons;
};

// Generate default letter icons when no image is uploaded
export const generateDefaultIcons = async (
  appName: string,
  bgColor: string = "#4285F4"
): Promise<GeneratedIcon[]> => {
  const letter = (appName[0] || "A").toUpperCase();
  const icons: GeneratedIcon[] = [];

  for (const density of ICON_DENSITIES) {
    const [squareBlob, roundBlob] = await Promise.all([
      generateLetterIcon(letter, density.size, bgColor, false),
      generateLetterIcon(letter, density.size, bgColor, true),
    ]);
    icons.push({ folder: density.folder, squareBlob, roundBlob });
  }

  return icons;
};

const generateLetterIcon = (
  letter: string,
  size: number,
  bgColor: string,
  circular: boolean
): Promise<ArrayBuffer> => {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    // Background
    if (circular) {
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = bgColor;
      ctx.fill();
    } else {
      const radius = size * 0.15;
      ctx.beginPath();
      ctx.roundRect(0, 0, size, size, radius);
      ctx.fillStyle = bgColor;
      ctx.fill();
    }

    // Letter
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold ${size * 0.5}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, size / 2, size / 2 + size * 0.03);

    canvas.toBlob((blob) => {
      blob!.arrayBuffer().then(resolve);
    }, "image/png");
  });
};

// Generate foreground icon for adaptive icons
export const generateForegroundIcon = async (
  imageDataUrl: string | null,
  appName: string,
  bgColor: string = "#4285F4"
): Promise<ArrayBuffer> => {
  const size = 432; // xxxhdpi foreground size (108dp * 4)
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  if (imageDataUrl) {
    const img = await loadImage(imageDataUrl);
    // Center the icon in the safe zone (66/108 ratio)
    const safeZone = size * (66 / 108);
    const offset = (size - safeZone) / 2;
    ctx.drawImage(img, offset, offset, safeZone, safeZone);
  } else {
    const letter = (appName[0] || "A").toUpperCase();
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold ${size * 0.3}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, size / 2, size / 2);
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      blob!.arrayBuffer().then(resolve);
    }, "image/png");
  });
};
