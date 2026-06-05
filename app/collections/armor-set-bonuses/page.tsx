"use client";

import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  Loader2,
  PackageCheck,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { DestinyItemCard } from "@/components/DestinyItemCard";
import { useDestinyProfileContext } from "@/components/DestinyProfileProvider";
import { Tooltip } from "@/components/ui/Tooltip";
import { useManifestTable } from "@/hooks/useManifestTable";
import { getBungieImage } from "@/lib/bungie";
import {
  buildBungieIconUrl,
  getClientManifestVersionCacheKey,
  normalizeBungieAssetPath,
} from "@/lib/bungieImageProxy";
import { BUCKETS } from "@/lib/destinyUtils";
import { cleanSourceText } from "@/lib/itemSourceInfo";
import { cn } from "@/lib/utils";
import { formatArmorSetBonusRequirement } from "@/lib/armorSetBonus";
import { useUIStore } from "@/store/uiStore";

type ArmorSetBonusTierModel = {
  requiredSetCount?: number;
  name: string;
  description: string;
  icon?: string;
  sandboxPerkHash?: number;
};

type ArmorSetItemModel = {
  itemHash: number;
  name: string;
  typeName: string;
  definition: any;
  icon?: string;
  watermark?: string;
  classType: number;
  bucketHash: number;
  collectibleHash?: number;
  sourceText?: string;
  isAcquired: boolean;
};

type ArmorClassProgress = {
  owned: number;
  equipped: number;
  total: number;
};

type ArmorSetCategoryModel = {
  setHash: number;
  name: string;
  sourceText: string;
  icon?: string;
  bonuses: ArmorSetBonusTierModel[];
  items: ArmorSetItemModel[];
  classProgress: Record<number, ArmorClassProgress>;
  ownedCount: number;
  equippedCount: number;
  totalCount: number;
  activeBonusCount: number;
  searchText: string;
};

type CollectionFilterValue = "all" | "one-class" | "two-classes" | "all-classes";

type CollectionFilterOption = {
  value: CollectionFilterValue;
  label: string;
  description: string;
};

type ClassCollectionSummary = {
  classType: number;
  collectedPieces: number;
  totalPieces: number;
  completeSets: number;
  totalSets: number;
  percent: number;
};

type ArmorSetCollectionSummary = {
  collectedPieces: number;
  totalPieces: number;
  percent: number;
  fullyCollectedSets: number;
  classSummaries: ClassCollectionSummary[];
};

const ARMOR_BUCKET_ORDER = [
  BUCKETS.HELMET,
  BUCKETS.GAUNTLETS,
  BUCKETS.CHEST_ARMOR,
  BUCKETS.LEG_ARMOR,
  BUCKETS.CLASS_ARMOR,
] as const;
const ARMOR_BUCKETS = new Set<number>(ARMOR_BUCKET_ORDER);
const ARMOR_CLASS_ORDER = [1, 0, 2] as const;

const CLASS_LABELS: Record<number, string> = {
  0: "Titan",
  1: "Hunter",
  2: "Warlock",
};

const CLASS_ACCENT_CLASSES: Record<number, string> = {
  0: "border-red-300/25 bg-red-300/5 text-red-100",
  1: "border-sky-300/25 bg-sky-300/5 text-sky-100",
  2: "border-violet-300/25 bg-violet-300/5 text-violet-100",
};

const CLASS_PROGRESS_BAR_CLASSES: Record<number, string> = {
  0: "bg-red-300",
  1: "bg-sky-300",
  2: "bg-violet-300",
};

const SET_SOURCE_OVERRIDES: Record<string, string> = {
  "Wild Anthem": "Portal activities and engrams",
};

const PREFERRED_SET_ORDER = [
  "New Demotic",
  "Thriving Survivor",
  "Wild Anthem",
  "Shrewd Survivor",
  "Iron Panoply Set",
  "Twofold Crown",
  "Collective Psyche",
  "Wayward Psyche Set",
  "AION Renewal",
  "AION Adapter",
  "Sage Protector",
  "Techsec",
  "Bushido",
  "Smoke Jumper Set",
  "Disaster Corps Set",
  "Swordmaster",
  "Ferropotent",
  "Last Discipline",
  "Lustrous",
];

const COLLECTION_FILTER_OPTIONS: CollectionFilterOption[] = [
  {
    value: "all",
    label: "All Sets",
    description: "Show every armor set bonus.",
  },
  {
    value: "one-class",
    label: "One Class Complete",
    description: "At least one class has all five pieces collected.",
  },
  {
    value: "two-classes",
    label: "Two Classes Complete",
    description: "At least two classes have all five pieces collected.",
  },
  {
    value: "all-classes",
    label: "All Classes Complete",
    description: "Hunter, Titan, and Warlock are all complete.",
  },
];

const COLLECTION_TOOLTIP_CONTENT_CLASS =
  "rounded border border-white/20 bg-[#0f0f0f] p-3 shadow-2xl shadow-black/50 backdrop-blur-md";
const COLLECTION_TOOLTIP_ARROW_CLASS = "border-white/20 bg-[#0f0f0f]";
const COLLAPSED_SETS_STORAGE_KEY = "warmind-armor-set-bonus-collapsed-sets";

