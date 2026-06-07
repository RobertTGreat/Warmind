"use client";

import dynamic from "next/dynamic";
import { useDestinyProfileContext } from "@/components/DestinyProfileProvider";
import { DestinyItemCard } from "@/components/DestinyItemCard";
import { ItemTile, type ItemTileModel } from "@/components/ItemTile";
import { ProfileInventoryPanel } from "@/components/ProfileInventoryPanel";
import { useInventoryItemDefinitionsFromTable } from "@/hooks/useInventoryItemDefinitionsFromTable";
import { useInventorySearchMatches } from "@/hooks/useInventoryViewModels";
import { useManifestTable } from "@/hooks/useManifestTable";
import { BUCKETS, CURRENCIES, MATERIALS } from "@/lib/destinyUtils";
import {
  buildDimItemMini,
  type DimDefinitionTables,
  type DimItemMini,
} from "@/lib/dimItemMini";
import { ITEM_ICON_CSS_PX, type ItemIconSize } from "@/lib/itemIconImage";
import { getBungieImage, loginWithBungie, moveItem } from "@/lib/bungie";
import { normalizeBungieAssetPath } from "@/lib/bungieImageProxy";
import { parseSearchQuery } from "@/lib/searchUtils";
import { cn } from "@/lib/utils";
import { useSettingsStore, type VaultGroupingOptions } from "@/store/settingsStore";
import { useTransferStore } from "@/store/transferStore";
import { useUIStore } from "@/store/uiStore";
import { useWishListStore } from "@/store/wishlistStore";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Loader2,
  Settings,
} from "lucide-react";
import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

const ItemDetailsOverlay = dynamic(
  () =>
    import("@/components/ItemDetailsOverlay").then(
      (mod) => mod.ItemDetailsOverlay,
    ),
  { ssr: false },
);

const LoadoutButton = dynamic(
  () => import("@/components/LoadoutButton").then((mod) => mod.LoadoutButton),
  { ssr: false },
);

const VAULT_OWNER_ID = "VAULT";
const VAULT_BUCKET_HASH = BUCKETS.VAULT;
const INVENTORY_GRID_GAP_PX = 8;
const INVENTORY_GRID_PADDING_PX = 16;
const CURRENCY_CARD_WIDTH_PX = 360;
const MIN_CURRENCY_CARD_WIDTH_PX = 180;
const CHARACTER_TOGGLE_COLUMN_WIDTH_PX = 44;
const MATERIAL_ITEM_CATEGORY_HASH = 40;
const INVENTORY_OVERSCAN_PX = 160;
const SCROLL_IDLE_TIMEOUT_MS = 150;
const POSTMASTER_POPOUT_ICON_SIZE: ItemIconSize = "small";
const AMMO_TYPE_GROUPS = {
  PRIMARY: 1,
  SPECIAL: 2,
  HEAVY: 3,
  OTHER: 99,
} as const;

function ignoreDragLeave() {}

function getInitialScrollMetrics() {
  if (typeof window === "undefined") {
    return {
      scrollTop: 0,
      viewportHeight: 720,
      viewportWidth: 0,
      virtualListTop: 0,
    };
  }

  return {
    scrollTop: 0,
    viewportHeight: window.innerHeight,
    viewportWidth: 0,
    virtualListTop: 0,
  };
}

const CLASS_NAMES: Record<number, string> = {
  0: "Titan",
  1: "Hunter",
  2: "Warlock",
};

const CLASS_ICONS: Record<number, string> = {
  0: "/class-titan.svg",
  1: "/class-hunter.svg",
  2: "/class-warlock.svg",
};

const ELEMENT_ICONS: Record<number, string> = {
  1847026933:
    "https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_2a1773e10968f2d088b97c22b22bba9e.png",
  2303181850:
    "https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_092d066688b879c807c3b460afdd61e6.png",
  3454344768:
    "https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_ceb2f6197dccf3958bb31cc783eb97a0.png",
  151347233:
    "https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_530c4c3e7981dc2aefd24fd3293482bf.png",
  3949783978:
    "https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_b2fe51a94f3533f97079dfa0d27a4096.png",
  2817963223:
    "https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_b9c5a3f0c98bc973e8e507e2d9b31c5e.png",
};

const INVENTORY_SECTIONS = [
  {
    key: "postmaster",
    label: "Postmaster",
    rows: [
      {
        key: "postmaster",
        label: "Postmaster",
        bucketHash: BUCKETS.LOST_ITEMS,
        showEquipped: false,
      },
    ],
  },
  {
    key: "weapons",
    label: "Weapons",
    rows: [
      {
        key: "kinetic",
        label: "Kinetic",
        bucketHash: BUCKETS.KINETIC_WEAPON,
        showEquipped: true,
      },
      {
        key: "energy",
        label: "Energy",
        bucketHash: BUCKETS.ENERGY_WEAPON,
        showEquipped: true,
      },
      {
        key: "power",
        label: "Power",
        bucketHash: BUCKETS.POWER_WEAPON,
        showEquipped: true,
      },
    ],
  },
  {
    key: "armor",
    label: "Armor",
    rows: [
      {
        key: "helmet",
        label: "Helmet",
        bucketHash: BUCKETS.HELMET,
        showEquipped: true,
      },
      {
        key: "gauntlets",
        label: "Gauntlets",
        bucketHash: BUCKETS.GAUNTLETS,
        showEquipped: true,
      },
      {
        key: "chest",
        label: "Chest",
        bucketHash: BUCKETS.CHEST_ARMOR,
        showEquipped: true,
      },
      {
        key: "legs",
        label: "Legs",
        bucketHash: BUCKETS.LEG_ARMOR,
        showEquipped: true,
      },
      {
        key: "class",
        label: "Class Item",
        bucketHash: BUCKETS.CLASS_ARMOR,
        showEquipped: true,
      },
    ],
  },
] as const;

const CURRENCY_HASHES = [
  CURRENCIES.GLIMMER,
  CURRENCIES.BRIGHT_DUST,
  MATERIALS.ENHANCEMENT_CORE,
  MATERIALS.ENHANCEMENT_PRISM,
  MATERIALS.ASCENDANT_SHARD,
  MATERIALS.ASCENDANT_ALLOY,
  MATERIALS.STRANGE_COIN,
  MATERIALS.STRANGE_COIN_XUR,
] as const;

const CURRENCY_ROWS = [
  {
    hash: CURRENCIES.GLIMMER,
    label: "Glimmer",
    shortLabel: "G",
    key: "glimmer",
  },
  {
    hash: CURRENCIES.BRIGHT_DUST,
    label: "Bright Dust",
    shortLabel: "BD",
    key: "brightDust",
  },
  {
    hash: MATERIALS.ENHANCEMENT_CORE,
    label: "Enhancement Core",
    shortLabel: "C",
    key: "cores",
  },
  {
    hash: MATERIALS.ENHANCEMENT_PRISM,
    label: "Enhancement Prism",
    shortLabel: "P",
    key: "prisms",
  },
  {
    hash: MATERIALS.ASCENDANT_SHARD,
    label: "Ascendant Shard",
    shortLabel: "S",
    key: "shards",
  },
  {
    hash: MATERIALS.ASCENDANT_ALLOY,
    label: "Ascendant Alloy",
    shortLabel: "A",
    key: "alloys",
  },
  {
    hash: MATERIALS.STRANGE_COIN_XUR,
    label: "Strange Coin",
    shortLabel: "SC",
    key: "strangeCoins",
  },
] as const;

const NON_MATERIAL_CURRENCY_HASHES = new Set<number>([
  CURRENCIES.GLIMMER,
  CURRENCIES.BRIGHT_DUST,
]);

type InventoryItem = {
  itemHash: number;
  itemInstanceId?: string;
  bucketHash?: number;
  quantity?: number;
};

type BucketRow = (typeof INVENTORY_SECTIONS)[number]["rows"][number];

type CurrencyTotals = {
  glimmer: number;
  brightDust: number;
  cores: number;
  prisms: number;
  shards: number;
  alloys: number;
  strangeCoins: number;
};

type MaterialCount = {
  itemHash: number;
  name: string;
  quantity: number;
  iconPath?: string;
};

type TileWishListInfo = {
  isWishListed: boolean;
  isTrash: boolean;
  matchType: "exact" | "partial" | "item" | "none";
  matchedPerkHashes: number[];
  notes?: string;
  tags?: string[];
};

type TileRenderData = {
  key: string;
  item: InventoryItem;
  ownerId: string;
  definition: any;
  instanceData?: any;
  socketsData?: any;
  reusablePlugs?: any;
  normalizedItem?: DimItemMini;
  model: ItemTileModel;
  wishListInfo: TileWishListInfo;
  transferStatus: string | null;
};

type TileItemRef = {
  key: string;
  item: InventoryItem;
  ownerId: string;
  fallbackIndex: number;
  isDimmed: boolean;
};

type CharacterColumnSlice = {
  characterId: string;
  equippedItemRef: TileItemRef | null;
  inventoryItemRefs: Array<TileItemRef | null>;
};

type VaultDisplayRow =
  {
    type: "items";
    key: string;
    items: InventoryItem[];
    startIndex: number;
    groupLabel?: string;
  };

type CharacterInventoryRow =
  | {
      type: "section";
      key: string;
      sectionKey: string;
      label: string;
      isCollapsed: boolean;
      height: number;
    }
  | {
      type: "items";
      key: string;
      sectionKey: string;
      bucketRow: BucketRow;
      sliceIndex: number;
      characterColumns: CharacterColumnSlice[];
      vaultItemRefs: TileItemRef[];
      vaultGroupLabel?: string;
      height: number;
    };

type VirtualRow = CharacterInventoryRow & {
  top: number;
};

type VisibleRowWindow = {
  startIndex: number;
  endIndex: number;
  startTop: number;
};

function getVisibleRowWindow(
  virtualRows: VirtualRow[],
  scrollMetrics: ReturnType<typeof getInitialScrollMetrics>,
): VisibleRowWindow {
  if (virtualRows.length === 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      startTop: 0,
    };
  }

  const visibleTop = Math.max(
    0,
    scrollMetrics.scrollTop -
      scrollMetrics.virtualListTop -
      INVENTORY_OVERSCAN_PX,
  );
  const visibleBottom =
    Math.max(0, scrollMetrics.scrollTop - scrollMetrics.virtualListTop) +
    scrollMetrics.viewportHeight +
    INVENTORY_OVERSCAN_PX;
  let lowIndex = 0;
  let highIndex = virtualRows.length - 1;
  let startIndex = 0;

  while (lowIndex <= highIndex) {
    const middleIndex = Math.floor((lowIndex + highIndex) / 2);
    const middleRow = virtualRows[middleIndex];

    if (middleRow.top + middleRow.height >= visibleTop) {
      startIndex = middleIndex;
      highIndex = middleIndex - 1;
    } else {
      lowIndex = middleIndex + 1;
    }
  }

  let endIndex = startIndex;
  while (
    endIndex < virtualRows.length &&
    virtualRows[endIndex].top <= visibleBottom
  ) {
    endIndex += 1;
  }

  return {
    startIndex,
    endIndex,
    startTop: virtualRows[startIndex]?.top ?? 0,
  };
}

function getInstanceDataWithStats(
  profile: any,
  itemInstanceId: string | undefined,
) {
  if (!itemInstanceId) return undefined;

  const instance = profile?.itemComponents?.instances?.data?.[itemInstanceId];
  const itemStats =
    profile?.itemComponents?.stats?.data?.[itemInstanceId]?.stats;
  if (!instance) return undefined;

  return {
    ...instance,
    stats: itemStats,
  };
}

