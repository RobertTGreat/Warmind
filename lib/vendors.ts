import { ItemCategoryHashes } from "@/data/d2/generated-enums";
import { getVendorDisplayIcon } from "@/lib/vendorIcons";

/** Bungie DestinyComponentType values for the GetVendors endpoint. */
export const VENDOR_API_COMPONENTS = [400, 402, 600] as const;

/** Silver currency item hash used for Eververse purchases. */
export const SILVER_ITEM_HASH = 2817410917;

/** Vendors shown first within a group, matching DIM's ordering. */
const PRIORITY_VENDOR_HASHES = [
  2913605701, // Ada-1 / Transmog
  672118163, // Banshee-44
  1037843411, // Eververse
];

const IGNORE_DISPLAY_CATEGORY_IDENTIFIERS = new Set(["category_preview"]);

export interface VendorItemCost {
  itemHash: number;
  quantity: number;
  hasEnough: boolean;
}

export interface VendorSaleItem {
  itemHash: number;
  vendorItemIndex: number;
  displayCategoryIndex?: number;
  originalCategoryIndex?: number;
  costs: VendorItemCost[];
  failureStrings: string[];
  canBeSold: boolean;
  owned: boolean;
  locked: boolean;
}

export interface VendorProgressionState {
  progressionHash: number;
  level: number;
  stepIndex: number;
  currentProgress: number;
  progressToNextLevel: number;
  nextLevelAt: number;
  currentResetCount?: number;
  dailyProgress?: number;
  dailyLimit?: number;
  weeklyProgress?: number;
  weeklyLimit?: number;
}

export interface VendorDefinition {
  hash: number;
  displayProperties: {
    name: string;
    icon: string;
    smallTransparentIcon?: string;
    description?: string;
  };
  failureStrings: string[];
  displayCategories: Array<{
    identifier: string;
    displayProperties: { name: string };
  }>;
  originalCategories?: Array<{ sortValue?: number }>;
  itemList: Array<{
    itemHash: number;
    displayCategoryIndex?: number;
    originalCategoryIndex?: number;
    quantity?: number;
    currencies?: Array<{ itemHash: number; quantity: number }>;
  }>;
  returnWithVendorRequest?: boolean;
  locations?: Array<{ destinationHash?: number }>;
  factionHash?: number;
}

export interface VendorGroupDefinition {
  hash: number;
  categoryName: string;
  order: number;
}

export interface VendorGroup {
  groupHash: number;
  categoryName: string;
  order: number;
  vendors: Vendor[];
}

export interface Vendor {
  vendorHash: number;
  name: string;
  icon: string;
  locationLabel?: string;
  nextRefreshDate?: Date;
  currencies: number[];
  items: VendorSaleItem[];
  progression?: VendorProgressionState;
}

export interface DestinyVendorsResponse {
  vendorGroups?: {
    data?: {
      groups?: Array<{
        vendorGroupHash: number;
        vendorHashes: number[];
      }>;
    };
  };
  vendors?: {
    data?: Record<
      string,
      {
        vendorHash: number;
        nextRefreshDate?: string;
        vendorLocationIndex?: number;
        progression?: {
          progressionHash: number;
          level: number;
          stepIndex: number;
          currentProgress: number;
          progressToNextLevel: number;
          nextLevelAt: number;
          currentResetCount?: number;
          dailyProgress?: number;
          dailyLimit?: number;
          weeklyProgress?: number;
          weeklyLimit?: number;
        };
      }
    >;
  };
  sales?: {
    data?: Record<
      string,
      {
        vendorHash: number;
        saleItems: Record<
          string,
          {
            vendorItemIndex: number;
            itemHash: number;
            failureIndexes: number[];
            costs: Array<{ itemHash: number; quantity: number }>;
            augments?: number;
          }
        >;
      }
    >;
  };
  currencyLookups?: {
    data?: {
      itemQuantities?: Record<string, number>;
    };
  };
}

function getVendorPriorityIndex(vendorHash: number) {
  const priorityIndex = PRIORITY_VENDOR_HASHES.indexOf(vendorHash);
  return priorityIndex === -1 ? Number.MAX_SAFE_INTEGER : priorityIndex;
}

