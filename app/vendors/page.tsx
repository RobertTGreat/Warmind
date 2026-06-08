'use client';

import dynamic from 'next/dynamic';

const VendorsBrowser = dynamic(
  () => import('@/components/VendorsBrowser').then((mod) => mod.VendorsBrowser),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[80vh] animate-pulse rounded bg-white/5 pt-10" />
    ),
  }
);

export default function VendorsPage() {
  return <VendorsBrowser />;
}
