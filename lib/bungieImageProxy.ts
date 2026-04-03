/**
 * Build URLs for `/api/bungie-image`, which fetches Bungie CDN assets and serves
 * resized WebP (smaller bytes for inventory-style icons).
 */

import { getBungieImage } from "./bungie";
import { displayPixelsForCssEdge } from "./itemIconImage";

const BUNGIE_HOSTS = ["https://www.bungie.net", "http://www.bungie.net"] as const;

/** Normalize manifest paths (`/common/...`) or full bungie.net URLs to a pathname. */
export function normalizeBungieAssetPath(pathOrUrl: string | undefined | null): string | null {
  if (!pathOrUrl) {
    return null;
  }
  const s = pathOrUrl.trim();
  if (!s) {
    return null;
  }
  for (const origin of BUNGIE_HOSTS) {
    if (s.startsWith(origin)) {
      const path = s.slice(origin.length);
      return path.startsWith("/") ? path : null;
    }
  }
  if (s.startsWith("/")) {
    return s;
  }
  return null;
}

export function buildBungieImageProxyUrl(assetPath: string, widthPx: number): string {
  const params = new URLSearchParams();
  params.set("path", assetPath);
  params.set("w", String(widthPx));
  return `/api/bungie-image?${params.toString()}`;
}

/**
 * Tooltip / overlay images: proxy when we have a Bungie path or full bungie.net URL;
 * otherwise fall back to `getBungieImage` or pass through absolute URLs.
 */
export function tooltipBungieImageSrc(
  pathOrFullUrl: string | undefined | null,
  cssDisplayEdgePx: number,
): string {
  if (!pathOrFullUrl) {
    return "";
  }
  const w = Math.min(
    512,
    Math.max(16, displayPixelsForCssEdge(cssDisplayEdgePx, 2)),
  );
  const trimmed = pathOrFullUrl.trim();
  const p = normalizeBungieAssetPath(trimmed);
  if (p) {
    return buildBungieImageProxyUrl(p, w);
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return getBungieImage(trimmed);
}
