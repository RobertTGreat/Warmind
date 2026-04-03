"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * Reads resolved `font` shorthand from the element (canvas-compatible).
 * Updates on resize of the element (font size changes from container queries are rare).
 */
export function useElementCanvasFont(
  ref: RefObject<HTMLElement | null>,
  /** When class names or inherited typography change without a resize, bump this to re-read `font`. */
  revision: unknown = 0,
): string | null {
  const [font, setFont] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const sync = () => {
      setFont(getComputedStyle(el).font);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, revision]);

  return font;
}
