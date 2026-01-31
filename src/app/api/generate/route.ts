import { NextResponse } from "next/server";
import { getPrompt } from "@/lib/prompts";
import { extractTextWithOCR } from "@/lib/ocr";

export const runtime = "nodejs";
type GenerationMode = "fiche" | "critique" | "traduction";

/**
 * Sécurité / anti-abus (serveur)
 */
const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 6 * 1024 * 1024; // 6MB max
const MAX_TITLE_LEN = 140;
const MAX_AUTHOR_LEN = 120;
const MAX_INPUT_LEN = 9000; // limite dure (évite prompts énormes)
const OPENAI_TIMEOUT_MS = 25_000;

// Anti-DoS CPU: limiteur de concurrence OCR (process-level)
const OCR_MAX_CONCURRENCY = 2;
let ocrInFlight = 0;
const ocrQueue: Array<() => void> = [];

async function withOcrConcurrency<T>(fn: () => Promise<T>): Promise<T> {
  if (ocrInFlight >= OCR_MAX_CONCURRENCY) {
    await new Promise<void>((resolve) => ocrQueue.push(resolve));
  }
  ocrInFlight++;
  try {
    return await fn();
  } finally {
    ocrInFlight--;
    const next = ocrQueue.shift();
    if (next) next();
  }
}

function clampText(s: string, max: number) {
  const v = (s ?? "").trim();
  return v.length > max ? v.slice(0, max) : v;
}

function isProbablyImage(bytes: Uint8Array): boolean {
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

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Mini rate-limit en mémoire (par IP), best-effort.
 * Très utile sur VPS (process Node long-running).
 */
const RL_WINDOW_MS = 60_000; // 1 min
const RL_MAX_REQ = 20; // 20 req/min/IP (ajuste)
const rlMap = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request): string {
  // Derrière Nginx, X-Forwarded-For est la source principale.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xrip = req.headers.get("x-real-ip");
  return xrip?.trim() || "unknown";
}

function rateLimit(req: Request): NextResponse | null {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = rlMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rlMap.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS });
    return null;
  }

  entry.count += 1;
  if (entry.count > RL_MAX_REQ) {
    // 429: Too Many Requests
    return jsonError("Trop de requêtes. Réessayez dans un instant.", 429);
  }
  return null;
}

function mapOcrErrorToUserMessage(err: unknown): {
  msg: string;
  status: number;
} {
  const code = err instanceof Error ? err.message : "";

  switch (code) {
    case "OCR_TIMEOUT":
      return {
        msg: "OCR trop long. Essayez une photo plus nette, mieux cadrée, et avec plus de lumière.",
        status: 408,
      };
    case "OCR_IMAGE_TOO_LARGE":
      return { msg: "Image trop lourde.", status: 413 };
    case "OCR_EMPTY_BUFFER":
      return { msg: "Image invalide.", status: 400 };
    case "OCR_FAILED":
    default:
      return {
        msg: "Impossible de lire le texte sur l’image. Essayez une photo plus nette.",
        status: 422,
      };
  }
}

/** Helpers de parsing JSON "safe" */
type JsonRecord = Record<string, unknown>;

function asRecord(v: unknown): JsonRecord | null {
  if (typeof v !== "object" || v === null) return null;
  if (Array.isArray(v)) return null;
  return v as JsonRecord;
}

function getStringField(obj: JsonRecord, key: string): string {
  const v = obj[key];
  return typeof v === "string" ? v : "";
}

/** Typage minimal de la réponse OpenAI */
type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

