import {
  ItemCategoryHashes,
  PlugCategoryHashes,
  SocketCategoryHashes,
} from "@/data/d2/generated-enums";
import { BUCKETS } from "@/lib/destinyUtils";

type Hash = number;

const ITEM_STATE_LOCKED = 1;
const ITEM_STATE_MASTERWORK = 4;
const ITEM_STATE_CRAFTED = 8;
const TIER_TYPE_COMMON = 2;
const TIER_TYPE_RARE = 4;
const TIER_TYPE_LEGENDARY = 5;
const TIER_TYPE_EXOTIC = 6;

const ARTIFICE_PLUG_HASHES = new Set([
  4030660414,
  455024236,
  4164883102,
  4026414261,
  3121760799,
  4173924323,
  1656746282,
]);

const WEAPON_COMPONENT_PLUG_CATEGORIES = new Set<number>([
  PlugCategoryHashes.Barrels,
  PlugCategoryHashes.Batteries,
  PlugCategoryHashes.Blades,
  PlugCategoryHashes.Bolts,
  PlugCategoryHashes.Bowstrings,
  PlugCategoryHashes.Frames,
  PlugCategoryHashes.Magazines,
  PlugCategoryHashes.Origins,
  PlugCategoryHashes.Stocks,
  PlugCategoryHashes.Tubes,
]);

const PERK_SOCKET_CATEGORY_HASHES = new Set<number>([
  SocketCategoryHashes.IntrinsicTraits,
  SocketCategoryHashes.WeaponPerks_Reusable,
  SocketCategoryHashes.WeaponPerks_Consumable,
  SocketCategoryHashes.ArmorPerks_Reusable,
  SocketCategoryHashes.ArmorPerks_LargePerk,
]);

const MOD_SOCKET_CATEGORY_HASHES = new Set<number>([
  SocketCategoryHashes.WeaponMods,
  SocketCategoryHashes.ArmorMods,
]);

export type DimDefinitionTables = {
  inventoryItems: Record<string, any> | Record<number, any>;
  equipableItemSets?: Record<string, any> | Record<number, any>;
  sandboxPerks?: Record<string, any> | Record<number, any>;
  socketCategories?: Record<string, any> | Record<number, any>;
  socketTypes?: Record<string, any> | Record<number, any>;
  stats?: Record<string, any> | Record<number, any>;
};

export interface DimItemMini {
  hash: Hash;
  id: string;
  itemCategoryHashes: Hash[];
  rarity: string;
  isExotic: boolean;
  bucket: {
    hash: Hash;
    inWeapons?: boolean;
    inArmor?: boolean;
    sort?: "Weapons" | "Armor" | string;
  };
  tier: number;
  masterwork: boolean;
  crafted: "crafted" | "enhanced" | false;
  adept: boolean;
  holofoil: boolean;
  locked: boolean;
  sockets: DimSocketsMini | null;
  stats: DimStatMini[] | null;
  masterworkInfo: DimMasterworkMini | null;
  setBonus?: any;
}

export interface DimSocketsMini {
  allSockets: DimSocketMini[];
  categories: {
    category: any;
    socketIndexes: number[];
  }[];
  fromDefinitions: boolean;
}

export interface DimSocketMini {
  socketIndex: number;
  plugged: DimPlugMini | null;
  plugOptions: DimPlugMini[];
  plugSet?: DimPlugSetMini;
  reusablePlugItems?: any[];
  emptyPlugItemHash?: Hash;
  hasRandomizedPlugItems: boolean;
  isPerk: boolean;
  isMod: boolean;
  isReusable: boolean;
  visibleInGame?: boolean;
  socketDefinition: any;
}

export interface DimPlugSetMini {
  hash: Hash;
  plugs: DimPlugMini[];
}

export interface DimPlugMini {
  plugDef: any;
  enabled: boolean;
  plugObjectives: any[];
  stats: Record<number, { value: number; investmentValue: number }> | null;
  cannotCurrentlyRoll?: boolean;
}

export interface DimStatMini {
  statHash: Hash;
  value: number;
  base: number;
  investmentValue: number;
}

