import { Suspense } from "react";
import { WeaponDetailsPageClient } from "./WeaponDetailsPageClient";

export default async function ItemDetailsPage({
  params,
}: {
  params: Promise<{ itemHash: string }>;
}) {
  const { itemHash } = await params;

  return (
    <Suspense fallback={<div className="text-slate-400">Loading item details...</div>}>
      <WeaponDetailsPageClient itemHash={Number(itemHash)} />
    </Suspense>
  );
}
