'use client';

import dynamic from 'next/dynamic';
import { PRESENTATION_NODES } from "@/lib/destinyUtils";

// Lazy load heavy component
const CollectionsBrowser = dynamic(
  () => import("@/components/CollectionsBrowser").then((mod) => mod.CollectionsBrowser),
  { 
    ssr: false, 
    loading: () => <div className="h-[80vh] animate-pulse bg-white/5 rounded" /> 
  }
);

const ItemDetailsOverlay = dynamic(
  () => import("@/components/ItemDetailsOverlay").then((mod) => mod.ItemDetailsOverlay),
  { ssr: false }
);

export default function CollectionsPage() {
  return (
    <div className="space-y-6 pt-10">
      <div className="border border-white/10 p-6 min-h-[80vh] rounded-none">
         <CollectionsBrowser rootHash={PRESENTATION_NODES.COLLECTIONS_ROOT} />
      </div>
      <ItemDetailsOverlay />
    </div>
  );
}