function buildSaleItemsFromDefinition(
  vendorDef: VendorDefinition,
  currencyQuantities: Record<string, number>
): VendorSaleItem[] {
  return vendorDef.itemList.map((entry, vendorItemIndex) => ({
    itemHash: entry.itemHash,
    vendorItemIndex,
    displayCategoryIndex: entry.displayCategoryIndex,
    originalCategoryIndex: entry.originalCategoryIndex,
    costs: (entry.currencies ?? []).map((cost) => ({
      itemHash: cost.itemHash,
      quantity: cost.quantity,
      hasEnough: (currencyQuantities[String(cost.itemHash)] ?? 0) >= cost.quantity,
    })),
    failureStrings: [],
    canBeSold: true,
    owned: false,
    locked: false,
  }));
}

function buildSaleItemsFromSales(
  vendorDef: VendorDefinition,
  sales: Record<
    string,
    {
      vendorItemIndex: number;
      itemHash: number;
      failureIndexes: number[];
      costs: Array<{ itemHash: number; quantity: number }>;
      augments?: number;
    }
  >,
  currencyQuantities: Record<string, number>
): VendorSaleItem[] {
  return Object.values(sales).map((saleItem) => {
    const vendorItemDef = vendorDef.itemList[saleItem.vendorItemIndex];
    const owned = Boolean((saleItem.augments ?? 0) & 1);
    const locked = Boolean((saleItem.augments ?? 0) & 2);

    return {
      itemHash: saleItem.itemHash,
      vendorItemIndex: saleItem.vendorItemIndex,
      displayCategoryIndex: vendorItemDef?.displayCategoryIndex,
      originalCategoryIndex: vendorItemDef?.originalCategoryIndex,
      costs: saleItem.costs.map((cost) => ({
        itemHash: cost.itemHash,
        quantity: cost.quantity,
        hasEnough: (currencyQuantities[String(cost.itemHash)] ?? 0) >= cost.quantity,
      })),
      failureStrings: saleItem.failureIndexes.map(
        (index) => vendorDef.failureStrings[index] ?? ""
      ).filter(Boolean),
      canBeSold: saleItem.failureIndexes.length === 0,
      owned,
      locked,
    };
  });
}

function gatherVendorCurrencyHashes(
  vendorDef: VendorDefinition,
  sales?: Record<
    string,
    {
      costs: Array<{ itemHash: number; quantity: number }>;
    }
  >
): number[] {
  const currencyHashes = new Set<number>();

  if (sales) {
    for (const saleItem of Object.values(sales)) {
      for (const cost of saleItem.costs) {
        currencyHashes.add(cost.itemHash);
      }
    }
  } else {
    for (const entry of vendorDef.itemList) {
      for (const cost of entry.currencies ?? []) {
        currencyHashes.add(cost.itemHash);
      }
    }
  }

  return [...currencyHashes];
}