export interface DimMasterworkMini {
  tier?: number;
  stats?: {
    hash: Hash;
    name: string;
    value: number;
    isPrimary: boolean;
  }[];
}

export interface ActiveSetPerk {
  setHash: number;
  setName: string;
  sandboxPerkHash: number;
  requiredSetCount: number;
  perkName: string;
  perkDescription: string;
  contributingItemHashes: number[];
}

function getDefinition<T = any>(
  table: Record<string, T> | Record<number, T> | undefined,
  hash: number | string | undefined | null
): T | undefined {
  if (hash === undefined || hash === null || !table) {
    return undefined;
  }

  return (table as Record<string, T>)[String(hash)] ?? (table as Record<number, T>)[Number(hash)];
}

function getItemState(rawItem: any, instance: any): number {
  return Number(rawItem?.state ?? instance?.state ?? 0);
}

function getBucketInfo(bucketHash: number) {
  const weaponBuckets = new Set([
    BUCKETS.KINETIC_WEAPON,
    BUCKETS.ENERGY_WEAPON,
    BUCKETS.POWER_WEAPON,
  ]);
  const armorBuckets = new Set([
    BUCKETS.HELMET,
    BUCKETS.GAUNTLETS,
    BUCKETS.CHEST_ARMOR,
    BUCKETS.LEG_ARMOR,
    BUCKETS.CLASS_ARMOR,
  ]);

  if (weaponBuckets.has(bucketHash)) {
    return { hash: bucketHash, inWeapons: true, sort: "Weapons" as const };
  }

  if (armorBuckets.has(bucketHash)) {
    return { hash: bucketHash, inArmor: true, sort: "Armor" as const };
  }

  return { hash: bucketHash };
}

function rarityFromTierType(tierType: number | undefined): string {
  switch (tierType) {
    case TIER_TYPE_EXOTIC:
      return "Exotic";
    case TIER_TYPE_LEGENDARY:
      return "Legendary";
    case TIER_TYPE_RARE:
      return "Rare";
    case TIER_TYPE_COMMON:
      return "Common";
    default:
      return "Basic";
  }
}

function getReusablePlugsForSocket(
  reusablePlugsBySocket: any,
  socketState: any,
  socketIndex: number
): any[] {
  const profileReusablePlugs =
    reusablePlugsBySocket?.[socketIndex] ?? reusablePlugsBySocket?.[String(socketIndex)];

  if (Array.isArray(profileReusablePlugs)) {
    return profileReusablePlugs;
  }

  if (Array.isArray(socketState?.reusablePlugs)) {
    return socketState.reusablePlugs;
  }

  if (Array.isArray(socketState?.reusablePlugItems)) {
    return socketState.reusablePlugItems;
  }

  return [];
}

function getPlugHash(plugItem: any): number | null {
  const plugHash =
    typeof plugItem === "number"
      ? plugItem
      : plugItem?.plugItemHash ?? plugItem?.plugHash ?? plugItem?.itemHash;
  const numericHash = Number(plugHash);

  return Number.isFinite(numericHash) ? numericHash : null;
}

function buildPlugStats(plugDef: any) {
  const investmentStats = Array.isArray(plugDef?.investmentStats)
    ? plugDef.investmentStats
    : [];
  const stats: Record<number, { value: number; investmentValue: number }> = {};

  for (const investmentStat of investmentStats) {
    const statHash = Number(investmentStat?.statTypeHash);
    const value = Number(investmentStat?.value ?? 0);

    if (!Number.isFinite(statHash) || value === 0) {
      continue;
    }

    stats[statHash] = {
      value,
      investmentValue: value,
    };
  }

  return Object.keys(stats).length > 0 ? stats : null;
}

function buildPlugMini(
  definitions: DimDefinitionTables,
  plugHash: number | null,
  plugObjectives: Record<string, any[]> | undefined,
  enabled: boolean
): DimPlugMini | null {
  if (!plugHash) {
    return null;
  }

  const plugDef = getDefinition(definitions.inventoryItems, plugHash);
  if (!plugDef) {
    return null;
  }

  return {
    plugDef,
    enabled,
    plugObjectives: plugObjectives?.[String(plugHash)] ?? plugObjectives?.[plugHash] ?? [],
    stats: buildPlugStats(plugDef),
    cannotCurrentlyRoll: Boolean(plugDef?.plug?.cannotCurrentlyRoll),
  };
}

