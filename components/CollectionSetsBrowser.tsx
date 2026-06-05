"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { DestinyItemCard } from "@/components/DestinyItemCard";
import { ItemTile, type ItemTileModel } from "@/components/ItemTile";
import {
  COLLECTION_SET_DROP_SOURCES,
  type ArmorDropSlot,
  type DropSourceLabel,
} from "@/data/d2/collection-set-drop-sources";
import { useDestinyProfileContext } from "@/components/DestinyProfileProvider";
import { useManifestTable } from "@/hooks/useManifestTable";
import {
  buildBungieIconUrl,
  getClientManifestVersionCacheKey,
  normalizeBungieAssetPath,
} from "@/lib/bungieImageProxy";
import { getCollectionIconSizePx, getIconWidthClassName } from "@/lib/collectionIconSizing";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/settingsStore";

type SetCategory = "raid" | "dungeon" | "story";

type StorySetGroupDefinition = {
  name: string;
  itemNames: string[];
};

type StorySetDefinition = {
  id: string;
  name: string;
  description: string;
  groups: StorySetGroupDefinition[];
};

type CollectionSetItem = {
  itemHash: number;
  collectibleHashes: number[];
  definition: any;
};

type CollectionSetGroup = {
  name: string;
  items: CollectionSetItem[];
};

type DisplaySection = {
  kind: "weapons" | "armor" | "equipment";
  name: string;
  groups: CollectionSetGroup[];
};

type CollectionSet = {
  id: string;
  name: string;
  description: string;
  category: SetCategory;
  iconPath?: string;
  groups: CollectionSetGroup[];
};

type PatternProgress = {
  current: number;
  total: number;
  isComplete: boolean;
};

type SetStats = {
  collected: number;
  total: number;
  percent: number;
  exoticCollected: number;
  exoticTotal: number;
  exoticItems: CollectionSetItem[];
  patternCurrent: number;
  patternTotal: number;
  patternUnlocked: number;
  patternItemTotal: number;
  patternItems: CollectionSetItem[];
};

const BADGES_ROOT_HASH = 498211331;
const DROP_SOURCE_LABEL_AREA_HEIGHT_PX = 18;
const DESKTOP_SIDEBAR_WIDTH_PX = 360;
const DROP_SOURCE_LABEL_ORDER = [
  "Any",
  "1",
  "2",
  "3",
  "4",
  "5",
  "F",
  "Mission",
  "Quest",
  "Epic",
];

const SET_DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  "Sacred Duty": "Garden of Salvation",
};

const CATEGORY_CONFIG: Record<
  SetCategory,
  {
    label: string;
    iconSrc: string;
  }
> = {
  raid: {
    label: "Raid",
    iconSrc: "/Raid.png",
  },
  dungeon: {
    label: "Dungeon",
    iconSrc: "/Dungeon.png",
  },
  story: {
    label: "Exotic Mission",
    iconSrc: "/Exotic-Mission.png",
  },
};

const STORY_SETS: StorySetDefinition[] = [
  {
    id: "starcrossed",
    name: "Starcrossed",
    description: "Season of the Wish and Starcrossed craftable rewards.",
    groups: [
      {
        name: "Season of the Wish",
        itemNames: [
          "Optative",
          "Scatter Signal",
          "Adhortative",
          "Subjunctive",
          "Imperative",
          "Lethophobia",
          "Doomed Petitioner",
          "Supercluster",
        ],
      },
      {
        name: "Starcrossed",
        itemNames: ["Wish-Keeper"],
      },
    ],
  },
  {
    id: "avalon",
    name: "//node.ovrd.AVALON//",
    description: "Season of Defiance and AVALON craftable rewards.",
    groups: [
      {
        name: "Season of Defiance",
        itemNames: [
          "Prodigal Return",
          "Caretaker",
          "Raconteur",
          "Royal Executioner",
          "Perpetualis",
          "Regnant",
        ],
      },
      {
        name: "//node.ovrd.AVALON//",
        itemNames: ["Vexcalibur"],
      },
    ],
  },
  {
    id: "seraph-shield",
    name: "Operation: Seraph's Shield",
    description: "Season of the Seraph, IKELOS, and Revision Zero craftable rewards.",
    groups: [
      {
        name: "Seraph Arsenal",
        itemNames: [
          "Disparity",
          "Judgment of Kelgorath",
          "Tripwire Canary",
          "Fire and Forget",
          "Retrofit Escapade",
          "Path of Least Resistance",
        ],
      },
      {
        name: "IKELOS",
        itemNames: [
          "IKELOS_SMG_v1.0.3",
          "IKELOS_SG_v1.0.3",
          "IKELOS_HC_v1.0.3",
          "IKELOS_SR_v1.0.3",
        ],
      },
      {
        name: "Final Encounter",
        itemNames: ["Revision Zero"],
      },
    ],
  },
  {
    id: "vox-obscura",
    name: "Vox Obscura",
    description: "Season of the Risen and Vox Obscura craftable rewards.",
    groups: [
      {
        name: "Season of the Risen",
        itemNames: [
          "Piece of Mind",
          "Thoughtless",
          "Explosive Personality",
          "Recurrent Impact",
          "Under Your Skin",
          "Sweet Sorrow",
        ],
      },
      {
        name: "Vox Obscura",
        itemNames: ["Dead Messenger"],
      },
    ],
  },
  {
    id: "presage",
    name: "Presage",
    description: "Season of the Haunted, Opulent, and Presage craftable rewards.",
    groups: [
      {
        name: "Haunted Arsenal",
        itemNames: [
          "Nezarec's Whisper",
          "Bump in the Night",
          "Hollow Denial",
          "Tears of Contrition",
          "Without Remorse",
          "Firefright",
        ],
      },
      {
        name: "Opulent Arsenal",
        itemNames: [
          "Austringer",
          "Beloved",
          "Drang (Baroque)",
          "CALUS Mini-Tool",
        ],
      },
      {
        name: "Presage",
        itemNames: ["Dead Man's Tale"],
      },
    ],
  },
];

