"use client";

import React, { createContext, useContext, useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  getProfileComponentsForPathname,
  useDestinyProfile,
} from "@/hooks/useDestinyProfile";

type DestinyProfileValue = ReturnType<typeof useDestinyProfile>;

const DestinyProfileContext = createContext<DestinyProfileValue | null>(null);

export function DestinyProfileProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const components = useMemo(
    () => getProfileComponentsForPathname(pathname),
    [pathname]
  );
  const profile = useDestinyProfile(components);

  return (
    <DestinyProfileContext.Provider value={profile}>
      {children}
    </DestinyProfileContext.Provider>
  );
}

export function useDestinyProfileContext() {
  const context = useContext(DestinyProfileContext);

  if (!context) {
    throw new Error(
      "useDestinyProfileContext must be used inside DestinyProfileProvider"
    );
  }

  return context;
}