function getSocketCategoryHash(
  socketDefinition: any,
  definitions: DimDefinitionTables
): number | undefined {
  const socketType = getDefinition(definitions.socketTypes, socketDefinition?.socketTypeHash);
  return socketType?.socketCategoryHash;
}

function getPlugCategoryHash(plugDef: any): number | undefined {
  const categoryHash = Number(plugDef?.plug?.plugCategoryHash ?? plugDef?.plugCategoryHash);
  return Number.isFinite(categoryHash) ? categoryHash : undefined;
}

function getPlugCategoryIdentifier(plugDef: any): string {
  return String(plugDef?.plug?.plugCategoryIdentifier ?? "").toLowerCase();
}

function socketHasPlugCategory(socket: DimSocketMini, categoryHash: number): boolean {
  return socket.plugged?.plugDef?.plug?.plugCategoryHash === categoryHash;
}

function socketHasIntrinsicPlug(socket: DimSocketMini): boolean {
  return (
    socketHasPlugCategory(socket, PlugCategoryHashes.Intrinsics) ||
    socketHasPlugCategory(socket, PlugCategoryHashes.ArmorStats)
  );
}

function classifySocket(
  socketDefinition: any,
  socketCategoryHash: number | undefined,
  plugged: DimPlugMini | null,
  plugOptions: DimPlugMini[]
) {
  const plugDefinitions = [
    plugged?.plugDef,
    ...plugOptions.map((plugOption) => plugOption.plugDef),
  ].filter(Boolean);
  const plugCategoryHashes = plugDefinitions
    .map((plugDefinition) => getPlugCategoryHash(plugDefinition))
    .filter((hash): hash is number => hash !== undefined);
  const plugCategoryIdentifiers = plugDefinitions.map(getPlugCategoryIdentifier);
  const plugItemCategories = plugDefinitions.flatMap(
    (plugDefinition) => plugDefinition?.itemCategoryHashes ?? []
  );
  const isReusable =
    socketCategoryHash === SocketCategoryHashes.WeaponPerks_Reusable ||
    socketCategoryHash === SocketCategoryHashes.ArmorPerks_Reusable ||
    Boolean(socketDefinition?.reusablePlugSetHash);
  const isPerk =
    (socketCategoryHash !== undefined && PERK_SOCKET_CATEGORY_HASHES.has(socketCategoryHash)) ||
    plugCategoryHashes.some((hash) =>
      [
        PlugCategoryHashes.Frames,
        PlugCategoryHashes.Intrinsics,
        PlugCategoryHashes.Origins,
      ].includes(hash)
    ) ||
    plugItemCategories.includes(ItemCategoryHashes.WeaponModsIntrinsic) ||
    plugItemCategories.includes(ItemCategoryHashes.WeaponModsOriginTraits);
  const isMod =
    (socketCategoryHash !== undefined && MOD_SOCKET_CATEGORY_HASHES.has(socketCategoryHash)) ||
    plugCategoryIdentifiers.some(
      (identifier) => identifier.includes("enhancements") || identifier.includes("mods")
    );

  return { isPerk, isMod, isReusable };
}