function getBungieIconSrc(iconPath: string | undefined, width: number) {
  const normalizedPath = normalizeBungieAssetPath(iconPath);

  if (!normalizedPath) {
    return null;
  }

  return buildBungieIconUrl(
    normalizedPath,
    width,
    getClientManifestVersionCacheKey()
  );
}

function getCleanSetName(name: string | undefined) {
  const cleanName = (name ?? "Unknown Set")
    .replace(/^Raid:\s*/i, "")
    .replace(/^Dungeon:\s*/i, "");

  return SET_DISPLAY_NAME_OVERRIDES[cleanName] ?? cleanName;
}

function getCollectibleState(profile: any, collectibleHash: number) {
  let state = profile?.profileCollectibles?.data?.collectibles?.[collectibleHash]?.state;

  if (state === undefined && profile?.characterCollectibles?.data) {
    const characterIds = Object.keys(profile.characterCollectibles.data);

    for (const characterId of characterIds) {
      const characterState =
        profile.characterCollectibles.data[characterId]?.collectibles?.[collectibleHash]?.state;

      if (characterState !== undefined) {
        if ((characterState & 1) === 0) {
          return characterState;
        }

        if (state === undefined) {
          state = characterState;
        }
      }
    }
  }

  return state ?? 1;
}

function isCollectibleAcquired(profile: any, collectibleHash: number) {
  const state = getCollectibleState(profile, collectibleHash);
  return (state & 1) === 0;
}

function isItemAcquired(profile: any, item: CollectionSetItem) {
  return item.collectibleHashes.some((collectibleHash) =>
    isCollectibleAcquired(profile, collectibleHash)
  );
}

function getRecordComponent(profile: any, recordHash: number) {
  const profileRecord = profile?.profileRecords?.data?.records?.[recordHash];
  if (profileRecord) return profileRecord;

  const characterRecords = profile?.characterRecords?.data;
  if (!characterRecords) return null;

  let bestRecord = null;

  for (const characterId of Object.keys(characterRecords)) {
    const characterRecord = characterRecords[characterId].records?.[recordHash];
    if (!characterRecord) continue;

    const characterRecordIsComplete = (characterRecord.state & 4) === 0;

    if (!bestRecord || characterRecordIsComplete) {
      bestRecord = characterRecord;
    }
  }

  return bestRecord;
}

function getPatternProgress(
  item: CollectionSetItem,
  patternRecordByName: Map<string, any>,
  objectiveTable: Record<string, any> | undefined,
  profile: any
): PatternProgress | null {
  if (!item.definition.inventory?.recipeItemHash) {
    return null;
  }

  const itemName = item.definition.displayProperties?.name;
  const patternRecord = itemName ? patternRecordByName.get(itemName) : undefined;

  if (!patternRecord) {
    return null;
  }

  const objectiveHash = patternRecord.objectiveHashes?.[0];
  const recordComponent = getRecordComponent(profile, patternRecord.hash);
  const profileObjective = recordComponent?.objectives?.find(
    (objective: any) => objective.objectiveHash === objectiveHash
  );
  const objectiveDefinition = objectiveHash
    ? objectiveTable?.[String(objectiveHash)]
    : undefined;
  const total =
    profileObjective?.completionValue ||
    objectiveDefinition?.completionValue ||
    1;
  const recordIsComplete =
    recordComponent?.state !== undefined && (recordComponent.state & 4) === 0;
  const isComplete = Boolean(profileObjective?.complete) || recordIsComplete;
  const rawCurrent = isComplete
    ? total
    : profileObjective?.progress ?? 0;
  const current = Math.min(total, Math.max(0, rawCurrent));

  return {
    current,
    total,
    isComplete,
  };
}

function getRarityClassName(itemDefinition: any) {
  const tierName = itemDefinition.inventory?.tierTypeName;

  if (tierName === "Exotic") {
    return "border-yellow-500";
  }

  if (tierName === "Legendary") {
    return "border-purple-500";
  }

  if (tierName === "Rare") {
    return "border-blue-500";
  }

  return "border-white/20";
}

