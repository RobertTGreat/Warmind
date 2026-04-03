"use client";

import { cn } from "@/lib/utils";
import { useLayoutEffect, useRef, useState } from "react";

/** Subpixel / rounding slack so we don’t marquee when text visually fits. */
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
  const [shouldScroll, setShouldScroll] = useState(false);

  /** Only DOM overflow — canvas/Pretext width often overshoots real layout and forced marquee (duplicate segments). */
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const measure = () => {
      const cw = el.clientWidth;
      const textEl = textRef.current;
      if (!textEl || cw <= 0) {
        setShouldScroll(false);
        return;
      }
      setShouldScroll(textEl.scrollWidth > cw + OVERFLOW_THRESHOLD_PX);
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
  }, [children, className]);

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