function buildSocketMini(
  definitions: DimDefinitionTables,
  socketDefinition: any,
  socketIndex: number,
  socketState: any,
  reusablePlugs: any[] | undefined,
  plugObjectives: Record<string, any[]> | undefined
): DimSocketMini | undefined {
  const pluggedHash =
    getPlugHash(socketState?.plugHash) ??
    getPlugHash(socketDefinition?.singleInitialItemHash) ??
    null;
  const plugged = buildPlugMini(definitions, pluggedHash, plugObjectives, true);
  const plugOptions: DimPlugMini[] = [];

  const addPlugOption = (plug: DimPlugMini | null) => {
    if (!plug) return;

    const alreadyAdded = plugOptions.some(
      (plugOption) => plugOption.plugDef.hash === plug.plugDef.hash
    );
    if (!alreadyAdded) {
      plugOptions.push(plug);
    }
  };

  for (const reusablePlug of reusablePlugs ?? []) {
    addPlugOption(
      buildPlugMini(
        definitions,
        getPlugHash(reusablePlug),
        plugObjectives,
        Boolean(reusablePlug?.enabled ?? true) && Boolean(reusablePlug?.canInsert ?? true)
      )
    );
  }

  addPlugOption(plugged);

  if (!plugged && plugOptions.length === 0 && !socketDefinition?.socketTypeHash) {
    return undefined;
  }

  const socketCategoryHash = getSocketCategoryHash(socketDefinition, definitions);
  const socketClass = classifySocket(socketDefinition, socketCategoryHash, plugged, plugOptions);

  return {
    socketIndex,
    plugged,
    plugOptions,
    reusablePlugItems: reusablePlugs,
    emptyPlugItemHash: socketDefinition?.emptyPlugItemHash,
    hasRandomizedPlugItems: Boolean(socketDefinition?.randomizedPlugSetHash),
    visibleInGame: socketState?.isVisible ?? socketDefinition?.hidePerksInItemTooltip !== true,
    socketDefinition,
    ...socketClass,
  };
}

function buildSocketCategories(
  itemDef: any,
  definitions: DimDefinitionTables
): DimSocketsMini["categories"] {
  const socketCategories = Array.isArray(itemDef?.sockets?.socketCategories)
    ? itemDef.sockets.socketCategories
    : [];

  return socketCategories.flatMap((socketCategory: any) => {
    const category = getDefinition(
      definitions.socketCategories,
      socketCategory.socketCategoryHash
    ) ?? { hash: socketCategory.socketCategoryHash };

    if (!Array.isArray(socketCategory.socketIndexes)) {
      return [];
    }

    return [
      {
        category,
        socketIndexes: socketCategory.socketIndexes,
      },
    ];
  });
}

export function buildSocketsMini(
  rawItem: any,
  itemComponents: any,
  definitions: DimDefinitionTables,
  itemDef: any
): DimSocketsMini | null {
  const itemId = rawItem?.itemInstanceId;
  const liveSockets = itemId
    ? itemComponents?.sockets?.data?.[itemId]?.sockets
    : undefined;
  const liveReusablePlugs = itemId
    ? itemComponents?.reusablePlugs?.data?.[itemId]?.plugs
    : undefined;
  const plugObjectives = itemId
    ? itemComponents?.plugObjectives?.data?.[itemId]?.objectivesPerPlug
    : undefined;
  const socketDefinitions = Array.isArray(itemDef?.sockets?.socketEntries)
    ? itemDef.sockets.socketEntries
    : [];
  const socketCount = Math.max(socketDefinitions.length, liveSockets?.length ?? 0);

  if (socketCount === 0) {
    return null;
  }

  const allSockets: DimSocketMini[] = [];

  for (let socketIndex = 0; socketIndex < socketCount; socketIndex += 1) {
    const socketDefinition = socketDefinitions[socketIndex] ?? {};
    const socketState = liveSockets?.[socketIndex];
    const reusablePlugs = getReusablePlugsForSocket(
      liveReusablePlugs,
      socketState,
      socketIndex
    );
    const socket = buildSocketMini(
      definitions,
      socketDefinition,
      socketIndex,
      socketState,
      reusablePlugs,
      plugObjectives
    );

    if (socket) {
      allSockets.push(socket);
    }
  }

  if (allSockets.length === 0) {
    return null;
  }

  return {
    allSockets,
    categories: buildSocketCategories(itemDef, definitions),
    fromDefinitions: !liveSockets,
  };
}