function getIconSizeClass(iconSize: ItemIconSize) {
  return {
    small: "w-12",
    medium: "w-14",
    large: "w-16",
  }[iconSize];
}

function getLayoutMeasurements(iconSize: ItemIconSize) {
  const sizePx = ITEM_ICON_CSS_PX[iconSize];
  return {
    sizePx,
    characterColumnWidth: sizePx * 4 + 34,
    vaultColumnWidth: Math.max(680, sizePx * 9 + 72),
  };
}

function getVaultGridMeasurements(iconSize: ItemIconSize) {
  const iconSizePx = ITEM_ICON_CSS_PX[iconSize];

  return {
    gapPx: 4,
    iconSizePx,
    rowHeightPx: iconSizePx + 26,
  };
}

function getVaultColumnCount(widthPx: number, iconSize: ItemIconSize) {
  const { gapPx, iconSizePx } = getVaultGridMeasurements(iconSize);
  const usableWidth = Math.max(widthPx, iconSizePx);

  return Math.max(1, Math.floor((usableWidth + gapPx) / (iconSizePx + gapPx)));
}

function getCurrencyIconPath(definitions: Record<number, any>, hash: number) {
  return definitions[hash]?.displayProperties?.icon;
}

function getBungieIconFromPath(iconPath: string | undefined | null) {
  const normalizedPath = normalizeBungieAssetPath(iconPath);
  return normalizedPath ? getBungieImage(normalizedPath) : null;
}

function getRarityClassName(definition: any, isMasterwork: boolean) {
  if (isMasterwork) {
    return "border-destiny-gold shadow-[0_0_4px_rgba(227,206,98,0.5)]";
  }

  return (
    {
      Exotic: "border-yellow-500",
      Legendary: "border-purple-500",
      Rare: "border-blue-500",
      Common: "border-green-500",
      Basic: "border-white/20",
    }[definition?.inventory?.tierTypeName as string] ?? "border-white/20"
  );
}

function getItemRenderKey(
  item: InventoryItem,
  ownerId: string,
  fallbackIndex = 0,
) {
  return `${ownerId}:${item.itemInstanceId ?? `${item.itemHash}:${item.bucketHash ?? "none"}:${fallbackIndex}`}`;
}

function getItemSearchKey(item: InventoryItem) {
  return (
    item.itemInstanceId ??
    `${item.itemHash}:${item.bucketHash ?? "none"}:${item.quantity ?? 0}`
  );
}

function createTileItemRef({
  item,
  ownerId,
  fallbackIndex,
  isDimmed,
}: {
  item: InventoryItem;
  ownerId: string;
  fallbackIndex: number;
  isDimmed: boolean;
}): TileItemRef {
  return {
    key: getItemRenderKey(item, ownerId, fallbackIndex),
    item,
    ownerId,
    fallbackIndex,
    isDimmed,
  };
}

function getSocketReusablePlugs(
  reusablePlugs: any,
  socket: any,
  socketIndex: number,
): any[] {
  const profileReusablePlugs =
    reusablePlugs?.[socketIndex] ?? reusablePlugs?.[String(socketIndex)];

  if (Array.isArray(profileReusablePlugs)) {
    return profileReusablePlugs;
  }

  if (Array.isArray(socket?.reusablePlugs)) {
    return socket.reusablePlugs;
  }

  if (Array.isArray(socket?.reusablePlugItems)) {
    return socket.reusablePlugItems;
  }

  return [];
}

function getPlugItemHash(plugItem: any) {
  const plugHash =
    typeof plugItem === "number"
      ? plugItem
      : (plugItem?.plugItemHash ?? plugItem?.plugHash ?? plugItem?.itemHash);

  return typeof plugHash === "number" ? plugHash : null;
}

function collectItemPlugHashes(
  socketsData: any,
  reusablePlugs: any,
  includeReusablePlugs: boolean,
) {
  const plugHashes = new Set<number>();

  socketsData?.sockets?.forEach((socket: any, socketIndex: number) => {
    if (socket?.plugHash) {
      plugHashes.add(socket.plugHash);
    }

    if (!includeReusablePlugs) {
      return;
    }

    for (const plugItem of getSocketReusablePlugs(
      reusablePlugs,
      socket,
      socketIndex,
    )) {
      const plugHash = getPlugItemHash(plugItem);

      if (plugHash) {
        plugHashes.add(plugHash);
      }
    }
  });

  return Array.from(plugHashes);
}

function getElementIconSrc(definition: any, instanceData: any) {
  const damageTypeHash =
    instanceData?.damageTypeHash || definition?.defaultDamageTypeHash;
  return damageTypeHash ? (ELEMENT_ICONS[damageTypeHash] ?? null) : null;
}

function getCharacterLoadouts(profile: any, characterId: string) {
  return profile?.characterLoadouts?.data?.[characterId]?.loadouts ?? [];
}

function getCharacterTitleName(
  character: any,
  recordDefinitions: Record<string, any> | undefined,
) {
  if (!character.titleRecordHash || !recordDefinitions) return "Guardian";

  const titleDefinition = recordDefinitions[String(character.titleRecordHash)];
  const genderKey = character.genderType === 1 ? "Female" : "Male";

  return (
    titleDefinition?.titleInfo?.titlesByGender?.[genderKey] ||
    titleDefinition?.titleInfo?.titlesByGender?.Male ||
    titleDefinition?.displayProperties?.name ||
    "Guardian"
  );
}

function findInventoryQuantity(
  profile: any,
  hashes: number | readonly number[],
) {
  const hashList = Array.isArray(hashes) ? hashes : [hashes];
  let quantity = 0;

  for (const item of profile?.profileInventory?.data?.items ?? []) {
    if (hashList.includes(item.itemHash)) {
      quantity += item.quantity ?? 0;
    }
  }

  for (const item of profile?.profileCurrencies?.data?.items ?? []) {
    if (hashList.includes(item.itemHash)) {
      quantity += item.quantity ?? 0;
    }
  }

  for (const characterCurrencies of Object.values(
    profile?.characterCurrencies?.data ?? {},
  )) {
    for (const item of (characterCurrencies as any).items ?? []) {
      if (hashList.includes(item.itemHash)) {
        quantity += item.quantity ?? 0;
      }
    }
  }

  for (const characterInventory of Object.values(
    profile?.characterInventories?.data ?? {},
  )) {
    for (const item of (characterInventory as any).items ?? []) {
      if (hashList.includes(item.itemHash)) {
        quantity += item.quantity ?? 0;
      }
    }
  }

  return quantity;
}

function isMaterialCountDefinition(definition: any) {
  const categoryHashes = definition?.itemCategoryHashes ?? [];
  const bucketHash = definition?.inventory?.bucketTypeHash;

  return (
    categoryHashes.includes(MATERIAL_ITEM_CATEGORY_HASH) ||
    bucketHash === BUCKETS.CONSUMABLES
  );
}

function getMaterialCounts(
  items: InventoryItem[],
  definitions: Record<number, any>,
): MaterialCount[] {
  const materialCountByHash = new Map<number, MaterialCount>();

  for (const item of items) {
    if (
      item.itemInstanceId ||
      !item.quantity ||
      NON_MATERIAL_CURRENCY_HASHES.has(item.itemHash)
    ) {
      continue;
    }

    const definition = definitions[item.itemHash];
    if (!definition || !isMaterialCountDefinition(definition)) {
      continue;
    }

    const existingMaterialCount = materialCountByHash.get(item.itemHash);
    const materialName =
      definition.displayProperties?.name ?? `Item ${item.itemHash}`;
    const materialIconPath = definition.displayProperties?.icon;

    materialCountByHash.set(item.itemHash, {
      itemHash: item.itemHash,
      name: materialName,
      iconPath: materialIconPath,
      quantity: (existingMaterialCount?.quantity ?? 0) + item.quantity,
    });
  }

  return Array.from(materialCountByHash.values()).sort(
    (firstMaterial, secondMaterial) =>
      firstMaterial.name.localeCompare(secondMaterial.name),
  );
}

function makeOwnerBucketKey(ownerId: string, bucketHash: number) {
  return `${ownerId}:${bucketHash}`;
}

function getItemSortValue(
  item: InventoryItem,
  definition: any,
  profile: any,
  sortMethod: string,
) {
  const instance = getInstanceDataWithStats(profile, item.itemInstanceId);

  switch (sortMethod) {
    case "power":
      return instance?.primaryStat?.value ?? item.quantity ?? 0;
    case "rarity":
      return definition?.inventory?.tierType ?? 0;
    case "name":
      return definition?.displayProperties?.name ?? "";
    default:
      return 0;
  }
}

function getWeaponBucketHash(definition: any) {
  return Number(definition?.inventory?.bucketTypeHash);
}

function getNormalizedAmmoTypeGroup(definition: any) {
  const rawAmmoType = definition?.equippingBlock?.ammoType;
  const numericAmmoType = Number(rawAmmoType);

  if (
    numericAmmoType === AMMO_TYPE_GROUPS.PRIMARY ||
    numericAmmoType === AMMO_TYPE_GROUPS.SPECIAL ||
    numericAmmoType === AMMO_TYPE_GROUPS.HEAVY
  ) {
    return numericAmmoType;
  }

  if (typeof rawAmmoType !== "string") {
    return null;
  }

  const normalizedAmmoType = rawAmmoType.toLowerCase();

  if (normalizedAmmoType === "primary") return AMMO_TYPE_GROUPS.PRIMARY;
  if (normalizedAmmoType === "special") return AMMO_TYPE_GROUPS.SPECIAL;
  if (normalizedAmmoType === "heavy") return AMMO_TYPE_GROUPS.HEAVY;

  return null;
}

