import {
  buildDimItemMini,
  type DimDefinitionTables,
  type DimItemMini,
} from "@/lib/dimItemMini";
import { checkItemMatch, type ParsedSearch } from "@/lib/searchUtils";

export type InventoryItem = {
  itemHash: number;
  itemInstanceId?: string;
  bucketHash?: number;
  quantity?: number;
};

export type InventorySearchMatchRequest = {
  items: InventoryItem[];
  definitions: Record<number, any>;
  profile: any;
  parsedSearch: ParsedSearch;
  dimDefinitions: DimDefinitionTables;
};

export type InventorySearchMatchResponse = {
  matchByItemKey: Record<string, boolean>;
};

export function getInventoryItemSearchKey(item: InventoryItem) {
  return (
    item.itemInstanceId ??
    `${item.itemHash}:${item.bucketHash ?? "none"}:${item.quantity ?? 0}`
  );
}

export function getInventoryItemInstanceData(profile: any, itemInstanceId: string | undefined) {
  if (!itemInstanceId) return undefined;

  const instance = profile?.itemComponents?.instances?.data?.[itemInstanceId];
  const itemStats = profile?.itemComponents?.stats?.data?.[itemInstanceId]?.stats;

  if (!instance) return undefined;

  return {
    ...instance,
    stats: itemStats,
  };
}

export function buildNormalizedInventoryItem(
  item: InventoryItem,
  profile: any,
  dimDefinitions: DimDefinitionTables,
): DimItemMini | undefined {
  return buildDimItemMini(item, profile?.itemComponents ?? {}, dimDefinitions);
}

export function buildInventorySearchMatchRecord({
  items,
  definitions,
  profile,
  parsedSearch,
  dimDefinitions,
}: InventorySearchMatchRequest): InventorySearchMatchResponse {
  const matchByItemKey: Record<string, boolean> = {};

  for (const item of items) {
    const definition = definitions[item.itemHash];
    const instance = getInventoryItemInstanceData(profile, item.itemInstanceId);
    const normalizedItem = buildNormalizedInventoryItem(item, profile, dimDefinitions);

    matchByItemKey[getInventoryItemSearchKey(item)] = checkItemMatch(
      item,
      definition,
      parsedSearch,
      instance,
      items,
      normalizedItem,
    );
  }

  return { matchByItemKey };
}
