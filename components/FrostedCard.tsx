import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface FrostedCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function FrostedCard({ children, className, hover = false }: FrostedCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-sm border border-white/5 bg-gray-800/20 backdrop-blur-md p-4 transition-all duration-300",
        hover && "hover:bg-gray-700/30 hover:border-white/10 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]",
        className
      )}
    >
      {/* Top shimmer line effect commonly seen in D2 */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />
      {children}
    </div>
  );
}
