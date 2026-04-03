"use client";

import { layout, prepare, type PreparedText } from "@chenglou/pretext";
import { useMemo } from "react";

/**
 * One-time Pretext `prepare()` per text/font pair. On resize, only re-run `layout()`
 * via `useParagraphLayoutSize` (cheap) instead of touching the DOM.
 */
export function usePreparedParagraph(text: string, canvasFont: string | null): PreparedText | null {
  return useMemo(() => {
    if (!canvasFont || !text.trim()) {
      return null;
    }
    try {
      return prepare(text, canvasFont);
    } catch {
      return null;
    }
  }, [text, canvasFont]);
}

export function useParagraphLayoutSize(
  prepared: PreparedText | null,
  maxWidthPx: number,
  lineHeightPx: number,
): { height: number; lineCount: number } {
  return useMemo(() => {
    if (!prepared || maxWidthPx <= 0 || lineHeightPx <= 0) {
      return { height: 0, lineCount: 0 };
    }
    try {
      return layout(prepared, maxWidthPx, lineHeightPx);
    } catch {
      return { height: 0, lineCount: 0 };
    }
  }, [prepared, maxWidthPx, lineHeightPx]);
}
