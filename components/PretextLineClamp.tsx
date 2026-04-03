"use client";

import { cn } from "@/lib/utils";
import { measureClampedBlockHeightPx } from "@/lib/pretextMeasure";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

type PretextLineClampProps = {
  text: string;
  maxLines: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * Reserves exact min-height for clamped paragraphs using Pretext, so layout is stable
 * before/after text paints. Pair with Tailwind `line-clamp-*` for ellipsis behavior.
 */
export function PretextLineClamp({ text, maxLines, className, style }: PretextLineClampProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [minHeight, setMinHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const run = () => {
      if (!text.trim()) {
        setMinHeight(undefined);
        return;
      }
      const w = el.clientWidth;
      if (w <= 0) {
        return;
      }
      const cs = getComputedStyle(el);
      const font = cs.font;
      const lhParsed = parseFloat(cs.lineHeight);
      const fontSize = parseFloat(cs.fontSize);
      const lineHeightPx =
        Number.isFinite(lhParsed) && lhParsed > 0
          ? lhParsed
          : Number.isFinite(fontSize)
            ? fontSize * 1.25
            : 16;
      try {
        const h = measureClampedBlockHeightPx(text, font, w, lineHeightPx, maxLines);
        setMinHeight(h > 0 ? h : undefined);
      } catch {
        setMinHeight(undefined);
      }
    };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, maxLines]);

  return (
    <p
      ref={ref}
      className={cn(className)}
      style={{
        ...style,
        ...(minHeight !== undefined ? { minHeight } : undefined),
      }}
    >
      {text}
    </p>
  );
}
