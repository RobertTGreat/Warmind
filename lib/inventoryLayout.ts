import { BUCKETS } from "@/lib/destinyUtils";

/**
 * Compact, fully-serializable inputs for computing inventory ordering off the
 * main thread. Only the small "card" fields needed for sorting and grouping are
 * included, instead of the full manifest definitions and profile objects.
 *
 * Ordering is returned as indices into each owner bucket's original item array
 * so the main thread can map them back to the full item objects (preserving
 * fields such as `state` that are not part of this compact snapshot).
 */
export type InventoryLayoutItem = {
  itemHash: number;
  itemInstanceId?: string;
  quantity?: number;
};

export type InventoryCardSnapshot = {
  name: string;
  tierType: number;
  tierTypeName: string;
  bucketTypeHash: number;
  ammoType: number | string | null;
};

export type InventoryVaultGroupingOptions = {
  byClass: boolean;
  byRarity: boolean;
  byAmmoType: boolean;
  byTier: boolean;
};

export type InventoryLayoutOrderRequest = {
  revision: string;
  vaultOwnerId: string;
  sortMethod: string;
  vaultGrouping: InventoryVaultGroupingOptions;
  itemsByOwnerBucket: Record<string, InventoryLayoutItem[]>;
  cardByItemHash: Record<number, InventoryCardSnapshot>;
  primaryStatByInstanceId: Record<string, number>;
};

export type InventoryVaultGroupOrder = {
  groupLabel?: string;
  indices: number[];
};

export type InventoryLayoutOrderResponse = {
  revision: string;
  sortedIndicesByOwnerBucket: Record<string, number[]>;
  vaultGroupOrderByOwnerBucket: Record<string, InventoryVaultGroupOrder[]>;
};

const AMMO_TYPE_GROUPS = {
  PRIMARY: 1,
  SPECIAL: 2,
  HEAVY: 3,
  OTHER: 99,
} as const;

function getItemPrimaryStat(
  item: InventoryLayoutItem,
  primaryStatByInstanceId: Record<string, number>,
): number | undefined {
  if (!item.itemInstanceId) return undefined;
  return primaryStatByInstanceId[item.itemInstanceId];
}

function getItemSortValue(
  item: InventoryLayoutItem,
  card: InventoryCardSnapshot | undefined,
  primaryStatByInstanceId: Record<string, number>,
  sortMethod: string,
): string | number {
  switch (sortMethod) {
    case "power":
      return (
        getItemPrimaryStat(item, primaryStatByInstanceId) ?? item.quantity ?? 0
      );
    case "rarity":
      return card?.tierType ?? 0;
    case "name":
      return card?.name ?? "";
    default:
      return 0;
  }
}

/**
 * Compares two items for the active sort method, mirroring the main-thread
 * comparator so worker and synchronous results stay identical.
 */
function compareItemsForSort(
  firstItem: InventoryLayoutItem,
  secondItem: InventoryLayoutItem,
  cardByItemHash: Record<number, InventoryCardSnapshot>,
  primaryStatByInstanceId: Record<string, number>,
  sortMethod: string,
): number {
  const firstCard = cardByItemHash[firstItem.itemHash];
  const secondCard = cardByItemHash[secondItem.itemHash];

  if (sortMethod === "name") {
    return String(
      getItemSortValue(firstItem, firstCard, primaryStatByInstanceId, sortMethod),
    ).localeCompare(
      String(
        getItemSortValue(
          secondItem,
          secondCard,
          primaryStatByInstanceId,
          sortMethod,
        ),
      ),
    );
  }

  return (
    Number(
      getItemSortValue(
        secondItem,
        secondCard,
        primaryStatByInstanceId,
        sortMethod,
      ),
    ) -
    Number(
      getItemSortValue(firstItem, firstCard, primaryStatByInstanceId, sortMethod),
    )
  );
}

