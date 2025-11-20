import Link from 'next/link';
import { MapPinOff } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex h-[calc(100vh-4rem)] w-full flex-col items-center justify-center gap-6 bg-slate-950 px-4 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-sm border border-dashed border-slate-700 bg-slate-900/50">
        <MapPinOff className="h-10 w-10 text-slate-500" />
      </div>
      
      <div className="space-y-2">
        <h2 className="text-4xl font-bold text-slate-700">404</h2>
        <h3 className="text-xl font-bold uppercase tracking-widest text-white">
          Sector Not Found
        </h3>
        <p className="max-w-md text-slate-400">
          The coordinates you are looking for do not exist in our star charts.
        </p>
      </div>

      <Link
        href="/"
        className="mt-4 bg-white/5 px-8 py-3 text-sm font-bold uppercase tracking-wider text-white ring-1 ring-white/10 transition-all hover:bg-white/10"
      >
        Return to Orbit
      </Link>
    </div>
  );
}