function buildStatsMini(item: DimItemMini, itemDef: any, itemComponents: any): DimStatMini[] | null {
  const liveStats =
    item.id !== "0" ? itemComponents?.stats?.data?.[item.id]?.stats : undefined;
  const definitionStats = itemDef?.stats?.stats ?? {};
  const investmentStats = Array.isArray(itemDef?.investmentStats)
    ? itemDef.investmentStats
    : [];
  const statHashes = new Set<number>();

  for (const hashText of Object.keys(definitionStats)) {
    statHashes.add(Number(hashText));
  }

  for (const hashText of Object.keys(liveStats ?? {})) {
    statHashes.add(Number(hashText));
  }

  for (const investmentStat of investmentStats) {
    statHashes.add(Number(investmentStat?.statTypeHash));
  }

  const stats = Array.from(statHashes)
    .filter(Number.isFinite)
    .map((statHash) => {
      const liveValue = liveStats?.[statHash]?.value ?? liveStats?.[String(statHash)]?.value;
      const definitionValue =
        definitionStats?.[statHash]?.value ?? definitionStats?.[String(statHash)]?.value ?? 0;
      const investmentValue =
        investmentStats.find((stat: any) => stat?.statTypeHash === statHash)?.value ?? 0;
      const value = Number(liveValue ?? definitionValue ?? investmentValue ?? 0);

      return {
        statHash,
        value,
        base: Number(definitionValue ?? value),
        investmentValue: Number(investmentValue ?? 0),
      };
    });

  return stats.length > 0 ? stats : null;
}

function isWeaponMasterworkSocket(socket: DimSocketMini): boolean {
  const plug = socket.plugged?.plugDef?.plug;
  const categoryIdentifier = String(plug?.plugCategoryIdentifier ?? "");

  return (
    plug?.uiPlugLabel === "masterwork" ||
    categoryIdentifier.includes("masterworks.stat") ||
    categoryIdentifier.endsWith("_masterwork")
  );
}

function isArmor3MasterworkSocket(socket: DimSocketMini): boolean {
  const plug = socket.plugged?.plugDef?.plug;

  return (
    plug?.plugCategoryHash === PlugCategoryHashes.V460PlugsArmorMasterworks ||
    String(plug?.plugCategoryIdentifier ?? "").includes("v460.plugs.armor.masterworks")
  );
}

function getFirstSocketByCategoryHash(
  sockets: DimSocketsMini,
  categoryHash: number
): DimSocketMini | undefined {
  const category = sockets.categories.find((entry) => entry.category.hash === categoryHash);
  const firstIndex = category?.socketIndexes[0];

  return firstIndex === undefined
    ? undefined
    : sockets.allSockets.find((socket) => socket.socketIndex === firstIndex);
}

function getStatName(definitions: DimDefinitionTables, statHash: number): string {
  return (
    getDefinition(definitions.stats, statHash)?.displayProperties?.name ??
    String(statHash)
  );
}

function getMasterworkTierFromPlug(plugDef: any, armor3: boolean): number {
  const investmentStats = Array.isArray(plugDef?.investmentStats)
    ? plugDef.investmentStats
    : [];

  if (armor3) {
    return Math.abs(
      Number(investmentStats.find((stat: any) => stat?.isConditionallyActive)?.value ?? 0)
    );
  }

  return Math.abs(Number(investmentStats[0]?.value ?? 0));
}