export function buildVendor(
  vendorHash: number,
  vendorDef: VendorDefinition | undefined,
  vendorComponent:
    | {
        nextRefreshDate?: string;
        vendorLocationIndex?: number;
        progression?: {
          progressionHash: number;
          level: number;
          stepIndex: number;
          currentProgress: number;
          progressToNextLevel: number;
          nextLevelAt: number;
          currentResetCount?: number;
          dailyProgress?: number;
          dailyLimit?: number;
          weeklyProgress?: number;
          weeklyLimit?: number;
        };
      }
    | undefined,
  sales:
    | Record<
        string,
        {
          vendorItemIndex: number;
          itemHash: number;
          failureIndexes: number[];
          costs: Array<{ itemHash: number; quantity: number }>;
          augments?: number;
        }
      >
    | undefined,
  currencyQuantities: Record<string, number>,
  destinationNames: Record<number, string>
): Vendor | null {
  if (!vendorDef) {
    return null;
  }

  const items = sales
    ? buildSaleItemsFromSales(vendorDef, sales, currencyQuantities)
    : vendorDef.returnWithVendorRequest
      ? []
      : buildSaleItemsFromDefinition(vendorDef, currencyQuantities);

  if (!items.length) {
    return null;
  }

  items.sort((firstItem, secondItem) => {
    const firstSortValue =
      firstItem.originalCategoryIndex !== undefined
        ? vendorDef.originalCategories?.[firstItem.originalCategoryIndex]?.sortValue ?? 0
        : 0;
    const secondSortValue =
      secondItem.originalCategoryIndex !== undefined
        ? vendorDef.originalCategories?.[secondItem.originalCategoryIndex]?.sortValue ?? 0
        : 0;

    if (firstSortValue !== secondSortValue) {
      return firstSortValue - secondSortValue;
    }

    return firstItem.vendorItemIndex - secondItem.vendorItemIndex;
  });

  let nextRefreshDate: Date | undefined;
  if (vendorComponent?.nextRefreshDate) {
    const refreshDate = new Date(vendorComponent.nextRefreshDate);
    if (refreshDate.getFullYear() !== 9999) {
      nextRefreshDate = refreshDate;
    }
  }

  const locationIndex = vendorComponent?.vendorLocationIndex;
  const destinationHash =
    locationIndex !== undefined && locationIndex >= 0
      ? vendorDef.locations?.[locationIndex]?.destinationHash
      : undefined;
  const locationLabel =
    destinationHash !== undefined ? destinationNames[destinationHash] : undefined;

  return {
    vendorHash,
    name: vendorDef.displayProperties.name,
    icon: getVendorDisplayIcon(vendorDef),
    locationLabel,
    nextRefreshDate,
    currencies: gatherVendorCurrencyHashes(vendorDef, sales),
    items,
    progression: vendorComponent?.progression,
  };
}

export function buildVendorGroups(
  vendorsResponse: DestinyVendorsResponse,
  vendorDefinitions: Record<number, VendorDefinition>,
  vendorGroupDefinitions: Record<number, VendorGroupDefinition>,
  destinationNames: Record<number, string> = {}
): VendorGroup[] {
  const currencyQuantities = vendorsResponse.currencyLookups?.data?.itemQuantities ?? {};
  const groups = vendorsResponse.vendorGroups?.data?.groups ?? [];

  return groups
    .map((group) => {
      const groupDef = vendorGroupDefinitions[group.vendorGroupHash];
      const vendors = group.vendorHashes
        .map((vendorHash) =>
          buildVendor(
            vendorHash,
            vendorDefinitions[vendorHash],
            vendorsResponse.vendors?.data?.[String(vendorHash)],
            vendorsResponse.sales?.data?.[String(vendorHash)]?.saleItems,
            currencyQuantities,
            destinationNames
          )
        )
        .filter((vendor): vendor is Vendor => vendor !== null)
        .sort((firstVendor, secondVendor) => {
          const firstPriority = getVendorPriorityIndex(firstVendor.vendorHash);
          const secondPriority = getVendorPriorityIndex(secondVendor.vendorHash);
          return firstPriority - secondPriority;
        });

      return {
        groupHash: group.vendorGroupHash,
        categoryName: groupDef?.categoryName ?? "Vendors",
        order: groupDef?.order ?? 0,
        vendors,
      };
    })
    .filter((group) => group.vendors.length > 0)
    .sort((firstGroup, secondGroup) => firstGroup.order - secondGroup.order);
}

export function groupVendorItemsByCategory(
  vendor: Vendor,
  vendorDef?: VendorDefinition
) {
  const groupedItems = new Map<number | "uncategorized", VendorSaleItem[]>();

  for (const item of vendor.items) {
    const categoryIndex = item.displayCategoryIndex;
    const key = categoryIndex ?? "uncategorized";
    const existingItems = groupedItems.get(key) ?? [];
    existingItems.push(item);
    groupedItems.set(key, existingItems);
  }

  return [...groupedItems.entries()]
    .filter(([categoryIndex]) => {
      if (categoryIndex === "uncategorized") {
        return true;
      }

      const category = vendorDef?.displayCategories?.[categoryIndex];
      return category && !IGNORE_DISPLAY_CATEGORY_IDENTIFIERS.has(category.identifier);
    })
    .map(([categoryIndex, items]) => ({
      categoryIndex,
      categoryName:
        categoryIndex === "uncategorized"
          ? "Items"
          : vendorDef?.displayCategories?.[categoryIndex]?.displayProperties?.name ?? "Items",
      items,
    }));
}