function normalizeText(text: unknown): string {
  return typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
}

function normalizeSearchText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function readStoredCollapsedSets(): Record<number, boolean> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const storedValue = localStorage.getItem(COLLAPSED_SETS_STORAGE_KEY);

    if (!storedValue) {
      return {};
    }

    const parsedValue = JSON.parse(storedValue);

    if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
      return {};
    }

    const collapsedSets: Record<number, boolean> = {};

    for (const [setHash, isCollapsed] of Object.entries(parsedValue)) {
      const numericSetHash = Number(setHash);

      if (Number.isFinite(numericSetHash) && typeof isCollapsed === "boolean") {
        collapsedSets[numericSetHash] = isCollapsed;
      }
    }

    return collapsedSets;
  } catch {
    return {};
  }
}

function writeStoredCollapsedSets(collapsedSets: Record<number, boolean>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(COLLAPSED_SETS_STORAGE_KEY, JSON.stringify(collapsedSets));
  } catch {
    // Local UI memory is optional; ignore storage failures.
  }
}

function getNumber(value: unknown): number | undefined {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function isArmorSetPiece(itemDefinition: any): boolean {
  const bucketHash = getNumber(itemDefinition?.inventory?.bucketTypeHash);
  const setHash = getNumber(itemDefinition?.equippingBlock?.equipableItemSetHash);
  const tierType = getNumber(itemDefinition?.inventory?.tierType);

  return Boolean(bucketHash && setHash && ARMOR_BUCKETS.has(bucketHash) && tierType !== 6);
}

function getCollectibleDefinition(
  itemDefinition: any,
  collectibleTable: Record<string, any> | undefined
) {
  const collectibleHash = getNumber(itemDefinition?.collectibleHash);

  if (!collectibleHash || !collectibleTable) {
    return undefined;
  }

  return collectibleTable[String(collectibleHash)];
}

function getCollectibleState(profile: any, collectibleHash: number | undefined) {
  if (!collectibleHash) {
    return undefined;
  }

  let state = profile?.profileCollectibles?.data?.collectibles?.[collectibleHash]?.state;

  if (state === undefined && profile?.characterCollectibles?.data) {
    for (const characterCollectibles of Object.values(profile.characterCollectibles.data)) {
      const characterState = (characterCollectibles as any)?.collectibles?.[collectibleHash]?.state;

      if (characterState === undefined) {
        continue;
      }

      if ((characterState & 1) === 0) {
        return characterState;
      }

      state ??= characterState;
    }
  }

  return state;
}

function getItemIsAcquired(profile: any, collectibleHash: number | undefined): boolean {
  const collectibleState = getCollectibleState(profile, collectibleHash);

  return collectibleState !== undefined && (collectibleState & 1) === 0;
}

function getItemSourceText(itemDefinition: any, collectibleDefinition: any): string | undefined {
  return cleanSourceText(
    collectibleDefinition?.sourceString ?? itemDefinition?.sourceData?.sourceString
  );
}

function getFriendlySourceText(setName: string, sourceText: string | undefined): string {
  const sourceOverride = SET_SOURCE_OVERRIDES[setName];

  if (sourceOverride) {
    return sourceOverride;
  }

  if (!sourceText) {
    return "Unknown source";
  }

  if (sourceText.toLowerCase().startsWith("random perks:")) {
    return "Random roll armor";
  }

  return sourceText;
}

function getMostCommonSource(setName: string, items: ArmorSetItemModel[]): string {
  const sourceCounts = new Map<string, number>();

  for (const item of items) {
    const sourceText = getFriendlySourceText(setName, item.sourceText);
    sourceCounts.set(sourceText, (sourceCounts.get(sourceText) ?? 0) + 1);
  }

  return (
    Array.from(sourceCounts.entries()).sort((firstSource, secondSource) => {
      return secondSource[1] - firstSource[1] || firstSource[0].localeCompare(secondSource[0]);
    })[0]?.[0] ?? "Unknown source"
  );
}

function getSortedSetItems(items: ArmorSetItemModel[]) {
  return [...items].sort((firstItem, secondItem) => {
    const firstClassIndex = ARMOR_CLASS_ORDER.indexOf(firstItem.classType as any);
    const secondClassIndex = ARMOR_CLASS_ORDER.indexOf(secondItem.classType as any);
    const firstBucketIndex = ARMOR_BUCKET_ORDER.indexOf(firstItem.bucketHash as any);
    const secondBucketIndex = ARMOR_BUCKET_ORDER.indexOf(secondItem.bucketHash as any);

    if (firstClassIndex !== secondClassIndex) {
      return firstClassIndex - secondClassIndex;
    }

    if (firstBucketIndex !== secondBucketIndex) {
      return firstBucketIndex - secondBucketIndex;
    }

    return firstItem.name.localeCompare(secondItem.name);
  });
}

function buildEquippedCounts(
  profile: any,
  itemTable: Record<string, any> | undefined
): Record<number, Record<number, number>> {
  const equippedCounts: Record<number, Record<number, number>> = {};

  if (!profile?.characterEquipment?.data || !itemTable) {
    return equippedCounts;
  }

  for (const [characterId, equipment] of Object.entries(profile.characterEquipment.data)) {
    const classType = getNumber(profile?.characters?.data?.[characterId]?.classType);

    if (classType === undefined) {
      continue;
    }

    for (const item of (equipment as any)?.items ?? []) {
      const itemDefinition = itemTable[String(item.itemHash)];

      if (!isArmorSetPiece(itemDefinition)) {
        continue;
      }

      const setHash = getNumber(itemDefinition.equippingBlock?.equipableItemSetHash);

      if (!setHash) {
        continue;
      }

      equippedCounts[setHash] ??= {};
      equippedCounts[setHash][classType] = (equippedCounts[setHash][classType] ?? 0) + 1;
    }
  }

  return equippedCounts;
}

function buildArmorSetSearchText(setCategory: Omit<ArmorSetCategoryModel, "searchText">) {
  const itemText = setCategory.items.flatMap((item) => [
    item.name,
    item.typeName,
    CLASS_LABELS[item.classType],
    item.sourceText,
  ]);
  const bonusText = setCategory.bonuses.flatMap((bonus) => [
    bonus.name,
    bonus.description,
    formatArmorSetBonusRequirement(bonus.requiredSetCount),
  ]);

  return normalizeSearchText(
    [setCategory.name, setCategory.sourceText, ...bonusText, ...itemText].join(" ")
  );
}

function buildArmorSetCategories({
  itemTable,
  equipableItemSetTable,
  sandboxPerkTable,
  collectibleTable,
  profile,
}: {
  itemTable: Record<string, any> | undefined;
  equipableItemSetTable: Record<string, any> | undefined;
  sandboxPerkTable: Record<string, any> | undefined;
  collectibleTable: Record<string, any> | undefined;
  profile: any;
}): ArmorSetCategoryModel[] {
  if (!itemTable || !equipableItemSetTable || !sandboxPerkTable) {
    return [];
  }

  const equippedCounts = buildEquippedCounts(profile, itemTable);
  const itemsBySetHash = new Map<number, ArmorSetItemModel[]>();

  for (const itemDefinition of Object.values(itemTable)) {
    if (!isArmorSetPiece(itemDefinition)) {
      continue;
    }

    const setHash = getNumber(itemDefinition.equippingBlock?.equipableItemSetHash);
    const itemHash = getNumber(itemDefinition.hash);
    const classType = getNumber(itemDefinition.classType);
    const bucketHash = getNumber(itemDefinition.inventory?.bucketTypeHash);

    if (!setHash || !itemHash || classType === undefined || !bucketHash) {
      continue;
    }

    const setDefinition = equipableItemSetTable[String(setHash)];
    const setPerks = Array.isArray(setDefinition?.setPerks) ? setDefinition.setPerks : [];

    if (setPerks.length === 0) {
      continue;
    }

    const collectibleDefinition = getCollectibleDefinition(itemDefinition, collectibleTable);
    const collectibleHash = getNumber(itemDefinition.collectibleHash);
    const setItems = itemsBySetHash.get(setHash) ?? [];

    setItems.push({
      itemHash,
      name: normalizeText(itemDefinition.displayProperties?.name) || String(itemHash),
      typeName: normalizeText(itemDefinition.itemTypeDisplayName),
      definition: itemDefinition,
      icon: itemDefinition.displayProperties?.icon,
      watermark: itemDefinition.iconWatermark || itemDefinition.iconWatermarkShelved,
      classType,
      bucketHash,
      collectibleHash,
      sourceText: getItemSourceText(itemDefinition, collectibleDefinition),
      isAcquired: getItemIsAcquired(profile, collectibleHash),
    });
    itemsBySetHash.set(setHash, setItems);
  }

  return Array.from(itemsBySetHash.entries())
    .flatMap(([setHash, rawItems]) => {
      const setDefinition = equipableItemSetTable[String(setHash)];
      const setName = normalizeText(setDefinition?.displayProperties?.name) || `Set ${setHash}`;
      const setPerks = Array.isArray(setDefinition?.setPerks)
        ? (setDefinition.setPerks as any[])
        : [];
      const bonuses: ArmorSetBonusTierModel[] = setPerks
        .map((setPerk: any): ArmorSetBonusTierModel | null => {
          const sandboxPerkHash = getNumber(setPerk?.sandboxPerkHash);
          const sandboxPerkDefinition = sandboxPerkHash
            ? sandboxPerkTable[String(sandboxPerkHash)]
            : undefined;
          const name = normalizeText(sandboxPerkDefinition?.displayProperties?.name);
          const description = normalizeText(sandboxPerkDefinition?.displayProperties?.description);

          if (!name && !description) {
            return null;
          }

          return {
            requiredSetCount: getNumber(setPerk?.requiredSetCount),
            name,
            description,
            icon: sandboxPerkDefinition?.displayProperties?.icon,
            sandboxPerkHash,
          };
        })
        .filter((bonus): bonus is ArmorSetBonusTierModel => Boolean(bonus))
        .sort((firstBonus, secondBonus) => {
          return (firstBonus.requiredSetCount ?? 0) - (secondBonus.requiredSetCount ?? 0);
        });

      if (bonuses.length === 0) {
        return [];
      }

      const items = getSortedSetItems(rawItems);
      const sourceText = getMostCommonSource(setName, items);
      const classProgress: Record<number, ArmorClassProgress> = {};
      let equippedCount = 0;

      for (const classType of ARMOR_CLASS_ORDER) {
        const classItems = items.filter((item) => item.classType === classType);
        const equipped = equippedCounts[setHash]?.[classType] ?? 0;

        classProgress[classType] = {
          owned: classItems.filter((item) => item.isAcquired).length,
          equipped,
          total: classItems.length,
        };
        equippedCount = Math.max(equippedCount, equipped);
      }

      const categoryWithoutSearchText = {
        setHash,
        name: setName,
        sourceText,
        icon:
          bonuses.find((bonus) => bonus.icon)?.icon ||
          setDefinition?.displayProperties?.icon ||
          items.find((item) => item.icon)?.icon,
        bonuses,
        items,
        classProgress,
        ownedCount: items.filter((item) => item.isAcquired).length,
        equippedCount,
        totalCount: items.length,
        activeBonusCount: bonuses.filter((bonus) => {
          return bonus.requiredSetCount !== undefined && equippedCount >= bonus.requiredSetCount;
        }).length,
      };

      return [
        {
          ...categoryWithoutSearchText,
          searchText: buildArmorSetSearchText(categoryWithoutSearchText),
        },
      ];
    })
    .sort((firstSet, secondSet) => {
      const firstPreferredIndex = PREFERRED_SET_ORDER.indexOf(firstSet.name);
      const secondPreferredIndex = PREFERRED_SET_ORDER.indexOf(secondSet.name);

      if (firstPreferredIndex !== -1 || secondPreferredIndex !== -1) {
        return (
          (firstPreferredIndex === -1 ? Number.MAX_SAFE_INTEGER : firstPreferredIndex) -
          (secondPreferredIndex === -1 ? Number.MAX_SAFE_INTEGER : secondPreferredIndex)
        );
      }

      return firstSet.name.localeCompare(secondSet.name);
    });
}

function getCompleteClassCount(setCategory: ArmorSetCategoryModel): number {
  return ARMOR_CLASS_ORDER.filter((classType) => {
    const progress = setCategory.classProgress[classType];

    return progress.total > 0 && progress.owned === progress.total;
  }).length;
}

function getCollectionPercent(collectedPieces: number, totalPieces: number): number {
  if (totalPieces <= 0) {
    return 0;
  }

  return Math.round((collectedPieces / totalPieces) * 100);
}

function getClassCollectionSummary(
  setCategories: ArmorSetCategoryModel[],
  classType: number
): ClassCollectionSummary {
  let collectedPieces = 0;
  let totalPieces = 0;
  let completeSets = 0;
  let totalSets = 0;

  for (const setCategory of setCategories) {
    const classProgress = setCategory.classProgress[classType];

    if (!classProgress || classProgress.total <= 0) {
      continue;
    }

    collectedPieces += classProgress.owned;
    totalPieces += classProgress.total;
    totalSets += 1;

    if (classProgress.owned === classProgress.total) {
      completeSets += 1;
    }
  }

  return {
    classType,
    collectedPieces,
    totalPieces,
    completeSets,
    totalSets,
    percent: getCollectionPercent(collectedPieces, totalPieces),
  };
}

function getArmorSetCollectionSummary(
  setCategories: ArmorSetCategoryModel[]
): ArmorSetCollectionSummary {
  const collectedPieces = setCategories.reduce((total, setCategory) => {
    return total + setCategory.ownedCount;
  }, 0);
  const totalPieces = setCategories.reduce((total, setCategory) => {
    return total + setCategory.totalCount;
  }, 0);
  const fullyCollectedSets = setCategories.filter((setCategory) => {
    return setCategory.totalCount > 0 && setCategory.ownedCount === setCategory.totalCount;
  }).length;

  return {
    collectedPieces,
    totalPieces,
    percent: getCollectionPercent(collectedPieces, totalPieces),
    fullyCollectedSets,
    classSummaries: ARMOR_CLASS_ORDER.map((classType) =>
      getClassCollectionSummary(setCategories, classType)
    ),
  };
}

function matchesCollectionFilter(
  setCategory: ArmorSetCategoryModel,
  collectionFilter: CollectionFilterValue
): boolean {
  const completeClassCount = getCompleteClassCount(setCategory);

  switch (collectionFilter) {
    case "one-class":
      return completeClassCount >= 1;
    case "two-classes":
      return completeClassCount >= 2;
    case "all-classes":
      return completeClassCount === ARMOR_CLASS_ORDER.length;
    case "all":
    default:
      return true;
  }
}

function getVisibleSetCategories(
  setCategories: ArmorSetCategoryModel[],
  searchQuery: string,
  collectionFilter: CollectionFilterValue
) {
  const searchTerms = normalizeSearchText(searchQuery).split(" ").filter(Boolean);

  return setCategories.filter((setCategory) => {
    if (!matchesCollectionFilter(setCategory, collectionFilter)) {
      return false;
    }

    return searchTerms.every((searchTerm) => setCategory.searchText.includes(searchTerm));
  });
}

function getViewportFlags() {
  if (typeof window === "undefined") {
    return { isWide: false, isVeryWide: false };
  }

  return {
    isWide: window.innerWidth >= 1280,
    isVeryWide: window.innerWidth >= 1536,
  };
}

function useViewportFlags() {
  const [viewportFlags, setViewportFlags] = useState({
    isWide: false,
    isVeryWide: false,
  });

  useEffect(() => {
    const updateViewportFlags = () => setViewportFlags(getViewportFlags());

    updateViewportFlags();
    window.addEventListener("resize", updateViewportFlags);
    return () => window.removeEventListener("resize", updateViewportFlags);
  }, []);

  return viewportFlags;
}

function getIconSource(iconPath: string | undefined, sizePx: number): string | null {
  const normalizedPath = normalizeBungieAssetPath(iconPath);

  if (!normalizedPath) {
    return null;
  }

  return buildBungieIconUrl(normalizedPath, sizePx * 2, getClientManifestVersionCacheKey());
}

function IconTooltipContent({
  title,
  eyebrow,
  lines,
}: {
  title: string;
  eyebrow?: string;
  lines?: string[];
}) {
  return (
    <div className="max-w-64">
      {eyebrow && (
        <p className="text-[10px] font-bold uppercase tracking-wide text-destiny-gold">
          {eyebrow}
        </p>
      )}
      <p className="text-sm font-semibold leading-tight text-white">{title}</p>
      {lines?.map((line) => (
        <p key={line} className="mt-1 text-xs leading-relaxed text-slate-300">
          {line}
        </p>
      ))}
    </div>
  );
}

function BonusIcon({
  icon,
  name,
}: {
  icon?: string;
  name: string;
}) {
  const iconSource = icon ? getBungieImage(icon) : null;

  return (
    <div
      className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-sky-200/40 bg-sky-400/70 shadow-[0_0_18px_rgba(125,190,230,0.25)]"
      aria-hidden="true"
    >
      {iconSource ? (
        <Image src={iconSource} alt="" fill sizes="44px" className="object-cover" />
      ) : (
        <Sparkles className="h-5 w-5 text-white" aria-hidden="true" />
      )}
      <span className="sr-only">{name}</span>
    </div>
  );
}

function ArmorSetBonusTier({
  bonus,
  isActive,
}: {
  bonus: ArmorSetBonusTierModel;
  isActive: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-full gap-3 border-l border-white/10 py-2 pl-3 transition-colors",
        isActive && "border-destiny-gold"
      )}
    >
      <BonusIcon icon={bonus.icon} name={bonus.name} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-destiny-gold">
            {formatArmorSetBonusRequirement(bonus.requiredSetCount)}
          </span>
          {isActive && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-destiny-gold">
              Active
            </span>
          )}
        </div>
        {bonus.name && <p className="mt-1 font-semibold leading-tight text-white">{bonus.name}</p>}
        {bonus.description && (
          <p className="mt-1 text-sm leading-relaxed text-slate-300">{bonus.description}</p>
        )}
      </div>
    </div>
  );
}

