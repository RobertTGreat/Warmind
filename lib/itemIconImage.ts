/**
 * Fixed CSS pixel sizes for Destiny item icon cells (matches Tailwind w-16 / w-20 / w-24).
 * Accurate `sizes` feeds Next/Image; `itemIconDecodeBudgetPx` matches `/api/bungie-image` width
 * (DPR-capped) so the proxy does not upscale beyond what the cell needs.
 */
export const ITEM_ICON_CSS_PX = {
  small: 64,
  medium: 80,
  large: 96,
} as const;

export type ItemIconSize = keyof typeof ITEM_ICON_CSS_PX;

/** Pass to Next.js `<Image sizes={...} />` when the icon fills the item cell. */
export function itemIconSizes(size: ItemIconSize): string {
  return `${ITEM_ICON_CSS_PX[size]}px`;
}

const MAX_DECODE_DPR = 2;

/**
 * Logical pixels worth decoding for a given CSS edge length (DPR-capped).
 * Pure arithmetic — no layout reads.
 */
export function displayPixelsForCssEdge(cssEdgePx: number, devicePixelRatio: number): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.ceil(cssEdgePx * Math.min(dpr, MAX_DECODE_DPR));
}

export function itemIconDecodeBudgetPx(
  size: ItemIconSize,
  devicePixelRatio: number = 1,
): number {
  return displayPixelsForCssEdge(ITEM_ICON_CSS_PX[size], devicePixelRatio);
}
