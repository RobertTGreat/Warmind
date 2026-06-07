import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export interface ActivityDefinitionCard {
  hash: number;
  displayProperties?: {
    name?: string;
    description?: string;
    icon?: string;
    hasIcon?: boolean;
  };
  originalDisplayProperties?: {
    name?: string;
  };
  selectionScreenDisplayProperties?: {
    name?: string;
  };
  pgcrImage?: string;
  activityTypeHash?: number;
  directActivityModeHash?: number;
  directActivityModeType?: number;
  activityModeTypes?: number[];
  matchmaking?: {
    isMatchmade?: boolean;
    maxPlayers?: number;
  };
  isPlaylist?: boolean;
  isPvP?: boolean;
  redacted?: boolean;
  blacklisted?: boolean;
}

async function fetchActivityDefinitions(url: string, hashesKey: string) {
  const hashes = hashesKey.split(",").filter(Boolean).map(Number);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ hashes }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch activity definitions");
  }

  return response.json();
}

export function useActivityDefinitions(hashes: number[]) {
  const hashesKey = useMemo(() => {
    return [...new Set(hashes)].filter(Number.isFinite).sort((a, b) => a - b).join(",");
  }, [hashes.join(",")]);

  const { data, error, isLoading } = useQuery({
    queryKey: ["manifestDefinitions", "DestinyActivityDefinition", hashesKey, "activity-card"],
    queryFn: () =>
      fetchActivityDefinitions(
        "/api/manifest-table/DestinyActivityDefinition?view=activity-card",
        hashesKey,
      ) as Promise<Record<string, ActivityDefinitionCard>>,
    enabled: hashesKey.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });

  return {
    definitions: data ?? {},
    isLoading,
    isError: error,
  };
}