function normalizeDropSourceText(text: string | undefined) {
  return (text ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

function getArmorDropSlot(itemDefinition: any): ArmorDropSlot | null {
  const typeText = `${itemDefinition?.itemTypeDisplayName ?? ""} ${
    itemDefinition?.displayProperties?.name ?? ""
  }`.toLowerCase();

  if (typeText.includes("helmet") || typeText.includes("helm")) {
    return "helmet";
  }

  if (
    typeText.includes("gauntlet") ||
    typeText.includes("grip") ||
    typeText.includes("glove") ||
    typeText.includes("fist") ||
    typeText.includes("arms") ||
    typeText.includes("wrap")
  ) {
    return "arms";
  }

  if (
    typeText.includes("chest") ||
    typeText.includes("plate") ||
    typeText.includes("vest") ||
    typeText.includes("robe") ||
    typeText.includes("cuirass") ||
    typeText.includes("chiton") ||
    typeText.includes("harness") ||
    typeText.includes("duster")
  ) {
    return "chest";
  }

  if (
    typeText.includes("leg") ||
    typeText.includes("greave") ||
    typeText.includes("boot") ||
    typeText.includes("stride") ||
    typeText.includes("tread") ||
    typeText.includes("pants") ||
    typeText.includes("chaps")
  ) {
    return "legs";
  }

  if (
    typeText.includes("class item") ||
    typeText.includes("mark") ||
    typeText.includes("cloak") ||
    typeText.includes("bond")
  ) {
    return "class item";
  }

  return null;
}

function getDropSourceLabelSortIndex(label: DropSourceLabel) {
  const index = DROP_SOURCE_LABEL_ORDER.indexOf(label.shortLabel);

  return index === -1 ? DROP_SOURCE_LABEL_ORDER.length : index;
}

function getItemDropSourceLabels(
  set: CollectionSet,
  item: CollectionSetItem
): DropSourceLabel[] {
  const setKey = normalizeDropSourceText(set.name);
  const itemKey = normalizeDropSourceText(item.definition.displayProperties?.name);
  const armorSlot = getArmorDropSlot(item.definition);
  const labelsByKey = new Map<string, DropSourceLabel>();

  for (const dropSource of COLLECTION_SET_DROP_SOURCES) {
    if (normalizeDropSourceText(dropSource.setName) !== setKey) {
      continue;
    }

    const itemNameMatches = dropSource.itemNames?.some(
      (itemName) => normalizeDropSourceText(itemName) === itemKey
    );
    const armorSlotMatches =
      dropSource.armorSlot !== undefined && dropSource.armorSlot === armorSlot;

    if (!dropSource.allItems && !itemNameMatches && !armorSlotMatches) {
      continue;
    }

    for (const encounter of dropSource.encounters) {
      labelsByKey.set(`${encounter.shortLabel}:${encounter.label}`, encounter);
    }
  }

  return Array.from(labelsByKey.values()).sort(
    (firstLabel, secondLabel) =>
      getDropSourceLabelSortIndex(firstLabel) -
      getDropSourceLabelSortIndex(secondLabel)
  );
}

function createSetItem(
  itemDefinition: any,
  collectibleHashes: number[]
): CollectionSetItem | null {
  const name = itemDefinition?.displayProperties?.name;

  if (!itemDefinition?.hash || !name) {
    return null;
  }

  return {
    itemHash: itemDefinition.hash,
    collectibleHashes: Array.from(new Set(collectibleHashes)),
    definition: itemDefinition,
  };
}

function buildCollectibleHashMap(collectibleTable: Record<string, any> | undefined) {
  const collectibleHashesByItemHash = new Map<number, number[]>();

  if (!collectibleTable) {
    return collectibleHashesByItemHash;
  }

  for (const collectible of Object.values(collectibleTable)) {
    const itemHash = collectible?.itemHash;

    if (!itemHash) continue;

    const collectibleHashes = collectibleHashesByItemHash.get(itemHash) ?? [];
    collectibleHashes.push(collectible.hash);
    collectibleHashesByItemHash.set(itemHash, collectibleHashes);
  }

  return collectibleHashesByItemHash;
}

function buildItemsFromCollectibles(
  collectibleEntries: any[],
  collectibleTable: Record<string, any> | undefined,
  itemTable: Record<string, any> | undefined
) {
  const itemMap = new Map<number, CollectionSetItem>();

  for (const collectibleEntry of collectibleEntries) {
    const collectibleHash = collectibleEntry.collectibleHash;
    const collectible = collectibleTable?.[String(collectibleHash)];
    const itemDefinition = itemTable?.[String(collectible?.itemHash)];
    const existingItem = itemDefinition
      ? itemMap.get(itemDefinition.hash)
      : undefined;

    if (existingItem) {
      existingItem.collectibleHashes.push(collectibleHash);
      existingItem.collectibleHashes = Array.from(
        new Set(existingItem.collectibleHashes)
      );
      continue;
    }

    const item = createSetItem(itemDefinition, [collectibleHash]);

    if (item) {
      itemMap.set(item.itemHash, item);
    }
  }

  return Array.from(itemMap.values());
}

function buildBadgeSetGroups(
  node: any,
  presentationTable: Record<string, any> | undefined,
  collectibleTable: Record<string, any> | undefined,
  itemTable: Record<string, any> | undefined
): CollectionSetGroup[] {
  const childNodes = (node.children?.presentationNodes ?? [])
    .map((child: any) => presentationTable?.[String(child.presentationNodeHash)])
    .filter(Boolean);

  if (childNodes.length === 0) {
    return [
      {
        name: "Rewards",
        items: buildItemsFromCollectibles(
          node.children?.collectibles ?? [],
          collectibleTable,
          itemTable
        ),
      },
    ];
  }

  const childGroups: CollectionSetGroup[] = childNodes.map((childNode: any) => ({
    name: childNode.displayProperties?.name ?? "Rewards",
    items: buildItemsFromCollectibles(
      childNode.children?.collectibles ?? [],
      collectibleTable,
      itemTable
    ),
  }));
  const itemFrequency = new Map<number, number>();

  for (const group of childGroups) {
    for (const item of group.items) {
      itemFrequency.set(item.itemHash, (itemFrequency.get(item.itemHash) ?? 0) + 1);
    }
  }

  const sharedItemHashes = new Set(
    Array.from(itemFrequency.entries())
      .filter(([, count]) => count === childGroups.length)
      .map(([itemHash]) => itemHash)
  );
  const firstGroupItems = childGroups[0]?.items ?? [];
  const sharedItems = firstGroupItems.filter((item) =>
    sharedItemHashes.has(item.itemHash)
  );
  const groups: CollectionSetGroup[] = [];

  if (sharedItems.length > 0) {
    groups.push({
      name: "Shared Drops",
      items: sharedItems,
    });
  }

  for (const group of childGroups) {
    const classItems = group.items.filter(
      (item) => !sharedItemHashes.has(item.itemHash)
    );

    if (classItems.length > 0) {
      groups.push({
        name: group.name,
        items: classItems,
      });
    }
  }

  return groups;
}

function buildBadgeSets(
  category: SetCategory,
  presentationTable: Record<string, any> | undefined,
  collectibleTable: Record<string, any> | undefined,
  itemTable: Record<string, any> | undefined
): CollectionSet[] {
  const badgesRoot = presentationTable?.[String(BADGES_ROOT_HASH)];

  if (!badgesRoot) {
    return [];
  }

  return (badgesRoot.children?.presentationNodes ?? [])
    .map((child: any) => presentationTable?.[String(child.presentationNodeHash)])
    .filter(Boolean)
    .filter((node: any) => {
      const text = `${node.displayProperties?.name ?? ""} ${node.displayProperties?.description ?? ""}`.toLowerCase();
      return category === "raid"
        ? text.includes("raid")
        : text.includes("dungeon");
    })
    .map((node: any) => ({
      id: `${category}-${node.hash}`,
      name: getCleanSetName(node.displayProperties?.name),
      description: node.displayProperties?.description ?? "",
      category,
      iconPath: node.displayProperties?.icon,
      groups: buildBadgeSetGroups(
        node,
        presentationTable,
        collectibleTable,
        itemTable
      ).filter((group) => group.items.length > 0),
    }))
    .filter((set: CollectionSet) => set.groups.length > 0);
}

function buildItemByNameMap(itemTable: Record<string, any> | undefined) {
  const itemByName = new Map<string, any>();

  if (!itemTable) {
    return itemByName;
  }

  for (const itemDefinition of Object.values(itemTable)) {
    const itemName = itemDefinition.displayProperties?.name;

    if (!itemName || itemDefinition.itemType !== 3) continue;

    const existingItem = itemByName.get(itemName);
    const currentItemHasRecipe = Boolean(itemDefinition.inventory?.recipeItemHash);
    const existingItemHasRecipe = Boolean(existingItem?.inventory?.recipeItemHash);

    if (!existingItem || (currentItemHasRecipe && !existingItemHasRecipe)) {
      itemByName.set(itemName, itemDefinition);
    }
  }

  return itemByName;
}

function buildStorySets(
  itemByName: Map<string, any>,
  collectibleHashesByItemHash: Map<number, number[]>
): CollectionSet[] {
  return STORY_SETS.map((storySet) => ({
    id: `story-${storySet.id}`,
    name: storySet.name,
    description: storySet.description,
    category: "story" as const,
    groups: storySet.groups
      .map((group) => ({
        name: group.name,
        items: group.itemNames
          .map((itemName) => {
            const itemDefinition = itemByName.get(itemName);
            const collectibleHashes = itemDefinition
              ? collectibleHashesByItemHash.get(itemDefinition.hash) ?? []
              : [];

            return createSetItem(itemDefinition, collectibleHashes);
          })
          .filter(Boolean) as CollectionSetItem[],
      }))
      .filter((group) => group.items.length > 0),
  })).filter((set) => set.groups.length > 0);
}

function getUniqueSetItems(groups: CollectionSetGroup[]) {
  const itemMap = new Map<number, CollectionSetItem>();

  for (const group of groups) {
    for (const item of group.items) {
      const existingItem = itemMap.get(item.itemHash);

      if (existingItem) {
        existingItem.collectibleHashes = Array.from(
          new Set([...existingItem.collectibleHashes, ...item.collectibleHashes])
        );
        continue;
      }

      itemMap.set(item.itemHash, {
        ...item,
        collectibleHashes: [...item.collectibleHashes],
      });
    }
  }

  return Array.from(itemMap.values());
}

function isWeaponItem(item: CollectionSetItem) {
  return item.definition.itemType === 3;
}

function isArmorItem(item: CollectionSetItem) {
  return item.definition.itemType === 2;
}

function isLegendaryWeaponItem(item: CollectionSetItem) {
  return isWeaponItem(item) && !isFeaturedExoticItem(item);
}

function buildDisplaySections(groups: CollectionSetGroup[]): DisplaySection[] {
  const legendaryWeaponGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter(isLegendaryWeaponItem),
    }))
    .filter((group) => group.items.length > 0);
  const armorGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter(isArmorItem),
    }))
    .filter((group) => group.items.length > 0);
  const equipmentAndFlairGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !isWeaponItem(item) && !isArmorItem(item)
      ),
    }))
    .filter((group) => group.items.length > 0);
  const displaySections: DisplaySection[] = [];

  if (legendaryWeaponGroups.length > 0) {
    displaySections.push({
      kind: "weapons",
      name: "Legendary Weapons",
      groups: legendaryWeaponGroups,
    });
  }

  if (armorGroups.length > 0) {
    displaySections.push({
      kind: "armor",
      name: "Armor",
      groups: armorGroups,
    });
  }

  if (equipmentAndFlairGroups.length > 0) {
    displaySections.push({
      kind: "equipment",
      name: "Equipment & Flair",
      groups: equipmentAndFlairGroups,
    });
  }

  return displaySections;
}