type HoverPosition = {
  x: number;
  y: number;
};

function getHoverPosition(event: MouseEvent<HTMLElement>): HoverPosition {
  return {
    x: event.clientX,
    y: event.clientY,
  };
}

function ArmorSetItemIcon({ item }: { item: ArmorSetItemModel }) {
  const [tooltipPosition, setTooltipPosition] = useState<HoverPosition | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<HoverPosition | null>(null);
  const iconSource = getIconSource(item.icon, 96);
  const watermarkSource = getIconSource(item.watermark, 96);

  const updateTooltipPosition = (event: MouseEvent<HTMLDivElement>) => {
    if (!contextMenuPosition) {
      setTooltipPosition(getHoverPosition(event));
    }
  };

  const hideTooltip = () => {
    setTooltipPosition(null);
  };

  const openContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setTooltipPosition(null);
    setContextMenuPosition(getHoverPosition(event));
  };

  return (
    <div
      className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden border-r border-white/10 bg-slate-900"
      onMouseEnter={updateTooltipPosition}
      onMouseMove={updateTooltipPosition}
      onMouseLeave={hideTooltip}
      onContextMenu={openContextMenu}
    >
      {iconSource ? (
        <Image src={iconSource} alt="" fill sizes="48px" className="object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <ShieldCheck className="h-5 w-5 text-slate-500" aria-hidden="true" />
        </div>
      )}
      {watermarkSource && (
        <Image src={watermarkSource} alt="" fill sizes="48px" className="object-cover" />
      )}

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
          imageFetchPriority="low"
          size="large"
          hideTooltipScreenshot
        />
      )}
    </div>
  );
}