export function buildMasterworkInfoMini(
  item: DimItemMini,
  definitions: DimDefinitionTables
): DimMasterworkMini | null {
  if (!item.sockets) {
    return null;
  }

  let masterworkPlug: DimPlugMini | undefined =
    ((item.crafted &&
      getFirstSocketByCategoryHash(item.sockets, SocketCategoryHashes.IntrinsicTraits)
        ?.plugged) ||
    item.sockets.allSockets.find(isWeaponMasterworkSocket)?.plugged ||
    undefined) ?? undefined;

  if (!masterworkPlug && item.bucket.inArmor) {
    masterworkPlug =
      item.sockets.allSockets.find(isArmor3MasterworkSocket)?.plugged ?? undefined;
  }

  if (!masterworkPlug) {
    return null;
  }

  const exoticWeapon = item.isExotic && item.bucket.sort === "Weapons";
  const plugStats = masterworkPlug.stats;

  if (!plugStats || Object.keys(plugStats).length === 0) {
    return exoticWeapon ? { tier: 10 } : null;
  }

  const primaryMasterworkStatHash =
    masterworkPlug.plugDef?.investmentStats?.[0]?.statTypeHash;
  const stats = Object.entries(plugStats).flatMap(([statHashText, stat]) => {
    const statHash = Number(statHashText);
    const itemHasStat = item.stats?.some((itemStat) => itemStat.statHash === statHash);

    if (!itemHasStat) {
      return [];
    }

    return [
      {
        hash: statHash,
        name: getStatName(definitions, statHash),
        value: stat.value,
        isPrimary:
          primaryMasterworkStatHash === undefined || primaryMasterworkStatHash === statHash,
      },
    ];
  });
  const armor3 = isArmor3MasterworkSocket({
    socketIndex: -1,
    plugged: masterworkPlug,
    plugOptions: [],
    hasRandomizedPlugItems: false,
    isPerk: false,
    isMod: false,
    isReusable: false,
    socketDefinition: {},
  });
  const tier = exoticWeapon
    ? 10
    : getMasterworkTierFromPlug(masterworkPlug.plugDef, armor3);

  return { tier, stats };
}

export function buildItemMini(
  rawItem: any,
  itemComponents: any,
  definitions: DimDefinitionTables
): DimItemMini | undefined {
  const itemDef = getDefinition(definitions.inventoryItems, rawItem?.itemHash);
  if (!itemDef) {
    return undefined;
  }

  const instance = rawItem?.itemInstanceId
    ? itemComponents?.instances?.data?.[rawItem.itemInstanceId]
    : undefined;
  const bucketHash = itemDef.inventory?.bucketTypeHash ?? rawItem.bucketHash ?? 0;
  const itemState = getItemState(rawItem, instance);
  const setHash = itemDef.equippingBlock?.equipableItemSetHash;
  const item: DimItemMini = {
    hash: rawItem.itemHash,
    id: rawItem.itemInstanceId ?? "0",
    itemCategoryHashes: itemDef.itemCategoryHashes ?? [],
    rarity: rarityFromTierType(itemDef.inventory?.tierType),
    isExotic: itemDef.inventory?.tierType === TIER_TYPE_EXOTIC,
    bucket: getBucketInfo(bucketHash),
    tier: instance?.gearTier ?? 0,
    masterwork:
      Boolean(itemState & ITEM_STATE_MASTERWORK) && bucketHash !== BUCKETS.SUBCLASS,
    crafted: itemState & ITEM_STATE_CRAFTED ? "crafted" : false,
    adept: Boolean(itemDef.isAdept),
    holofoil: Boolean(itemDef.isHolofoil),
    locked: Boolean(itemState & ITEM_STATE_LOCKED),
    sockets: null,
    stats: null,
    masterworkInfo: null,
    setBonus: setHash ? getDefinition(definitions.equipableItemSets, setHash) : undefined,
  };

  item.sockets = buildSocketsMini(rawItem, itemComponents, definitions, itemDef);
  item.stats = buildStatsMini(item, itemDef, itemComponents);
  item.masterworkInfo = buildMasterworkInfoMini(item, definitions);
  applyCraftedMasterworkOverride(item);

  return item;
}

export function buildDimItemMini(
  rawItem: any,
  itemComponents: any,
  definitions: DimDefinitionTables
): DimItemMini | undefined {
  return buildItemMini(rawItem, itemComponents, definitions);
}

export function collectDimItemPlugHashes(
  rawItem: any,
  itemComponents: any,
  includeReusablePlugs: boolean
) {
  const itemId = rawItem?.itemInstanceId;
  const socketsData = itemId ? itemComponents?.sockets?.data?.[itemId] : undefined;
  const reusablePlugs = itemId
    ? itemComponents?.reusablePlugs?.data?.[itemId]?.plugs
    : undefined;
  const plugHashes = new Set<number>();

  socketsData?.sockets?.forEach((socket: any, socketIndex: number) => {
    const socketPlugHash = getPlugHash(socket?.plugHash);

    if (socketPlugHash) {
      plugHashes.add(socketPlugHash);
    }

    if (!includeReusablePlugs) {
      return;
    }

    for (const reusablePlug of getReusablePlugsForSocket(reusablePlugs, socket, socketIndex)) {
      const reusablePlugHash = getPlugHash(reusablePlug);

      if (reusablePlugHash) {
        plugHashes.add(reusablePlugHash);
      }
    }
  });

  return Array.from(plugHashes);
}

