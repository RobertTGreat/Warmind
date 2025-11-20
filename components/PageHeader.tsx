import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, children, className }: { title: string, description?: string, children?: ReactNode, className?: string }) {
  return (
    <div className={cn("mb-8 border-b border-white/10 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4", className)}>
      <div>
        <h1 className="text-4xl font-bold uppercase tracking-wide text-white">{title}</h1>
        {description && <p className="text-slate-400 mt-1">{description}</p>}
      </div>
      {children}
    </div>
  );
}

