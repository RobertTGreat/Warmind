"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useRef, useState, type RefObject } from "react";
import { useDestinyProfileContext } from "@/components/DestinyProfileProvider";
import { useItemDefinitions } from "@/hooks/useItemDefinitions";
import { useClarityDescriptions } from "@/hooks/useClarityDescriptions";
import { useManifestTable } from "@/hooks/useManifestTable";
import { usePlugSetDefinitions } from "@/hooks/usePlugSetDefinitions";
import { getBungieImage } from "@/lib/bungie";
import {
  formatArmorSetBonusRequirement,
  getArmorSetBonusInfo,
  isArmorSetBonusItem,
  type ArmorSetBonusInfo,
} from "@/lib/armorSetBonus";
import {
  getExoticArmorTraitPlugs,
  getPlugDisplayText,
  getPlugHash,
  getPlugTypeText,
} from "@/lib/armorTraits";
import {
  buildWeaponSocketGroups,
  collectWeaponPlugHashes,
  getWeaponPlugSetHashes,
  isFunctionalWeaponPerk,
  type WeaponPlugOption,
  type WeaponSocketGroup,
} from "@/lib/weaponPlugAnalysis";
import { cn } from "@/lib/utils";
import { STAT_NAMES_BY_HASH } from "@/lib/dim-stats";
import { STAT_HASHES } from "@/lib/destinyUtils";
import {
  getItemSourceInfo,
  type ItemSourceInfo,
} from "@/lib/itemSourceInfo";
import type { ClarityDescription } from "@/lib/clarityDescriptions";

interface WeaponDetailsPageClientProps {
  itemHash: number;
  instanceId?: string;
  ownerId?: string;
  isOverlay?: boolean;
  onSelectCopy?: (copy: OwnedWeaponCopy) => void;
}

interface OwnedWeaponCopy {
  itemHash: number;
  itemInstanceId: string;
  ownerId: string;
  ownerName: string;
  locationName: string;
}

type TooltipAlignment = "left" | "center" | "right";
type TooltipVerticalPlacement = "top" | "bottom";

interface DetailStatRow {
  statHash: number;
  name: string;
  value: number;
  maximum: number;
}

const weaponStatHashes = [
  4043523819, // Impact
  1240592695, // Range
  155624089, // Stability
  943549884, // Handling
  4188031367, // Reload Speed
  4284893193, // Rounds Per Minute
  3871231066, // Magazine
  1345609583, // Aim Assistance
  2714457168, // Airborne Effectiveness
  2715839340, // Recoil Direction
  3555269338, // Zoom
];

const armorStatHashes = [
  STAT_HASHES.RESILIENCE, // Health
  STAT_HASHES.STRENGTH, // Melee
  STAT_HASHES.DISCIPLINE, // Grenade
  STAT_HASHES.INTELLECT, // Super
  STAT_HASHES.RECOVERY, // Class
  STAT_HASHES.MOBILITY, // Weapons
];

const armorStatNames: Record<number, string> = {
  [STAT_HASHES.RESILIENCE]: "Health",
  [STAT_HASHES.STRENGTH]: "Melee",
  [STAT_HASHES.DISCIPLINE]: "Grenade",
  [STAT_HASHES.INTELLECT]: "Super",
  [STAT_HASHES.RECOVERY]: "Class",
  [STAT_HASHES.MOBILITY]: "Weapons",
};

const hiddenDetailStatHashes = new Set([
  3481294762,
  4006394725,
  1885944937,
  3209419233,
]);