export function getActiveSetBonusesMini(
  definitions: DimDefinitionTables,
  equippedItems: DimItemMini[]
): ActiveSetPerk[] {
  const itemsBySetHash = new Map<number, DimItemMini[]>();

  for (const item of equippedItems) {
    if (!item.bucket.inArmor || !item.setBonus) {
      continue;
    }

    const items = itemsBySetHash.get(item.setBonus.hash) ?? [];
    items.push(item);
    itemsBySetHash.set(item.setBonus.hash, items);
  }

  return Array.from(itemsBySetHash.entries()).flatMap(([setHash, matchingItems]) => {
    const setDefinition = matchingItems[0].setBonus;
    const equippedCount = matchingItems.length;

    return (setDefinition?.setPerks ?? []).flatMap((setPerk: any) => {
      if (equippedCount < setPerk.requiredSetCount) {
        return [];
      }

      const perkDefinition = getDefinition(definitions.sandboxPerks, setPerk.sandboxPerkHash);

      return [
        {
          setHash,
          setName: setDefinition.displayProperties?.name ?? "",
          sandboxPerkHash: setPerk.sandboxPerkHash,
          requiredSetCount: setPerk.requiredSetCount,
          perkName: perkDefinition?.displayProperties?.name ?? "",
          perkDescription: perkDefinition?.displayProperties?.description ?? "",
          contributingItemHashes: matchingItems.map((item) => item.hash),
        },
      ];
    });
  });
}

export function getExoticArmorIntrinsic(item: DimItemMini): any | undefined {
  if (!item.bucket.inArmor || !item.sockets) {
    return undefined;
  }

  return item.sockets.allSockets.find((socket) => {
    return (
      socketHasIntrinsicPlug(socket) &&
      socket.plugged?.plugDef?.inventory?.tierType === TIER_TYPE_EXOTIC
    );
  })?.plugged?.plugDef;
}

export function getExtraExoticClassItemPerks(item: DimItemMini): any[] {
  if (!item.isExotic || !item.bucket.inArmor || !item.sockets) {
    return [];
  }

  return item.sockets.allSockets
    .filter(
      (socket) =>
        socket.isPerk &&
        socket.visibleInGame &&
        socketHasIntrinsicPlug(socket) &&
        socket.plugged?.plugDef
    )
    .map((socket) => socket.plugged?.plugDef);
}

export function isArtifice(item: DimItemMini): boolean {
  return (
    item.sockets?.allSockets.some((socket) => {
      const plug = socket.plugged?.plugDef;
      const plugCategoryHash = plug?.plug?.plugCategoryHash;

      return Boolean(
        socket.visibleInGame &&
          plug &&
          (plugCategoryHash === PlugCategoryHashes.EnhancementsArtifice ||
            plugCategoryHash === PlugCategoryHashes.EnhancementsArtificeExotic ||
            ARTIFICE_PLUG_HASHES.has(plug.hash))
      );
    }) ?? false
  );
}

export function isEnhancedPerk(plugDef: any): boolean {
  const plugCategoryHash = getPlugCategoryHash(plugDef);

  return Boolean(
    plugDef?.inventory?.tierType === TIER_TYPE_COMMON &&
      plugCategoryHash !== undefined &&
      (plugCategoryHash === PlugCategoryHashes.Frames ||
        plugCategoryHash === PlugCategoryHashes.Origins ||
        WEAPON_COMPONENT_PLUG_CATEGORIES.has(plugCategoryHash))
  );
}

export function countEnhancedPerks(item: DimItemMini): number {
  return (
    item.sockets?.allSockets.filter(
      (socket) => socket.plugged && isEnhancedPerk(socket.plugged.plugDef)
    ).length ?? 0
  );
}

