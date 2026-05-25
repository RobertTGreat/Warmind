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

export const USE_BUNGIE_ICON_PROXY =
  process.env.NEXT_PUBLIC_USE_BUNGIE_ICON_PROXY === "true";

export function buildBungieImageProxyUrl(
  assetPath: string,
  widthPx: number,
  version?: string,
): string {
  const params = new URLSearchParams();
  params.set("path", assetPath);
  params.set("w", String(widthPx));

  if (version) {
    params.set("v", version);
  }

  return `/api/bungie-image?${params.toString()}`;
}

export function getClientManifestVersionCacheKey(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const simpleVersion = window.localStorage.getItem("destiny_manifest_version");
  if (simpleVersion) {
    return simpleVersion;
  }

  const storedVersionInfo = window.localStorage.getItem("warmind-manifest-version");
  if (!storedVersionInfo) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(storedVersionInfo) as { version?: string };
    return parsed.version;
  } catch {
    return storedVersionInfo;
  }
}

export function buildBungieIconUrl(
  assetPath: string,
  widthPx: number,
  version?: string,
): string {
  return USE_BUNGIE_ICON_PROXY
    ? buildBungieImageProxyUrl(assetPath, widthPx, version)
    : getBungieImage(assetPath);
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
    return buildBungieImageProxyUrl(p, w, getClientManifestVersionCacheKey());
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return getBungieImage(trimmed);
}