const fallbackElementIconsByDamageTypeHash: Record<number, string> = {
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

function getCharacterOwnerName(profile: any, characterId: string): string {
  const character = profile?.characters?.data?.[characterId];
  const classNames: Record<number, string> = {
    0: "Titan",
    1: "Hunter",
    2: "Warlock",
  };

  return character ? classNames[character.classType] ?? "Character" : "Character";
}

function getOwnedWeaponCopies(profile: any, itemHash: number): OwnedWeaponCopy[] {
  const copies: OwnedWeaponCopy[] = [];
  const addCopy = (item: any, ownerId: string, locationName: string) => {
    if (item?.itemHash !== itemHash || !item?.itemInstanceId) return;

    copies.push({
      itemHash: item.itemHash,
      itemInstanceId: item.itemInstanceId,
      ownerId,
      ownerName:
        ownerId === "VAULT" ? "Vault" : getCharacterOwnerName(profile, ownerId),
      locationName,
    });
  };

  for (const [characterId, inventory] of Object.entries(
    profile?.characterInventories?.data ?? {}
  )) {
    for (const item of (inventory as any)?.items ?? []) {
      addCopy(item, characterId, "Inventory");
    }
  }

  for (const [characterId, equipment] of Object.entries(
    profile?.characterEquipment?.data ?? {}
  )) {
    for (const item of (equipment as any)?.items ?? []) {
      addCopy(item, characterId, "Equipped");
    }
  }

  for (const item of profile?.profileInventory?.data?.items ?? []) {
    addCopy(item, "VAULT", "Vault");
  }

  return copies;
}

function getSocketColumnTitle(socketGroup: WeaponSocketGroup): string {
  const activePlug = socketGroup.activePlugDefinition;
  const typeName = activePlug?.itemTypeDisplayName;
  const category = socketGroup.categoryIdentifier;

  if (socketGroup.isIntrinsic) return "Intrinsic";
  if (socketGroup.isMasterworkColumn) return "Masterwork";
  if (socketGroup.isOriginColumn) return "Origin Trait";
  if (typeName) return typeName;
  if (category.includes("barrels")) return "Barrel";
  if (category.includes("magazines")) return "Magazine";

  return `Column ${socketGroup.socketIndex + 1}`;
}

function getOptionIcon(option: WeaponPlugOption): string | null {
  const icon = option.definition?.displayProperties?.icon;
  return icon ? getBungieImage(icon) : null;
}

function getDefinitionStatValue(itemDefinition: any, statHash: number): number | null {
  const stat = itemDefinition?.stats?.stats?.[statHash];
  const investmentStat = itemDefinition?.investmentStats?.find(
    (candidate: any) => candidate.statTypeHash === statHash
  );

  return stat?.value ?? investmentStat?.value ?? null;
}

function getWeaponStatName(statHash: number): string {
  return STAT_NAMES_BY_HASH[statHash] ?? `Stat ${statHash}`;
}

function getArmorStatName(statHash: number): string {
  return armorStatNames[statHash] ?? getWeaponStatName(statHash);
}

function getItemStatValue(
  itemDefinition: any,
  instanceData: any,
  statsData: any,
  statHash: number
): number | null {
  return (
    statsData?.[statHash]?.value ??
    statsData?.[String(statHash)]?.value ??
    instanceData?.stats?.[statHash]?.value ??
    instanceData?.stats?.[String(statHash)]?.value ??
    getDefinitionStatValue(itemDefinition, statHash)
  );
}

function collectAvailableStatHashes(
  itemDefinition: any,
  statsData: any,
  preferredStatHashes: number[]
): number[] {
  const statHashes = new Set<number>();
  const addStatHash = (statHash: unknown) => {
    const numericStatHash = Number(statHash);

    if (Number.isFinite(numericStatHash)) {
      statHashes.add(numericStatHash);
    }
  };

  preferredStatHashes.forEach(addStatHash);
  Object.keys(statsData ?? {}).forEach(addStatHash);
  Object.keys(itemDefinition?.stats?.stats ?? {}).forEach(addStatHash);

  for (const investmentStat of itemDefinition?.investmentStats ?? []) {
    addStatHash(investmentStat?.statTypeHash);
  }

  return Array.from(statHashes);
}

function getMaximumForStat(value: number, isArmor: boolean): number {
  if (isArmor) return 100;

  return Math.max(100, value);
}

function getDetailStatRows(
  itemDefinition: any,
  instanceData: any,
  statsData: any,
  isArmor: boolean
): DetailStatRow[] {
  const preferredStatHashes = isArmor ? armorStatHashes : weaponStatHashes;

  return collectAvailableStatHashes(itemDefinition, statsData, preferredStatHashes)
    .map((statHash) => {
      const value = getItemStatValue(itemDefinition, instanceData, statsData, statHash);

      return value === null || value === undefined
        ? null
        : {
            statHash,
            name: isArmor ? getArmorStatName(statHash) : getWeaponStatName(statHash),
            value,
            maximum: getMaximumForStat(value, isArmor),
          };
    })
    .filter((statRow): statRow is DetailStatRow => {
      if (!statRow) return false;
      if (hiddenDetailStatHashes.has(statRow.statHash)) return false;

      return !["Attack", "Defense", "Power"].includes(statRow.name);
    });
}

function getWeaponStatRows(
  itemDefinition: any,
  instanceData: any,
  statsData: any
): DetailStatRow[] {
  return getDetailStatRows(itemDefinition, instanceData, statsData, false);
}

function getArmorStatRows(
  itemDefinition: any,
  instanceData: any,
  statsData: any
): DetailStatRow[] {
  return getDetailStatRows(itemDefinition, instanceData, statsData, true);
}

function collectArmorSetBonusClarityHashes(armorSetBonus: ArmorSetBonusInfo | null): number[] {
  const clarityHashes = new Set<number>();

  for (const bonusTier of armorSetBonus?.bonuses ?? []) {
    if (bonusTier.plugHash) {
      clarityHashes.add(bonusTier.plugHash);
    }

    if (bonusTier.sandboxPerkHash) {
      clarityHashes.add(bonusTier.sandboxPerkHash);
    }
  }

  return Array.from(clarityHashes);
}

function getActiveSocketOption(socketGroup: WeaponSocketGroup): WeaponPlugOption | null {
  return (
    socketGroup.options.find((option) => option.isActive) ??
    socketGroup.options[0] ??
    null
  );
}

function getActivePlugOptions(
  socketGroups: WeaponSocketGroup[],
  shouldIncludeSocketGroup: (socketGroup: WeaponSocketGroup) => boolean
): WeaponPlugOption[] {
  const activeOptions: WeaponPlugOption[] = [];
  const seenPlugHashes = new Set<number>();

  for (const socketGroup of socketGroups) {
    if (!shouldIncludeSocketGroup(socketGroup)) continue;

    const activeOption = getActiveSocketOption(socketGroup);

    if (!activeOption || seenPlugHashes.has(activeOption.plugHash)) continue;

    seenPlugHashes.add(activeOption.plugHash);
    activeOptions.push(activeOption);
  }

  return activeOptions;
}

function getIntrinsicPlugOption(socketGroups: WeaponSocketGroup[]): WeaponPlugOption | null {
  const intrinsicSocketGroup = socketGroups.find((socketGroup) => socketGroup.isIntrinsic);

  return intrinsicSocketGroup ? getActiveSocketOption(intrinsicSocketGroup) : null;
}

function getEnemiesDefeated(objectivesData: any): number | null {
  const objectives = Array.isArray(objectivesData?.objectives)
    ? objectivesData.objectives
    : Array.isArray(objectivesData)
      ? objectivesData
      : [];
  const killTrackerObjective = objectives.find((objective: any) =>
    [2302094943, 74070459].includes(Number(objective?.objectiveHash))
  );
  const progress = Number(killTrackerObjective?.progress);

  return Number.isFinite(progress) ? progress : null;
}

function getDamageTypeHash(itemDefinition: any, instanceData: any): number | null {
  const damageTypeHash =
    instanceData?.damageTypeHash ??
    instanceData?.damageType ??
    itemDefinition?.defaultDamageTypeHash;
  const numericDamageTypeHash = Number(damageTypeHash);

  return Number.isFinite(numericDamageTypeHash) ? numericDamageTypeHash : null;
}

function getDamageTypeIcon(
  damageTypeHash: number | null,
  damageTypeDefinitions?: Record<string, any>
): string | null {
  if (!damageTypeHash) return null;

  const damageTypeDefinition =
    damageTypeDefinitions?.[damageTypeHash] ??
    damageTypeDefinitions?.[String(damageTypeHash)];
  const manifestIcon = damageTypeDefinition?.displayProperties?.icon;

  if (manifestIcon) {
    return getBungieImage(manifestIcon);
  }

  return fallbackElementIconsByDamageTypeHash[damageTypeHash] ?? null;
}

function sortEnhancedOptionsFirst(options: WeaponPlugOption[]): WeaponPlugOption[] {
  return [...options].sort((firstOption, secondOption) => {
    if (firstOption.isEnhanced !== secondOption.isEnhanced) {
      return firstOption.isEnhanced ? -1 : 1;
    }

    const firstName = firstOption.definition?.displayProperties?.name ?? "";
    const secondName = secondOption.definition?.displayProperties?.name ?? "";

    return firstName.localeCompare(secondName);
  });
}

function getNormalizedPerkName(option: WeaponPlugOption): string {
  const rawName = option.definition?.displayProperties?.name ?? String(option.plugHash);

  return rawName
    .replace(/^enhanced\s+/i, "")
    .replace(/\s*\(enhanced\)\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function pairStandardAndEnhancedOptions(
  options: WeaponPlugOption[]
): Array<{ key: string; standardOption?: WeaponPlugOption; enhancedOption?: WeaponPlugOption }> {
  const pairsByName = new Map<
    string,
    { key: string; standardOption?: WeaponPlugOption; enhancedOption?: WeaponPlugOption }
  >();
  const optionPairs: Array<{
    key: string;
    standardOption?: WeaponPlugOption;
    enhancedOption?: WeaponPlugOption;
  }> = [];

  for (const option of options) {
    const normalizedName = getNormalizedPerkName(option);
    const preferredKey = normalizedName || String(option.plugHash);
    const existingPair = pairsByName.get(preferredKey);
    const canUseExistingPair =
      existingPair &&
      ((option.isEnhanced && !existingPair.enhancedOption) ||
        (!option.isEnhanced && !existingPair.standardOption));
    const pair =
      canUseExistingPair && existingPair
        ? existingPair
        : {
            key: canUseExistingPair ? preferredKey : `${preferredKey}-${option.plugHash}`,
          };

    if (!canUseExistingPair) {
      pairsByName.set(pair.key, pair);
      optionPairs.push(pair);
    }

    if (option.isEnhanced) {
      pair.enhancedOption = option;
    } else {
      pair.standardOption = option;
    }

    if (!pairsByName.has(preferredKey)) {
      pairsByName.set(preferredKey, pair);
    }
  }

  return optionPairs.sort((firstPair, secondPair) => {
    const firstOption = firstPair.standardOption ?? firstPair.enhancedOption;
    const secondOption = secondPair.standardOption ?? secondPair.enhancedOption;
    const firstName = firstOption?.definition?.displayProperties?.name ?? "";
    const secondName = secondOption?.definition?.displayProperties?.name ?? "";

    return firstName.localeCompare(secondName);
  });
}

function getTooltipAlignment(columnIndex: number, columnCount: number): TooltipAlignment {
  if (columnIndex === 0) return "left";
  if (columnIndex === columnCount - 1) return "right";

  return "center";
}

function getDefaultTooltipPlacement(
  optionIndex: number,
  optionCount: number,
  hasClarityDescription: boolean
): TooltipVerticalPlacement {
  if (!hasClarityDescription) return "top";

  const midpoint = Math.ceil(optionCount / 2);
  return optionIndex < midpoint ? "bottom" : "top";
}

function PlugOptionTooltip({
  option,
  socketTitle,
  clarityDescription,
  tooltipAlignment,
  tooltipPlacement,
  tooltipRef,
}: {
  option: WeaponPlugOption;
  socketTitle: string;
  clarityDescription?: ClarityDescription;
  tooltipAlignment: TooltipAlignment;
  tooltipPlacement: TooltipVerticalPlacement;
  tooltipRef: RefObject<HTMLDivElement | null>;
}) {
  const icon = getOptionIcon(option);
  const name = option.definition?.displayProperties?.name ?? String(option.plugHash);
  const description = option.definition?.displayProperties?.description;
  const typeName = option.definition?.itemTypeDisplayName ?? socketTitle;
  const tooltipWidthClass = clarityDescription
    ? "w-96 max-w-[min(24rem,calc(100vw-2rem))]"
    : "w-60 max-w-[min(15rem,calc(100vw-2rem))]";
  const tooltipPositionClass =
    tooltipAlignment === "left"
      ? "left-0 translate-x-0"
      : tooltipAlignment === "right"
        ? "right-0 translate-x-0"
        : "left-1/2 -translate-x-1/2";
  const tooltipArrowClass =
    tooltipAlignment === "left"
      ? "left-5"
      : tooltipAlignment === "right"
        ? "right-5"
        : "left-1/2 -translate-x-1/2";
  const tooltipVerticalClass =
    tooltipPlacement === "top" ? "bottom-full mb-2" : "top-full mt-2";
  const tooltipArrowVerticalClass =
    tooltipPlacement === "top"
      ? "top-full -translate-y-1/2 border-b border-r"
      : "bottom-full translate-y-1/2 border-l border-t";

  return (
    <div
      ref={tooltipRef}
      className={cn(
        "perk-tooltip pointer-events-none invisible absolute z-[1000] opacity-0 transition-opacity duration-150",
        tooltipWidthClass,
        tooltipPositionClass,
        tooltipVerticalClass
      )}
    >
      <div className="rounded border border-white/20 bg-[#0f0f0f]/95 p-3 shadow-2xl shadow-black/50 backdrop-blur-md">
        <div className="flex items-start gap-2">
          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/20 bg-black/40">
            {icon ? (
              <Image
                src={icon}
                alt=""
                fill
                sizes="32px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-500">
                ?
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="break-words text-sm font-bold leading-tight text-destiny-gold">
              {name}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {typeName}
            </p>
          </div>
        </div>

        {description && (
          <p className="mt-2 break-words text-xs leading-relaxed text-slate-300">
            {description}
          </p>
        )}

        {clarityDescription && (
          <div className="mt-3 border-t border-white/10 pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
              Clarity
            </p>
            <div className="mt-1 space-y-2 text-xs leading-relaxed text-slate-200">
              {clarityDescription.lines.map((line, index) =>
                line ? (
                  <p key={`${clarityDescription.hash}-${index}`} className="break-words">
                    {line}
                  </p>
                ) : (
                  <div
                    key={`${clarityDescription.hash}-${index}`}
                    className="h-1"
                    aria-hidden="true"
                  />
                )
              )}
            </div>
          </div>
        )}

        {(option.isActive || option.isEnhanced) && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/10 pt-2">
            {option.isActive && (
              <span className="border border-destiny-gold/40 bg-destiny-gold/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-destiny-gold">
                Equipped
              </span>
            )}
            {option.isEnhanced && (
              <span className="border border-cyan-300/40 bg-cyan-400/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-cyan-200">
                Enhanced
              </span>
            )}
          </div>
        )}
      </div>
      <div
        className={cn(
          "absolute h-2 w-2 rotate-45 border-white/20 bg-[#0f0f0f]",
          tooltipArrowClass,
          tooltipArrowVerticalClass
        )}
      />
    </div>
  );
}

function EnhancedPlugArrow() {
  return (
    <div
      className="pointer-events-none absolute -left-1.5 top-0 z-10 h-8 w-3 drop-shadow-[0_1px_1px_rgba(0,0,0,0.75)]"
      aria-hidden="true"
    >
      <div className="absolute left-[5px] top-[8px] h-5 w-[3px] bg-destiny-gold" />
      <div className="absolute left-0 top-0 h-0 w-0 border-b-[10px] border-l-[6px] border-r-[6px] border-b-destiny-gold border-l-transparent border-r-transparent" />
    </div>
  );
}

function PossiblePerkOption({
  option,
  socketTitle,
  clarityDescription,
  defaultTooltipAlignment,
  defaultTooltipPlacement,
}: {
  option: WeaponPlugOption;
  socketTitle: string;
  clarityDescription?: ClarityDescription;
  defaultTooltipAlignment: TooltipAlignment;
  defaultTooltipPlacement: TooltipVerticalPlacement;
}) {
  const iconContainerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [tooltipAlignment, setTooltipAlignment] = useState(defaultTooltipAlignment);
  const [tooltipPlacement, setTooltipPlacement] =
    useState<TooltipVerticalPlacement>(defaultTooltipPlacement);
  const icon = getOptionIcon(option);
  const name = option.definition?.displayProperties?.name ?? String(option.plugHash);

  function updateTooltipPosition() {
    const iconElement = iconContainerRef.current;
    const tooltipElement = tooltipRef.current;

    if (!iconElement || !tooltipElement) return;

    const viewportPadding = 16;
    const iconRect = iconElement.getBoundingClientRect();
    const tooltipRect = tooltipElement.getBoundingClientRect();
    const tooltipCenter = iconRect.left + iconRect.width / 2;
    const centeredLeft = tooltipCenter - tooltipRect.width / 2;
    const centeredRight = tooltipCenter + tooltipRect.width / 2;
    const viewportRight = window.innerWidth - viewportPadding;

    if (centeredLeft >= viewportPadding && centeredRight <= viewportRight) {
      setTooltipAlignment("center");
    } else if (iconRect.left + tooltipRect.width <= viewportRight) {
      setTooltipAlignment("left");
    } else if (iconRect.right - tooltipRect.width >= viewportPadding) {
      setTooltipAlignment("right");
    } else {
      setTooltipAlignment(defaultTooltipAlignment);
    }

    const topSpace = iconRect.top - viewportPadding;
    const bottomSpace = window.innerHeight - iconRect.bottom - viewportPadding;
    const tooltipNeeds = tooltipRect.height + 8;
    const placement =
      topSpace >= tooltipNeeds || topSpace >= bottomSpace ? "top" : "bottom";

    setTooltipPlacement(placement);
  }

  return (
    <div
      className="perk-option relative z-0"
      onFocus={updateTooltipPosition}
      onMouseEnter={updateTooltipPosition}
    >
      <div
        ref={iconContainerRef}
        tabIndex={0}
        role="img"
        aria-label={`${name}${option.isActive ? " equipped" : ""}`}
        className={cn(
          "relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border bg-black/40 transition-all outline-none",
          "hover:border-white/70 hover:opacity-100 focus-visible:border-white/80 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white/25",
          option.isActive
            ? "border-destiny-gold bg-[#5b94be] opacity-100 ring-1 ring-destiny-gold/50"
            : "border-slate-500 opacity-50",
          option.isEnhanced &&
            !option.isActive &&
            "border-destiny-gold/80 bg-black/40 opacity-90"
        )}
      >
        {icon && (
          <Image
            src={icon}
            alt=""
            fill
            sizes="44px"
            className="object-cover"
          />
        )}
        {!icon && <span className="text-xs font-bold text-slate-500">?</span>}
        {option.isEnhanced && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(227, 206, 98, 0.5) 0%, rgba(227, 206, 98, 0) 50%)",
            }}
          />
        )}
        {option.isActive && (
          <div className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border border-black/70 bg-destiny-gold shadow shadow-black/50" />
        )}
      </div>
      {option.isEnhanced && <EnhancedPlugArrow />}
      <PlugOptionTooltip
        option={option}
        socketTitle={socketTitle}
        clarityDescription={clarityDescription}
        tooltipAlignment={tooltipAlignment}
        tooltipPlacement={tooltipPlacement}
        tooltipRef={tooltipRef}
      />
    </div>
  );
}