function getSetStats(
  set: CollectionSet,
  profile: any,
  patternRecordByName: Map<string, any>,
  objectiveTable: Record<string, any> | undefined,
  collectibleTable?: Record<string, any>,
  itemTable?: Record<string, any>
): SetStats {
  const uniqueItems = getUniqueSetItems(set.groups);
  const collected = uniqueItems.filter((item) => isItemAcquired(profile, item)).length;
  const exoticItems = buildFeaturedExoticItems(set, collectibleTable, itemTable);
  const patternRows = uniqueItems
    .map((item) => ({
      item,
      progress: getPatternProgress(
        item,
        patternRecordByName,
        objectiveTable,
        profile
      ),
    }))
    .filter((row) => row.progress !== null) as {
      item: CollectionSetItem;
      progress: PatternProgress;
    }[];
  const patternCurrent = patternRows.reduce(
    (sum, row) => sum + row.progress.current,
    0
  );
  const patternTotal = patternRows.reduce(
    (sum, row) => sum + row.progress.total,
    0
  );
  const patternUnlocked = patternRows.filter((row) => row.progress.isComplete).length;
  const total = uniqueItems.length;
  const percent = total > 0 ? Math.floor((collected / total) * 100) : 0;

  return {
    collected,
    total,
    percent,
    exoticCollected: exoticItems.filter((item) => isItemAcquired(profile, item)).length,
    exoticTotal: exoticItems.length,
    exoticItems,
    patternCurrent,
    patternTotal,
    patternUnlocked,
    patternItemTotal: patternRows.length,
    patternItems: patternRows.map((row) => row.item),
  };
}

