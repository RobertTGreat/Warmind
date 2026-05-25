import { useMemo } from "react";
import useSWR from "swr";
import type { ItemDefinition } from "@/hooks/useItemDefinitions";

type InventoryDefinitionView = "card" | "full";

const fetchDefinitionsFromTable = async ([url, hashesKey, view]: [
  string,
  string,
  InventoryDefinitionView,
]) => {
  if (!hashesKey) {
    return {};
  }

  const response = await fetch(`${url}?view=${view}`, {
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

  const { data, error, isLoading } = useSWR<Record<number, ItemDefinition>>(
    ["/api/manifest-table/DestinyInventoryItemDefinition", hashesKey, view],
    fetchDefinitionsFromTable,
    {
      revalidateOnFocus: false,
      dedupingInterval: 24 * 60 * 60 * 1000,
    }
  );

  return {
    definitions: data ?? {},
    isLoading,
    isError: error,
  };
}