function SocketColumn({
  socketGroup,
  clarityDescriptions,
  columnIndex,
  columnCount,
}: {
  socketGroup: WeaponSocketGroup;
  clarityDescriptions: Record<number, ClarityDescription>;
  columnIndex: number;
  columnCount: number;
}) {
  const functionalOptions = socketGroup.options.filter((option) =>
    socketGroup.isMasterworkColumn
      ? option.isMasterwork
      : isFunctionalWeaponPerk(option.definition)
  );
  const optionsToPair = functionalOptions.length > 0 ? functionalOptions : socketGroup.options;
  const optionPairs = pairStandardAndEnhancedOptions(optionsToPair);
  const socketTitle = getSocketColumnTitle(socketGroup);
  const defaultTooltipAlignment = getTooltipAlignment(columnIndex, columnCount);

  return (
    <section
      aria-label={`${socketTitle} options`}
      className="w-[6.75rem] shrink-0 border-l border-white/10 pl-3 first:border-l-0 first:pl-0"
    >
      <div className="grid grid-cols-2 gap-1.5 overflow-visible">
        {optionPairs.flatMap((optionPair, optionPairIndex) =>
          ([optionPair.standardOption, optionPair.enhancedOption] as Array<
            WeaponPlugOption | undefined
          >).map((option, pairedOptionIndex) => {
            if (!option) {
              return (
                <div
                  key={`${optionPair.key}-empty-${pairedOptionIndex}`}
                  className="h-11 w-11"
                  aria-hidden="true"
                />
              );
            }

            const clarityDescription = clarityDescriptions[option.plugHash];
            const defaultTooltipPlacement = getDefaultTooltipPlacement(
              optionPairIndex,
              optionPairs.length,
              Boolean(clarityDescription)
            );

            return (
              <PossiblePerkOption
                key={option.plugHash}
                option={option}
                socketTitle={socketTitle}
                clarityDescription={clarityDescription}
                defaultTooltipAlignment={defaultTooltipAlignment}
                defaultTooltipPlacement={defaultTooltipPlacement}
              />
            );
          })
        )}
      </div>
    </section>
  );
}

