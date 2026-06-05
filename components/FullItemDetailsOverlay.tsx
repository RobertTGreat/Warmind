"use client";

import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { Suspense, useEffect } from "react";
import { useUIStore } from "@/store/uiStore";

const WeaponDetailsPageClient = dynamic(
  () =>
    import("@/app/item/[itemHash]/WeaponDetailsPageClient").then(
      (module) => module.WeaponDetailsPageClient
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Loading full details...
      </div>
    ),
  }
);

export function FullItemDetailsOverlay() {
  const fullDetailsItem = useUIStore((state) => state.fullDetailsItem);
  const setDetailsItem = useUIStore((state) => state.setDetailsItem);
  const setFullDetailsItem = useUIStore((state) => state.setFullDetailsItem);

  useEffect(() => {
    if (!fullDetailsItem) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFullDetailsItem(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [fullDetailsItem, setFullDetailsItem]);

  if (!fullDetailsItem) return null;

  const closeOverlay = () => setFullDetailsItem(null);
  const showLessDetails = () => {
    setDetailsItem({
      itemHash: fullDetailsItem.itemHash,
      itemInstanceId: fullDetailsItem.itemInstanceId,
      ownerId: fullDetailsItem.ownerId,
    });
    setFullDetailsItem(null);
  };
  const selectOwnedCopy = (copy: any) => {
    setFullDetailsItem({
      itemHash: copy.itemHash ?? fullDetailsItem.itemHash,
      itemInstanceId: copy.itemInstanceId,
      ownerId: copy.ownerId,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/90 p-3 text-white backdrop-blur-sm sm:p-5"
      onClick={closeOverlay}
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-sm border border-white/15 bg-[#121212] shadow-2xl shadow-black"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute right-4 top-4 z-50 flex max-w-[calc(100%-2rem)] items-center gap-2 md:right-6 md:top-6 md:gap-4">
          <button
            type="button"
            onClick={showLessDetails}
            className="whitespace-nowrap border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-bold uppercase text-slate-300 transition-colors hover:border-destiny-gold/50 hover:text-destiny-gold"
          >
            Less Details
          </button>

          <button
            type="button"
            onClick={closeOverlay}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/70 text-slate-300 transition-colors hover:border-white/30 hover:text-white"
            aria-label="Close full item details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="h-full overflow-hidden">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Loading full details...
              </div>
            }
          >
            <WeaponDetailsPageClient
              key={`${fullDetailsItem.itemHash}-${fullDetailsItem.itemInstanceId ?? "definition"}`}
              itemHash={fullDetailsItem.itemHash}
              instanceId={fullDetailsItem.itemInstanceId}
              ownerId={fullDetailsItem.ownerId}
              isOverlay
              onSelectCopy={selectOwnedCopy}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
