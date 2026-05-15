"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useDestinyProfileContext } from "@/components/DestinyProfileProvider";

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

function scheduleIdle(callback: () => void) {
  if (typeof window === "undefined") return undefined;

  if ("requestIdleCallback" in window) {
    return (window as any).requestIdleCallback(callback, { timeout: 3000 });
  }

  return globalThis.setTimeout(callback, 1500);
}

export function PostLoginBoot() {
  const { isLoggedIn } = useDestinyProfileContext();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) {
      setEnabled(false);
      return;
    }

    const idleHandle = scheduleIdle(() => setEnabled(true));

    return () => {
      if (typeof idleHandle === "number") {
        clearTimeout(idleHandle);
      } else if (idleHandle && "cancelIdleCallback" in window) {
        (window as any).cancelIdleCallback(idleHandle);
      }
    };
  }, [isLoggedIn]);

  if (!enabled) return null;

  return (
    <>
      <FirstLoadWarning />
      <ClientManifestManager />
      <WishListInitializer />
    </>
  );
}