function ArmorSetItemRow({
  item,
  showCollectionState,
}: {
  item: ArmorSetItemModel;
  showCollectionState: boolean;
}) {
  return (
    <Link
      href={`/item/${item.itemHash}`}
      style={{
        display: "grid",
        gridTemplateColumns: "48px minmax(0, 1fr) auto",
        alignItems: "center",
      }}
      className={cn(
        "armor-set-item-row group min-h-12 border border-white/10 bg-black/30 text-left transition-colors hover:border-white/30 hover:bg-white/5",
        showCollectionState && !item.isAcquired && "opacity-55"
      )}
    >
      <ArmorSetItemIcon item={item} />

      <div className="min-w-0 flex-1 px-3 py-2">
        <p className="truncate text-sm font-semibold text-slate-200 group-hover:text-white">
          {item.name}
        </p>
        <p className="truncate text-xs text-slate-500">{item.typeName}</p>
      </div>

      {showCollectionState && (
        <div className="px-3 text-slate-500">
          <Tooltip
            side="left"
            delay={120}
            content={item.isAcquired ? "Collected" : "Not collected"}
            contentClassName={COLLECTION_TOOLTIP_CONTENT_CLASS}
            arrowClassName={COLLECTION_TOOLTIP_ARROW_CLASS}
          >
            {item.isAcquired ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-label="Collected" />
            ) : (
              <Circle className="h-4 w-4" aria-label="Not collected" />
            )}
          </Tooltip>
        </div>
      )}
    </Link>
  );
}