function getItemAmmoTypeGroup(definition: any) {
  const ammoTypeGroup = getNormalizedAmmoTypeGroup(definition);

  if (ammoTypeGroup !== null) {
    return ammoTypeGroup;
  }

  const weaponBucketHash = getWeaponBucketHash(definition);

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

function getItemAmmoTypeLabel(definition: any) {
  const ammoTypeGroup = getItemAmmoTypeGroup(definition);

  if (ammoTypeGroup === AMMO_TYPE_GROUPS.PRIMARY) return "Primary";
  if (ammoTypeGroup === AMMO_TYPE_GROUPS.SPECIAL) return "Special";
  if (ammoTypeGroup === AMMO_TYPE_GROUPS.HEAVY) return "Heavy";

  return "Other";
}

function getItemRarityLabel(definition: any) {
  return definition?.inventory?.tierTypeName ?? "Unknown Rarity";
}

function hasActiveVaultGrouping(vaultGrouping: VaultGroupingOptions) {
  return Boolean(vaultGrouping.byAmmoType || vaultGrouping.byRarity);
}

function getVaultGroupLabel(definition: any, vaultGrouping: VaultGroupingOptions) {
  const labelParts: string[] = [];

  if (vaultGrouping.byAmmoType) {
    labelParts.push(getItemAmmoTypeLabel(definition));
  }

  if (vaultGrouping.byRarity) {
    labelParts.push(getItemRarityLabel(definition));
  }

  return labelParts.join(" / ") || "Vault";
}

function compareItemGrouping(
  firstDefinition: any,
  secondDefinition: any,
  vaultGrouping: VaultGroupingOptions,
) {
  if (vaultGrouping.byAmmoType) {
    const ammoTypeDifference =
      getItemAmmoTypeGroup(firstDefinition) - getItemAmmoTypeGroup(secondDefinition);

    if (ammoTypeDifference !== 0) {
      return ammoTypeDifference;
    }
  }

  if (vaultGrouping.byRarity) {
    const firstTier = firstDefinition?.inventory?.tierType ?? 0;
    const secondTier = secondDefinition?.inventory?.tierType ?? 0;
    const rarityDifference = secondTier - firstTier;

    if (rarityDifference !== 0) {
      return rarityDifference;
    }
  }

  return 0;
}

function getSortedItems(
  items: InventoryItem[],
  definitions: Record<number, any>,
  profile: any,
  sortMethod: string,
) {
  return [...items].sort((firstItem, secondItem) => {
    const firstDefinition = definitions[firstItem.itemHash];
    const secondDefinition = definitions[secondItem.itemHash];

    if (sortMethod === "name") {
      return String(
        getItemSortValue(firstItem, firstDefinition, profile, sortMethod),
      ).localeCompare(
        String(
          getItemSortValue(secondItem, secondDefinition, profile, sortMethod),
        ),
      );
    }

    return (
      Number(
        getItemSortValue(secondItem, secondDefinition, profile, sortMethod),
      ) -
      Number(getItemSortValue(firstItem, firstDefinition, profile, sortMethod))
    );
  });
}

function getVaultDisplayRows({
  items,
  definitions,
  profile,
  sortMethod,
  vaultGrouping,
  vaultColumnCount,
}: {
  items: InventoryItem[];
  definitions: Record<number, any>;
  profile: any;
  sortMethod: string;
  vaultGrouping: VaultGroupingOptions;
  vaultColumnCount: number;
}): VaultDisplayRow[] {
  if (!hasActiveVaultGrouping(vaultGrouping)) {
    return chunkVaultItems(items, vaultColumnCount, "vault");
  }

  const sortedItems = [...items].sort((firstItem, secondItem) => {
    const firstDefinition = definitions[firstItem.itemHash];
    const secondDefinition = definitions[secondItem.itemHash];
    const groupingDifference = compareItemGrouping(
      firstDefinition,
      secondDefinition,
      vaultGrouping,
    );

    if (groupingDifference !== 0) {
      return groupingDifference;
    }

    return getSortedItems(
      [firstItem, secondItem],
      definitions,
      profile,
      sortMethod,
    )[0] === firstItem
      ? -1
      : 1;
  });
  const rows: VaultDisplayRow[] = [];
  let currentGroupKey = "";
  let currentGroupItems: InventoryItem[] = [];
  let currentGroupLabel = "";

  const flushCurrentGroup = () => {
    if (currentGroupItems.length === 0) return;

    rows.push(
      ...chunkVaultItems(
        currentGroupItems,
        vaultColumnCount,
        currentGroupKey,
        currentGroupLabel,
      ),
    );
  };

  for (const item of sortedItems) {
    const definition = definitions[item.itemHash];
    const groupLabel = getVaultGroupLabel(definition, vaultGrouping);
    const groupKey = groupLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    if (currentGroupItems.length > 0 && groupKey !== currentGroupKey) {
      flushCurrentGroup();
      currentGroupItems = [];
    }

    currentGroupKey = groupKey;
    currentGroupLabel = groupLabel;
    currentGroupItems.push(item);
  }

  flushCurrentGroup();

  return rows;
}

function chunkVaultItems(
  items: InventoryItem[],
  vaultColumnCount: number,
  keyPrefix: string,
  groupLabel?: string,
): VaultDisplayRow[] {
  const rows: VaultDisplayRow[] = [];
  let startIndex = 0;
  let isFirstRow = true;

  while (startIndex < items.length) {
    const rowItemCount =
      isFirstRow && groupLabel
        ? Math.max(1, vaultColumnCount - 1)
        : vaultColumnCount;

    rows.push({
      type: "items",
      key: `${keyPrefix}-items-${startIndex}`,
      items: items.slice(startIndex, startIndex + rowItemCount),
      startIndex,
      groupLabel: isFirstRow ? groupLabel : undefined,
    });

    startIndex += rowItemCount;
    isFirstRow = false;
  }

  return rows;
}

function getVaultGroupAmmoIconPath(groupLabel?: string) {
  const ammoGroupName = groupLabel?.split("/")[0]?.trim().toLowerCase();

  if (
    ammoGroupName === "primary" ||
    ammoGroupName === "special" ||
    ammoGroupName === "heavy"
  ) {
    return `/ammo-${ammoGroupName}.svg`;
  }

  return null;
}

function createTileRenderData({
  item,
  ownerId,
  fallbackIndex,
  definitions,
  profile,
  isDimmed,
  getWishListInfo,
  getNormalizedItem,
  pendingOperationByItemId,
}: {
  item: InventoryItem;
  ownerId: string;
  fallbackIndex?: number;
  definitions: Record<number, any>;
  profile: any;
  isDimmed: boolean;
  getWishListInfo: (
    itemHash: number,
    perkHashes?: number[],
  ) => TileWishListInfo;
  getNormalizedItem: (item: InventoryItem) => DimItemMini | undefined;
  pendingOperationByItemId: Map<string, string>;
}): TileRenderData {
  const definition = definitions[item.itemHash];
  const instance = getInstanceDataWithStats(profile, item.itemInstanceId);
  const socketsData = item.itemInstanceId
    ? profile?.itemComponents?.sockets?.data?.[item.itemInstanceId]
    : undefined;
  const reusablePlugs = item.itemInstanceId
    ? profile?.itemComponents?.reusablePlugs?.data?.[item.itemInstanceId]?.plugs
    : undefined;
  const normalizedItem = getNormalizedItem(item);
  const wishListPlugHashes =
    normalizedItem?.sockets?.allSockets.flatMap((socket) =>
      socket.plugOptions.map((plug) => plug.plugDef.hash),
    ) ?? collectItemPlugHashes(socketsData, reusablePlugs, true);
  const wishListInfo = item.itemHash
    ? getWishListInfo(
        item.itemHash,
        wishListPlugHashes.length > 0 ? wishListPlugHashes : undefined,
      )
    : {
        isWishListed: false,
        isTrash: false,
        matchType: "none" as const,
        matchedPerkHashes: [],
      };
  const isMasterwork =
    normalizedItem?.masterwork ??
    (instance ? (instance.state & 4) === 4 : false);
  const tierNumber = normalizedItem?.tier ?? 0;
  const primaryStat = instance?.primaryStat?.value;
  const itemKey = getItemRenderKey(item, ownerId, fallbackIndex);

  return {
    key: itemKey,
    item,
    ownerId,
    definition,
    instanceData: instance,
    socketsData,
    reusablePlugs,
    normalizedItem,
    wishListInfo,
    transferStatus: item.itemInstanceId
      ? (pendingOperationByItemId.get(item.itemInstanceId) ?? null)
      : null,
    model: {
      itemHash: item.itemHash,
      itemInstanceId: item.itemInstanceId,
      name: definition?.displayProperties?.name ?? `Item ${item.itemHash}`,
      iconSrc: getBungieIconFromPath(definition?.displayProperties?.icon),
      watermarkSrc: getBungieIconFromPath(
        definition?.iconWatermark || definition?.iconWatermarkShelved,
      ),
      elementIconSrc: getElementIconSrc(definition, instance),
      primaryStat,
      quantity: !item.itemInstanceId ? item.quantity : undefined,
      rarityClassName: getRarityClassName(definition, isMasterwork),
      isDimmed,
      isLocked:
        normalizedItem?.locked ??
        (instance ? (instance.state & 1) === 1 : false),
      isTrash: wishListInfo.isTrash,
      isWishListed: wishListInfo.isWishListed,
      wishListMatchType: wishListInfo.matchType,
      tierNumber,
    },
  };
}

const InteractiveInventoryTile = memo(function InteractiveInventoryTile({
  tile,
  iconSize,
  fetchPriority,
  suppressDetails,
}: {
  tile: TileRenderData;
  iconSize: ItemIconSize;
  fetchPriority: "auto" | "high" | "low";
  suppressDetails: boolean;
}) {
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const tileRef = useRef<HTMLDivElement>(null);
  const isPending = tile.transferStatus !== null;

  const handleMouseEnter = (event: React.MouseEvent) => {
    if (suppressDetails) return;

    if (!contextMenuPosition) {
      setTooltipPosition({ x: event.clientX, y: event.clientY });
    }
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    if (suppressDetails) return;

    setTooltipPosition(null);
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
  };

  const handleDragStart = (event: React.DragEvent) => {
    if (!tile.item.itemInstanceId || isPending) return;

    setIsDragging(true);
    setTooltipPosition(null);
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        itemHash: tile.item.itemHash,
        itemInstanceId: tile.item.itemInstanceId,
        ownerId: tile.ownerId,
        def: tile.definition,
      }),
    );
    event.dataTransfer.setData("text/plain", tile.item.itemInstanceId);

    if (tileRef.current) {
      const tileBounds = tileRef.current.getBoundingClientRect();
      event.dataTransfer.setDragImage(
        tileRef.current,
        tileBounds.width / 2,
        tileBounds.height / 2,
      );
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (!suppressDetails) return;

    setTooltipPosition(null);
    setContextMenuPosition(null);
  }, [suppressDetails]);

  return (
    <div
      ref={tileRef}
      className={cn(isDragging && "pointer-events-none scale-95 opacity-40")}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setTooltipPosition(null)}
      onContextMenu={handleContextMenu}
      draggable={Boolean(tile.item.itemInstanceId && !isPending)}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <ItemTile
        item={tile.model}
        sizePx={ITEM_ICON_CSS_PX[iconSize]}
        className={getIconSizeClass(iconSize)}
        fetchPriority={fetchPriority}
      />

      {!suppressDetails && (tooltipPosition || contextMenuPosition) && (
        <DestinyItemCard
          itemHash={tile.item.itemHash}
          definition={tile.definition}
          definitionIsPartial
          instanceData={tile.instanceData}
          socketsData={tile.socketsData}
          reusablePlugs={tile.reusablePlugs}
          itemInstanceId={tile.item.itemInstanceId}
          ownerId={tile.ownerId}
          quantity={!tile.item.itemInstanceId ? tile.item.quantity : undefined}
          size={iconSize}
          imageFetchPriority={fetchPriority}
          deferDetails
          renderTile={false}
          forcedTooltipPosition={tooltipPosition ?? undefined}
          forcedContextMenuPosition={contextMenuPosition ?? undefined}
          onCloseForcedContextMenu={() => setContextMenuPosition(null)}
        />
      )}
    </div>
  );
});

function EmptyInventorySlot({ iconSize }: { iconSize: ItemIconSize }) {
  const { sizePx } = getLayoutMeasurements(iconSize);

  return (
    <div
      className="shrink-0 bg-transparent"
      style={{ width: sizePx, height: sizePx }}
    />
  );
}

