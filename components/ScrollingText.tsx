"use client";

import { cn } from "@/lib/utils";
import { useElementCanvasFont } from "@/hooks/useElementCanvasFont";
import {
  extractPlainTextFromReactNode,
  normalizeForSingleLineMeasure,
} from "@/lib/pretextPlainText";
import { measureUnwrappedLineWidthPx } from "@/lib/pretextMeasure";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

/** Avoid marquee when width is within a few px (Pretext vs DOM / subpixels). */
const OVERFLOW_THRESHOLD_PX = 4;

interface ScrollingTextProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  duration?: number;
  /** When true, marquee pauses while hovering (default). Use false for tooltip-style always-on scroll. */
  pauseOnHover?: boolean;
}

export function ScrollingText({
  children,
  className,
  duration = 20,
  pauseOnHover = true,
  ...props
}: ScrollingTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [domShouldScroll, setDomShouldScroll] = useState(false);

  const plainText = useMemo(
    () => extractPlainTextFromReactNode(children),
    [children],
  );
  const fontRevision = `${className ?? ""}`;
  const canvasFont = useElementCanvasFont(containerRef, fontRevision);

  const pretextLineWidth = useMemo(() => {
    if (plainText === null || !canvasFont) {
      return null;
    }
    const t = normalizeForSingleLineMeasure(plainText);
    if (!t) {
      return 0;
    }
    try {
      return measureUnwrappedLineWidthPx(t, canvasFont);
    } catch {
      return null;
    }
  }, [plainText, canvasFont]);

  /** Always measure real DOM overflow — Pretext/canvas ignores letter-spacing etc., and we used to skip DOM when plainText was set. */
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const measure = () => {
      const cw = el.clientWidth;
      setContainerWidth(cw);
      const textEl = textRef.current;
      if (!textEl || cw <= 0) {
        setDomShouldScroll(false);
        return;
      }
      setDomShouldScroll(
        textEl.scrollWidth > cw + OVERFLOW_THRESHOLD_PX,
      );
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    window.addEventListener("resize", measure);
    const raf = requestAnimationFrame(() => measure());
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [children, className, fontRevision]);

  const usePretextPath = plainText !== null && pretextLineWidth !== null;
  const pretextOverflow =
    usePretextPath &&
    containerWidth > 0 &&
    pretextLineWidth > containerWidth + OVERFLOW_THRESHOLD_PX;
  const shouldScroll = domShouldScroll || pretextOverflow;

  if (!shouldScroll) {
    return (
      <div
        ref={containerRef}
        className={cn(
          "min-w-0 overflow-hidden whitespace-nowrap",
          className,
        )}
        {...props}
      >
        <div ref={textRef} className="inline-block">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "min-w-0 overflow-hidden whitespace-nowrap mask-linear-fade",
        className,
      )}
      {...props}
    >
      {/* pr-8 on each segment so translateX(-50%) matches one full loop (gap-8 broke seamless repeat). */}
      <div
        className={cn(
          "animate-marquee flex w-max",
          pauseOnHover && "marquee-pause-on-hover",
        )}
        style={{ animationDuration: `${duration}s` }}
      >
        <div ref={textRef} className="shrink-0 pr-8">
          {children}
        </div>
        <div className="shrink-0 pr-8" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
