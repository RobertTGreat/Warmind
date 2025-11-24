"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

interface ScrollingTextProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  duration?: number;
}

export function ScrollingText({ 
  children, 
  className, 
  duration = 20,
  ...props 
}: ScrollingTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  useEffect(() => {
    const checkScroll = () => {
      if (containerRef.current && textRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const textWidth = textRef.current.offsetWidth;
        setShouldScroll(textWidth > containerWidth);
      }
    };

    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [children]);

  if (!shouldScroll) {
    return (
      <div 
        ref={containerRef} 
        className={cn("overflow-hidden whitespace-nowrap", className)} 
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
      className={cn("overflow-hidden whitespace-nowrap mask-linear-fade", className)} 
      {...props}
    >
      <div 
        className="animate-marquee inline-flex gap-8"
        style={{ animationDuration: `${duration}s` }}
      >
        <div ref={textRef} className="shrink-0">
          {children}
        </div>
        <div className="shrink-0">
          {children}
        </div>
      </div>
    </div>
  );
}



