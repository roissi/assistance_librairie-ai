import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Sécurité / anti-abus
 */
const MAX_ISBN_LEN = 13;

// Rate-limit best-effort en mémoire (par IP)
const RL_WINDOW_MS = 60_000; // 1 min
const RL_MAX_REQ = 60; // 60 req/min/IP (endpoint léger)

// Défense en profondeur : éviter une Map qui grossit indéfiniment
const RL_MAX_KEYS = 10_000; // cap raisonnable
const RL_GC_EVERY = 500; // GC toutes les N requêtes
let rlTick = 0;

const rlMap = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request): string {
  // x-forwarded-for: "client, proxy1, proxy2"
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xrip = req.headers.get("x-real-ip");
  if (xrip?.trim()) return xrip.trim();

  // Fallback best-effort (évite que tout le monde partage "unknown")
  const ua = req.headers.get("user-agent") || "ua";
  return `unknown:${ua.slice(0, 40)}`;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function gcRateLimit(now: number) {
  rlTick++;
  if (rlTick % RL_GC_EVERY !== 0) return;

  // 1) supprimer les entrées expirées
  for (const [k, v] of rlMap.entries()) {
    if (now > v.resetAt) rlMap.delete(k);
  }

  // 2) si ça dépasse le cap, on purge “au hasard” (Map conserve l’ordre d’insertion)
  if (rlMap.size > RL_MAX_KEYS) {
    const toRemove = rlMap.size - RL_MAX_KEYS;
    let i = 0;
    for (const k of rlMap.keys()) {
      rlMap.delete(k);
      i++;
      if (i >= toRemove) break;
    }
  }
}

function rateLimit(req: Request): NextResponse | null {
  const ip = getClientIp(req);
  const now = Date.now();

  gcRateLimit(now);

  const entry = rlMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rlMap.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS });
    return null;
  }

  entry.count += 1;
  if (entry.count > RL_MAX_REQ) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessayez dans un instant." },
      {
        status: 429,
        headers: {
          "Retry-After": "60",
          "Cache-Control": "no-store",
        },
      },
    );
  }
  return null;
}

function isValidIsbn10(isbn10: string): boolean {
  // 9 chiffres + (chiffre ou X)
  if (!/^\d{9}[\dX]$/.test(isbn10)) return false;

  // checksum ISBN-10
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = isbn10[i];
    const val = ch === "X" ? 10 : Number(ch);
    sum += val * (10 - i);
  }
  return sum % 11 === 0;
}

function isValidIsbn13(isbn13: string): boolean {
  if (!/^\d{13}$/.test(isbn13)) return false;

  // checksum ISBN-13 (EAN-13)
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(isbn13[i]);
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(isbn13[12]);
}

export async function GET(req: Request) {
  // Rate limit en tout début
  const rl = rateLimit(req);
  if (rl) return rl;

  const { searchParams } = new URL(req.url);
  let isbn = (searchParams.get("isbn") ?? "").trim();

  if (!isbn) return jsonError("ISBN requis", 400);

  // Normalisation : ne garder que chiffres et X
  isbn = isbn.replace(/[^0-9Xx]/g, "").toUpperCase();

  // Longueur raisonnable
  if (isbn.length > MAX_ISBN_LEN) {
    return jsonError("ISBN invalide", 400);
  }

  // Validation stricte 10/13 (évite de spam OpenLibrary avec n’importe quoi)
  const ok =
    (isbn.length === 10 && isValidIsbn10(isbn)) ||
    (isbn.length === 13 && isValidIsbn13(isbn));

  if (!ok) {
    return jsonError("ISBN invalide", 400);
  }

  // URL fixée -> pas de SSRF (bonne pratique)
  const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;

  // Timeout réseau (OpenLibrary peut être lent)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "manual", // évite qu’un 3xx soit suivi et considéré “ok”
      headers: {
        Accept: "image/*",
      },
      // Cache côté Next
      cache: "force-cache",
      next: { revalidate: 3600 }, // 1h
    });

    // Défense en profondeur : on veut UNIQUEMENT 200
    if (res.status !== 200) {
      return jsonError("Pas de couverture OpenLibrary", 404);
    }

    // Vérifier que c’est bien une image
    const ct = res.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) {
      return jsonError("Pas de couverture OpenLibrary", 404);
    }

    // Cache côté client/proxy (réduit la charge)
    return NextResponse.json(
      { thumbnail: url },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
          Vary: "Accept",
        },
      },
    );
  } catch {
    return jsonError("Service indisponible. Réessayez.", 503);
  } finally {
    clearTimeout(timeout);
  }
}