function isFeaturedExoticItem(item: CollectionSetItem) {
  return (
    item.definition.itemType === 3 &&
    item.definition.inventory?.tierTypeName === "Exotic"
  );
}

function getSetSourceSearchNames(set: CollectionSet) {
  const quotedNames = Array.from(
    set.description.matchAll(/"([^"]+)"/g),
    (match) => match[1]
  );

  return Array.from(new Set([set.name, ...quotedNames]))
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
}

function buildFeaturedExoticItems(
  set: CollectionSet,
  collectibleTable: Record<string, any> | undefined,
  itemTable: Record<string, any> | undefined
) {
  const exoticItemMap = new Map<number, CollectionSetItem>();

  for (const item of getUniqueSetItems(set.groups)) {
    if (isFeaturedExoticItem(item)) {
      exoticItemMap.set(item.itemHash, item);
    }
  }

  if (set.category === "story" || !collectibleTable || !itemTable) {
    return Array.from(exoticItemMap.values());
  }

  const searchNames = getSetSourceSearchNames(set);

  for (const collectible of Object.values(collectibleTable)) {
    const sourceText = (collectible.sourceString ?? "").toLowerCase();
    const sourceMatchesSet = searchNames.some((name) => sourceText.includes(name));

    if (!sourceMatchesSet) continue;

    const itemDefinition = itemTable[String(collectible.itemHash)];
    const item = createSetItem(itemDefinition, [collectible.hash]);

    if (item && isFeaturedExoticItem(item)) {
      exoticItemMap.set(item.itemHash, item);
    }
  }

  return Array.from(exoticItemMap.values());
}

function buildPatternRecordByName(recordTable: Record<string, any> | undefined) {
  const patternRecordByName = new Map<string, any>();

  if (!recordTable) {
    return patternRecordByName;
  }

  for (const record of Object.values(recordTable)) {
    const name = record.displayProperties?.name;

    if (name) {
      patternRecordByName.set(name, record);
    }
  }

  return patternRecordByName;
}

function getItemTileModel(
  item: CollectionSetItem,
  isAcquired: boolean,
  iconSizePx: number
): ItemTileModel {
  const iconSrc = getBungieIconSrc(
    item.definition.displayProperties?.icon,
    iconSizePx * 2
  );
  const watermarkSrc = getBungieIconSrc(
    item.definition.iconWatermark || item.definition.iconWatermarkShelved,
    iconSizePx * 2
  );

  return {
    itemHash: item.itemHash,
    name: item.definition.displayProperties?.name ?? String(item.itemHash),
    iconSrc,
    watermarkSrc,
    rarityClassName: getRarityClassName(item.definition),
    isDimmed: !isAcquired,
  };
}