export function sortInventoryItems(
  items: InventoryLayoutItem[],
  cardByItemHash: Record<number, InventoryCardSnapshot>,
  primaryStatByInstanceId: Record<string, number>,
  sortMethod: string,
): InventoryLayoutItem[] {
  return [...items].sort((firstItem, secondItem) =>
    compareItemsForSort(
      firstItem,
      secondItem,
      cardByItemHash,
      primaryStatByInstanceId,
      sortMethod,
    ),
  );
}

function sortInventoryItemIndices(
  items: InventoryLayoutItem[],
  cardByItemHash: Record<number, InventoryCardSnapshot>,
  primaryStatByInstanceId: Record<string, number>,
  sortMethod: string,
): number[] {
  return items
    .map((_item, index) => index)
    .sort((firstIndex, secondIndex) => {
      const comparison = compareItemsForSort(
        items[firstIndex],
        items[secondIndex],
        cardByItemHash,
        primaryStatByInstanceId,
        sortMethod,
      );

      return comparison !== 0 ? comparison : firstIndex - secondIndex;
    });
}

function getNormalizedAmmoTypeGroup(
  ammoType: number | string | null,
): number | null {
  const numericAmmoType = Number(ammoType);

  if (
    numericAmmoType === AMMO_TYPE_GROUPS.PRIMARY ||
    numericAmmoType === AMMO_TYPE_GROUPS.SPECIAL ||
    numericAmmoType === AMMO_TYPE_GROUPS.HEAVY
  ) {
    return numericAmmoType;
  }

  if (typeof ammoType !== "string") {
    return null;
  }

  const normalizedAmmoType = ammoType.toLowerCase();

  if (normalizedAmmoType === "primary") return AMMO_TYPE_GROUPS.PRIMARY;
  if (normalizedAmmoType === "special") return AMMO_TYPE_GROUPS.SPECIAL;
  if (normalizedAmmoType === "heavy") return AMMO_TYPE_GROUPS.HEAVY;

  return null;
}

function getItemAmmoTypeGroup(card: InventoryCardSnapshot | undefined): number {
  const ammoTypeGroup = getNormalizedAmmoTypeGroup(card?.ammoType ?? null);

  if (ammoTypeGroup !== null) {
    return ammoTypeGroup;
  }

  const weaponBucketHash = Number(card?.bucketTypeHash);

  if (weaponBucketHash === BUCKETS.POWER_WEAPON) {
    return AMMO_TYPE_GROUPS.HEAVY;
  }

  if (
    weaponBucketHash === BUCKETS.KINETIC_WEAPON ||
    weaponBucketHash === BUCKETS.ENERGY_WEAPON
  ) {
    return AMMO_TYPE_GROUPS.PRIMARY;
  }

  return AMMO_TYPE_GROUPS.OTHER;
}

function getItemAmmoTypeLabel(card: InventoryCardSnapshot | undefined): string {
  const ammoTypeGroup = getItemAmmoTypeGroup(card);

  if (ammoTypeGroup === AMMO_TYPE_GROUPS.PRIMARY) return "Primary";
  if (ammoTypeGroup === AMMO_TYPE_GROUPS.SPECIAL) return "Special";
  if (ammoTypeGroup === AMMO_TYPE_GROUPS.HEAVY) return "Heavy";

  return "Other";
}

function getItemRarityLabel(card: InventoryCardSnapshot | undefined): string {
  return card?.tierTypeName ?? "Unknown Rarity";
}

export function hasActiveVaultGrouping(
  vaultGrouping: InventoryVaultGroupingOptions,
): boolean {
  return Boolean(vaultGrouping.byAmmoType || vaultGrouping.byRarity);
}

export function getVaultGroupLabel(
  card: InventoryCardSnapshot | undefined,
  vaultGrouping: InventoryVaultGroupingOptions,
): string {
  const labelParts: string[] = [];

  if (vaultGrouping.byAmmoType) {
    labelParts.push(getItemAmmoTypeLabel(card));
  }

  if (vaultGrouping.byRarity) {
    labelParts.push(getItemRarityLabel(card));
  }

  return labelParts.join(" / ") || "Vault";
}