export function applyCraftedMasterworkOverride(item: DimItemMini): void {
  if (!item.crafted || !item.sockets) {
    return;
  }

  if ((item.masterworkInfo?.tier ?? 0) >= 10 && countEnhancedPerks(item) >= 2) {
    item.masterwork = true;
  }
}

export function hasOriginTrait(item: DimItemMini): boolean {
  return (
    item.sockets?.allSockets.some((socket) =>
      socket.plugged?.plugDef?.itemCategoryHashes?.includes(
        ItemCategoryHashes.WeaponModsOriginTraits
      )
    ) ?? false
  );
}

export function hasMemento(item: DimItemMini): boolean {
  return (
    item.sockets?.allSockets.some(
      (socket) =>
        socket.plugged?.plugDef?.plug?.plugCategoryHash === PlugCategoryHashes.Mementos
    ) ?? false
  );
}

export function hasRetiredPerk(item: DimItemMini): boolean {
  return (
    item.sockets?.allSockets.some((socket) =>
      socket.plugOptions.some((plug) => plug.cannotCurrentlyRoll)
    ) ?? false
  );
}

export function hasDisabledMod(item: DimItemMini): boolean {
  return (
    item.sockets?.allSockets.some(
      (socket) => socket.visibleInGame && socket.plugged && !socket.plugged.enabled
    ) ?? false
  );
}

export type ItemPredicate = (item: DimItemMini) => boolean;

export const dimItemFilters = {
  isMasterwork: (): ItemPredicate => (item) => item.masterwork,
  isExotic: (): ItemPredicate => (item) => item.isExotic,
  isLegendary: (): ItemPredicate => (item) => item.rarity === "Legendary",
  isArtifice: (): ItemPredicate => (item) => isArtifice(item),
  isOriginTrait: (): ItemPredicate => (item) => hasOriginTrait(item),
  isAdept: (): ItemPredicate => (item) =>
    item.adept && Boolean(item.bucket.inWeapons),
  isHolofoil: (): ItemPredicate => (item) =>
    item.holofoil && Boolean(item.bucket.inWeapons),
  tierAtLeast:
    (wantedTier: number): ItemPredicate =>
    (item) =>
      item.tier >= wantedTier,
  tierEquals:
    (wantedTier: number): ItemPredicate =>
    (item) =>
      item.tier === wantedTier,
  masterworkAtLeast:
    (wantedTier: number): ItemPredicate =>
    (item) =>
      (item.masterworkInfo?.tier ?? 0) >= wantedTier,
  masterworkStat:
    (statHash: number): ItemPredicate =>
    (item) =>
      Boolean(
        item.masterworkInfo?.stats?.some(
          (stat) => stat.isPrimary && stat.hash === statHash
        )
      ),
  set:
    (setHash: number): ItemPredicate =>
    (item) =>
      item.setBonus?.hash === setHash,
  perk:
    (query: string): ItemPredicate =>
    (item) => {
      const normalizedQuery = query.toLowerCase();
      const socketMatch =
        item.sockets?.allSockets.some((socket) =>
          socket.plugOptions.some((plug) => {
            const displayProperties = plug.plugDef.displayProperties;
            const name = String(displayProperties?.name ?? "").toLowerCase();
            const description = String(displayProperties?.description ?? "").toLowerCase();

            return name.includes(normalizedQuery) || description.includes(normalizedQuery);
          })
        ) ?? false;
      const setMatch =
        String(item.setBonus?.displayProperties?.name ?? "")
          .toLowerCase()
          .includes(normalizedQuery) ||
        (item.setBonus?.setPerks ?? []).some((setPerk: any) => {
          const perkName = String(setPerk?.displayProperties?.name ?? "").toLowerCase();
          const perkDescription = String(
            setPerk?.displayProperties?.description ?? ""
          ).toLowerCase();
          return (
            perkName.includes(normalizedQuery) ||
            perkDescription.includes(normalizedQuery)
          );
        });

      return socketMatch || setMatch;
    },
};
