const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

// Limite “avant compression” (client) : défense UX + évite de tenter de traiter 40MB
// (côté serveur on limite déjà aussi)
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB

// Garde-fou “pixels” (anti crash mémoire côté client)
// Ex: 8000x8000 = 64M pixels -> trop lourd pour canvas sur certaines machines.
const MAX_PIXELS = 24_000_000; // 24 MP (ajustable)

// Timeout de chargement image (évite promesse pendante)
const IMAGE_LOAD_TIMEOUT_MS = 6_000;

function isProbablyImage(bytes: Uint8Array): boolean {
  // Magic numbers basiques
  // JPEG: FF D8 FF
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  // WEBP: "RIFF....WEBP"
  if (bytes.length < 12) return false;

  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;

  // PNG
  const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (pngSig.every((b, i) => bytes[i] === b)) return true;

  // WEBP
  const riff =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46;
  const webp =
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  if (riff && webp) return true;

  return false;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function readMagicBytes(file: File, n = 16): Promise<Uint8Array> {
  const slice = file.slice(0, n);
  const buf = await slice.arrayBuffer();
  return new Uint8Array(buf);
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  code: string,
): Promise<T> {
  let timer: number | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(code)), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer !== null) window.clearTimeout(timer);
  }) as Promise<T>;
}

/**
 * Compresser une image côté navigateur :
 * - Valider type + taille
 * - Vérifier que le contenu ressemble à une image (magic number)
 * - Charger l’image
 * - Garde-fou dimensions/pixels
 * - Redimensionner (maxDim)
 * - Ré-encoder (supprime EXIF)
 *
 * Par défaut : sortie en JPEG (meilleur ratio poids/qualité pour photo)
 */
export async function compressImage(
  file: File,
  maxDim = 1500,
  opts?: {
    output?: "jpeg" | "png" | "webp";
    quality?: number; // 0..1 (jpeg/webp)
  },
): Promise<File> {
  // 1) Validations rapides
  if (!file) throw new Error("IMAGE_MISSING");
  if (!ALLOWED_IMAGE_MIME.has(file.type))
    throw new Error("IMAGE_TYPE_NOT_ALLOWED");
  if (file.size === 0) throw new Error("IMAGE_EMPTY");
  if (file.size > MAX_FILE_BYTES) throw new Error("IMAGE_TOO_LARGE");

  // 2) Validation “contenu”
  const magic = await readMagicBytes(file, 16);
  if (!isProbablyImage(magic)) throw new Error("IMAGE_INVALID");

  // 3) Chargement via objectURL
  const objectUrl = URL.createObjectURL(file);

  try {
    const img = new Image();
    img.decoding = "async";

    const loadPromise = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
      img.src = objectUrl;
    });

    await withTimeout(loadPromise, IMAGE_LOAD_TIMEOUT_MS, "IMAGE_LOAD_TIMEOUT");

    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;

    if (!width || !height) throw new Error("IMAGE_DIMENSIONS_FAILED");

    // 3bis) Garde-fou pixels
    if (width * height > MAX_PIXELS) {
      throw new Error("IMAGE_TOO_MANY_PIXELS");
    }

    // 4) Resize en respectant l’aspect ratio
    if (width > height) {
      if (width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      }
    } else {
      if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("CANVAS_CTX_FAILED");

    // Fond blanc (utile si source PNG transparent + sortie JPEG)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.drawImage(img, 0, 0, width, height);

    const output = opts?.output ?? "jpeg";
    const quality =
      output === "png" ? undefined : clamp(opts?.quality ?? 0.82, 0.5, 0.92);

    const mime =
      output === "png"
        ? "image/png"
        : output === "webp"
          ? "image/webp"
          : "image/jpeg";

    const ext = output === "png" ? "png" : output === "webp" ? "webp" : "jpg";

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (!b) return reject(new Error("BLOB_FAILED"));
          resolve(b);
        },
        mime,
        quality,
      );
    });

    // Nettoyage optionnel
    canvas.width = 0;
    canvas.height = 0;

    const safeBaseName = (file.name || "cover")
      .replace(/\.[^/.]+$/, "")
      .replace(/[^\w.-]+/g, "_")
      .slice(0, 80);

    return new File([blob], `${safeBaseName}.${ext}`, { type: mime });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
