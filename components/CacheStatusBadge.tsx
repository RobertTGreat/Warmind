"use client";

import { Database, RefreshCw } from "lucide-react";
import { useDestinyProfileContext } from "@/components/DestinyProfileProvider";
import { cn } from "@/lib/utils";

export function CacheStatusBadge() {
  const { cacheInfo, isUsingCachedData, forceRefresh } =
    useDestinyProfileContext();

  if (!cacheInfo.isCached) return null;

  return (
    <button
      onClick={() => forceRefresh()}
      className={cn(
        "inline-flex items-center gap-2 border px-2 py-1 text-xs transition-colors",
        isUsingCachedData
          ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
          : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
      )}
      title="Refresh profile data"
    >
      <Database className="h-3 w-3" />
      <span>
        {isUsingCachedData ? "Cached" : "Fresh"} {cacheInfo.ageString ?? ""}
      </span>
      <RefreshCw className="h-3 w-3" />
    </button>
  );
}
