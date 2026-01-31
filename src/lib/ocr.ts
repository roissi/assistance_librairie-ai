import tesseract from "node-tesseract-ocr";
import fs from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";

const TESSDATA_DIR = "/usr/share/tesseract-ocr/4.00/tessdata";

// Timeout dur OCR (anti-DoS CPU)
const OCR_TIMEOUT_MS = 15_000;

// Défense en profondeur : limite buffer (même si la route limite déjà)
const OCR_MAX_BYTES = 6 * 1024 * 1024;

// Défense en profondeur : limite du texte retourné
const OCR_MAX_TEXT_LEN = 12_000;

function sanitizeText(raw: string): string {
  return raw
    .replace(/-\s*\n/g, "") // mots coupés en fin de ligne
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function clampText(s: string, max: number) {
  const v = (s ?? "").trim();
  return v.length > max ? v.slice(0, max) : v;
}

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

function detectExt(bytes: Uint8Array): "jpg" | "png" | "webp" | null {
  if (bytes.length < 12) return null;

  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";

  // PNG
  const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (pngSig.every((b, i) => bytes[i] === b)) return "png";

  // WEBP (RIFF....WEBP)
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
  if (riff && webp) return "webp";

  return null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("OCR_TIMEOUT")), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

export async function extractTextWithOCR(buffer: ArrayBuffer): Promise<string> {
  const buf = Buffer.from(buffer);

  if (buf.length === 0) throw new Error("OCR_EMPTY_BUFFER");
  if (buf.length > OCR_MAX_BYTES) throw new Error("OCR_IMAGE_TOO_LARGE");

  const bytes = new Uint8Array(buf);

  // Défense en profondeur : vérifier que c’est bien une image
  if (!isProbablyImage(bytes)) {
    throw new Error("OCR_INVALID_IMAGE");
  }

  // Extension cohérente (meilleure compat / debug plus simple)
  const ext = detectExt(bytes) ?? "jpg";

  // Nom imprévisible + unique (anti collision / anti guess)
  const fileName = `cover-${crypto.randomBytes(16).toString("hex")}.${ext}`;
  const filePath = path.join(os.tmpdir(), fileName);

  // Écriture avec permissions strictes
  await fs.writeFile(filePath, buf, { mode: 0o600 });

  try {
    const config = {
      lang: "fra",
      oem: 1,
      psm: 3,
      tessdataDir: TESSDATA_DIR,
    };

    const rawText = await withTimeout(
      tesseract.recognize(filePath, config),
      OCR_TIMEOUT_MS,
    );

    const cleaned = sanitizeText(String(rawText || ""));
    return clampText(cleaned, OCR_MAX_TEXT_LEN);
  } catch (err) {
    if (err instanceof Error && err.message === "OCR_TIMEOUT") {
      throw new Error("OCR_TIMEOUT");
    }
    throw new Error("OCR_FAILED");
  } finally {
    // Nettoyage no matter what
    await fs.unlink(filePath).catch(() => {});
  }
}
