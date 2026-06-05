"use client";

import dynamic from "next/dynamic";

const CollectionSetsBrowser = dynamic(
  () =>
    import("@/components/CollectionSetsBrowser").then(
      (mod) => mod.CollectionSetsBrowser
    ),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[80vh] animate-pulse bg-white/5" />
    ),
  }
);

const ItemDetailsOverlay = dynamic(
  () =>
    import("@/components/ItemDetailsOverlay").then(
      (mod) => mod.ItemDetailsOverlay
    ),
  { ssr: false }
);

export default function CollectionSetsPage() {
  return (
    <div className="space-y-6 pt-10">
      <div className="min-h-[80vh] border border-white/10">
        <CollectionSetsBrowser />
      </div>
      <ItemDetailsOverlay />
    </div>
  );
}
