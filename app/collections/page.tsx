'use client';

import { PageHeader } from "@/components/PageHeader";
import { CollectionsBrowser } from "@/components/CollectionsBrowser";
import { PRESENTATION_NODES } from "@/lib/destinyUtils";

export default function CollectionsPage() {
  return (
    <div className="space-y-6 pt-10">
      <div className="border border-white/10 p-6 min-h-[80vh] rounded-none">
         <CollectionsBrowser rootHash={PRESENTATION_NODES.COLLECTIONS_ROOT} />
      </div>
    </div>
  );
}