function CharacterHeaderCard({
  character,
  isSelected,
  titleName,
  loadouts,
  postmasterTiles,
  membershipInfo,
  profile,
  isPopoutOpen,
  onClick,
}: {
  character: any;
  isSelected: boolean;
  titleName: string;
  loadouts: any[];
  postmasterTiles: TileRenderData[];
  membershipInfo: any;
  profile: any;
  isPopoutOpen: boolean;
  onClick: () => void;
}) {
  const className = CLASS_NAMES[character.classType] ?? "Guardian";
  const emblemBackground = character.emblemBackgroundPath
    ? getBungieImage(character.emblemBackgroundPath)
    : "";
  const postmasterItemCount = postmasterTiles.length;

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    onClick();
  };

  return (
    <div className="relative h-16 overflow-visible">
      <button
        className={cn(
          "relative h-full w-full overflow-hidden border text-left transition-colors",
          isSelected || isPopoutOpen
            ? "border-destiny-gold/70"
            : "border-white/10 hover:border-white/30",
        )}
        onClick={onClick}
        onContextMenu={handleContextMenu}
        title="Open class panel"
        aria-haspopup="dialog"
        aria-expanded={isPopoutOpen}
      >
        {emblemBackground && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-80"
            style={{ backgroundImage: `url(${emblemBackground})` }}
          />
        )}
        <div className="absolute inset-0 bg-linear-to-r from-black/80 via-black/35 to-black/70" />
        <div className="relative flex h-full items-center p-2">
          <div className="flex w-full items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <img
                src={CLASS_ICONS[character.classType]}
                alt=""
                className="h-7 w-7 shrink-0 opacity-90"
              />
              <div className="min-w-0">
                <div className="truncate text-base font-semibold leading-tight text-white">
                  {className}
                </div>
                <div className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-200/80">
                  {titleName}
                </div>
              </div>
            </div>
            <div className="text-right text-base font-bold leading-none text-destiny-gold">
              {character.light}
            </div>
          </div>
        </div>

      </button>

      {postmasterItemCount > 0 && (
        <div className="pointer-events-none absolute right-2 top-full z-20 -mt-px flex h-5 items-center gap-1 rounded-b-sm border border-t-0 border-destiny-gold/45 bg-black/85 px-1.5 text-[10px] font-bold leading-none text-destiny-gold shadow-lg">
          <Archive className="h-3 w-3" />
          <span>{postmasterItemCount}</span>
        </div>
      )}

      {isPopoutOpen && (
        <CharacterClassPopout
          character={character}
          loadouts={loadouts}
          postmasterTiles={postmasterTiles}
          membershipInfo={membershipInfo}
          profile={profile}
        />
      )}
    </div>
  );
}

