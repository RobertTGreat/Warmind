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

/**
 * The heavy, slow-changing inputs needed to evaluate any search query. This is
 * sent to the worker once per profile/definition load instead of on every
 * keystroke, so that typing only transfers the lightweight parsed query.
 */
export type InventorySearchDataset = {
  items: InventoryItem[];
  definitions: Record<number, any>;
  profile: any;
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

/**
 * Creates a reusable search matcher bound to one dataset that caches the
 * expensive normalized item models so repeated queries only re-run the cheap
 * predicate evaluation rather than rebuilding every item from definitions.
 */
export function createInventorySearchMatcher(dataset: InventorySearchDataset) {
  const { items, definitions, profile, dimDefinitions } = dataset;
  const normalizedItemBySearchKey = new Map<string, DimItemMini | undefined>();

  const getNormalizedItemForSearch = (item: InventoryItem) => {
    const searchKey = getInventoryItemSearchKey(item);

    if (normalizedItemBySearchKey.has(searchKey)) {
      return normalizedItemBySearchKey.get(searchKey);
    }

    const normalizedItem = buildNormalizedInventoryItem(
      item,
      profile,
      dimDefinitions,
    );
    normalizedItemBySearchKey.set(searchKey, normalizedItem);
    return normalizedItem;
  };

  const matchParsedSearch = (
    parsedSearch: ParsedSearch,
  ): InventorySearchMatchResponse => {
    const matchByItemKey: Record<string, boolean> = {};

    for (const item of items) {
      const definition = definitions[item.itemHash];
      const instance = getInventoryItemInstanceData(
        profile,
        item.itemInstanceId,
      );
      const normalizedItem = getNormalizedItemForSearch(item);

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
  };

  return { matchParsedSearch };
}

export function buildInventorySearchMatchRecord({
  items,
  definitions,
  profile,
  parsedSearch,
  dimDefinitions,
}: InventorySearchMatchRequest): InventorySearchMatchResponse {
  return createInventorySearchMatcher({
    items,
    definitions,
    profile,
    dimDefinitions,
  }).matchParsedSearch(parsedSearch);
}