export function CollectionSetsBrowser() {
  const { profile } = useDestinyProfileContext();
  const characterIconSize = useSettingsStore((state) => state.iconSize);
  const setItemIconSizePx = getCollectionIconSizePx(characterIconSize);
  const [selectedCategory, setSelectedCategory] = useState<SetCategory>("raid");
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [usesDesktopLayout, setUsesDesktopLayout] = useState(false);
  const {
    table: presentationTable,
    isLoading: presentationTableLoading,
  } = useManifestTable<any>("DestinyPresentationNodeDefinition");
  const {
    table: collectibleTable,
    isLoading: collectibleTableLoading,
  } = useManifestTable<any>("DestinyCollectibleDefinition");
  const {
    table: itemTable,
    isLoading: itemTableLoading,
  } = useManifestTable<any>("DestinyInventoryItemDefinition", { view: "card" });
  const {
    table: patternRecordTable,
    isLoading: patternRecordTableLoading,
  } = useManifestTable<any>("DestinyRecordDefinition", { view: "patterns" });
  const {
    table: objectiveTable,
    isLoading: objectiveTableLoading,
  } = useManifestTable<any>("DestinyObjectiveDefinition");

  const collectibleHashesByItemHash = useMemo(
    () => buildCollectibleHashMap(collectibleTable),
    [collectibleTable]
  );
  const itemByName = useMemo(() => buildItemByNameMap(itemTable), [itemTable]);
  const patternRecordByName = useMemo(
    () => buildPatternRecordByName(patternRecordTable),
    [patternRecordTable]
  );
  const sets = useMemo(() => {
    const raidSets = buildBadgeSets(
      "raid",
      presentationTable,
      collectibleTable,
      itemTable
    );
    const dungeonSets = buildBadgeSets(
      "dungeon",
      presentationTable,
      collectibleTable,
      itemTable
    );
    const storySets = buildStorySets(itemByName, collectibleHashesByItemHash);

    return [...raidSets, ...dungeonSets, ...storySets];
  }, [
    presentationTable,
    collectibleTable,
    itemTable,
    itemByName,
    collectibleHashesByItemHash,
  ]);
  const selectedCategorySets = useMemo(
    () => sets.filter((set) => set.category === selectedCategory),
    [sets, selectedCategory]
  );
  const selectedSet = selectedCategorySets.find((set) => set.id === selectedSetId);
  const selectedSetStats = selectedSet
    ? getSetStats(
        selectedSet,
        profile,
        patternRecordByName,
        objectiveTable,
        collectibleTable,
        itemTable
      )
    : null;
  const selectedDisplaySections = selectedSet
    ? buildDisplaySections(selectedSet.groups)
    : [];
  const isLoading =
    presentationTableLoading ||
    collectibleTableLoading ||
    itemTableLoading ||
    patternRecordTableLoading ||
    objectiveTableLoading;

  useEffect(() => {
    const selectedSetIsValid = selectedCategorySets.some(
      (set) => set.id === selectedSetId
    );

    if (selectedCategorySets.length > 0 && !selectedSetIsValid) {
      setSelectedSetId(selectedCategorySets[0].id);
    }
  }, [selectedCategorySets, selectedSetId]);

  useEffect(() => {
    const desktopLayoutQuery = window.matchMedia("(min-width: 1024px)");
    const updateDesktopLayout = () => {
      setUsesDesktopLayout(desktopLayoutQuery.matches);
    };

    updateDesktopLayout();
    desktopLayoutQuery.addEventListener("change", updateDesktopLayout);

    return () => {
      desktopLayoutQuery.removeEventListener("change", updateDesktopLayout);
    };
  }, []);

  if (isLoading) {
    return <div className="min-h-[80vh] animate-pulse bg-white/5" />;
  }

  return (
    <div
      className="relative flex flex-col overflow-hidden text-slate-100"
      style={{ minHeight: "80vh" }}
    >
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
          {(Object.keys(CATEGORY_CONFIG) as SetCategory[]).map((category) => {
            const config = CATEGORY_CONFIG[category];
            const isSelected = selectedCategory === category;

            return (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap border px-4 py-2 transition-all",
                  isSelected
                    ? "border-destiny-gold bg-destiny-gold/10 text-destiny-gold"
                    : "border-white/10 text-slate-400 hover:border-white/70 hover:text-white"
                )}
              >
                <Image
                  src={config.iconSrc}
                  width={24}
                  height={24}
                  alt=""
                  className={cn(
                    "h-6 w-6 object-contain transition-opacity",
                    isSelected ? "opacity-100" : "opacity-65"
                  )}
                />
                <span className="text-sm font-bold uppercase tracking-wider">
                  {config.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="grid"
        style={{
          minHeight: "calc(80vh - 4.25rem)",
          gridTemplateColumns: usesDesktopLayout
            ? `${DESKTOP_SIDEBAR_WIDTH_PX}px minmax(0, 1fr)`
            : "minmax(0, 1fr)",
        }}
      >
        <aside
          className="p-4"
          style={{
            borderBottom: usesDesktopLayout
              ? "none"
              : "1px solid rgba(255, 255, 255, 0.1)",
            borderRight: usesDesktopLayout
              ? "1px solid rgba(255, 255, 255, 0.1)"
              : "none",
          }}
        >
          {selectedSetStats && <SetProgressPanel stats={selectedSetStats} />}

          <div className="mt-6 max-h-[calc(100vh-18rem)] space-y-1 overflow-y-auto pr-1 custom-scrollbar">
            {selectedCategorySets.map((set) => {
              const stats = getSetStats(
                set,
                profile,
                patternRecordByName,
                objectiveTable,
                collectibleTable,
                itemTable
              );
              const isSelected = selectedSetId === set.id;
              const isComplete = stats.total > 0 && stats.collected >= stats.total;

              return (
                <button
                  key={set.id}
                  type="button"
                  onClick={() => setSelectedSetId(set.id)}
                  className={cn(
                    "flex w-full items-center justify-between border-l-2 px-3 py-2.5 text-left text-sm transition-colors",
                    isSelected
                      ? "border-l-destiny-gold border-y-transparent border-r-transparent bg-linear-to-r from-destiny-gold/10 to-transparent text-white"
                      : isComplete
                        ? "border-l-[#d6c586]/55 border-y-transparent border-r-transparent text-[#f0df89] hover:border-l-[#d6c586]/85 hover:bg-linear-to-r hover:from-destiny-gold/5 hover:to-transparent"
                        : "border-l-white/10 border-y-transparent border-r-transparent text-slate-400 hover:border-l-white/70 hover:bg-linear-to-r hover:from-white/5 hover:to-transparent hover:text-white"
                  )}
                >
                  <span className="min-w-0 truncate font-medium">{set.name}</span>
                  <span className="ml-3 shrink-0 font-bold text-white/70">
                    {stats.collected} / {stats.total}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-w-0 px-4 py-5 sm:px-7 lg:px-10">
          {selectedSet && selectedSetStats ? (
            <div>
              <div className="max-h-[calc(100vh-12rem)] overflow-y-auto pb-10 pr-1 custom-scrollbar">
                <div className="space-y-9">
                  {selectedDisplaySections.map((section) => (
                    <SetItemSection
                      key={section.name}
                      set={selectedSet}
                      section={section}
                      stats={selectedSetStats}
                      profile={profile}
                      patternRecordByName={patternRecordByName}
                      objectiveTable={objectiveTable}
                      itemIconSizePx={setItemIconSizePx}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[70vh] items-center justify-center text-white/45">
              No sets found.
            </div>
          )}
        </main>
      </div>

      <footer className="border-t border-white/10 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
        Drop table data may be inaccurate or outdated.
      </footer>
    </div>
  );
}

function SetProgressPanel({ stats }: { stats: SetStats }) {
  return (
    <section className="border-b border-white/10 pb-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/45">
        Collection
      </div>
      <div className="mt-1 flex items-end gap-3">
        <div className="text-5xl font-light leading-none text-white">
          {stats.percent}%
        </div>
        <div className="pb-1 text-2xl font-semibold leading-none text-white/80">
          {stats.collected} / {stats.total}
        </div>
      </div>

      <div className="mt-5">
        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/45">
          Patterns
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-xl font-semibold text-white/80">
            {stats.patternCurrent} / {stats.patternTotal}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
            {stats.patternUnlocked} / {stats.patternItemTotal} unlocked
          </span>
        </div>
      </div>
    </section>
  );
}

function SetItemSection({
  set,
  section,
  stats,
  profile,
  patternRecordByName,
  objectiveTable,
  itemIconSizePx,
}: {
  set: CollectionSet;
  section: DisplaySection;
  stats: SetStats;
  profile: any;
  patternRecordByName: Map<string, any>;
  objectiveTable: Record<string, any> | undefined;
  itemIconSizePx: number;
}) {
  const legendaryWeaponItems = section.kind === "weapons"
    ? getUniqueSetItems(section.groups)
    : [];
  const weaponRowItems = section.kind === "weapons"
    ? [...stats.exoticItems, ...legendaryWeaponItems]
    : [];

  return (
    <section className="space-y-4">
      <SetSectionHeader
        section={section}
        stats={stats}
      />
      {section.kind === "weapons" ? (
        <SetItemIconRow
          set={set}
          items={weaponRowItems}
          profile={profile}
          patternRecordByName={patternRecordByName}
          objectiveTable={objectiveTable}
          itemIconSizePx={itemIconSizePx}
        />
      ) : (
        <div className="space-y-6">
          {section.groups.map((group) => (
            <SetItemGroup
              key={group.name}
              set={set}
              group={group}
              profile={profile}
              patternRecordByName={patternRecordByName}
              objectiveTable={objectiveTable}
              itemIconSizePx={itemIconSizePx}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SetSectionHeader({
  section,
  stats,
}: {
  section: DisplaySection;
  stats: SetStats;
}) {
  if (section.kind !== "weapons") {
    return (
      <div className="border-b border-white/12 pb-2 text-xs font-bold uppercase tracking-[0.22em] text-white/55">
        {section.name}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-white/12 pb-2 text-xs font-bold uppercase tracking-[0.22em] text-white/55">
      <span>{section.name}</span>
      <span className="text-white/25">|</span>
      <span>Exotic</span>
      <span className="tracking-wider text-white/45">
        {stats.exoticCollected} / {stats.exoticTotal}
      </span>
    </div>
  );
}

function SetItemIconRow({
  set,
  items,
  profile,
  patternRecordByName,
  objectiveTable,
  itemIconSizePx,
}: {
  set: CollectionSet;
  items: CollectionSetItem[];
  profile: any;
  patternRecordByName: Map<string, any>;
  objectiveTable: Record<string, any> | undefined;
  itemIconSizePx: number;
}) {
  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      {items.map((item) => (
        <SetItemIcon
          key={item.itemHash}
          set={set}
          item={item}
          profile={profile}
          patternRecordByName={patternRecordByName}
          objectiveTable={objectiveTable}
          sizePx={itemIconSizePx}
        />
      ))}
    </div>
  );
}

function SetItemGroup({
  set,
  group,
  profile,
  patternRecordByName,
  objectiveTable,
  itemIconSizePx,
}: {
  set: CollectionSet;
  group: CollectionSetGroup;
  profile: any;
  patternRecordByName: Map<string, any>;
  objectiveTable: Record<string, any> | undefined;
  itemIconSizePx: number;
}) {
  const shouldShowGroupLabel = group.name !== "Shared Drops";

  return (
    <section
      className="grid gap-3"
      style={{
        gridTemplateColumns: shouldShowGroupLabel
          ? "26px minmax(0, 1fr)"
          : "minmax(0, 1fr)",
      }}
    >
      {shouldShowGroupLabel && (
        <div className="flex items-start justify-center pt-1">
          <div
            className="origin-center text-[11px] font-bold uppercase tracking-widest text-white/55"
            style={{
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
            }}
          >
            {group.name}
          </div>
        </div>
      )}
      <SetItemIconRow
        set={set}
        items={group.items}
        profile={profile}
        patternRecordByName={patternRecordByName}
        objectiveTable={objectiveTable}
        itemIconSizePx={itemIconSizePx}
      />
    </section>
  );
}

function SetItemIcon({
  set,
  item,
  profile,
  patternRecordByName,
  objectiveTable,
  sizePx,
}: {
  set: CollectionSet;
  item: CollectionSetItem;
  profile: any;
  patternRecordByName: Map<string, any>;
  objectiveTable: Record<string, any> | undefined;
  sizePx: number;
}) {
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const isAcquired = isItemAcquired(profile, item);
  const patternProgress = getPatternProgress(
    item,
    patternRecordByName,
    objectiveTable,
    profile
  );
  const patternPercent = patternProgress && patternProgress.total > 0
    ? Math.min(100, (patternProgress.current / patternProgress.total) * 100)
    : 0;
  const tileModel = getItemTileModel(item, isAcquired, sizePx);
  const tileWidthClassName = getIconWidthClassName(sizePx);
  const labelAreaHeight = DROP_SOURCE_LABEL_AREA_HEIGHT_PX;
  const dropSourceLabels = getItemDropSourceLabels(set, item);
  const itemName = item.definition.displayProperties?.name ?? "Collection item";
  const dropSourceDescription = dropSourceLabels.length > 0
    ? ` Drops from ${dropSourceLabels.map((label) => label.label).join(", ")}.`
    : "";

  const updateTooltipPosition = (event: React.MouseEvent) => {
    if (!contextMenuPosition) {
      setTooltipPosition({ x: event.clientX, y: event.clientY });
    }
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setTooltipPosition(null);
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
  };

  return (
    <div
      className={cn(
        "relative shrink-0 cursor-pointer transition-transform hover:scale-105 focus:outline-none focus:ring-1 focus:ring-white/70",
        !isAcquired && "opacity-65"
      )}
      style={{
        width: sizePx,
        height: sizePx + labelAreaHeight,
      }}
      role="button"
      tabIndex={0}
      aria-label={`${itemName}.${dropSourceDescription}`}
      onMouseEnter={updateTooltipPosition}
      onMouseMove={updateTooltipPosition}
      onMouseLeave={() => setTooltipPosition(null)}
      onContextMenu={handleContextMenu}
    >
      <div
        className="relative"
        style={{
          width: sizePx,
          height: sizePx,
        }}
      >
        <ItemTile
          item={tileModel}
          sizePx={sizePx}
          showBorder
          className={tileWidthClassName}
          fetchPriority="low"
          title=""
        />

        {patternProgress && (
          <>
            <div
              className="pointer-events-none absolute z-20"
              style={{
                inset: 0,
                border: "2px solid rgba(239, 68, 68, 0.85)",
              }}
            />
            <div
              className="pointer-events-none absolute z-30"
              style={{
                left: 0,
                right: 0,
                bottom: 0,
                height: 6,
                backgroundColor: "rgba(127, 29, 29, 0.75)",
              }}
            >
              <div
                className="h-full"
                style={{
                  width: `${patternPercent}%`,
                  backgroundColor: "rgb(239, 68, 68)",
                }}
              />
            </div>
          </>
        )}
      </div>

      {labelAreaHeight > 0 && (
        <DropSourceLabelStrip labels={dropSourceLabels} />
      )}

      <span className="sr-only">
        {itemName}
      </span>

      {(tooltipPosition || contextMenuPosition) && (
        <DestinyItemCard
          itemHash={item.itemHash}
          definition={item.definition}
          definitionIsPartial
          deferDetails
          renderTile={false}
          forcedTooltipPosition={tooltipPosition ?? undefined}
          forcedContextMenuPosition={contextMenuPosition ?? undefined}
          onCloseForcedContextMenu={() => setContextMenuPosition(null)}
          patternUnlockProgress={patternProgress ?? undefined}
          imageFetchPriority="low"
          size="large"
          hideTooltipScreenshot
        />
      )}
    </div>
  );
}

function DropSourceLabelStrip({ labels }: { labels: DropSourceLabel[] }) {
  if (labels.length === 0) {
    return (
      <div
        className="mt-1 h-4"
        aria-hidden="true"
      />
    );
  }

  const visibleLabel = labels.map((label) => label.shortLabel).join(" / ");
  const fullLabel = labels.map((label) => label.label).join(", ");

  return (
    <div
      className="mt-1 flex h-4 w-full items-center justify-center overflow-hidden border border-white/10 bg-black/45 px-1 text-center text-[10px] font-bold leading-none text-destiny-gold/90"
      title={fullLabel}
      aria-label={fullLabel}
    >
      <span className="min-w-0 truncate">{visibleLabel}</span>
    </div>
  );
}