function CharacterClassPopout({
  character,
  loadouts,
  postmasterTiles,
  membershipInfo,
  profile,
}: {
  character: any;
  loadouts: any[];
  postmasterTiles: TileRenderData[];
  membershipInfo: any;
  profile: any;
}) {
  const className = CLASS_NAMES[character.classType] ?? "Guardian";
  const postmasterItemCount = postmasterTiles.length;

  return (
    <div
      className="absolute left-0 top-full z-50 mt-2 w-[380px] max-w-[calc(100vw-1rem)] border border-white/10 bg-[#101317]/95 p-3 text-slate-100 shadow-2xl backdrop-blur-xl"
      role="dialog"
      aria-label={`${className} class panel`}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">
            {className}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500">
            Class quick panel
          </div>
        </div>
        <span className="shrink-0 text-xs font-bold text-destiny-gold">
          {character.light}
        </span>
      </div>

      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1 custom-scrollbar">
        <section>
          <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <span>Loadouts</span>
            <span>{loadouts.length}</span>
          </div>

          {loadouts.length > 0 ? (
            <div className="grid grid-cols-5 gap-2">
              {loadouts.map((loadout, index) => (
                <LoadoutButton
                  key={`${character.characterId}-loadout-${index}`}
                  loadout={loadout}
                  index={index}
                  activeCharacterId={character.characterId}
                  membershipInfo={membershipInfo}
                  profile={profile}
                />
              ))}
            </div>
          ) : (
            <div className="border border-white/10 bg-black/30 px-3 py-5 text-center text-sm text-slate-500">
              No in-game loadouts found.
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <span>Postmaster</span>
            <span>{postmasterItemCount}/21</span>
          </div>

          {postmasterItemCount > 0 ? (
            <div className="grid grid-cols-6 gap-2">
              {postmasterTiles.map((tile, index) => (
                <InteractiveInventoryTile
                  key={tile.key}
                  tile={tile}
                  iconSize={POSTMASTER_POPOUT_ICON_SIZE}
                  fetchPriority={index < 6 ? "auto" : "low"}
                  suppressDetails={false}
                />
              ))}
            </div>
          ) : (
            <div className="border border-white/10 bg-black/30 px-3 py-5 text-center text-sm text-slate-500">
              No postmaster items found.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function CurrencyStrip({
  currencies,
  currencyDefinitions,
  materialCounts,
  materialsExpanded,
  onToggleMaterials,
}: {
  currencies: CurrencyTotals;
  currencyDefinitions: Record<number, any>;
  materialCounts: MaterialCount[];
  materialsExpanded: boolean;
  onToggleMaterials: () => void;
}) {
  return (
    <div className="grid h-full grid-flow-col grid-rows-2 content-center gap-x-2.5 gap-y-1 overflow-hidden text-[11px] text-slate-200">
      {CURRENCY_ROWS.map((row) => {
        const iconPath = getCurrencyIconPath(currencyDefinitions, row.hash);
        const value = currencies[row.key];

        return (
          <div
            key={row.hash}
            className="flex min-w-[4.5rem] items-center justify-end gap-1.5 tabular-nums"
            title={row.label}
          >
            {iconPath ? (
              <img
                src={getBungieImage(iconPath)}
                alt=""
                className="h-3.5 w-3.5 shrink-0 object-contain"
              />
            ) : (
              <span className="flex h-3.5 min-w-3.5 shrink-0 items-center justify-center border border-white/15 bg-white/10 px-0.5 text-[7px] font-bold text-slate-300">
                {row.shortLabel}
              </span>
            )}
            <span className="min-w-9 text-right font-semibold leading-none text-slate-100">
              {value.toLocaleString()}
            </span>
          </div>
        );
      })}
      <button
        type="button"
        className={cn(
          "flex min-w-[4.5rem] items-center justify-end gap-1.5 tabular-nums transition-colors hover:text-white",
          materialsExpanded ? "text-destiny-gold" : "text-slate-300",
        )}
        onClick={onToggleMaterials}
        title="Show material counts"
        aria-expanded={materialsExpanded}
      >
        <span className="flex h-3.5 min-w-3.5 shrink-0 items-center justify-center border border-white/15 bg-white/10 px-0.5 text-[7px] font-bold text-slate-300">
          M
        </span>
        <span className="min-w-9 text-right font-semibold leading-none">
          {materialCounts.length}
        </span>
      </button>
    </div>
  );
}

function MaterialCountsPanel({
  materialCounts,
}: {
  materialCounts: MaterialCount[];
}) {
  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-[42rem] max-w-[calc(100vw-2rem)] border border-white/10 bg-[#0d0d0d] p-3 text-slate-100 shadow-2xl">
      <div className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-300">
        Material Counts
      </div>

      {materialCounts.length === 0 ? (
        <div className="border-t border-white/10 py-4 text-center text-xs text-slate-500">
          No other materials found.
        </div>
      ) : (
        <div className="grid max-h-[60vh] grid-cols-2 gap-x-6 overflow-y-auto border-t border-white/10 pt-2 pr-2 text-xs custom-scrollbar">
          {materialCounts.map((materialCount) => (
            <div
              key={materialCount.itemHash}
              className="flex min-w-0 items-center gap-2 border-b border-white/10 py-1.5"
              title={materialCount.name}
            >
              <span className="w-16 shrink-0 text-right font-bold tabular-nums text-slate-100">
                {materialCount.quantity.toLocaleString()}
              </span>
              {materialCount.iconPath ? (
                <img
                  src={getBungieImage(materialCount.iconPath)}
                  alt=""
                  className="h-5 w-5 shrink-0 object-contain"
                />
              ) : (
                <span className="h-5 w-5 shrink-0 border border-white/10 bg-white/5" />
              )}
              <span className="min-w-0 truncate font-medium text-slate-200">
                {materialCount.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CurrencyHeaderCard({
  currencies,
  currencyDefinitions,
  materialCounts,
}: {
  currencies: CurrencyTotals;
  currencyDefinitions: Record<number, any>;
  materialCounts: MaterialCount[];
}) {
  const [materialsExpanded, setMaterialsExpanded] = useState(false);

  return (
    <div className="relative h-16 overflow-visible border border-white/10 bg-[#0f1115] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <CurrencyStrip
        currencies={currencies}
        currencyDefinitions={currencyDefinitions}
        materialCounts={materialCounts}
        materialsExpanded={materialsExpanded}
        onToggleMaterials={() =>
          setMaterialsExpanded((currentValue) => !currentValue)
        }
      />
      {materialsExpanded && (
        <MaterialCountsPanel materialCounts={materialCounts} />
      )}
    </div>
  );
}

function CharacterExpansionCard({
  hasExtraCharacters,
  showExtraCharacters,
  onToggleExtraCharacters,
}: {
  hasExtraCharacters: boolean;
  showExtraCharacters: boolean;
  onToggleExtraCharacters: () => void;
}) {
  return (
    <div className="flex h-16 items-center justify-center">
      {hasExtraCharacters && (
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center text-slate-300 transition-colors hover:text-white"
          onClick={onToggleExtraCharacters}
          title={
            showExtraCharacters
              ? "Hide other characters"
              : "Show other characters"
          }
          aria-label={
            showExtraCharacters
              ? "Hide other characters"
              : "Show other characters"
          }
          aria-expanded={showExtraCharacters}
        >
          <ChevronRight
            className={cn(
              "h-5 w-5 transition-transform",
              showExtraCharacters && "rotate-90",
            )}
          />
        </button>
      )}
    </div>
  );
}

function VaultHeaderCard({ vaultCount }: { vaultCount: number }) {
  return (
    <div className="relative h-16 overflow-hidden border border-white/10 bg-[#0f1115]">
      <div className="relative flex h-full items-center p-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center bg-white/10">
            <Archive className="h-5 w-5 text-slate-200" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-semibold text-white">Vault</div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">
              {vaultCount}/1300 stored
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const CharacterBucketRowSlice = memo(function CharacterBucketRowSlice({
  bucketRow,
  characterColumn,
  iconSize,
  sliceIndex,
  rowHeightPx,
  renderTile,
  suppressDetails,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  bucketRow: BucketRow;
  characterColumn: CharacterColumnSlice;
  iconSize: ItemIconSize;
  sliceIndex: number;
  rowHeightPx: number;
  renderTile: (tileRef: TileItemRef) => TileRenderData;
  suppressDetails: boolean;
  onDragOver: (event: React.DragEvent, targetId: string) => void;
  onDragLeave: () => void;
  onDrop: (
    event: React.DragEvent,
    targetOwnerId: string,
    bucketHash: number,
  ) => void;
}) {
  const dropZoneId = `${characterColumn.characterId}-${bucketRow.bucketHash}`;
  const visibleEquippedItemRef =
    sliceIndex === 0 ? characterColumn.equippedItemRef : null;

  return (
    <div
      className="w-full p-1 transition-colors hover:bg-white/[0.025]"
      style={{ height: rowHeightPx }}
      onDragOver={(event) => onDragOver(event, dropZoneId)}
      onDragLeave={onDragLeave}
      onDrop={(event) =>
        onDrop(event, characterColumn.characterId, bucketRow.bucketHash)
      }
    >
      <div className="flex items-start gap-2">
        {bucketRow.showEquipped && (
          <div className="shrink-0">
            {visibleEquippedItemRef ? (
              <InteractiveInventoryTile
                tile={renderTile(visibleEquippedItemRef)}
                iconSize={iconSize}
                fetchPriority="auto"
                suppressDetails={suppressDetails}
              />
            ) : (
              <EmptyInventorySlot iconSize={iconSize} />
            )}
          </div>
        )}

        <div className="grid shrink-0 grid-cols-3 gap-1">
          {characterColumn.inventoryItemRefs.map((tileRef, index) =>
            tileRef ? (
              <InteractiveInventoryTile
                key={tileRef.key}
                tile={renderTile(tileRef)}
                iconSize={iconSize}
                fetchPriority={sliceIndex === 0 && index < 3 ? "auto" : "low"}
                suppressDetails={suppressDetails}
              />
            ) : (
              <EmptyInventorySlot
                key={`empty-${characterColumn.characterId}-${sliceIndex}-${index}`}
                iconSize={iconSize}
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
});

const VaultBucketRowSlice = memo(function VaultBucketRowSlice({
  bucketRow,
  vaultItemRefs,
  vaultGroupLabel,
  vaultColumnCount,
  iconSize,
  rowHeightPx,
  renderTile,
  suppressDetails,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  bucketRow: BucketRow;
  vaultItemRefs: TileItemRef[];
  vaultGroupLabel?: string;
  vaultColumnCount: number;
  iconSize: ItemIconSize;
  rowHeightPx: number;
  renderTile: (tileRef: TileItemRef) => TileRenderData;
  suppressDetails: boolean;
  onDragOver: (event: React.DragEvent, targetId: string) => void;
  onDragLeave: () => void;
  onDrop: (
    event: React.DragEvent,
    targetOwnerId: string,
    bucketHash: number,
  ) => void;
}) {
  const { gapPx, iconSizePx } = getVaultGridMeasurements(iconSize);
  const dropZoneId = `${VAULT_OWNER_ID}-${bucketRow.bucketHash}`;
  const vaultGroupAmmoIconPath = getVaultGroupAmmoIconPath(vaultGroupLabel);

  return (
    <div
      className="p-1 transition-colors hover:bg-white/[0.025]"
      style={{ height: rowHeightPx }}
      onDragOver={(event) => onDragOver(event, dropZoneId)}
      onDragLeave={onDragLeave}
      onDrop={(event) => onDrop(event, VAULT_OWNER_ID, bucketRow.bucketHash)}
    >
      <div className="h-full">
        <div
          className="grid content-start"
          style={{
            gap: `${gapPx}px`,
            gridTemplateColumns: `repeat(${vaultColumnCount}, ${iconSizePx}px)`,
          }}
        >
          {vaultGroupAmmoIconPath && (
            <div
              className="flex items-center justify-center"
              style={{ height: iconSizePx, width: iconSizePx }}
              aria-label={`${vaultGroupLabel} ammo`}
              title={vaultGroupLabel}
            >
              <img
                src={vaultGroupAmmoIconPath}
                alt=""
                className="h-1/2 w-1/2 object-contain opacity-90"
              />
            </div>
          )}
          {vaultItemRefs.map((tileRef, index) => (
            <InteractiveInventoryTile
              key={tileRef.key}
              tile={renderTile(tileRef)}
              iconSize={iconSize}
              fetchPriority={index < 18 ? "auto" : "low"}
              suppressDetails={suppressDetails}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

const CharacterVirtualRow = memo(function CharacterVirtualRow({
  row,
  iconSize,
  boardGridTemplateColumns,
  hasCharacterToggleColumn,
  vaultColumnCount,
  renderTile,
  suppressDetails,
  onToggleSection,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  row: VirtualRow;
  iconSize: ItemIconSize;
  boardGridTemplateColumns: string;
  hasCharacterToggleColumn: boolean;
  vaultColumnCount: number;
  renderTile: (tileRef: TileItemRef) => TileRenderData;
  suppressDetails: boolean;
  onToggleSection: (sectionKey: string) => void;
  onDragOver: (event: React.DragEvent, targetId: string) => void;
  onDragLeave: () => void;
  onDrop: (
    event: React.DragEvent,
    targetOwnerId: string,
    bucketHash: number,
  ) => void;
}) {
  if (row.type === "section") {
    return (
      <button
        className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-300 transition-colors hover:text-white"
        style={{ height: row.height }}
        onClick={() => onToggleSection(row.sectionKey)}
        aria-expanded={!row.isCollapsed}
      >
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            row.isCollapsed && "-rotate-90",
          )}
        />
        {row.label}
      </button>
    );
  }

  return (
    <div
      className="grid gap-2"
      style={{
        gridTemplateColumns: boardGridTemplateColumns,
        height: row.height,
      }}
    >
      {row.characterColumns.map((characterColumn) => (
          <CharacterBucketRowSlice
            key={`${row.key}-${characterColumn.characterId}`}
            bucketRow={row.bucketRow}
            characterColumn={characterColumn}
            iconSize={iconSize}
            sliceIndex={row.sliceIndex}
            rowHeightPx={row.height}
            renderTile={renderTile}
            suppressDetails={suppressDetails}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          />
      ))}

      {hasCharacterToggleColumn && <div aria-hidden="true" />}

      <VaultBucketRowSlice
        bucketRow={row.bucketRow}
        vaultItemRefs={row.vaultItemRefs}
        vaultGroupLabel={row.vaultGroupLabel}
        vaultColumnCount={vaultColumnCount}
        iconSize={iconSize}
        rowHeightPx={row.height}
        renderTile={renderTile}
        suppressDetails={suppressDetails}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      />
    </div>
  );
});

export default function CharacterPage() {
  const { profile, stats, isLoading, isLoggedIn, membershipInfo } =
    useDestinyProfileContext();
  const addOperation = useTransferStore((state) => state.addOperation);
  const removeOperation = useTransferStore((state) => state.removeOperation);
  const updateOperationStatus = useTransferStore(
    (state) => state.updateOperationStatus,
  );
  const pendingOperations = useTransferStore(
    (state) => state.pendingOperations,
  );
  const iconSize = useSettingsStore((state) => state.iconSize);
  const sortMethod = useSettingsStore((state) => state.sortMethod);
  const vaultGrouping = useSettingsStore((state) => state.vaultGrouping);
  const setIconSize = useSettingsStore((state) => state.setIconSize);
  const setSortMethod = useSettingsStore((state) => state.setSortMethod);
  const setVaultGrouping = useSettingsStore((state) => state.setVaultGrouping);
  const searchQuery = useUIStore((state) => state.headerSearchQuery);
  const setSearchQuery = useUIStore((state) => state.setHeaderSearchQuery);
  const setHeaderSearchVisible = useUIStore(
    (state) => state.setHeaderSearchVisible,
  );
  const setHeaderSearchPlaceholder = useUIStore(
    (state) => state.setHeaderSearchPlaceholder,
  );
  const getWishListInfo = useWishListStore((state) => state.getWishListInfo);
  const wishListLookup = useWishListStore((state) => state.wishListLookup);
  const trashListLookup = useWishListStore((state) => state.trashListLookup);
  const activeSortMethod = sortMethod === "rarity" ? "power" : sortMethod;
  const { table: recordDefinitions } = useManifestTable<any>(
    "DestinyRecordDefinition",
  );
  const { table: equipableItemSetDefinitions } = useManifestTable<any>(
    "DestinyEquipableItemSetDefinition",
  );
  const { table: statDefinitions } = useManifestTable<any>(
    "DestinyStatDefinition",
  );
  const [mounted, setMounted] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    null,
  );
  const [showExtraCharacters, setShowExtraCharacters] = useState(false);
  const [openClassPopoutCharacterId, setOpenClassPopoutCharacterId] = useState<
    string | null
  >(null);
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const virtualListRef = useRef<HTMLDivElement>(null);
  const liveScrollMetricsRef = useRef(getInitialScrollMetrics());
  const visibleRowWindowRef = useRef<VisibleRowWindow>({
    startIndex: 0,
    endIndex: 0,
    startTop: 0,
  });
  const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInventoryScrollingRef = useRef(false);
  const [visibleRowWindow, setVisibleRowWindow] =
    useState<VisibleRowWindow>(() => visibleRowWindowRef.current);
  const [isInventoryScrolling, setIsInventoryScrolling] = useState(false);
  const [layoutViewportWidth, setLayoutViewportWidth] = useState(
    () => getInitialScrollMetrics().viewportWidth,
  );
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const parsedSearch = useMemo(
    () => parseSearchQuery(deferredSearchQuery),
    [deferredSearchQuery],
  );
  const layout = getLayoutMeasurements(iconSize);

  useEffect(() => {
    setMounted(true);

    const handleClickOutside = (event: MouseEvent) => {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(event.target as Node)
      ) {
        setIsSettingsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setHeaderSearchVisible(true);
    setHeaderSearchPlaceholder("Search, or h: to hide non-matches");

    return () => {
      setHeaderSearchVisible(false);
      setHeaderSearchPlaceholder("Search");
      setSearchQuery("");
    };
  }, [setHeaderSearchPlaceholder, setHeaderSearchVisible, setSearchQuery]);

  useEffect(() => {
    if (sortMethod === "rarity") {
      setSortMethod("power");
    }
  }, [setSortMethod, sortMethod]);

  const characters = useMemo(() => {
    const characterList = profile?.characters?.data
      ? Object.values(profile.characters.data)
      : [];
    return [...characterList].sort(
      (firstCharacter: any, secondCharacter: any) => {
        return (
          new Date(secondCharacter.dateLastPlayed).getTime() -
          new Date(firstCharacter.dateLastPlayed).getTime()
        );
      },
    );
  }, [profile]);

  const activeCharacterId =
    selectedCharacterId ??
    stats?.characterId ??
    (characters[0] as any)?.characterId;
  const activeCharacter = useMemo(() => {
    return (
      characters.find(
        (character: any) => character.characterId === activeCharacterId,
      ) ??
      characters[0] ??
      null
    );
  }, [activeCharacterId, characters]);
  const hasExtraCharacters = characters.length > 1;
  const visibleCharacters = useMemo(() => {
    if (showExtraCharacters) return characters;

    return activeCharacter ? [activeCharacter] : [];
  }, [activeCharacter, characters, showExtraCharacters]);

  useEffect(() => {
    if (!openClassPopoutCharacterId) return;

    const openCharacterIsVisible = visibleCharacters.some((character: any) => {
      return character.characterId === openClassPopoutCharacterId;
    });

    if (!openCharacterIsVisible) {
      setOpenClassPopoutCharacterId(null);
    }
  }, [openClassPopoutCharacterId, visibleCharacters]);

  const boardLayout = useMemo(() => {
    const characterColumns = visibleCharacters.map(
      () => `${layout.characterColumnWidth}px`,
    );
    const characterWidth =
      visibleCharacters.length * layout.characterColumnWidth;
    const characterToggleColumnWidth = hasExtraCharacters
      ? CHARACTER_TOGGLE_COLUMN_WIDTH_PX
      : 0;
    const characterToggleColumn = hasExtraCharacters
      ? `${CHARACTER_TOGGLE_COLUMN_WIDTH_PX}px`
      : null;
    const headerColumnCount =
      visibleCharacters.length + (hasExtraCharacters ? 1 : 0) + 2;
    const bodyColumnCount =
      visibleCharacters.length + (hasExtraCharacters ? 1 : 0) + 1;
    const headerGapWidth =
      Math.max(0, headerColumnCount - 1) * INVENTORY_GRID_GAP_PX;
    const bodyGapWidth =
      Math.max(0, bodyColumnCount - 1) * INVENTORY_GRID_GAP_PX;
    const availableContentWidth = Math.max(
      0,
      layoutViewportWidth - INVENTORY_GRID_PADDING_PX,
    );
    const minimumVaultColumnWidth = layout.sizePx;
    const availableCurrencyColumnWidth =
      availableContentWidth -
        characterWidth -
        characterToggleColumnWidth -
        minimumVaultColumnWidth -
        headerGapWidth;
    const currencyColumnWidth = Math.min(
      CURRENCY_CARD_WIDTH_PX,
      Math.max(MIN_CURRENCY_CARD_WIDTH_PX, availableCurrencyColumnWidth),
    );
    const headerVaultColumnWidth = Math.max(
      minimumVaultColumnWidth,
      availableContentWidth -
        characterWidth -
        characterToggleColumnWidth -
        currencyColumnWidth -
        headerGapWidth,
    );
    const bodyVaultColumnWidth = Math.max(
      minimumVaultColumnWidth +
        currencyColumnWidth +
        INVENTORY_GRID_GAP_PX,
      availableContentWidth -
        characterWidth -
        characterToggleColumnWidth -
        bodyGapWidth,
    );
    const visibleVaultGridWidth = Math.max(
      layout.sizePx,
      availableContentWidth -
        characterWidth -
        characterToggleColumnWidth -
        bodyGapWidth,
    );
    const headerVaultColumn = `${headerVaultColumnWidth}px`;
    const bodyVaultColumn = `${bodyVaultColumnWidth}px`;
    const currencyColumn = `${currencyColumnWidth}px`;
    const minimumContentWidth =
      characterWidth +
      characterToggleColumnWidth +
      minimumVaultColumnWidth +
      currencyColumnWidth +
      headerGapWidth;
    const headerGridColumns = [
      ...characterColumns,
      ...(characterToggleColumn ? [characterToggleColumn] : []),
      headerVaultColumn,
      currencyColumn,
    ];
    const bodyGridColumns = [
      ...characterColumns,
      ...(characterToggleColumn ? [characterToggleColumn] : []),
      bodyVaultColumn,
    ];

    return {
      headerGridTemplateColumns: headerGridColumns.join(" "),
      bodyGridTemplateColumns: bodyGridColumns.join(" "),
      minWidth: minimumContentWidth + INVENTORY_GRID_PADDING_PX,
      vaultColumnWidth: bodyVaultColumnWidth,
      visibleVaultGridWidth,
      hasCharacterToggleColumn: hasExtraCharacters,
    };
  }, [
    hasExtraCharacters,
    layout.characterColumnWidth,
    layout.sizePx,
    layout.vaultColumnWidth,
    layoutViewportWidth,
    visibleCharacters,
  ]);

  const { allItemHashes, fullInventoryList } = useMemo(() => {
    const currencyHashes = [...CURRENCY_HASHES];

    if (!profile) {
      return {
        allItemHashes: currencyHashes,
        fullInventoryList: [] as InventoryItem[],
      };
    }

    const characterItems = Object.values(
      profile.characterInventories?.data ?? {},
    ).flatMap((characterInventory: any) => characterInventory.items ?? []);
    const equippedItems = Object.values(
      profile.characterEquipment?.data ?? {},
    ).flatMap((characterEquipment: any) =>
      (characterEquipment.items ?? []).map((item: InventoryItem) => ({
        ...item,
        __isEquipped: true,
      })),
    );
    const characterCurrencyItems = Object.values(
      profile.characterCurrencies?.data ?? {},
    ).flatMap((characterCurrencies: any) => characterCurrencies.items ?? []);
    const profileCurrencyItems = profile.profileCurrencies?.data?.items ?? [];
    const profileItems = profile.profileInventory?.data?.items ?? [];
    const allItems = [
      ...characterItems,
      ...equippedItems,
      ...profileItems,
      ...profileCurrencyItems,
      ...characterCurrencyItems,
    ] as InventoryItem[];
    const plugHashes = new Set<number>();

    for (const item of allItems) {
      if (!item.itemInstanceId) continue;

      const socketsData =
        profile?.itemComponents?.sockets?.data?.[item.itemInstanceId];
      const reusablePlugs =
        profile?.itemComponents?.reusablePlugs?.data?.[item.itemInstanceId]
          ?.plugs;

      collectItemPlugHashes(socketsData, reusablePlugs, true).forEach(
        (plugHash) => {
          plugHashes.add(plugHash);
        },
      );
    }

    return {
      allItemHashes: [
        ...allItems.map((item) => item.itemHash),
        ...Array.from(plugHashes),
        ...currencyHashes,
      ],
      fullInventoryList: allItems,
    };
  }, [profile]);

  const { definitions, isLoading: definitionsLoading } =
    useInventoryItemDefinitionsFromTable(allItemHashes, "card");

  const inventoryItemByInstanceId = useMemo(() => {
    const itemMap = new Map<string, InventoryItem>();

    for (const item of fullInventoryList) {
      if (item.itemInstanceId) {
        itemMap.set(item.itemInstanceId, item);
      }
    }

    return itemMap;
  }, [fullInventoryList]);

  const dimDefinitions = useMemo<DimDefinitionTables>(
    () => ({
      inventoryItems: definitions,
      equipableItemSets: equipableItemSetDefinitions ?? {},
      stats: statDefinitions ?? {},
    }),
    [definitions, equipableItemSetDefinitions, statDefinitions],
  );

  const normalizedItemCacheRef = useRef(
    new Map<string, DimItemMini | undefined>(),
  );
  const normalizedItemCacheScopeRef = useRef<{
    dimDefinitions: DimDefinitionTables | null;
    profile: any;
  }>({
    dimDefinitions: null,
    profile: null,
  });

  const getNormalizedItem = useCallback(
    (item: InventoryItem) => {
      const cacheScope = normalizedItemCacheScopeRef.current;
      if (
        cacheScope.dimDefinitions !== dimDefinitions ||
        cacheScope.profile !== profile
      ) {
        normalizedItemCacheRef.current.clear();
        cacheScope.dimDefinitions = dimDefinitions;
        cacheScope.profile = profile;
      }

      const cacheKey = getItemSearchKey(item);
      const cache = normalizedItemCacheRef.current;

      if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
      }

      const normalizedItem = buildDimItemMini(
        item,
        profile?.itemComponents ?? {},
        dimDefinitions,
      );
      cache.set(cacheKey, normalizedItem);
      return normalizedItem;
    },
    [dimDefinitions, profile],
  );

  const inventoryByOwnerBucket = useMemo(() => {
    const itemMap = new Map<string, InventoryItem[]>();

    const addItem = (
      ownerId: string,
      item: InventoryItem,
      bucketHash: number | undefined,
    ) => {
      if (!bucketHash) return;

      const key = makeOwnerBucketKey(ownerId, bucketHash);
      const currentItems = itemMap.get(key) ?? [];
      currentItems.push(item);
      itemMap.set(key, currentItems);
    };

    for (const [characterId, inventory] of Object.entries(
      profile?.characterInventories?.data ?? {},
    )) {
      for (const item of (inventory as any).items ?? []) {
        addItem(characterId, item, item.bucketHash);
      }
    }

    for (const item of profile?.profileInventory?.data?.items ?? []) {
      if (item.bucketHash !== VAULT_BUCKET_HASH) continue;

      const definition = definitions[item.itemHash];
      addItem(VAULT_OWNER_ID, item, definition?.inventory?.bucketTypeHash);
    }

    return itemMap;
  }, [profile, definitions]);

  const equipmentByOwnerBucket = useMemo(() => {
    const itemMap = new Map<string, InventoryItem>();

    for (const [characterId, equipment] of Object.entries(
      profile?.characterEquipment?.data ?? {},
    )) {
      for (const item of (equipment as any).items ?? []) {
        if (item.bucketHash) {
          itemMap.set(makeOwnerBucketKey(characterId, item.bucketHash), item);
        }
      }
    }

    return itemMap;
  }, [profile]);

  const inventorySearchRequest = useMemo(() => {
    if (!deferredSearchQuery.trim()) {
      return null;
    }

    return {
      items: fullInventoryList,
      definitions,
      profile,
      parsedSearch,
      dimDefinitions,
    };
  }, [
    deferredSearchQuery,
    dimDefinitions,
    definitions,
    fullInventoryList,
    parsedSearch,
    profile,
  ]);
  const { matchByItemKey: searchMatchByItemKey } =
    useInventorySearchMatches(inventorySearchRequest);

  const isItemMatch = useCallback(
    (item: InventoryItem) => {
      if (!searchMatchByItemKey) return true;

      return searchMatchByItemKey[getItemSearchKey(item)] ?? false;
    },
    [searchMatchByItemKey],
  );

  const searchState = useMemo(
    () => ({
      hasQuery: Boolean(deferredSearchQuery.trim()),
      hideNonMatches: parsedSearch.hideNonMatches,
      isMatch: isItemMatch,
    }),
    [deferredSearchQuery, isItemMatch, parsedSearch.hideNonMatches],
  );

  const pendingTransferIndex = useMemo(() => {
    const operationMap = new Map<string, string>();
    const departingItemKeys = new Set<string>();
    const arrivalsByOwnerBucket = new Map<string, typeof pendingOperations>();

    pendingOperations.forEach((operation) => {
      operationMap.set(operation.itemInstanceId, operation.status);
      departingItemKeys.add(`${operation.fromOwnerId}:${operation.itemInstanceId}`);

      if (operation.bucketHash) {
        const ownerBucketKey = makeOwnerBucketKey(
          operation.toOwnerId,
          operation.bucketHash,
        );
        arrivalsByOwnerBucket.set(ownerBucketKey, [
          ...(arrivalsByOwnerBucket.get(ownerBucketKey) ?? []),
          operation,
        ]);
      }
    });

    return {
      operationByItemId: operationMap,
      departingItemKeys,
      arrivalsByOwnerBucket,
    };
  }, [pendingOperations]);

  const pendingOperationByItemId = pendingTransferIndex.operationByItemId;

  const getItemsForOwnerBucket = useCallback(
    (ownerId: string, bucketHash: number) => {
      const baseItems = [
        ...(inventoryByOwnerBucket.get(
          makeOwnerBucketKey(ownerId, bucketHash),
        ) ?? []),
      ];
      const withoutDepartingItems = baseItems.filter((item) => {
        return !(
          item.itemInstanceId &&
          pendingTransferIndex.departingItemKeys.has(
            `${ownerId}:${item.itemInstanceId}`,
          )
        );
      });

      const arrivingItems = (
        pendingTransferIndex.arrivalsByOwnerBucket.get(
          makeOwnerBucketKey(ownerId, bucketHash),
        ) ?? []
      )
        .filter(
          (operation) =>
            !withoutDepartingItems.some(
              (item) => item.itemInstanceId === operation.itemInstanceId,
            ),
        )
        .map((operation) => ({
          ...operation.item,
          itemHash: operation.itemHash,
          itemInstanceId: operation.itemInstanceId,
          bucketHash,
        }));

      return getSortedItems(
        [...withoutDepartingItems, ...arrivingItems],
        definitions,
        profile,
        activeSortMethod,
      );
    },
    [
      activeSortMethod,
      definitions,
      inventoryByOwnerBucket,
      pendingTransferIndex,
      profile,
    ],
  );

  const getEquippedItemForBucket = useCallback(
    (characterId: string, bucketHash: number) => {
      const equippedItem = equipmentByOwnerBucket.get(
        makeOwnerBucketKey(characterId, bucketHash),
      );

      if (!equippedItem) return undefined;

      const isMovingAway = Boolean(
        equippedItem.itemInstanceId &&
          pendingTransferIndex.departingItemKeys.has(
            `${characterId}:${equippedItem.itemInstanceId}`,
          ),
      );

      return isMovingAway ? undefined : equippedItem;
    },
    [equipmentByOwnerBucket, pendingTransferIndex],
  );

  const vaultCount = useMemo(() => {
    return (profile?.profileInventory?.data?.items ?? []).filter(
      (item: InventoryItem) => item.bucketHash === VAULT_BUCKET_HASH,
    ).length;
  }, [profile]);

  const currencies = useMemo(
    () => ({
      glimmer: findInventoryQuantity(profile, CURRENCIES.GLIMMER),
      brightDust: findInventoryQuantity(profile, CURRENCIES.BRIGHT_DUST),
      cores: findInventoryQuantity(profile, MATERIALS.ENHANCEMENT_CORE),
      prisms: findInventoryQuantity(profile, MATERIALS.ENHANCEMENT_PRISM),
      shards: findInventoryQuantity(profile, MATERIALS.ASCENDANT_SHARD),
      alloys: findInventoryQuantity(profile, MATERIALS.ASCENDANT_ALLOY),
      strangeCoins: findInventoryQuantity(profile, [
        MATERIALS.STRANGE_COIN,
        MATERIALS.STRANGE_COIN_XUR,
      ]),
    }),
    [profile],
  );
  const materialCounts = useMemo(
    () => getMaterialCounts(fullInventoryList, definitions),
    [definitions, fullInventoryList],
  );
  const postmasterTilesByCharacterId = useMemo(() => {
    const tileMap = new Map<string, TileRenderData[]>();

    for (const character of characters as any[]) {
      const postmasterItems = getItemsForOwnerBucket(
        character.characterId,
        BUCKETS.LOST_ITEMS,
      );
      const postmasterTiles = postmasterItems.map((item, index) =>
        createTileRenderData({
          item,
          ownerId: character.characterId,
          fallbackIndex: index,
          definitions,
          profile,
          isDimmed: false,
          getWishListInfo,
          getNormalizedItem,
          pendingOperationByItemId,
        }),
      );

      tileMap.set(character.characterId, postmasterTiles);
    }

    return tileMap;
  }, [
    characters,
    definitions,
    getItemsForOwnerBucket,
    getNormalizedItem,
    getWishListInfo,
    pendingOperationByItemId,
    profile,
    trashListLookup,
    wishListLookup,
  ]);

  const handleDrop = useCallback(async (
    event: React.DragEvent,
    targetOwnerId: string,
    bucketHash: number,
  ) => {
    event.preventDefault();

    const data = event.dataTransfer.getData("application/json");
    if (!data || !membershipInfo) return;

    try {
      const {
        itemHash,
        itemInstanceId,
        ownerId: fromOwnerId,
      } = JSON.parse(data);
      if (!itemInstanceId || fromOwnerId === targetOwnerId) return;

      const fullItem = inventoryItemByInstanceId.get(itemInstanceId);

      addOperation({
        itemHash,
        itemInstanceId,
        fromOwnerId,
        toOwnerId: targetOwnerId,
        item: fullItem ?? { itemHash, itemInstanceId, bucketHash },
        type: "transfer",
        bucketHash,
      });

      const targetName =
        targetOwnerId === VAULT_OWNER_ID
          ? "Vault"
          : (CLASS_NAMES[
              (characters as any[]).find(
                (character) => character.characterId === targetOwnerId,
              )?.classType
            ] ?? "Character");

      const transferPromise = (async () => {
        try {
          await moveItem(
            itemInstanceId,
            itemHash,
            fromOwnerId,
            targetOwnerId,
            membershipInfo.membershipType,
          );
          updateOperationStatus(itemInstanceId, "success");
          setTimeout(() => removeOperation(itemInstanceId), 1500);
        } catch (error) {
          updateOperationStatus(itemInstanceId, "error");
          setTimeout(() => removeOperation(itemInstanceId), 800);
          throw error;
        }
      })();

      toast.promise(transferPromise, {
        loading: `Transferring to ${targetName}...`,
        success: `Moved to ${targetName}`,
        error: "Transfer failed - item returned",
      });
    } catch (error) {
      console.error("Drop parsing error", error);
    }
  }, [
    addOperation,
    characters,
    inventoryItemByInstanceId,
    membershipInfo,
    removeOperation,
    updateOperationStatus,
  ]);

  const handleDragOver = useCallback((event: React.DragEvent, _targetId: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const visibleInventorySections = useMemo(() => {
    return INVENTORY_SECTIONS.filter((section) => {
      if (section.key !== "postmaster") return true;

      return visibleCharacters.some((character: any) => {
        return (
          getItemsForOwnerBucket(character.characterId, BUCKETS.LOST_ITEMS)
            .length > 0
        );
      });
    });
  }, [getItemsForOwnerBucket, visibleCharacters]);

  const toggleSection = useCallback((sectionKey: string) => {
    setCollapsedSections((currentSections) => ({
      ...currentSections,
      [sectionKey]: !currentSections[sectionKey],
    }));
  }, []);

  const vaultColumnCount = useMemo(() => {
    return getVaultColumnCount(boardLayout.visibleVaultGridWidth, iconSize);
  }, [boardLayout.visibleVaultGridWidth, iconSize]);

  const inventoryRows = useMemo<CharacterInventoryRow[]>(() => {
    const { rowHeightPx } = getVaultGridMeasurements(iconSize);
    const rows: CharacterInventoryRow[] = [];

    const makeItemRef = (
      item: InventoryItem,
      ownerId: string,
      fallbackIndex: number,
      isDimmed: boolean,
    ) => {
      return createTileItemRef({
        item,
        ownerId,
        fallbackIndex,
        isDimmed,
      });
    };

    const shouldShowItem = (item: InventoryItem) => {
      if (!searchState.hasQuery || !searchState.hideNonMatches) {
        return true;
      }

      return searchState.isMatch(item);
    };

    for (const section of visibleInventorySections) {
      const isCollapsed = Boolean(collapsedSections[section.key]);
      const sectionRows: CharacterInventoryRow[] = [];

      if (isCollapsed) {
        rows.push({
          type: "section",
          key: `section-${section.key}`,
          sectionKey: section.key,
          label: section.label,
          isCollapsed,
          height: 28,
        });
        continue;
      }

      for (const bucketRow of section.rows) {
        const characterColumns = visibleCharacters.map((character: any) => {
          const ownerId = character.characterId;
          const equippedItem = bucketRow.showEquipped
            ? getEquippedItemForBucket(ownerId, bucketRow.bucketHash)
            : undefined;
          const visibleEquippedItem =
            equippedItem && shouldShowItem(equippedItem)
              ? equippedItem
              : undefined;
          const inventoryItems = getItemsForOwnerBucket(
            ownerId,
            bucketRow.bucketHash,
          ).filter(shouldShowItem);
          const sliceCount = Math.max(
            visibleEquippedItem ? 1 : 0,
            Math.ceil(inventoryItems.length / 3),
          );

          return {
            ownerId,
            equippedItemRef: visibleEquippedItem
              ? makeItemRef(
                  visibleEquippedItem,
                  ownerId,
                  0,
                  searchState.hasQuery &&
                    !searchState.isMatch(visibleEquippedItem),
                )
              : null,
            inventoryItems,
            sliceCount,
          };
        });
        const vaultItems =
          bucketRow.key === "postmaster"
            ? []
            : getItemsForOwnerBucket(
                VAULT_OWNER_ID,
                bucketRow.bucketHash,
              ).filter(shouldShowItem);
        const vaultDisplayRows = getVaultDisplayRows({
          items: vaultItems,
          definitions,
          profile,
          sortMethod: activeSortMethod,
          vaultGrouping: {
            byClass: Boolean(vaultGrouping.byClass),
            byRarity: Boolean(vaultGrouping.byRarity),
            byAmmoType: Boolean(vaultGrouping.byAmmoType),
            byTier: Boolean(vaultGrouping.byTier),
          },
          vaultColumnCount,
        });
        const characterSliceCount = Math.max(
          ...characterColumns.map(
            (characterColumn) => characterColumn.sliceCount,
          ),
          0,
        );
        let characterSliceIndex = 0;
        let vaultDisplayRowIndex = 0;
        let renderedRowIndex = 0;

        while (
          characterSliceIndex < characterSliceCount ||
          vaultDisplayRowIndex < vaultDisplayRows.length
        ) {
          const vaultDisplayRow = vaultDisplayRows[vaultDisplayRowIndex];
          const currentCharacterSliceIndex = characterSliceIndex;
          const rowCharacterColumns = characterColumns.map(
            (characterColumn) => {
              const startIndex = currentCharacterSliceIndex * 3;
              const inventoryItemRefs = Array.from({ length: 3 }).map(
                (_, offset) => {
                  const itemIndex = startIndex + offset;
                  const item = characterColumn.inventoryItems[itemIndex];

                  if (!item) {
                    return null;
                  }

                  return makeItemRef(
                    item,
                    characterColumn.ownerId,
                    itemIndex,
                    searchState.hasQuery && !searchState.isMatch(item),
                  );
                },
              );

              return {
                characterId: characterColumn.ownerId,
                equippedItemRef:
                  currentCharacterSliceIndex === 0
                    ? characterColumn.equippedItemRef
                    : null,
                inventoryItemRefs,
              };
            },
          );
          const vaultItemRefs =
            vaultDisplayRow
              ? vaultDisplayRow.items.map((item, offset) =>
              makeItemRef(
                item,
                VAULT_OWNER_ID,
                    vaultDisplayRow.startIndex + offset,
                searchState.hasQuery && !searchState.isMatch(item),
              ),
                )
              : [];
          const rowHasCharacterTiles = rowCharacterColumns.some(
            (characterColumn) => {
              return (
                Boolean(characterColumn.equippedItemRef) ||
                characterColumn.inventoryItemRefs.some(Boolean)
              );
            },
          );

          if (
            !rowHasCharacterTiles &&
            vaultItemRefs.length === 0
          ) {
            characterSliceIndex += 1;
            if (vaultDisplayRow) {
              vaultDisplayRowIndex += 1;
            }
            renderedRowIndex += 1;
            continue;
          }

          sectionRows.push({
            type: "items",
            key: `items-${section.key}-${bucketRow.key}-${renderedRowIndex}`,
            sectionKey: section.key,
            bucketRow,
            sliceIndex: Math.max(0, currentCharacterSliceIndex),
            height: rowHeightPx,
            characterColumns: rowCharacterColumns,
            vaultItemRefs,
            vaultGroupLabel: vaultDisplayRow?.groupLabel,
          });

          characterSliceIndex += 1;
          if (vaultDisplayRow) {
            vaultDisplayRowIndex += 1;
          }
          renderedRowIndex += 1;
        }
      }

      if (sectionRows.length > 0) {
        rows.push({
          type: "section",
          key: `section-${section.key}`,
          sectionKey: section.key,
          label: section.label,
          isCollapsed,
          height: 28,
        });
        rows.push(...sectionRows);
      }
    }

    return rows;
  }, [
    collapsedSections,
    definitions,
    getEquippedItemForBucket,
    getItemsForOwnerBucket,
    iconSize,
    profile,
    searchState,
    activeSortMethod,
    vaultColumnCount,
    vaultGrouping,
    visibleCharacters,
    visibleInventorySections,
  ]);

  const virtualRows = useMemo<VirtualRow[]>(() => {
    let nextTop = 0;

    return inventoryRows.map((row) => {
      const rowWithTop = { ...row, top: nextTop };
      nextTop += row.height;
      return rowWithTop;
    });
  }, [inventoryRows]);

  const totalInventoryHeight = useMemo(
    () => virtualRows.reduce((height, row) => height + row.height, 0),
    [virtualRows],
  );
  const commitVisibleRowWindow = useCallback(() => {
    const nextWindow = getVisibleRowWindow(
      virtualRows,
      liveScrollMetricsRef.current,
    );
    const currentWindow = visibleRowWindowRef.current;

    if (
      currentWindow.startIndex === nextWindow.startIndex &&
      currentWindow.endIndex === nextWindow.endIndex &&
      currentWindow.startTop === nextWindow.startTop
    ) {
      return;
    }

    visibleRowWindowRef.current = nextWindow;
    setVisibleRowWindow(nextWindow);
  }, [virtualRows]);

  const visibleVirtualRows = useMemo(() => {
    const startIndex = Math.min(
      visibleRowWindow.startIndex,
      virtualRows.length,
    );
    const endIndex = Math.min(
      Math.max(visibleRowWindow.endIndex, startIndex),
      virtualRows.length,
    );

    return {
      startTop: virtualRows[startIndex]?.top ?? 0,
      rows: virtualRows.slice(startIndex, endIndex),
    };
  }, [visibleRowWindow, virtualRows]);

  const renderTile = useCallback(
    (tileRef: TileItemRef) =>
      createTileRenderData({
        item: tileRef.item,
        ownerId: tileRef.ownerId,
        fallbackIndex: tileRef.fallbackIndex,
        definitions,
        profile,
        isDimmed: tileRef.isDimmed,
        getWishListInfo,
        getNormalizedItem,
        pendingOperationByItemId,
      }),
    [
      definitions,
      getNormalizedItem,
      getWishListInfo,
      pendingOperationByItemId,
      profile,
    ],
  );

  useLayoutEffect(() => {
    const scrollContainer = scrollContainerRef.current;

    if (!scrollContainer) return;

    let scrollFrameId = 0;
    let layoutFrameId = 0;

    const markInventoryScrolling = () => {
      if (!isInventoryScrollingRef.current) {
        isInventoryScrollingRef.current = true;
        setIsInventoryScrolling(true);
      }

      if (scrollIdleTimerRef.current) {
        clearTimeout(scrollIdleTimerRef.current);
      }

      scrollIdleTimerRef.current = setTimeout(() => {
        isInventoryScrollingRef.current = false;
        setIsInventoryScrolling(false);
      }, SCROLL_IDLE_TIMEOUT_MS);
    };

    const updateVisibleRowsFromScroll = () => {
      scrollFrameId = 0;
      liveScrollMetricsRef.current = {
        ...liveScrollMetricsRef.current,
        scrollTop: scrollContainer.scrollTop,
      };
      commitVisibleRowWindow();
    };

    const updateLayoutMetrics = () => {
      layoutFrameId = 0;
      const currentMetrics = liveScrollMetricsRef.current;
      const viewportWidth = scrollContainer.clientWidth;
      liveScrollMetricsRef.current = {
        scrollTop: scrollContainer.scrollTop,
        viewportHeight: scrollContainer.clientHeight,
        viewportWidth,
        virtualListTop:
          virtualListRef.current?.offsetTop ?? currentMetrics.virtualListTop,
      };
      setLayoutViewportWidth((currentViewportWidth) =>
        currentViewportWidth === viewportWidth
          ? currentViewportWidth
          : viewportWidth,
      );
      commitVisibleRowWindow();
    };

    const scheduleScrollUpdate = () => {
      markInventoryScrolling();
      if (scrollFrameId) return;
      scrollFrameId = requestAnimationFrame(updateVisibleRowsFromScroll);
    };

    const scheduleLayoutUpdate = () => {
      if (layoutFrameId) return;
      layoutFrameId = requestAnimationFrame(updateLayoutMetrics);
    };

    const observer = new ResizeObserver(scheduleLayoutUpdate);
    const virtualList = virtualListRef.current;

    updateLayoutMetrics();
    observer.observe(scrollContainer);
    if (virtualList) {
      observer.observe(virtualList);
    }
    scrollContainer.addEventListener("scroll", scheduleScrollUpdate, {
      passive: true,
    });
    window.addEventListener("resize", scheduleLayoutUpdate);

    return () => {
      observer.disconnect();
      scrollContainer.removeEventListener("scroll", scheduleScrollUpdate);
      window.removeEventListener("resize", scheduleLayoutUpdate);
      if (scrollFrameId) {
        cancelAnimationFrame(scrollFrameId);
      }
      if (layoutFrameId) {
        cancelAnimationFrame(layoutFrameId);
      }
      if (scrollIdleTimerRef.current) {
        clearTimeout(scrollIdleTimerRef.current);
        scrollIdleTimerRef.current = null;
      }
    };
  }, [
    boardLayout.minWidth,
    commitVisibleRowWindow,
    totalInventoryHeight,
    visibleCharacters.length,
  ]);

  if (!mounted) return null;

  if (!isLoggedIn) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <div className="text-slate-400">Please login to view inventory.</div>
        <button
          onClick={() => loginWithBungie()}
          className="bg-destiny-gold px-6 py-2 font-bold uppercase tracking-widest text-slate-950 transition-colors hover:bg-white"
        >
          Login
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex p-8">
        <Loader2 className="animate-spin text-destiny-gold" />
      </div>
    );
  }

  return (
    <div className="text-slate-100">
      <div className="flex h-[calc(100dvh-8rem)] min-h-0 flex-col overflow-hidden bg-transparent">
      <div
        className="fixed left-0 top-[calc(50vh-8rem)] z-50 flex w-16 justify-center"
        ref={settingsRef}
      >
        <button
          onClick={() => setIsSettingsOpen((currentValue) => !currentValue)}
          className={cn(
            "flex h-10 w-10 items-center justify-center transition-colors",
            isSettingsOpen
              ? "bg-white/10 text-destiny-gold"
              : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white",
          )}
          title="Inventory display settings"
        >
          <Settings className="h-5 w-5" />
        </button>

        {isSettingsOpen && (
          <div className="absolute left-full top-0 z-50 ml-2 w-64 border border-white/10 bg-[#1a1a1a] p-4 shadow-2xl">
            {definitionsLoading && (
              <div className="mb-3 border-b border-white/10 pb-3 text-xs text-slate-500">
                Loading item database...
              </div>
            )}
            <div className="mb-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                Icon Size
              </h3>
              <div className="grid grid-cols-3 gap-1">
                {(["small", "medium", "large"] as ItemIconSize[]).map(
                  (size) => (
                    <button
                      key={size}
                      onClick={() => setIconSize(size)}
                      className={cn(
                        "border px-2 py-1.5 text-xs font-bold uppercase transition-colors",
                        iconSize === size
                          ? "border-destiny-gold bg-destiny-gold text-black"
                          : "border-white/10 bg-black/40 text-slate-400 hover:border-white/30",
                      )}
                    >
                      {size}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                Sort By
              </h3>
              <div className="grid grid-cols-2 gap-1">
                {(["power", "name", "newest"] as const).map((method) => (
                  <button
                    key={method}
                    onClick={() => setSortMethod(method as any)}
                    className={cn(
                      "border px-2 py-1.5 text-xs font-bold uppercase transition-colors",
                      activeSortMethod === method
                        ? "border-destiny-gold bg-destiny-gold text-black"
                        : "border-white/10 bg-black/40 text-slate-400 hover:border-white/30",
                    )}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                Group By
              </h3>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { key: "byRarity", label: "rarity" },
                  { key: "byAmmoType", label: "ammo" },
                ].map((groupingOption) => {
                  const optionKey = groupingOption.key as keyof VaultGroupingOptions;
                  const isSelected = Boolean(vaultGrouping[optionKey]);

                  return (
                    <button
                      key={groupingOption.key}
                      onClick={() =>
                        setVaultGrouping({ [optionKey]: !isSelected })
                      }
                      className={cn(
                        "border px-2 py-1.5 text-xs font-bold uppercase transition-colors",
                        isSelected
                          ? "border-destiny-gold bg-destiny-gold text-black"
                          : "border-white/10 bg-black/40 text-slate-400 hover:border-white/30",
                      )}
                    >
                      {groupingOption.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-transparent custom-scrollbar"
      >
        <div className="w-full" style={{ minWidth: boardLayout.minWidth }}>
          <div
            className="sticky top-0 z-30 grid gap-2 p-2 pb-5"
            style={{
              gridTemplateColumns: boardLayout.headerGridTemplateColumns,
            }}
          >
            {visibleCharacters.map((character: any) => (
              <CharacterHeaderCard
                key={character.characterId}
                character={character}
                isSelected={character.characterId === activeCharacterId}
                titleName={getCharacterTitleName(character, recordDefinitions)}
                loadouts={getCharacterLoadouts(profile, character.characterId)}
                postmasterTiles={
                  postmasterTilesByCharacterId.get(character.characterId) ?? []
                }
                membershipInfo={membershipInfo}
                profile={profile}
                isPopoutOpen={
                  openClassPopoutCharacterId === character.characterId
                }
                onClick={() => {
                  setSelectedCharacterId(character.characterId);
                  setOpenClassPopoutCharacterId((currentCharacterId) =>
                    currentCharacterId === character.characterId
                      ? null
                      : character.characterId,
                  );
                }}
              />
            ))}

            {boardLayout.hasCharacterToggleColumn && (
              <CharacterExpansionCard
                hasExtraCharacters={hasExtraCharacters}
                showExtraCharacters={showExtraCharacters}
                onToggleExtraCharacters={() => {
                  setOpenClassPopoutCharacterId(null);
                  setShowExtraCharacters((currentValue) => !currentValue);
                }}
              />
            )}

            <VaultHeaderCard vaultCount={vaultCount} />

            <CurrencyHeaderCard
              currencies={currencies}
              currencyDefinitions={definitions}
              materialCounts={materialCounts}
            />
          </div>

          <div ref={virtualListRef} className="p-2">
            <div
              className="relative w-full"
              style={{ height: totalInventoryHeight }}
            >
              <div
                className="absolute left-0 top-0 flex w-full flex-col"
                style={{
                  transform: `translateY(${visibleVirtualRows.startTop}px)`,
                }}
              >
                {visibleVirtualRows.rows.map((row) => (
                  <CharacterVirtualRow
                    key={row.key}
                    row={row}
                    iconSize={iconSize}
                    boardGridTemplateColumns={
                      boardLayout.bodyGridTemplateColumns
                    }
                    hasCharacterToggleColumn={
                      boardLayout.hasCharacterToggleColumn
                    }
                    vaultColumnCount={vaultColumnCount}
                    renderTile={renderTile}
                    suppressDetails={isInventoryScrolling}
                    onToggleSection={toggleSection}
                    onDragOver={handleDragOver}
                    onDragLeave={ignoreDragLeave}
                    onDrop={handleDrop}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="p-2">
            <ProfileInventoryPanel
              iconSize={iconSize}
              sortMethod={activeSortMethod}
            />
          </div>
        </div>
      </div>

      <ItemDetailsOverlay />
      </div>
    </div>
  );
}
