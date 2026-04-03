import { NextRequest } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";

const BUNGIE_ORIGIN = "https://www.bungie.net";
const MAX_EDGE = 512;
const MIN_EDGE = 16;
const DEFAULT_EDGE = 192;

function sanitizePath(raw: string | null): string | null {
  if (!raw) {
    return null;
  }
  let path = raw.trim();
  try {
    path = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (!path.startsWith("/") || path.includes("..")) {
    return null;
  }
  return path;
}

export async function GET(req: NextRequest) {
  const path = sanitizePath(req.nextUrl.searchParams.get("path"));
  const wRaw = req.nextUrl.searchParams.get("w");
  let edge = DEFAULT_EDGE;
  if (wRaw) {
    const n = parseInt(wRaw, 10);
    if (Number.isFinite(n)) {
      edge = Math.min(MAX_EDGE, Math.max(MIN_EDGE, n));
    }
  }

  if (!path) {
    return new Response("Invalid path", { status: 400 });
  }

  const fetchOpts = {
    headers: { "User-Agent": "Warmind/1.0 (Destiny companion image proxy)" },
    signal: AbortSignal.timeout(20_000),
    next: { revalidate: 86_400 } as const,
  };

  let upstream: Response;
  let pathForType = path;
  try {
    upstream = await fetch(`${BUNGIE_ORIGIN}${path}`, fetchOpts);
    // Some manifest paths 404 as .jpg but exist as .png (or vice versa).
    if (!upstream.ok && upstream.status === 404) {
      const alt =
        /\.jpe?g$/i.test(path)
          ? path.replace(/\.jpe?g$/i, ".png")
          : /\.png$/i.test(path)
            ? path.replace(/\.png$/i, ".jpg")
            : null;
      if (alt) {
        const retry = await fetch(`${BUNGIE_ORIGIN}${alt}`, fetchOpts);
        if (retry.ok) {
          upstream = retry;
          pathForType = alt;
        }
      }
    }
  } catch {
    return new Response("Upstream fetch failed", { status: 504 });
  }

  if (!upstream.ok) {
    return new Response("Upstream error", {
      status: upstream.status === 404 ? 404 : 502,
    });
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  if (buf.length === 0) {
    return new Response("Empty body", { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") || "";

  if (contentType.includes("svg") || pathForType.toLowerCase().endsWith(".svg")) {
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": contentType || "image/svg+xml",
        "Cache-Control":
          "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  }

  try {
    const out = await sharp(buf)
      .rotate()
      .resize(edge, edge, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4, alphaQuality: 90 })
      .toBuffer();

    return new Response(new Uint8Array(out), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control":
          "public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Cache-Control":
          "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  }
}
