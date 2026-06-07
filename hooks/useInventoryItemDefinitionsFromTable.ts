import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ItemDefinition } from "@/hooks/useItemDefinitions";
import { getManifestDefinitions } from "@/lib/manifestRepository";

type InventoryDefinitionView = "card" | "full";
const INVENTORY_DEFINITION_SCHEMA_VERSION = "ammo-type-v2";

const fetchDefinitionsFromTable = async (
  hashesKey: string,
  view: InventoryDefinitionView,
) => {
  if (!hashesKey) {
    return {};
  }

  return getManifestDefinitions<ItemDefinition>(
    "DestinyInventoryItemDefinition",
    hashesKey.split(",").map(Number),
    {
      view,
      schemaVersion: INVENTORY_DEFINITION_SCHEMA_VERSION,
    },
  );
};

const fetchDefinitionsFromApi = async (
  url: string,
  hashesKey: string,
  view: InventoryDefinitionView,
) => {
  if (!hashesKey) {
    return {};
  }

  const queryParams = new URLSearchParams({
    view,
    schema: INVENTORY_DEFINITION_SCHEMA_VERSION,
  });
  const response = await fetch(`${url}?${queryParams.toString()}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      hashes: hashesKey.split(",").map(Number),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }

  return response.json();
};

export function useInventoryItemDefinitionsFromTable(
  itemHashes: number[],
  view: InventoryDefinitionView = "card"
) {
  const hashesKey = useMemo(
    () => [...new Set(itemHashes)].sort((a, b) => a - b).join(","),
    [itemHashes]
  );

  const { data, error, isLoading } = useQuery({
    queryKey: [
      "manifestDefinitions",
      "DestinyInventoryItemDefinition",
      hashesKey,
      view,
      INVENTORY_DEFINITION_SCHEMA_VERSION,
    ],
    queryFn: async () => {
      try {
        return (await fetchDefinitionsFromTable(
          hashesKey,
          view,
        )) as Record<number, ItemDefinition>;
      } catch (error) {
        console.warn("[Manifest] IndexedDB lookup failed, falling back to API", error);
        return fetchDefinitionsFromApi(
          "/api/manifest-table/DestinyInventoryItemDefinition",
          hashesKey,
          view,
        ) as Promise<Record<number, ItemDefinition>>;
      }
    },
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
