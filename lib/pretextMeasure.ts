"use client";

import {
  layout,
  prepare,
  prepareWithSegments,
  walkLineRanges,
} from "@chenglou/pretext";

/** Large enough that wrapping matches a single unwrapped line for typical UI widths. */
const UNWRAP_MEASURE_WIDTH_PX = 16_777_216;

/**
 * Pixel width of text laid out as a single line (whitespace collapsed).
 * Sync `canvasFont` with `getComputedStyle(el).font` for the measured element.
 */
export function measureUnwrappedLineWidthPx(text: string, canvasFont: string): number {
  const t = text.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  if (!t) {
    return 0;
  }
  const prepared = prepareWithSegments(t, canvasFont);
  let w = 0;
  walkLineRanges(prepared, UNWRAP_MEASURE_WIDTH_PX, (line) => {
    w = line.width;
  });
  return w;
}

export function measureParagraphHeightPx(
  text: string,
  canvasFont: string,
  maxWidthPx: number,
  lineHeightPx: number,
): { height: number; lineCount: number } {
  const trimmed = text.trim();
  if (!trimmed || maxWidthPx <= 0 || lineHeightPx <= 0) {
    return { height: 0, lineCount: 0 };
  }
  const prepared = prepare(trimmed, canvasFont);
  return layout(prepared, maxWidthPx, lineHeightPx);
}

/** Total block height when clamped to at most `maxLines` (matches CSS line-clamp intent). */
export function measureClampedBlockHeightPx(
  text: string,
  canvasFont: string,
  maxWidthPx: number,
  lineHeightPx: number,
  maxLines: number,
): number {
  if (maxLines <= 0) {
    return 0;
  }
  const { height, lineCount } = measureParagraphHeightPx(
    text,
    canvasFont,
    maxWidthPx,
    lineHeightPx,
  );
  if (lineCount === 0) {
    return 0;
  }
  const cap = maxLines * lineHeightPx;
  return Math.min(height, cap);
}