function FullClaritySection({
  clarityDescription,
}: {
  clarityDescription?: ClarityDescription;
}) {
  if (!clarityDescription) return null;

  return (
    <div className="mt-4 border-t border-cyan-300/20 pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">
        Clarity
      </p>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-200">
        {clarityDescription.lines.map((line, index) =>
          line ? (
            <p key={`${clarityDescription.hash}-${index}`} className="break-words">
              {line}
            </p>
          ) : (
            <div
              key={`${clarityDescription.hash}-${index}`}
              className="h-1"
              aria-hidden="true"
            />
          )
        )}
      </div>
    </div>
  );
}

function ArmorTraitFullPage({
  traitPlug,
  clarityDescription,
}: {
  traitPlug: any;
  clarityDescription?: ClarityDescription;
}) {
  const traitName = getPlugDisplayText(traitPlug, "name");
  const traitDescription = getPlugDisplayText(traitPlug, "description");
  const traitType = getPlugTypeText(traitPlug);
  const traitIcon = traitPlug.displayProperties?.icon
    ? getBungieImage(traitPlug.displayProperties.icon)
    : null;

  return (
    <div className="border border-white/10 bg-black/20 p-4">
      <div className="flex items-start gap-3">
        {traitIcon && (
          <div className="relative h-12 w-12 shrink-0 overflow-hidden border border-white/15 bg-white/5">
            <Image src={traitIcon} alt="" fill sizes="48px" className="object-cover" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight text-destiny-gold">
            {traitName}
          </p>
          {traitType && (
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {traitType}
            </p>
          )}
        </div>
      </div>

      {traitDescription && (
        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          {traitDescription}
        </p>
      )}

      <FullClaritySection clarityDescription={clarityDescription} />
    </div>
  );
}

function ArmorSetBonusFullPage({
  armorSetBonus,
  clarityDescriptions,
}: {
  armorSetBonus: ArmorSetBonusInfo;
  clarityDescriptions: Record<number, ClarityDescription>;
}) {
  return (
    <section className="border border-white/10 p-4">
      <div className="flex items-start gap-3">
        {armorSetBonus.icon && (
          <div className="relative h-10 w-10 shrink-0 border border-white/10 bg-white/5">
            <Image
              src={getBungieImage(armorSetBonus.icon)}
              alt=""
              fill
              sizes="40px"
              className="object-cover"
            />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold uppercase tracking-wide text-white">
            Armor Set Bonus
          </h2>
          <p className="mt-1 text-sm font-semibold text-destiny-gold">
            {armorSetBonus.name}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {armorSetBonus.bonuses.map((bonusTier) => {
          const clarityHash = bonusTier.plugHash ?? bonusTier.sandboxPerkHash;
          const clarityDescription = clarityHash
            ? clarityDescriptions[clarityHash]
            : undefined;

          return (
            <div
              key={`${bonusTier.requiredSetCount ?? "bonus"}-${bonusTier.sandboxPerkHash ?? bonusTier.plugHash ?? bonusTier.name}`}
              className="border border-white/10 bg-black/20 p-3"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-destiny-gold">
                {formatArmorSetBonusRequirement(bonusTier.requiredSetCount)}
                {bonusTier.name && (
                  <span className="ml-1 normal-case tracking-normal text-white">
                    - {bonusTier.name}
                  </span>
                )}
              </p>
              {bonusTier.description && (
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  {bonusTier.description}
                </p>
              )}
              <FullClaritySection clarityDescription={clarityDescription} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="border-b border-white/20 pb-1 text-sm font-medium text-slate-300">
      {children}
    </p>
  );
}

function ActivePlugIcon({
  option,
  socketTitle,
  clarityDescription,
}: {
  option: WeaponPlugOption;
  socketTitle: string;
  clarityDescription?: ClarityDescription;
}) {
  const iconContainerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [tooltipAlignment, setTooltipAlignment] = useState<TooltipAlignment>("center");
  const [tooltipPlacement, setTooltipPlacement] =
    useState<TooltipVerticalPlacement>("top");
  const icon = getOptionIcon(option);
  const name = option.definition?.displayProperties?.name ?? String(option.plugHash);

  function updateTooltipPosition() {
    const iconElement = iconContainerRef.current;
    const tooltipElement = tooltipRef.current;

    if (!iconElement || !tooltipElement) return;

    const viewportPadding = 16;
    const iconRect = iconElement.getBoundingClientRect();
    const tooltipRect = tooltipElement.getBoundingClientRect();
    const tooltipCenter = iconRect.left + iconRect.width / 2;
    const centeredLeft = tooltipCenter - tooltipRect.width / 2;
    const centeredRight = tooltipCenter + tooltipRect.width / 2;
    const viewportRight = window.innerWidth - viewportPadding;

    if (centeredLeft >= viewportPadding && centeredRight <= viewportRight) {
      setTooltipAlignment("center");
    } else if (iconRect.left + tooltipRect.width <= viewportRight) {
      setTooltipAlignment("left");
    } else {
      setTooltipAlignment("right");
    }

    const topSpace = iconRect.top - viewportPadding;
    const bottomSpace = window.innerHeight - iconRect.bottom - viewportPadding;
    const tooltipNeeds = tooltipRect.height + 8;

    setTooltipPlacement(
      topSpace >= tooltipNeeds || topSpace >= bottomSpace ? "top" : "bottom"
    );
  }

  return (
    <div
      className="perk-option relative z-0"
      onFocus={updateTooltipPosition}
      onMouseEnter={updateTooltipPosition}
    >
      <div
        ref={iconContainerRef}
        tabIndex={0}
        role="img"
        aria-label={name}
        className="relative flex h-11 w-11 items-center justify-center overflow-hidden border border-white/35 bg-black/35 outline-none transition-colors hover:border-white/80 focus-visible:border-white/80 focus-visible:ring-2 focus-visible:ring-white/25"
      >
        {icon ? (
          <Image src={icon} alt="" fill sizes="44px" className="object-cover" />
        ) : (
          <span className="text-xs font-bold text-slate-500">?</span>
        )}
      </div>
      <PlugOptionTooltip
        option={option}
        socketTitle={socketTitle}
        clarityDescription={clarityDescription}
        tooltipAlignment={tooltipAlignment}
        tooltipPlacement={tooltipPlacement}
        tooltipRef={tooltipRef}
      />
    </div>
  );
}

function IntrinsicDetail({
  intrinsicOption,
  clarityDescription,
}: {
  intrinsicOption: WeaponPlugOption | null;
  clarityDescription?: ClarityDescription;
}) {
  if (!intrinsicOption) return null;

  const icon = getOptionIcon(intrinsicOption);
  const name =
    intrinsicOption.definition?.displayProperties?.name ??
    String(intrinsicOption.plugHash);
  const description = intrinsicOption.definition?.displayProperties?.description;

  return (
    <section className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden">
          {icon ? (
            <Image src={icon} alt="" fill sizes="48px" className="object-contain" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-600">
              ?
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold leading-tight text-white">{name}</p>
          {description && (
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-300">
              {description}
            </p>
          )}
        </div>
      </div>
      <FullClaritySection clarityDescription={clarityDescription} />
    </section>
  );
}

function ActivePlugStrip({
  title,
  options,
  clarityDescriptions,
}: {
  title: string;
  options: WeaponPlugOption[];
  clarityDescriptions: Record<number, ClarityDescription>;
}) {
  if (options.length === 0) return null;

  return (
    <section className="space-y-3">
      <SectionLabel>{title}</SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <ActivePlugIcon
            key={option.plugHash}
            option={option}
            socketTitle={option.definition?.itemTypeDisplayName ?? title}
            clarityDescription={clarityDescriptions[option.plugHash]}
          />
        ))}
      </div>
    </section>
  );
}

function DetailStatsPanel({ statRows }: { statRows: DetailStatRow[] }) {
  if (statRows.length === 0) return null;

  return (
    <section className="border-t border-white/20 pt-5">
      <h2 className="text-2xl font-semibold uppercase tracking-wide text-white">
        Stats
      </h2>
      <div className="mt-4 space-y-2.5">
        {statRows.map((statRow) => (
          <div
            key={statRow.statHash}
            className="grid grid-cols-[minmax(7rem,1fr)_minmax(6rem,1.5fr)_3rem] items-center gap-3 text-sm"
          >
            <span className="truncate text-slate-300">{statRow.name}</span>
            <div className="h-2 bg-black/40">
              <div
                className="h-full bg-white"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(0, (statRow.value / statRow.maximum) * 100)
                  )}%`,
                }}
              />
            </div>
            <span className="text-right font-semibold text-white">{statRow.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TierDiamonds({ tier }: { tier?: number }) {
  const filledTierCount = Math.max(0, Math.min(5, Number(tier) || 0));

  return (
    <div className="flex items-center gap-2" aria-label={`Tier ${filledTierCount}`}>
      {Array.from({ length: 5 }).map((_, tierIndex) => (
        <span
          key={tierIndex}
          className={cn(
            "h-3 w-3 rotate-45",
            tierIndex < filledTierCount ? "bg-destiny-gold" : "bg-white/45"
          )}
        />
      ))}
    </div>
  );
}

function PowerSummary({
  primaryStatValue,
  damageTypeIcon,
  gearTier,
  tierLabel,
  enemiesDefeated,
}: {
  primaryStatValue?: number;
  damageTypeIcon: string | null;
  gearTier?: number;
  tierLabel: string;
  enemiesDefeated: number | null;
}) {
  if (!primaryStatValue && !gearTier && enemiesDefeated === null) return null;

  return (
    <section className="border-b border-white/20 pb-5 text-white">
      {primaryStatValue && (
        <div className="flex items-end gap-3">
          {damageTypeIcon && (
            <div className="relative mb-1 h-10 w-10 shrink-0">
              <Image
                src={damageTypeIcon}
                alt=""
                fill
                sizes="40px"
                className="object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]"
              />
            </div>
          )}
          <div>
            <p className="text-sm text-slate-200">Power</p>
            <p className="text-5xl font-bold leading-none text-white">
              {primaryStatValue}
            </p>
          </div>
        </div>
      )}

      {gearTier !== undefined && (
        <div className="mt-4 pl-1">
          <TierDiamonds tier={gearTier} />
          <p className="mt-2 text-sm font-medium text-slate-200">{tierLabel}</p>
        </div>
      )}

      {enemiesDefeated !== null && (
        <p className="mt-4 text-sm font-semibold text-slate-200">
          Enemies Defeated {enemiesDefeated.toLocaleString()}
        </p>
      )}
    </section>
  );
}

function DropSourcePanel({ sourceInfo }: { sourceInfo: ItemSourceInfo | null }) {
  if (!sourceInfo?.sourceText && !sourceInfo?.requirementText) return null;

  return (
    <section className="max-w-xl border-l-2 border-destiny-gold/60 bg-black/20 px-4 py-3">
      {sourceInfo.sourceText && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-destiny-gold">
            Drop Source
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-200">
            {sourceInfo.sourceText}
          </p>
        </div>
      )}
      {sourceInfo.requirementText && (
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          {sourceInfo.requirementText}
        </p>
      )}
    </section>
  );
}

function OwnedCopiesPanel({
  isLoggedIn,
  ownedCopies,
  itemHash,
  selectedInstanceId,
  icon,
  iconWatermark,
  onSelectCopy,
}: {
  isLoggedIn: boolean;
  ownedCopies: OwnedWeaponCopy[];
  itemHash: number;
  selectedInstanceId?: string;
  icon: string | null;
  iconWatermark: string | null;
  onSelectCopy?: (copy: OwnedWeaponCopy) => void;
}) {
  return (
    <section className="border-t border-white/20 pt-5">
      <h2 className="text-2xl font-semibold uppercase tracking-wide text-white">
        Your Copies
      </h2>
      <div className="mt-3">
        {isLoggedIn && ownedCopies.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {ownedCopies.map((copy) => {
              const copyLabel = `${copy.locationName} on ${copy.ownerName}`;
              const copyClassName = cn(
                "relative block h-14 w-14 overflow-hidden border border-white/20 bg-black/30 transition-colors hover:border-white/60",
                copy.itemInstanceId === selectedInstanceId &&
                  "border-destiny-gold ring-1 ring-destiny-gold/70"
              );
              const copyContent = (
                <>
                  {icon ? (
                    <Image
                      src={icon}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-500">
                      ?
                    </span>
                  )}
                  {iconWatermark && (
                    <Image
                      src={iconWatermark}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-cover opacity-90"
                    />
                  )}
                </>
              );

              return onSelectCopy ? (
                <button
                  key={copy.itemInstanceId}
                  type="button"
                  onClick={() => onSelectCopy(copy)}
                  aria-label={copyLabel}
                  title={copyLabel}
                  className={copyClassName}
                >
                  {copyContent}
                </button>
              ) : (
                <Link
                  key={copy.itemInstanceId}
                  href={`/item/${itemHash}?instanceId=${copy.itemInstanceId}&ownerId=${copy.ownerId}`}
                  aria-label={copyLabel}
                  title={copyLabel}
                  className={copyClassName}
                >
                  {copyContent}
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-300">
            {isLoggedIn
              ? "No owned copies found in the loaded profile."
              : "Log in to compare this database roll with your own copies."}
          </p>
        )}
      </div>
    </section>
  );
}

export function WeaponDetailsPageClient({
  itemHash,
  instanceId,
  isOverlay = false,
  onSelectCopy,
}: WeaponDetailsPageClientProps) {
  const searchParams = useSearchParams();
  const requestedInstanceId = instanceId ?? searchParams.get("instanceId") ?? undefined;
  const { profile, isLoggedIn } = useDestinyProfileContext();
  const { definitions } = useItemDefinitions(Number.isFinite(itemHash) ? [itemHash] : []);
  const { table: equipableItemSetDefinitions } =
    useManifestTable<any>("DestinyEquipableItemSetDefinition");
  const { table: sandboxPerkDefinitions } =
    useManifestTable<any>("DestinySandboxPerkDefinition");
  const { table: damageTypeDefinitions } =
    useManifestTable<any>("DestinyDamageTypeDefinition");
  const { table: collectibleDefinitions } =
    useManifestTable<any>("DestinyCollectibleDefinition");
  const itemDefinition = definitions[itemHash];
  const ownedCopies = useMemo(
    () => getOwnedWeaponCopies(profile, itemHash),
    [profile, itemHash]
  );
  const selectedCopy = useMemo(() => {
    if (!requestedInstanceId) {
      return (
        ownedCopies.find((copy) => copy.locationName === "Equipped") ??
        ownedCopies[0]
      );
    }

    return ownedCopies.find((copy) => copy.itemInstanceId === requestedInstanceId);
  }, [ownedCopies, requestedInstanceId]);
  const selectedInstanceId = selectedCopy?.itemInstanceId ?? requestedInstanceId;
  const instanceData = selectedInstanceId
    ? profile?.itemComponents?.instances?.data?.[selectedInstanceId]
    : undefined;
  const statsData = selectedInstanceId
    ? profile?.itemComponents?.stats?.data?.[selectedInstanceId]?.stats
    : undefined;
  const objectivesData = selectedInstanceId
    ? profile?.itemComponents?.objectives?.data?.[selectedInstanceId]
    : undefined;
  const socketsData = selectedInstanceId
    ? profile?.itemComponents?.sockets?.data?.[selectedInstanceId]
    : undefined;
  const reusablePlugsData = selectedInstanceId
    ? profile?.itemComponents?.reusablePlugs?.data?.[selectedInstanceId]?.plugs
    : undefined;
  const plugSetHashes = useMemo(
    () => getWeaponPlugSetHashes(itemDefinition),
    [itemDefinition]
  );
  const { plugSetDefinitions } = usePlugSetDefinitions(plugSetHashes);
  const plugHashes = useMemo(
    () =>
      collectWeaponPlugHashes({
        itemDefinition,
        socketsData,
        reusablePlugsData,
        plugSetDefinitions,
      }),
    [itemDefinition, socketsData, reusablePlugsData, plugSetDefinitions]
  );
  const { definitions: plugDefinitions } = useItemDefinitions(plugHashes);
  const socketGroups = useMemo(
    () =>
      buildWeaponSocketGroups({
        itemDefinition,
        socketsData,
        reusablePlugsData,
        plugDefinitions,
        plugSetDefinitions,
      }),
    [itemDefinition, socketsData, reusablePlugsData, plugDefinitions, plugSetDefinitions]
  );
  const perkColumns = socketGroups.filter(
    (socketGroup) => socketGroup.isPerkColumn || socketGroup.isOriginColumn
  );
  const armorSetBonus = useMemo(() => {
    return getArmorSetBonusInfo({
      itemDefinition,
      itemType: itemDefinition?.itemTypeDisplayName ?? "",
      equipableItemSetDefinitions,
      sandboxPerkDefinitions,
      socketsData,
      plugDefinitions,
    });
  }, [
    equipableItemSetDefinitions,
    itemDefinition,
    plugDefinitions,
    sandboxPerkDefinitions,
    socketsData,
  ]);
  const armorSetBonusClarityHashes = useMemo(
    () => collectArmorSetBonusClarityHashes(armorSetBonus),
    [armorSetBonus]
  );
  const exoticArmorTraits = useMemo(
    () =>
      getExoticArmorTraitPlugs({
        itemDefinition,
        itemType: itemDefinition?.itemTypeDisplayName ?? "",
        socketsData,
        plugDefinitions,
      }),
    [itemDefinition, plugDefinitions, socketsData]
  );
  const exoticArmorTraitHashes = useMemo(
    () =>
      exoticArmorTraits
        .map((traitPlug) => getPlugHash(traitPlug))
        .filter((traitHash): traitHash is number => Boolean(traitHash)),
    [exoticArmorTraits]
  );
  const clarityHashes = useMemo(
    () =>
      Array.from(
        new Set([...plugHashes, ...armorSetBonusClarityHashes, ...exoticArmorTraitHashes])
      ),
    [armorSetBonusClarityHashes, exoticArmorTraitHashes, plugHashes]
  );
  const { descriptions: clarityDescriptions } = useClarityDescriptions(clarityHashes);
  const itemSourceInfo = useMemo(
    () =>
      getItemSourceInfo({
        itemDefinition,
        collectibleTable: collectibleDefinitions,
      }),
    [itemDefinition, collectibleDefinitions]
  );
  const icon = itemDefinition?.displayProperties?.icon
    ? getBungieImage(itemDefinition.displayProperties.icon)
    : null;

  if (!Number.isFinite(itemHash)) {
    return <div className="text-red-300">Invalid item hash.</div>;
  }

  if (!itemDefinition) {
    return <div className="text-slate-400">Loading weapon details...</div>;
  }

  const itemTypeName = itemDefinition.itemTypeDisplayName ?? "";
  const isWeapon = itemDefinition.itemType === 3;
  const isArmor = isArmorSetBonusItem(itemDefinition, itemTypeName);
  const title = itemDefinition.displayProperties?.name ?? `Item ${itemHash}`;
  const description = itemDefinition.displayProperties?.description;
  const flavorText = itemDefinition.flavorText ?? description;
  const iconWatermark = itemDefinition.iconWatermark
    ? getBungieImage(itemDefinition.iconWatermark)
    : null;
  const intrinsicOption = getIntrinsicPlugOption(socketGroups);
  const activeModOptions = getActivePlugOptions(
    socketGroups,
    (socketGroup) =>
      !socketGroup.isIntrinsic &&
      !socketGroup.isPerkColumn &&
      !socketGroup.isOriginColumn
  );
  const primaryStatValue =
    instanceData?.primaryStat?.value ?? itemDefinition?.primaryStat?.value;
  const damageTypeHash = getDamageTypeHash(itemDefinition, instanceData);
  const damageTypeIcon = getDamageTypeIcon(damageTypeHash, damageTypeDefinitions);
  const gearTier = Number.isFinite(Number(instanceData?.gearTier))
    ? Number(instanceData?.gearTier)
    : undefined;
  const tierLabel = isWeapon ? "Weapon Tier" : "Armor Tier";
  const enemiesDefeated = getEnemiesDefeated(objectivesData);
  const statRows = isArmor
    ? getArmorStatRows(itemDefinition, instanceData, statsData)
    : getWeaponStatRows(itemDefinition, instanceData, statsData);
  const shellClassName = cn(
    "relative isolate overflow-visible bg-slate-800/20 text-white",
    isOverlay
      ? "min-h-full"
      : "-mx-4 -my-8 min-h-[calc(100vh-4rem)] sm:-mx-8 md:-ml-24 md:-mr-8"
  );
  const contentClassName = cn(
    "relative z-10",
    isOverlay
      ? "min-h-full p-6 lg:p-10 xl:p-12"
      : "min-h-[calc(100vh-4rem)] p-6 md:pl-32 lg:p-10 lg:pl-36 xl:p-12 xl:pl-40"
  );

  return (
    <div className={shellClassName}>
      <style>
        {`
          .perk-option:hover,
          .perk-option:focus-within {
            z-index: 50;
          }

          .perk-option:hover .perk-tooltip,
          .perk-option:focus-within .perk-tooltip {
            visibility: visible;
            opacity: 1 !important;
          }
        `}
      </style>

      <div className={contentClassName}>
        <section className="mb-10 space-y-6">
          <div className="flex min-w-0 items-start gap-5">
            {icon && (
              <div className="relative h-20 w-20 shrink-0 overflow-hidden border border-white/25 bg-black/30 shadow-2xl shadow-black/40">
                <Image
                  src={icon}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                />
                {iconWatermark && (
                  <Image
                    src={iconWatermark}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover opacity-90"
                  />
                )}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold uppercase tracking-wide text-destiny-gold">
                {itemDefinition.inventory?.tierTypeName} {itemDefinition.itemTypeDisplayName}
              </p>
              <h1 className="break-words text-5xl font-bold uppercase leading-none tracking-widest text-white sm:text-6xl lg:text-7xl">
                {title}
              </h1>
              <p className="mt-1 text-2xl font-semibold text-slate-300">
                {itemDefinition.itemTypeDisplayName}
              </p>
            </div>
          </div>

          {flavorText && (
            <p className="max-w-xl text-lg italic leading-relaxed text-slate-200">
              {flavorText}
            </p>
          )}
          {description && description !== flavorText && (
            <p className="max-w-xl text-sm leading-relaxed text-slate-300">
              {description}
            </p>
          )}
          <DropSourcePanel sourceInfo={itemSourceInfo} />
        </section>

        <div className="grid gap-8 xl:grid-cols-[minmax(520px,640px)_minmax(120px,1fr)_minmax(320px,390px)]">
          <main className="flex min-w-0 flex-col gap-8">

          {!isWeapon && !isArmor && (
            <div className="border border-yellow-500/25 bg-yellow-500/10 p-4 text-sm text-yellow-100">
              This details view is optimized for weapons and armor. This item loaded,
              but it is a different item type.
            </div>
          )}

          {isArmor ? (
            <div className="space-y-6">
              {exoticArmorTraits.length > 0 && (
                <section className="space-y-3">
                  <SectionLabel>Exotic Traits</SectionLabel>
                  <div className="space-y-3">
                    {exoticArmorTraits.map((traitPlug, traitIndex) => {
                      const traitHash = getPlugHash(traitPlug);
                      const clarityDescription = traitHash
                        ? clarityDescriptions[traitHash]
                        : undefined;

                      return (
                        <ArmorTraitFullPage
                          key={traitHash ?? traitIndex}
                          traitPlug={traitPlug}
                          clarityDescription={clarityDescription}
                        />
                      );
                    })}
                  </div>
                </section>
              )}

              {armorSetBonus && (
                <ArmorSetBonusFullPage
                  armorSetBonus={armorSetBonus}
                  clarityDescriptions={clarityDescriptions}
                />
              )}

              {exoticArmorTraits.length === 0 && !armorSetBonus && (
                <p className="border-y border-white/20 py-4 text-sm text-slate-300">
                  No exotic trait or armor set bonus found for this item.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              <IntrinsicDetail
                intrinsicOption={intrinsicOption}
                clarityDescription={
                  intrinsicOption
                    ? clarityDescriptions[intrinsicOption.plugHash]
                    : undefined
                }
              />

              {perkColumns.length > 0 ? (
                <section className="space-y-3 overflow-visible">
                  <SectionLabel>Perks</SectionLabel>
                  <div className="overflow-visible">
                    <div className="flex w-fit max-w-full flex-wrap items-stretch gap-x-0 gap-y-5 overflow-visible">
                      {perkColumns.map((socketGroup, columnIndex) => (
                        <SocketColumn
                          key={socketGroup.socketIndex}
                          socketGroup={socketGroup}
                          clarityDescriptions={clarityDescriptions}
                          columnIndex={columnIndex}
                          columnCount={perkColumns.length}
                        />
                      ))}
                    </div>
                  </div>
                </section>
              ) : (
                <p className="border-y border-white/20 py-4 text-sm text-slate-300">
                  No perk plugs found for this item.
                </p>
              )}

              <ActivePlugStrip
                title="Mods"
                options={activeModOptions}
                clarityDescriptions={clarityDescriptions}
              />
            </div>
          )}
        </main>

        <div className="relative hidden min-h-[28rem] xl:block" />

        <aside className="space-y-5 p-5 xl:self-end">
          <PowerSummary
            primaryStatValue={primaryStatValue}
            damageTypeIcon={damageTypeIcon}
            gearTier={gearTier}
            tierLabel={tierLabel}
            enemiesDefeated={enemiesDefeated}
          />
          {!isArmor && armorSetBonus && (
            <ArmorSetBonusFullPage
              armorSetBonus={armorSetBonus}
              clarityDescriptions={clarityDescriptions}
            />
          )}
          <DetailStatsPanel statRows={statRows} />
          <OwnedCopiesPanel
            isLoggedIn={isLoggedIn}
            ownedCopies={ownedCopies}
            itemHash={itemHash}
            selectedInstanceId={selectedInstanceId}
            icon={icon}
            iconWatermark={iconWatermark}
            onSelectCopy={onSelectCopy}
          />
        </aside>
      </div>
    </div>
    </div>
  );
}
