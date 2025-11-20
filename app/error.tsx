'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full flex-col items-center justify-center gap-6 bg-slate-950 px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
        <AlertTriangle className="h-10 w-10 text-red-500" />
      </div>
      
      <div className="space-y-2">
        <h2 className="text-2xl font-bold uppercase tracking-widest text-white">
          Mission Failed
        </h2>
        <p className="max-w-md text-slate-400">
          We encountered an unexpected error. {error.message || "The darkness consumed this request."}
        </p>
      </div>

      <button
        onClick={reset}
        className="group flex items-center gap-2 bg-destiny-gold/10 px-6 py-3 text-destiny-gold ring-1 ring-destiny-gold/50 transition-all hover:bg-destiny-gold hover:text-slate-900"
      >
        <RefreshCw className="h-4 w-4 transition-transform group-hover:rotate-180" />
        <span className="text-sm font-bold uppercase tracking-wider">Respawn</span>
      </button>
    </div>
  );
}