export async function POST(req: Request) {
  // Rate limit (avant tout)
  const rl = rateLimit(req);
  if (rl) return rl;

  try {
    let inputText = "";
    let mode: GenerationMode = "fiche";
    let title = "";
    let author = "";
    const ct = req.headers.get("content-type") ?? "";

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();

      const m = String(form.get("mode") ?? "fiche");
      if (m === "critique") mode = "critique";
      else if (m === "traduction") mode = "traduction";

      title = clampText(String(form.get("title") ?? ""), MAX_TITLE_LEN);
      author = clampText(String(form.get("author") ?? ""), MAX_AUTHOR_LEN);

      const file = form.get("coverImage");

      if (file instanceof Blob && file.size > 0) {
        // Taille max
        if (file.size > MAX_UPLOAD_BYTES) {
          return jsonError("Image trop lourde.", 413);
        }

        // MIME strict (Blob/File expose .type)
        const mime = String(file.type || "");
        if (!ALLOWED_IMAGE_MIME.has(mime)) {
          return jsonError("Format d’image non autorisé.", 415);
        }

        // Lecture + magic numbers
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);

        if (!isProbablyImage(bytes)) {
          return jsonError("Fichier image invalide.", 400);
        }

        // OCR sous contrôle de concurrence
        try {
          const ocrText = await withOcrConcurrency(() =>
            extractTextWithOCR(buf),
          );
          inputText = clampText(String(ocrText).trim(), MAX_INPUT_LEN);
        } catch (err) {
          const { msg, status } = mapOcrErrorToUserMessage(err);
          return jsonError(msg, status);
        }
      } else {
        inputText = clampText(
          String(form.get("textSource") ?? ""),
          MAX_INPUT_LEN,
        );
      }
    } else {
      // JSON fallback (si on l’utilise un jour)
      let raw: unknown = null;
      try {
        raw = await req.json();
      } catch {
        return jsonError("Requête invalide.", 400);
      }

      const json = asRecord(raw);
      if (!json) return jsonError("Requête invalide.", 400);

      const m = String(json.mode ?? "fiche");
      if (m === "critique") mode = "critique";
      else if (m === "traduction") mode = "traduction";

      title = clampText(getStringField(json, "title"), MAX_TITLE_LEN);
      author = clampText(getStringField(json, "author"), MAX_AUTHOR_LEN);
      inputText = clampText(getStringField(json, "input"), MAX_INPUT_LEN);
    }

    if (!author) return jsonError("Veuillez indiquer le nom de l’auteur.", 400);
    if (!title) return jsonError("Veuillez indiquer le titre du livre.", 400);
    if (!inputText) {
      return jsonError(
        "Veuillez fournir un texte ou une image lisible pour lancer la génération.",
        400,
      );
    }

    // Ne surtout pas exposer la nature du problème côté client
    if (!process.env.OPENAI_API_KEY) {
      return jsonError("Service temporairement indisponible.", 503);
    }

    const prompt = getPrompt(mode, inputText, title, author);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    let data: OpenAIChatCompletionResponse = {};
    try {
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          // Limite de sortie (anti coûts / anti réponses très longues)
          max_tokens: mode === "fiche" ? 700 : mode === "critique" ? 350 : 700,
        }),
      });

      data = (await aiRes
        .json()
        .catch(() => ({}))) as OpenAIChatCompletionResponse;

      if (!aiRes.ok) {
        // On n’expose pas l’erreur exacte OpenAI au client (clé, quotas, etc.)
        return jsonError("Erreur lors de la génération. Réessayez.", 502);
      }
    } catch {
      // Timeout / réseau
      return jsonError(
        "Le service met trop de temps à répondre. Réessayez.",
        504,
      );
    } finally {
      clearTimeout(timeout);
    }

    const content = data?.choices?.[0]?.message?.content ?? "";
    let fiche = "",
      meta = "",
      newsletter = "",
      translation = "";

    if (mode === "critique") {
      fiche = String(content).trim();
    } else if (mode === "traduction") {
      translation = String(content).trim();
    } else {
      const str = String(content);
      fiche = str.match(/FICHE:\s*([\s\S]*?)META:/)?.[1]?.trim() ?? "";
      meta = str.match(/META:\s*([\s\S]*?)NEWSLETTER:/)?.[1]?.trim() ?? "";
      newsletter = str.match(/NEWSLETTER:\s*([\s\S]*)/)?.[1]?.trim() ?? "";
    }

    return NextResponse.json({ fiche, meta, newsletter, translation });
  } catch {
    // Erreur inattendue: réponse neutre
    return jsonError("Erreur serveur. Réessayez.", 500);
  }
}
