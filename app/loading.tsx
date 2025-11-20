import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-destiny-gold/20" />
          <div className="relative flex h-12 w-12 items-center justify-center rounded-sm border border-destiny-gold/30 bg-destiny-gold/10">
            <Loader2 className="h-6 w-6 animate-spin text-destiny-gold" />
          </div>
        </div>
        <p className="animate-pulse text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
          Contacting Servers...
        </p>
      </div>
    </div>
  );
}

