"use client";

import React, { createContext, useContext, useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  getProfileComponentsForPathname,
  useDestinyProfile,
} from "@/hooks/useDestinyProfile";

type DestinyProfileValue = ReturnType<typeof useDestinyProfile>;

/**
 * Stable mutation/selection callbacks. Kept in their own context so that
 * components which only need to *act* on the profile (e.g. every item card's
 * `updateItemSocketPlug`) do not re-render whenever the profile data changes.
 */
type DestinyProfileActions = Pick<
  DestinyProfileValue,
  "selectCharacter" | "forceRefresh" | "updateItemSocketPlug"
>;

const DestinyProfileContext = createContext<DestinyProfileValue | null>(null);
const DestinyProfileActionsContext =
  createContext<DestinyProfileActions | null>(null);

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

  const actions = useMemo<DestinyProfileActions>(
    () => ({
      selectCharacter: profile.selectCharacter,
      forceRefresh: profile.forceRefresh,
      updateItemSocketPlug: profile.updateItemSocketPlug,
    }),
    [profile.selectCharacter, profile.forceRefresh, profile.updateItemSocketPlug]
  );

  return (
    <DestinyProfileActionsContext.Provider value={actions}>
      <DestinyProfileContext.Provider value={profile}>
        {children}
      </DestinyProfileContext.Provider>
    </DestinyProfileActionsContext.Provider>
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

/**
 * Subscribe only to the stable profile action callbacks. Components using this
 * hook will not re-render when profile data changes, only when the callbacks
 * themselves change (effectively never, after initial load).
 */
export function useDestinyProfileActions() {
  const context = useContext(DestinyProfileActionsContext);

  if (!context) {
    throw new Error(
      "useDestinyProfileActions must be used inside DestinyProfileProvider"
    );
  }

  return context;
}