export function saleItemUsesSilver(item: VendorSaleItem) {
  return item.costs.some(
    (cost) => cost.itemHash === SILVER_ITEM_HASH && cost.quantity > 0
  );
}

export function saleItemIsEververseFeatured(
  item: VendorSaleItem,
  vendorDef?: VendorDefinition
) {
  if (item.displayCategoryIndex === undefined || !vendorDef) {
    return false;
  }

  const categoryIdentifier =
    vendorDef.displayCategories[item.displayCategoryIndex]?.identifier;

  return Boolean(
    categoryIdentifier &&
      (categoryIdentifier.startsWith("categories.campaigns") ||
        categoryIdentifier.startsWith("categories.featured.carousel"))
  );
}

export function filterVendorGroups(
  vendorGroups: VendorGroup[],
  options: {
    hideSilverItems?: boolean;
    showUnacquiredOnly?: boolean;
    ownedItemHashes?: Set<number>;
    vendorDefinitions?: Record<number, VendorDefinition>;
  }
): VendorGroup[] {
  const {
    hideSilverItems = false,
    showUnacquiredOnly = false,
    ownedItemHashes,
    vendorDefinitions = {},
  } = options;

  return vendorGroups
    .map((group) => ({
      ...group,
      vendors: group.vendors
        .map((vendor) => ({
          ...vendor,
          items: vendor.items.filter((item) => {
            const vendorDef = vendorDefinitions[vendor.vendorHash];

            if (hideSilverItems) {
              if (saleItemUsesSilver(item)) {
                return false;
              }

              if (saleItemIsEververseFeatured(item, vendorDef)) {
                return false;
              }
            }

            if (showUnacquiredOnly) {
              if (item.owned) {
                return false;
              }

              if (ownedItemHashes?.has(item.itemHash)) {
                return false;
              }
            }

            return true;
          }),
        }))
        .filter((vendor) => vendor.items.length > 0),
    }))
    .filter((group) => group.vendors.length > 0);
}

export function collectVendorItemHashes(vendorGroups: VendorGroup[]) {
  const itemHashes = new Set<number>();

  for (const group of vendorGroups) {
    for (const vendor of group.vendors) {
      for (const item of vendor.items) {
        itemHashes.add(item.itemHash);
      }

      for (const currencyHash of vendor.currencies) {
        itemHashes.add(currencyHash);
      }
    }
  }

  return [...itemHashes];
}

export function collectVendorDefinitionHashes(vendorGroups: VendorGroup[]) {
  const vendorHashes = new Set<number>();
  const groupHashes = new Set<number>();
  const destinationHashes = new Set<number>();

  for (const group of vendorGroups) {
    groupHashes.add(group.groupHash);
    for (const vendor of group.vendors) {
      vendorHashes.add(vendor.vendorHash);
    }
  }

  return {
    vendorHashes: [...vendorHashes],
    groupHashes: [...groupHashes],
    destinationHashes: [...destinationHashes],
  };
}

export function getOwnedItemHashesFromProfile(profile: any): Set<number> {
  const ownedHashes = new Set<number>();

  const profileInventory = profile?.profileInventory?.data?.items ?? [];
  for (const item of profileInventory) {
    ownedHashes.add(item.itemHash);
  }

  const characterInventories = profile?.characterInventories?.data ?? {};
  for (const inventory of Object.values(characterInventories) as any[]) {
    for (const item of inventory.items ?? []) {
      ownedHashes.add(item.itemHash);
    }
  }

  const characterEquipment = profile?.characterEquipment?.data ?? {};
  for (const equipment of Object.values(characterEquipment) as any[]) {
    for (const item of equipment.items ?? []) {
      ownedHashes.add(item.itemHash);
    }
  }

  return ownedHashes;
}

export function isShaderOrModItem(definition?: {
  itemCategoryHashes?: number[];
}) {
  if (!definition?.itemCategoryHashes) {
    return false;
  }

  return (
    definition.itemCategoryHashes.includes(ItemCategoryHashes.Mods_Mod) ||
    definition.itemCategoryHashes.includes(ItemCategoryHashes.Shaders)
  );
}
