"use client";

import dynamic from "next/dynamic";
import { DatabaseProvider } from "@/components/DatabaseProvider";

// Lazy load non-critical components to reduce main-thread work
const Toaster = dynamic(
  () => import("sonner").then((mod) => mod.Toaster),
  { ssr: false }
);

const FirstLoadWarning = dynamic(
  () => import("@/components/FirstLoadWarning").then((mod) => mod.FirstLoadWarning),
  { ssr: false }
);

const ClientManifestManager = dynamic(
  () => import("@/components/ClientManifestManager").then((mod) => mod.ClientManifestManager),
  { ssr: false }
);

const WishListInitializer = dynamic(
  () => import("@/components/WishListInitializer").then((mod) => mod.WishListInitializer),
  { ssr: false }
);

// Defer analytics to after page load
const Analytics = dynamic(
  () => import("@vercel/analytics/react").then((mod) => mod.Analytics),
  { ssr: false }
);

const SpeedInsights = dynamic(
  () => import("@vercel/speed-insights/next").then((mod) => mod.SpeedInsights),
  { ssr: false }
);

export function ClientProviders({ children }: { children?: React.ReactNode }) {
  return (
    <DatabaseProvider>
      {children}
      <FirstLoadWarning />
      <ClientManifestManager />
      <WishListInitializer />
      <Toaster position="bottom-center" theme="system" closeButton />
      <Analytics />
      <SpeedInsights />
    </DatabaseProvider>
  );
}

