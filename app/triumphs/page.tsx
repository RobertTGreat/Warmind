'use client';

import { useState, useEffect } from "react";
import dynamic from 'next/dynamic';
import { PRESENTATION_NODES } from "@/lib/destinyUtils";
import { useDestinyProfileContext } from "@/components/DestinyProfileProvider";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

// Lazy load heavy component
const TriumphsBrowser = dynamic(
  () => import("@/components/TriumphsBrowser").then((mod) => mod.TriumphsBrowser),
  { 
    ssr: false, 
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-destiny-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
);

export default function TriumphsPage() {
  const { profile, recordCategoriesRootNodeHash, recordSealsRootNodeHash, isLoading, isError } = useDestinyProfileContext();
  const score = profile?.profile?.data?.lifetimeScore || 0;
  const activeScore = profile?.profile?.data?.activeScore || 0;

  const [activeTab, setActiveTab] = useState<'triumphs' | 'seals'>('triumphs');

  // Fallback to hardcoded if API fails or profile not loaded yet, but prefer dynamic
  // Note: If recordCategoriesRootNodeHash is undefined, TriumphsBrowser will handle loading state
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const triumphsRoot = recordCategoriesRootNodeHash; 
  const sealsRoot = recordSealsRootNodeHash || PRESENTATION_NODES.SEALS_ROOT;

  if (!mounted) return null;

  if (isError) {
      return (
          <div className="p-12 text-center text-red-400 flex flex-col items-center gap-4 bg-red-900/10 border border-red-900/30 rounded-lg mt-10">
              <AlertTriangle className="w-12 h-12 text-red-500" />
              <div>
                  <h3 className="text-lg font-bold">Failed to load profile</h3>
                  <p className="text-sm opacity-80 mt-1">Could not retrieve triumph root nodes.</p>
              </div>
          </div>
      );
  }

  return (
    <div className="space-y-6 pt-10">
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 items-start sm:items-center w-full md:w-auto">
             {/* Tab Switcher */}
             <div className="flex p-1 rounded-lg border border-white/10 self-start sm:self-auto">
                 <button
                    onClick={() => setActiveTab('triumphs')}
                    className={cn(
                        "px-4 py-2 text-sm font-bold transition-all rounded-md",
                        activeTab === 'triumphs' ? "bg-destiny-gold text-black shadow-lg" : "text-slate-400 hover:text-white"
                    )}
                 >
                     TRIUMPHS
                 </button>
                 <button
                    onClick={() => setActiveTab('seals')}
                    className={cn(
                        "px-4 py-2 text-sm font-bold transition-all rounded-md",
                        activeTab === 'seals' ? "bg-destiny-gold text-black shadow-lg" : "text-slate-400 hover:text-white"
                    )}
                 >
                     SEALS
                 </button>
             </div>

             <div className="h-8 w-px bg-white/10 hidden sm:block" />

              <div className="flex gap-4 w-full sm:w-auto justify-between sm:justify-start">
                  <div className="flex flex-col items-end">
                      <span className="text-xs text-slate-400 uppercase tracking-widest">Active Score</span>
                      <span className="text-2xl font-bold text-destiny-gold">{activeScore.toLocaleString()}</span>
                  </div>
                  <div className="w-px bg-white/10" />
                  <div className="flex flex-col items-end">
                      <span className="text-xs text-slate-400 uppercase tracking-widest">Lifetime Score</span>
                      <span className="text-xl font-bold text-white">{score.toLocaleString()}</span>
                  </div>
              </div>
          </div>
      </div>

      <div className="border border-white/5 p-6 min-h-[80vh] shadow-2xl backdrop-blur-sm">
         {!isLoading ? (
             <TriumphsBrowser 
                rootHash={activeTab === 'triumphs' ? triumphsRoot! : sealsRoot} 
             />
         ) : (
             <div className="flex items-center justify-center h-64">
                 <div className="w-8 h-8 border-2 border-destiny-gold border-t-transparent rounded-full animate-spin" />
             </div>
         )}
      </div>
    </div>
  );
}