function ArmorClassColumn({
  classType,
  items,
  progress,
  showCollectionState,
}: {
  classType: number;
  items: ArmorSetItemModel[];
  progress: ArmorClassProgress;
  showCollectionState: boolean;
}) {
  return (
    <div className="min-w-0">
      <div
        className={cn(
          "mb-2 flex min-h-9 items-center justify-between border px-3 text-xs font-bold uppercase tracking-wide",
          CLASS_ACCENT_CLASSES[classType]
        )}
      >
        <span>{CLASS_LABELS[classType]}</span>
        <span className="text-slate-400">
          {showCollectionState ? `${progress.owned}/${progress.total}` : `${progress.total} pieces`}
          {progress.equipped > 0 ? `, ${progress.equipped} eq` : ""}
        </span>
      </div>

      <div className="grid gap-2">
        {items.map((item) => (
          <ArmorSetItemRow
            key={item.itemHash}
            item={item}
            showCollectionState={showCollectionState}
          />
        ))}
      </div>
    </div>
  );
}

function ArmorSetCategory({
  setCategory,
  isCollapsed,
  showCollectionState,
  isVeryWide,
  onToggle,
}: {
  setCategory: ArmorSetCategoryModel;
  isCollapsed: boolean;
  showCollectionState: boolean;
  isVeryWide: boolean;
  onToggle: () => void;
}) {
  const setIconSource = setCategory.icon ? getBungieImage(setCategory.icon) : null;
  const activeRequiredCounts = new Set(
    setCategory.bonuses
      .filter((bonus) => bonus.requiredSetCount !== undefined)
      .filter((bonus) => setCategory.equippedCount >= (bonus.requiredSetCount ?? 0))
      .map((bonus) => bonus.requiredSetCount)
  );

  return (
    <section className="border-t border-white/10 py-6 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!isCollapsed}
        className="group flex w-full items-center gap-3 text-left"
      >
        <ChevronRight
          className={cn(
            "h-5 w-5 shrink-0 text-slate-500 transition-transform group-hover:text-white",
            !isCollapsed && "rotate-90 text-destiny-gold"
          )}
          aria-hidden="true"
        />
        <Tooltip
          side="right"
          delay={120}
          content={
            <IconTooltipContent
              eyebrow="Armor Set"
              title={setCategory.name}
              lines={[
                `Source: ${setCategory.sourceText}`,
                showCollectionState
                  ? `${setCategory.ownedCount}/${setCategory.totalCount} pieces collected`
                  : `${setCategory.totalCount} pieces`,
                setCategory.equippedCount > 0
                  ? `${setCategory.equippedCount}/5 pieces equipped on one class`
                  : "",
              ].filter(Boolean)}
            />
          }
          contentClassName={COLLECTION_TOOLTIP_CONTENT_CLASS}
          arrowClassName={COLLECTION_TOOLTIP_ARROW_CLASS}
        >
          <div className="relative h-11 w-11 shrink-0 overflow-hidden border border-white/10 bg-white/5">
            {setIconSource ? (
              <Image src={setIconSource} alt="" fill sizes="44px" className="object-cover" />
            ) : (
              <ShieldCheck className="m-3 h-5 w-5 text-slate-500" aria-hidden="true" />
            )}
          </div>
        </Tooltip>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold text-white">{setCategory.name}</h2>
          <p className="truncate text-sm italic text-slate-500">Source: {setCategory.sourceText}</p>
        </div>

        <div className="hidden flex-wrap justify-end gap-2 md:flex">
          {showCollectionState && (
            <span className="text-xs font-semibold text-slate-500">
              {`${setCategory.ownedCount}/${setCategory.totalCount} collected`}
            </span>
          )}
          {setCategory.equippedCount > 0 && (
            <span className="text-xs font-semibold text-slate-500">
              {`${setCategory.equippedCount}/5 equipped`}
            </span>
          )}
          {setCategory.activeBonusCount > 0 && (
            <span className="inline-flex min-h-6 items-center gap-1 text-xs font-bold text-destiny-gold">
              <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {`${setCategory.activeBonusCount} active`}
            </span>
          )}
        </div>
      </button>

      {!isCollapsed && (
        <div
          className="armor-set-detail-grid mt-5"
          style={{
            display: "grid",
            gap: "1.25rem",
            gridTemplateColumns: isVeryWide ? "430px minmax(0, 1fr)" : undefined,
          }}
        >
          <div className="relative overflow-hidden py-2">
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(148,163,184,0.28) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.28) 1px, transparent 1px)",
                backgroundSize: "16px 16px",
              }}
            />
            <div className="relative grid gap-3">
              {setCategory.bonuses.map((bonus) => (
                <ArmorSetBonusTier
                  key={`${bonus.requiredSetCount ?? "bonus"}-${bonus.sandboxPerkHash ?? bonus.name}`}
                  bonus={bonus}
                  isActive={activeRequiredCounts.has(bonus.requiredSetCount)}
                />
              ))}
            </div>
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-3">
            {ARMOR_CLASS_ORDER.map((classType) => (
              <ArmorClassColumn
                key={classType}
                classType={classType}
                items={setCategory.items.filter((item) => item.classType === classType)}
                progress={setCategory.classProgress[classType]}
                showCollectionState={showCollectionState}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function SidebarCollectionProgress({
  collectionSummary,
  showCollectionState,
  totalSetCount,
}: {
  collectionSummary: ArmorSetCollectionSummary;
  showCollectionState: boolean;
  totalSetCount: number;
}) {
  if (!showCollectionState) {
    return (
      <div className="mt-5 border-l-2 border-white/10 pl-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Collection Progress
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Sign in with Bungie to show collection percent and complete sets by class.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <div>
        <div className="flex items-end justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Total Collection
          </p>
          <p className="text-3xl font-semibold leading-none text-white">
            {collectionSummary.percent}%
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden bg-white/10">
          <div
            className="h-full bg-destiny-gold"
            style={{ width: `${collectionSummary.percent}%` }}
          />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          {collectionSummary.collectedPieces} of {collectionSummary.totalPieces} pieces,{" "}
          {collectionSummary.fullyCollectedSets} of {totalSetCount} full sets.
        </p>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Complete Sets By Class
        </p>
        <div className="mt-2 space-y-2">
          {collectionSummary.classSummaries.map((classSummary) => (
            <div key={classSummary.classType}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-slate-300">
                  {CLASS_LABELS[classSummary.classType]}
                </span>
                <span className="font-bold text-white">
                  {classSummary.completeSets} / {classSummary.totalSets} sets
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden bg-white/10">
                <div
                  className={cn("h-full", CLASS_PROGRESS_BAR_CLASSES[classSummary.classType])}
                  style={{ width: `${classSummary.percent}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {classSummary.percent}% pieces collected, {classSummary.collectedPieces} /{" "}
                {classSummary.totalPieces}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ArmorSetBonusesPage() {
  const { profile, isLoading: profileLoading, isLoggedIn } = useDestinyProfileContext();
  const {
    headerSearchQuery,
    setHeaderSearchQuery,
    setHeaderSearchVisible,
    setHeaderSearchPlaceholder,
  } = useUIStore();
  const { table: itemTable, isLoading: itemsLoading } = useManifestTable<any>(
    "DestinyInventoryItemDefinition",
    { view: "card" }
  );
  const { table: equipableItemSetTable, isLoading: setsLoading } =
    useManifestTable<any>("DestinyEquipableItemSetDefinition");
  const { table: sandboxPerkTable, isLoading: perksLoading } =
    useManifestTable<any>("DestinySandboxPerkDefinition");
  const { table: collectibleTable } = useManifestTable<any>("DestinyCollectibleDefinition");
  const [collapsedSets, setCollapsedSets] = useState<Record<number, boolean>>(
    () => readStoredCollapsedSets()
  );
  const [collectionFilter, setCollectionFilter] = useState<CollectionFilterValue>("all");
  const deferredSearchQuery = useDeferredValue(headerSearchQuery);
  const { isWide, isVeryWide } = useViewportFlags();
  const isSearching = Boolean(deferredSearchQuery.trim());
  const showCollectionState = Boolean(
    profile?.profileCollectibles?.data || profile?.characterCollectibles?.data
  );

  useEffect(() => {
    setHeaderSearchVisible(true);
    setHeaderSearchPlaceholder("Search armor set bonuses");

    return () => {
      setHeaderSearchVisible(false);
      setHeaderSearchPlaceholder("Search");
      setHeaderSearchQuery("");
    };
  }, [setHeaderSearchPlaceholder, setHeaderSearchQuery, setHeaderSearchVisible]);

  useEffect(() => {
    if (!showCollectionState && collectionFilter !== "all") {
      setCollectionFilter("all");
    }
  }, [collectionFilter, showCollectionState]);

  useEffect(() => {
    writeStoredCollapsedSets(collapsedSets);
  }, [collapsedSets]);

  const setCategories = useMemo(
    () =>
      buildArmorSetCategories({
        itemTable,
        equipableItemSetTable,
        sandboxPerkTable,
        collectibleTable,
        profile,
      }),
    [collectibleTable, equipableItemSetTable, itemTable, profile, sandboxPerkTable]
  );
  const visibleSetCategories = useMemo(
    () => getVisibleSetCategories(setCategories, deferredSearchQuery, collectionFilter),
    [collectionFilter, deferredSearchQuery, setCategories]
  );
  const collectionSummary = useMemo(
    () => getArmorSetCollectionSummary(setCategories),
    [setCategories]
  );
  const isLoading = itemsLoading || setsLoading || perksLoading;
  const allVisibleSetsCollapsed =
    visibleSetCategories.length > 0 &&
    visibleSetCategories.every((setCategory) => collapsedSets[setCategory.setHash]);

  const setAllCollapsed = (isCollapsed: boolean) => {
    const nextCollapsedSets: Record<number, boolean> = {};

    for (const setCategory of visibleSetCategories) {
      nextCollapsedSets[setCategory.setHash] = isCollapsed;
    }

    setCollapsedSets((currentCollapsedSets) => ({
      ...currentCollapsedSets,
      ...nextCollapsedSets,
    }));
  };

  return (
    <div className="min-h-[calc(100dvh-8rem)] text-slate-100">
      <div
        className="armor-set-page-layout"
        style={{
          display: "grid",
          gap: "2rem",
          gridTemplateColumns: isWide ? "320px minmax(0, 1fr)" : undefined,
        }}
      >
        <aside
          className="armor-set-page-sidebar self-start border-white/10"
          style={
            isWide
              ? {
                  position: "sticky",
                  top: "6rem",
                  borderRight: "1px solid rgba(255, 255, 255, 0.1)",
                  paddingRight: "2rem",
                }
              : undefined
          }
        >
          <h1 className="text-3xl font-semibold tracking-tight text-white">Armor Set Bonuses</h1>
          <SidebarCollectionProgress
            collectionSummary={collectionSummary}
            showCollectionState={showCollectionState}
            totalSetCount={setCategories.length}
          />

          <div className={cn("relative mt-6", isLoggedIn && "lg:hidden")}>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search armor set bonuses"
              className="w-full border border-white/10 bg-black/45 py-2 pl-9 pr-4 text-sm text-white outline-none transition-colors focus:border-destiny-gold/60"
              value={headerSearchQuery}
              onChange={(event) => setHeaderSearchQuery(event.target.value)}
            />
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setAllCollapsed(!allVisibleSetsCollapsed)}
              aria-pressed={allVisibleSetsCollapsed}
              className="w-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-300 transition-colors hover:border-white/30 hover:text-white"
            >
              {allVisibleSetsCollapsed ? "Expand All" : "Collapse All"}
            </button>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Collection Filter
            </p>
            <div className="grid gap-1">
              {COLLECTION_FILTER_OPTIONS.map((filterOption) => {
                const isSelected = collectionFilter === filterOption.value;
                const isProgressFilter = filterOption.value !== "all";
                const isDisabled = isProgressFilter && !showCollectionState;
                const tooltipText = isDisabled
                  ? "Sign in or load collection data to use this progress filter."
                  : filterOption.description;

                return (
                  <Tooltip
                    key={filterOption.value}
                    side="right"
                    delay={120}
                    content={tooltipText}
                    contentClassName={COLLECTION_TOOLTIP_CONTENT_CLASS}
                    arrowClassName={COLLECTION_TOOLTIP_ARROW_CLASS}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!isDisabled) {
                          setCollectionFilter(filterOption.value);
                        }
                      }}
                      aria-pressed={isSelected}
                      disabled={isDisabled}
                      className={cn(
                        "w-full border-l-2 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide transition-colors",
                        isSelected
                          ? "border-destiny-gold bg-destiny-gold/10 text-destiny-gold"
                          : "border-white/10 text-slate-400 hover:border-white/40 hover:bg-white/5 hover:text-white",
                        isDisabled && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-slate-400"
                      )}
                    >
                      {filterOption.label}
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          {isLoading || (profileLoading && !profile) ? (
            <div className="flex min-h-80 items-center justify-center text-slate-400">
              <Loader2 className="mr-3 h-5 w-5 animate-spin text-destiny-gold" />
              Loading armor set bonuses...
            </div>
          ) : visibleSetCategories.length === 0 ? (
            <div className="border border-white/10 bg-black/20 p-8 text-center text-slate-400">
              No armor set bonuses found.
            </div>
          ) : (
            visibleSetCategories.map((setCategory) => (
              <ArmorSetCategory
                key={setCategory.setHash}
                setCategory={setCategory}
                isCollapsed={!isSearching && Boolean(collapsedSets[setCategory.setHash])}
                showCollectionState={showCollectionState}
                isVeryWide={isVeryWide}
                onToggle={() =>
                  setCollapsedSets((currentCollapsedSets) => ({
                    ...currentCollapsedSets,
                    [setCategory.setHash]: !currentCollapsedSets[setCategory.setHash],
                  }))
                }
              />
            ))
          )}
        </section>
      </div>
    </div>
  );
}