function compareItemGrouping(
  firstCard: InventoryCardSnapshot | undefined,
  secondCard: InventoryCardSnapshot | undefined,
  vaultGrouping: InventoryVaultGroupingOptions,
): number {
  if (vaultGrouping.byAmmoType) {
    const ammoTypeDifference =
      getItemAmmoTypeGroup(firstCard) - getItemAmmoTypeGroup(secondCard);

    if (ammoTypeDifference !== 0) {
      return ammoTypeDifference;
    }
  }

  if (vaultGrouping.byRarity) {
    const firstTier = firstCard?.tierType ?? 0;
    const secondTier = secondCard?.tierType ?? 0;
    const rarityDifference = secondTier - firstTier;

    if (rarityDifference !== 0) {
      return rarityDifference;
    }
  }

  return 0;
}

/**
 * Sorts and groups vault items into ordered groups of indices (without chunking
 * into grid rows, which depends on the live column count and stays on the main
 * thread).
 */
export function buildVaultGroupOrder(
  items: InventoryLayoutItem[],
  cardByItemHash: Record<number, InventoryCardSnapshot>,
  primaryStatByInstanceId: Record<string, number>,
  sortMethod: string,
  vaultGrouping: InventoryVaultGroupingOptions,
): InventoryVaultGroupOrder[] {
  const sortedIndices = sortInventoryItemIndices(
    items,
    cardByItemHash,
    primaryStatByInstanceId,
    sortMethod,
  );

  if (!hasActiveVaultGrouping(vaultGrouping)) {
    return sortedIndices.length > 0 ? [{ indices: sortedIndices }] : [];
  }

  const groupedIndices = [...sortedIndices].sort((firstIndex, secondIndex) => {
    const groupingDifference = compareItemGrouping(
      cardByItemHash[items[firstIndex].itemHash],
      cardByItemHash[items[secondIndex].itemHash],
      vaultGrouping,
    );

    return groupingDifference;
  });

  const groups: InventoryVaultGroupOrder[] = [];
  let currentGroupKey = "";
  let currentGroup: InventoryVaultGroupOrder | null = null;

  for (const index of groupedIndices) {
    const groupLabel = getVaultGroupLabel(
      cardByItemHash[items[index].itemHash],
      vaultGrouping,
    );
    const groupKey = groupLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    if (!currentGroup || groupKey !== currentGroupKey) {
      currentGroup = { groupLabel, indices: [] };
      currentGroupKey = groupKey;
      groups.push(currentGroup);
    }

    currentGroup.indices.push(index);
  }

  return groups;
}

function isVaultOwnerBucketKey(
  ownerBucketKey: string,
  vaultOwnerId: string,
): boolean {
  return ownerBucketKey.startsWith(`${vaultOwnerId}:`);
}

/**
 * Computes the sorted character-bucket ordering and the grouped vault ordering
 * for every owner bucket in one pass, returning only plain serializable data.
 */
export function buildInventoryLayoutOrder(
  request: InventoryLayoutOrderRequest,
): InventoryLayoutOrderResponse {
  const {
    revision,
    vaultOwnerId,
    sortMethod,
    vaultGrouping,
    itemsByOwnerBucket,
    cardByItemHash,
    primaryStatByInstanceId,
  } = request;

  const sortedIndicesByOwnerBucket: Record<string, number[]> = {};
  const vaultGroupOrderByOwnerBucket: Record<
    string,
    InventoryVaultGroupOrder[]
  > = {};

  for (const [ownerBucketKey, items] of Object.entries(itemsByOwnerBucket)) {
    if (isVaultOwnerBucketKey(ownerBucketKey, vaultOwnerId)) {
      vaultGroupOrderByOwnerBucket[ownerBucketKey] = buildVaultGroupOrder(
        items,
        cardByItemHash,
        primaryStatByInstanceId,
        sortMethod,
        vaultGrouping,
      );
    } else {
      sortedIndicesByOwnerBucket[ownerBucketKey] = sortInventoryItemIndices(
        items,
        cardByItemHash,
        primaryStatByInstanceId,
        sortMethod,
      );
    }
  }

  return {
    revision,
    sortedIndicesByOwnerBucket,
    vaultGroupOrderByOwnerBucket,
  };
}
