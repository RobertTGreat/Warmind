"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { startTransition, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  Filter,
  Loader2,
  RefreshCw,
  Store,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useDestinyProfileContext } from "@/components/DestinyProfileProvider";
import { useVendors } from "@/hooks/useVendors";
import { useItemDefinitions } from "@/hooks/useItemDefinitions";
import { loginWithBungie, getBungieImage } from "@/lib/bungie";
import { fetchManifestDefinitions } from "@/lib/manifestTableClient";
import type { ItemIconSize } from "@/lib/itemIconImage";
import { CLASS_NAMES } from "@/components/loadouts/constants";
import {
  buildVendor,
  collectVendorItemHashes,
  filterVendorGroups,
  getOwnedItemHashesFromProfile,
  groupVendorItemsByCategory,
  type DestinyVendorsResponse,
  type Vendor,
  type VendorDefinition,
  type VendorGroup,
  type VendorSaleItem,
} from "@/lib/vendors";
import {
  buildVendorReputationDisplay,
  collectVendorFactionHashes,
  collectVendorProgressionHashes,
  type VendorReputationDisplay,
} from "@/lib/vendorReputation";
import { getVendorDisplayIcon } from "@/lib/vendorIcons";
import { useManifestTable } from "@/hooks/useManifestTable";
import {
  collectMatchingVendorHashes,
  filterVendorGroupsBySearch,
} from "@/lib/vendorSearch";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/settingsStore";
import { useUIStore } from "@/store/uiStore";

const DestinyItemCard = dynamic(
  () => import("@/components/DestinyItemCard").then((mod) => mod.DestinyItemCard),
  { ssr: false }
);

function formatRefreshCountdown(refreshDate?: Date) {
  if (!refreshDate) {
    return null;
  }

  const millisecondsRemaining = refreshDate.getTime() - Date.now();
  if (millisecondsRemaining <= 0) {
    return "Refreshing soon";
  }

  const totalMinutes = Math.floor(millisecondsRemaining / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedHours = String(hours).padStart(2, "0");

  if (days > 0) {
    return `${days} Day${days === 1 ? "" : "s"} ${paddedHours}:${paddedMinutes}`;
  }

  return `${paddedHours}:${paddedMinutes}`;
}

function getIconSizeClass(iconSize: ItemIconSize) {
  return {
    small: "w-12",
    medium: "w-14",
    large: "w-16",
  }[iconSize];
}

function getInternalVendorHash(itemDefinition?: {
  preview?: { previewVendorHash?: number };
}) {
  return itemDefinition?.preview?.previewVendorHash;
}

function collectInternalVendorHashes(
  vendorGroups: VendorGroup[],
  itemDefinitions: Record<number, any>
) {
  const internalVendorHashes = new Set<number>();

  for (const group of vendorGroups) {
    for (const vendor of group.vendors) {
      for (const saleItem of vendor.items) {
        const internalVendorHash = getInternalVendorHash(
          itemDefinitions[saleItem.itemHash]
        );

        if (internalVendorHash) {
          internalVendorHashes.add(internalVendorHash);
        }
      }
    }
  }

  return [...internalVendorHashes];
}

function normalizeVendorDefinitionMap(
  vendorDefinitions: Record<string, VendorDefinition>
) {
  const definitionsByHash: Record<number, VendorDefinition> = {};

  for (const [hashKey, definition] of Object.entries(vendorDefinitions)) {
    definitionsByHash[Number(hashKey)] = definition;
  }

  return definitionsByHash;
}

function buildInternalVendorByHash({
  vendorsData,
  internalVendorHashes,
  vendorDefinitions,
  currencyQuantities,
  destinationNames,
}: {
  vendorsData?: DestinyVendorsResponse;
  internalVendorHashes: number[];
  vendorDefinitions: Record<number, VendorDefinition>;
  currencyQuantities: Record<string, number>;
  destinationNames: Record<number, string>;
}) {
  const internalVendorByHash: Record<number, Vendor> = {};

  if (!vendorsData) {
    return internalVendorByHash;
  }

  for (const vendorHash of internalVendorHashes) {
    const internalVendor = buildVendor(
      vendorHash,
      vendorDefinitions[vendorHash],
      vendorsData.vendors?.data?.[String(vendorHash)],
      vendorsData.sales?.data?.[String(vendorHash)]?.saleItems,
      currencyQuantities,
      destinationNames
    );

    if (internalVendor) {
      internalVendorByHash[vendorHash] = internalVendor;
    }
  }

  return internalVendorByHash;
}

function collectInternalVendorItemHashes(
  internalVendorByHash: Record<number, Vendor>
) {
  const itemHashes = new Set<number>();

  for (const vendor of Object.values(internalVendorByHash)) {
    for (const item of vendor.items) {
      itemHashes.add(item.itemHash);
    }

    for (const currencyHash of vendor.currencies) {
      itemHashes.add(currencyHash);
    }
  }

  return [...itemHashes];
}

function VendorReputationPanel({
  reputation,
}: {
  reputation: VendorReputationDisplay;
}) {
  return (
    <div className="flex h-full flex-col items-center px-3 py-4 text-center">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
        Rank
      </p>

      <div className="relative mb-4 h-20 w-20 overflow-hidden rounded-full">
        {reputation.icon && (
          <Image
            src={getBungieImage(reputation.icon)}
            alt=""
            fill
            sizes="80px"
            className="object-contain"
          />
        )}
      </div>

      <p className="text-sm font-semibold text-white">{reputation.rankLabel}</p>
      {reputation.stepLabel && (
        <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-300">
          {reputation.stepLabel}
        </p>
      )}

      <p className="mt-3 text-lg font-semibold text-white">
        {reputation.totalProgress.toLocaleString()}
      </p>

      {reputation.stepProgressLabel && (
        <p className="text-xs text-slate-400">{reputation.stepProgressLabel}</p>
      )}

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-white/80 transition-all"
          style={{ width: `${reputation.stepProgressPercent}%` }}
        />
      </div>

      {reputation.resetProgressLabel && (
        <>
          <p className="mt-3 text-xs text-slate-400">
            {reputation.resetProgressLabel}
          </p>
          {reputation.resetProgressPercent !== undefined && (
            <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">
              {Math.round(reputation.resetProgressPercent)}% to reset
            </p>
          )}
        </>
      )}
    </div>
  );
}

function VendorCurrenciesBar({
  currencyHashes,
  currencyQuantities,
  itemDefinitions,
}: {
  currencyHashes: number[];
  currencyQuantities: Record<string, number>;
  itemDefinitions: Record<number, any>;
}) {
  if (currencyHashes.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-3 border-b border-white/10 px-4 py-2">
      {currencyHashes.map((currencyHash) => {
        const definition = itemDefinitions[currencyHash];
        const quantity = currencyQuantities[String(currencyHash)] ?? 0;

        return (
          <div
            key={currencyHash}
            className="flex items-center gap-1.5 text-sm text-slate-200"
          >
            <span>{quantity.toLocaleString()}</span>
            {definition?.displayProperties?.icon && (
              <Image
                src={getBungieImage(definition.displayProperties.icon)}
                alt=""
                width={18}
                height={18}
                className="rounded-sm"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function VendorCostBadge({
  cost,
  definition,
}: {
  cost: VendorSaleItem["costs"][number];
  definition?: { displayProperties?: { icon?: string; name?: string } };
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide",
        cost.hasEnough ? "text-slate-300" : "text-red-400"
      )}
    >
      {definition?.displayProperties?.icon && (
        <Image
          src={getBungieImage(definition.displayProperties.icon)}
          alt=""
          width={14}
          height={14}
          className="rounded-sm"
        />
      )}
      <span>{cost.quantity.toLocaleString()}</span>
    </div>
  );
}

function VendorSaleItemTile({
  saleItem,
  itemDefinition,
  costDefinitions,
  iconSize,
  internalVendor,
  onInternalVendorOpen,
}: {
  saleItem: VendorSaleItem;
  itemDefinition?: any;
  costDefinitions: Record<number, any>;
  iconSize: ItemIconSize;
  internalVendor?: Vendor;
  onInternalVendorOpen?: () => void;
}) {
  const isBlocked = !saleItem.canBeSold || saleItem.locked;

  return (
    <div
      className={cn(
        "group flex flex-col gap-1.5",
        getIconSizeClass(iconSize),
        internalVendor && "cursor-pointer"
      )}
      onClick={internalVendor ? onInternalVendorOpen : undefined}
      onKeyDown={(event) => {
        if (!internalVendor) {
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onInternalVendorOpen?.();
        }
      }}
      role={internalVendor ? "button" : undefined}
      tabIndex={internalVendor ? 0 : undefined}
      title={internalVendor ? `Open ${internalVendor.name}` : undefined}
    >
      <div className="relative">
        <DestinyItemCard
          itemHash={saleItem.itemHash}
          definition={itemDefinition}
          className={cn(
            "aspect-square w-full",
            isBlocked && "opacity-50 grayscale",
            saleItem.owned && "ring-1 ring-emerald-500/60"
          )}
          size={iconSize}
          deferDetails
          hidePower
        />

        {saleItem.owned && (
          <div className="absolute top-1 right-1 rounded-sm bg-emerald-600/90 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            Owned
          </div>
        )}

        {internalVendor && (
          <div className="pointer-events-none absolute inset-0 border-2 border-destiny-gold/70 opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </div>

      {saleItem.costs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {saleItem.costs.map((cost) => (
            <VendorCostBadge
              key={`${saleItem.vendorItemIndex}-${cost.itemHash}`}
              cost={cost}
              definition={costDefinitions[cost.itemHash]}
            />
          ))}
        </div>
      )}

      {saleItem.failureStrings.length > 0 && (
        <p className="text-[10px] leading-snug text-red-300/90 line-clamp-2">
          {saleItem.failureStrings[0]}
        </p>
      )}
    </div>
  );
}

function VendorPanel({
  vendor,
  vendorDefinition,
  costDefinitions,
  itemDefinitions,
  internalVendorByHash,
  vendorDefinitions,
  progressionDefinitions,
  factionDefinitions,
  currencyQuantities,
  iconSize,
  isExpanded,
  onToggleExpanded,
}: {
  vendor: Vendor;
  vendorDefinition?: VendorDefinition;
  costDefinitions: Record<number, any>;
  itemDefinitions: Record<number, any>;
  internalVendorByHash: Record<number, Vendor>;
  vendorDefinitions: Record<number, VendorDefinition>;
  progressionDefinitions: Record<number, any>;
  factionDefinitions: Record<number, any>;
  currencyQuantities: Record<string, number>;
  iconSize: ItemIconSize;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}) {
  const [internalVendorHistory, setInternalVendorHistory] = useState<number[]>(
    []
  );
  const activeInternalVendorHash =
    internalVendorHistory[internalVendorHistory.length - 1] ?? null;
  const activeInternalVendor =
    activeInternalVendorHash !== null
      ? internalVendorByHash[activeInternalVendorHash]
      : undefined;
  const displayedVendor = activeInternalVendor ?? vendor;
  const displayedVendorDefinition =
    vendorDefinitions[displayedVendor.vendorHash] ?? vendorDefinition;
  const groupedItems = useMemo(
    () => groupVendorItemsByCategory(displayedVendor, displayedVendorDefinition),
    [displayedVendor, displayedVendorDefinition]
  );
  const refreshLabel = formatRefreshCountdown(vendor.nextRefreshDate);
  const headerVendor = displayedVendor;
  const headerVendorDefinition =
    vendorDefinitions[headerVendor.vendorHash] ??
    (headerVendor === vendor ? vendorDefinition : undefined);
  const headerIcon =
    getVendorDisplayIcon(headerVendorDefinition, factionDefinitions) ||
    headerVendor.icon;
  const headerName = headerVendor.name;
  const headerLocation =
    activeInternalVendor ? undefined : vendor.locationLabel;
  const reputationVendorDefinition =
    vendorDefinitions[vendor.vendorHash] ?? vendorDefinition;
  const reputation = useMemo(
    () =>
      buildVendorReputationDisplay({
        vendorName: vendor.name,
        progression: vendor.progression,
        progressionDefinition: vendor.progression
          ? progressionDefinitions[vendor.progression.progressionHash]
          : undefined,
        factionIcon:
          getVendorDisplayIcon(reputationVendorDefinition, factionDefinitions) ||
          (reputationVendorDefinition?.factionHash
            ? factionDefinitions[reputationVendorDefinition.factionHash]
                ?.displayProperties?.icon
            : undefined),
      }),
    [
      factionDefinitions,
      progressionDefinitions,
      reputationVendorDefinition?.factionHash,
      vendor.name,
      vendor.progression,
    ]
  );

  return (
    <section className={cn(isExpanded && "ring-1 ring-inset ring-white/20")}>
      <div className="flex items-stretch">
        {activeInternalVendor && (
          <button
            type="button"
            onClick={() =>
              setInternalVendorHistory((history) => history.slice(0, -1))
            }
            className="group shrink-0 px-3 py-2 text-slate-400 transition-colors hover:text-white"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5 transition-transform duration-150 group-hover:scale-125" />
          </button>
        )}

        <button
          type="button"
          onClick={onToggleExpanded}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left transition-colors",
            isExpanded && "border-b border-white/10"
          )}
        >
          <div className="relative h-8 w-8 shrink-0">
            {headerIcon && (
              <Image
                src={getBungieImage(headerIcon)}
                alt=""
                fill
                sizes="32px"
                className="object-contain"
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h3 className="truncate text-sm font-bold uppercase tracking-wide text-white">
                {headerName}
              </h3>
              {headerLocation && (
                <span className="truncate text-xs text-slate-500">
                  {headerLocation}
                </span>
              )}
            </div>
          </div>

          {refreshLabel && !activeInternalVendor && (
            <div className="shrink-0 text-xs tabular-nums text-slate-400">
              {refreshLabel}
            </div>
          )}

          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-slate-500 transition-transform",
              isExpanded && "rotate-180"
            )}
          />
        </button>
      </div>

      {isExpanded && (
        <div className="flex flex-col lg:flex-row">
          {reputation && (
            <aside className="w-full shrink-0 border-b border-white/10 lg:w-44 lg:border-b-0 lg:border-r">
              <VendorReputationPanel reputation={reputation} />
            </aside>
          )}

          <div className="min-w-0 flex-1">
            <VendorCurrenciesBar
              currencyHashes={displayedVendor.currencies}
              currencyQuantities={currencyQuantities}
              itemDefinitions={itemDefinitions}
            />

            <div className="space-y-5 p-4">
              {groupedItems.map((category) => (
                <div
                  key={`${displayedVendor.vendorHash}-${String(category.categoryIndex)}`}
                >
                  <h4 className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                    {category.categoryName}
                  </h4>
                  <div className="flex flex-wrap content-start gap-2.5">
                    {category.items.map((saleItem) => {
                      const itemDefinition = itemDefinitions[saleItem.itemHash];
                      const internalVendorHash =
                        getInternalVendorHash(itemDefinition);
                      const internalVendor = internalVendorHash
                        ? internalVendorByHash[internalVendorHash]
                        : undefined;

                      return (
                        <VendorSaleItemTile
                          key={`${vendor.vendorHash}-${saleItem.vendorItemIndex}`}
                          saleItem={saleItem}
                          itemDefinition={itemDefinition}
                          costDefinitions={costDefinitions}
                          iconSize={iconSize}
                          internalVendor={internalVendor}
                          onInternalVendorOpen={() => {
                            if (!internalVendorHash) {
                              return;
                            }

                            setInternalVendorHistory((history) =>
                              history[history.length - 1] === internalVendorHash
                                ? history
                                : [...history, internalVendorHash]
                            );
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function VendorGroupSection({
  group,
  vendorDefinitions,
  itemDefinitions,
  costDefinitions,
  internalVendorByHash,
  progressionDefinitions,
  factionDefinitions,
  currencyQuantities,
  iconSize,
  collapsedVendorHashes,
  onToggleVendor,
}: {
  group: VendorGroup;
  vendorDefinitions: Record<number, VendorDefinition>;
  itemDefinitions: Record<number, any>;
  costDefinitions: Record<number, any>;
  internalVendorByHash: Record<number, Vendor>;
  progressionDefinitions: Record<number, any>;
  factionDefinitions: Record<number, any>;
  currencyQuantities: Record<string, number>;
  iconSize: ItemIconSize;
  collapsedVendorHashes: Record<number, boolean>;
  onToggleVendor: (vendorHash: number) => void;
}) {
  return (
    <section>
      <h2 className="border-b border-white/10 px-1 py-3 text-xs font-bold uppercase tracking-[0.28em] text-slate-400">
        {group.categoryName}
      </h2>

      <div className="divide-y divide-white/10">
        {group.vendors.map((vendor) => (
          <VendorPanel
            key={vendor.vendorHash}
            vendor={vendor}
            vendorDefinition={vendorDefinitions[vendor.vendorHash]}
            itemDefinitions={itemDefinitions}
            costDefinitions={costDefinitions}
            internalVendorByHash={internalVendorByHash}
            vendorDefinitions={vendorDefinitions}
            progressionDefinitions={progressionDefinitions}
            factionDefinitions={factionDefinitions}
            currencyQuantities={currencyQuantities}
            iconSize={iconSize}
            isExpanded={!collapsedVendorHashes[vendor.vendorHash]}
            onToggleExpanded={() => onToggleVendor(vendor.vendorHash)}
          />
        ))}
      </div>
    </section>
  );
}

export function VendorsBrowser() {
  const {
    profile,
    stats,
    allCharacters,
    selectCharacter,
    isLoggedIn,
    isLoading: profileLoading,
    membershipInfo,
  } = useDestinyProfileContext();

  const characterId = stats?.characterId;
  const [hideSilverItems, setHideSilverItems] = useState(false);
  const [showUnacquiredOnly, setShowUnacquiredOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [collapsedVendorHashes, setCollapsedVendorHashes] = useState<
    Record<number, boolean>
  >({});
  const iconSize = useSettingsStore((state) => state.iconSize);
  const setSearchQuery = useUIStore((state) => state.setHeaderSearchQuery);
  const setHeaderSearchVisible = useUIStore(
    (state) => state.setHeaderSearchVisible
  );
  const setHeaderSearchPlaceholder = useUIStore(
    (state) => state.setHeaderSearchPlaceholder
  );
  const [deferredSearchQuery, setDeferredSearchQuery] = useState(
    () => useUIStore.getState().headerSearchQuery
  );
  const activeFilterCount =
    Number(hideSilverItems) + Number(showUnacquiredOnly);

  useEffect(() => {
    const applyQuery = (nextQuery: string) => {
      startTransition(() => setDeferredSearchQuery(nextQuery));
    };

    applyQuery(useUIStore.getState().headerSearchQuery);

    return useUIStore.subscribe((state, previousState) => {
      if (state.headerSearchQuery !== previousState.headerSearchQuery) {
        applyQuery(state.headerSearchQuery);
      }
    });
  }, []);

  useEffect(() => {
    setHeaderSearchVisible(true);
    setHeaderSearchPlaceholder(
      "Search vendors, items, perks, areas..."
    );

    return () => {
      setHeaderSearchVisible(false);
      setHeaderSearchPlaceholder("Search");
      setSearchQuery("");
    };
  }, [setHeaderSearchPlaceholder, setHeaderSearchVisible, setSearchQuery]);

  const {
    vendorsData,
    vendorGroups,
    vendorDefinitions,
    destinationNames,
    currencyQuantities,
    isLoading: vendorsLoading,
    isFetching,
    refetch,
    error,
  } = useVendors({
    membershipType: membershipInfo?.membershipType,
    destinyMembershipId: membershipInfo?.membershipId,
    characterId,
    enabled: isLoggedIn && Boolean(characterId),
  });

  const ownedItemHashes = useMemo(
    () => getOwnedItemHashesFromProfile(profile),
    [profile]
  );

  const filteredVendorGroups = useMemo(
    () =>
      filterVendorGroups(vendorGroups, {
        hideSilverItems,
        showUnacquiredOnly,
        ownedItemHashes,
        vendorDefinitions,
      }),
    [
      vendorGroups,
      hideSilverItems,
      showUnacquiredOnly,
      ownedItemHashes,
      vendorDefinitions,
    ]
  );

  const itemHashes = useMemo(
    () => collectVendorItemHashes(filteredVendorGroups),
    [filteredVendorGroups]
  );

  const { definitions: mainItemDefinitions, isLoading: itemDefinitionsLoading } =
    useItemDefinitions(itemHashes);

  const internalVendorHashes = useMemo(
    () => collectInternalVendorHashes(filteredVendorGroups, mainItemDefinitions),
    [filteredVendorGroups, mainItemDefinitions]
  );
  const internalVendorHashKey = useMemo(
    () => [...internalVendorHashes].sort((a, b) => a - b).join(","),
    [internalVendorHashes]
  );

  const { data: internalVendorDefinitions = {} } = useQuery({
    queryKey: ["internalVendorDefinitions", internalVendorHashKey],
    queryFn: () =>
      fetchManifestDefinitions<VendorDefinition>(
        "DestinyVendorDefinition",
        internalVendorHashes
      ),
    enabled: internalVendorHashes.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });

  const normalizedInternalVendorDefinitions = useMemo(
    () => normalizeVendorDefinitionMap(internalVendorDefinitions),
    [internalVendorDefinitions]
  );
  const allVendorDefinitions = useMemo(
    () => ({
      ...vendorDefinitions,
      ...normalizedInternalVendorDefinitions,
    }),
    [normalizedInternalVendorDefinitions, vendorDefinitions]
  );
  const internalVendorByHash = useMemo(
    () =>
      buildInternalVendorByHash({
        vendorsData,
        internalVendorHashes,
        vendorDefinitions: allVendorDefinitions,
        currencyQuantities,
        destinationNames,
      }),
    [allVendorDefinitions, currencyQuantities, destinationNames, internalVendorHashes, vendorsData]
  );
  const internalVendorItemHashes = useMemo(
    () => collectInternalVendorItemHashes(internalVendorByHash),
    [internalVendorByHash]
  );
  const allItemHashes = useMemo(
    () => [...new Set([...itemHashes, ...internalVendorItemHashes])],
    [internalVendorItemHashes, itemHashes]
  );
  const { definitions: allItemDefinitions } = useItemDefinitions(allItemHashes);
  const itemDefinitions = allItemHashes.length > itemHashes.length
    ? allItemDefinitions
    : mainItemDefinitions;
  const { table: sandboxPerkDefinitions } = useManifestTable<any>(
    "DestinySandboxPerkDefinition"
  );
  const progressionHashes = useMemo(
    () => collectVendorProgressionHashes(vendorsData),
    [vendorsData]
  );
  const factionHashes = useMemo(
    () => collectVendorFactionHashes(allVendorDefinitions),
    [allVendorDefinitions]
  );
  const progressionHashKey = useMemo(
    () => [...progressionHashes].sort((a, b) => a - b).join(","),
    [progressionHashes]
  );
  const factionHashKey = useMemo(
    () => [...factionHashes].sort((a, b) => a - b).join(","),
    [factionHashes]
  );
  const { data: progressionDefinitions = {} } = useQuery({
    queryKey: ["vendorProgressionDefinitions", progressionHashKey],
    queryFn: () =>
      fetchManifestDefinitions<any>(
        "DestinyProgressionDefinition",
        progressionHashes
      ),
    enabled: progressionHashes.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });
  const { data: factionDefinitions = {} } = useQuery({
    queryKey: ["vendorFactionDefinitions", factionHashKey],
    queryFn: () =>
      fetchManifestDefinitions<any>("DestinyFactionDefinition", factionHashes),
    enabled: factionHashes.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });
  const normalizedProgressionDefinitions = useMemo(() => {
    const definitionsByHash: Record<number, any> = {};

    for (const [hashKey, definition] of Object.entries(progressionDefinitions)) {
      definitionsByHash[Number(hashKey)] = definition;
    }

    return definitionsByHash;
  }, [progressionDefinitions]);
  const normalizedFactionDefinitions = useMemo(() => {
    const definitionsByHash: Record<number, any> = {};

    for (const [hashKey, definition] of Object.entries(factionDefinitions)) {
      definitionsByHash[Number(hashKey)] = definition;
    }

    return definitionsByHash;
  }, [factionDefinitions]);

  const searchFilteredVendorGroups = useMemo(
    () =>
      filterVendorGroupsBySearch(filteredVendorGroups, deferredSearchQuery, {
        itemDefinitions,
        vendorDefinitions: allVendorDefinitions,
        sandboxPerkDefinitions,
        internalVendorByHash,
        destinationNames,
      }),
    [
      allVendorDefinitions,
      deferredSearchQuery,
      destinationNames,
      filteredVendorGroups,
      internalVendorByHash,
      itemDefinitions,
      sandboxPerkDefinitions,
    ]
  );

  useEffect(() => {
    const normalizedSearchQuery = deferredSearchQuery.trim();
    if (!normalizedSearchQuery) {
      return;
    }

    const matchingVendorHashes = collectMatchingVendorHashes(
      filteredVendorGroups,
      normalizedSearchQuery,
      {
        itemDefinitions,
        vendorDefinitions: allVendorDefinitions,
        sandboxPerkDefinitions,
        internalVendorByHash,
        destinationNames,
      }
    );

    if (matchingVendorHashes.length === 0) {
      return;
    }

    setCollapsedVendorHashes((currentCollapsedVendorHashes) => {
      const nextCollapsedVendorHashes = { ...currentCollapsedVendorHashes };
      let didChange = false;

      for (const vendorHash of matchingVendorHashes) {
        if (nextCollapsedVendorHashes[vendorHash]) {
          nextCollapsedVendorHashes[vendorHash] = false;
          didChange = true;
        }
      }

      return didChange ? nextCollapsedVendorHashes : currentCollapsedVendorHashes;
    });
  }, [
    allVendorDefinitions,
    deferredSearchQuery,
    destinationNames,
    filteredVendorGroups,
    internalVendorByHash,
    itemDefinitions,
    sandboxPerkDefinitions,
  ]);

  const visibleVendorHashes = useMemo(
    () =>
      searchFilteredVendorGroups.flatMap((group) =>
        group.vendors.map((vendor) => vendor.vendorHash)
      ),
    [searchFilteredVendorGroups]
  );
  const areAllVisibleVendorsCollapsed =
    visibleVendorHashes.length > 0 &&
    visibleVendorHashes.every((vendorHash) => collapsedVendorHashes[vendorHash]);
  const toggleVendorCollapsed = (vendorHash: number) => {
    setCollapsedVendorHashes((currentCollapsedVendorHashes) => ({
      ...currentCollapsedVendorHashes,
      [vendorHash]: !currentCollapsedVendorHashes[vendorHash],
    }));
  };
  const setAllVisibleVendorsCollapsed = (isCollapsed: boolean) => {
    const nextCollapsedVendorHashes: Record<number, boolean> = {};

    for (const vendorHash of visibleVendorHashes) {
      nextCollapsedVendorHashes[vendorHash] = isCollapsed;
    }

    setCollapsedVendorHashes((currentCollapsedVendorHashes) => ({
      ...currentCollapsedVendorHashes,
      ...nextCollapsedVendorHashes,
    }));
  };

  const isLoading =
    profileLoading ||
    vendorsLoading ||
    (itemHashes.length > 0 && itemDefinitionsLoading);

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <Store className="h-10 w-10 text-destiny-gold" />
        <h2 className="text-xl font-bold">Sign in to view Vendors</h2>
        <button
          onClick={loginWithBungie}
          className="rounded bg-destiny-gold px-6 py-2 font-bold text-black transition-colors hover:bg-yellow-500"
        >
          Login with Bungie
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="pb-20 pt-6">
      <div className="mx-auto max-w-[1800px] space-y-8 px-4 sm:px-6">
        <section className="border-b border-white/10 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {allCharacters.length > 0 && (
              <div className="min-h-16 flex-1 overflow-hidden">
                <div className="flex min-h-16 flex-wrap items-stretch gap-2 p-2">
                {allCharacters.map((character) => {
                  const isSelected = character.characterId === characterId;

                  return (
                    <button
                      key={character.characterId}
                      type="button"
                      className={cn(
                        "group relative min-h-12 min-w-36 overflow-hidden px-3 py-2 text-left transition-colors",
                        isSelected
                          ? "text-destiny-gold"
                          : "text-slate-300 hover:text-white"
                      )}
                      onClick={() => selectCharacter(character.characterId)}
                      title={`${CLASS_NAMES[character.classType]} vendors`}
                    >
                      {character.emblemBackgroundPath && (
                        <Image
                          src={character.emblemBackgroundPath}
                          alt=""
                          fill
                          sizes="160px"
                          className="object-cover opacity-35 transition-opacity group-hover:opacity-45"
                        />
                      )}
                      <span className="absolute inset-0 bg-black/60" />
                      <span
                        className={cn(
                          "absolute inset-y-2 left-0 w-0.5 transition-colors",
                          isSelected ? "bg-destiny-gold" : "bg-transparent"
                        )}
                      />
                      <span className="relative flex flex-col leading-none">
                        <span className="text-sm font-bold uppercase tracking-wide drop-shadow-md">
                          {CLASS_NAMES[character.classType]}
                        </span>
                      </span>
                    </button>
                  );
                })}
                </div>
              </div>
            )}

            <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="inline-flex h-10 items-center gap-2 rounded-sm border border-white/10 bg-white/5 px-3 text-xs font-bold uppercase tracking-wider text-slate-300 transition-colors hover:border-white/20 hover:text-white disabled:opacity-50"
              >
                <RefreshCw
                  className={cn("h-4 w-4", isFetching && "animate-spin")}
                />
                Refresh
              </button>

              <div className="relative">
                <button
                  type="button"
                  aria-label="Vendor filters"
                  aria-expanded={filtersOpen}
                  onClick={() => setFiltersOpen((open) => !open)}
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-sm border bg-white/5 text-slate-300 transition-colors hover:text-white",
                    filtersOpen || activeFilterCount > 0
                      ? "border-destiny-gold text-destiny-gold"
                      : "border-white/10 hover:border-white/20"
                  )}
                >
                  <Filter className="h-4 w-4" />
                  {activeFilterCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destiny-gold px-1 text-[10px] font-bold text-black">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {filtersOpen && (
                  <div className="absolute right-0 top-12 z-50 w-72 border border-white/10 bg-[#0f1115] p-4 shadow-2xl shadow-black/40">
                    <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3 text-slate-400">
                      <Filter className="h-4 w-4" />
                      <h2 className="text-sm font-bold uppercase tracking-widest">
                        Filters
                      </h2>
                    </div>

                    <div className="space-y-3">
                      <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={showUnacquiredOnly}
                          onChange={(event) =>
                            setShowUnacquiredOnly(event.target.checked)
                          }
                          className="mt-0.5 accent-destiny-gold"
                        />
                        <span>
                          <span className="block font-semibold text-white">
                            Unacquired only
                          </span>
                          <span className="text-xs text-slate-500">
                            Hide items you already own or have collected.
                          </span>
                        </span>
                      </label>

                      <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={hideSilverItems}
                          onChange={(event) =>
                            setHideSilverItems(event.target.checked)
                          }
                          className="mt-0.5 accent-destiny-gold"
                        />
                        <span>
                          <span className="block font-semibold text-white">
                            Hide Silver items
                          </span>
                          <span className="text-xs text-slate-500">
                            Hide Eververse and featured Silver listings.
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <main className="space-y-6">
          {error && (
            <div className="border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-200">
              Failed to load vendors. Try refreshing in a moment.
            </div>
          )}

          {!error && searchFilteredVendorGroups.length === 0 && (
            <div className="border border-dashed border-white/10 p-10 text-center text-slate-500">
              {deferredSearchQuery.trim()
                ? "No vendor inventory matches your search."
                : "No vendor inventory matches your current filters."}
            </div>
          )}

          {searchFilteredVendorGroups.map((group) => (
            <VendorGroupSection
              key={group.groupHash}
              group={group}
              vendorDefinitions={allVendorDefinitions}
              itemDefinitions={itemDefinitions}
              costDefinitions={itemDefinitions}
              internalVendorByHash={internalVendorByHash}
              progressionDefinitions={normalizedProgressionDefinitions}
              factionDefinitions={normalizedFactionDefinitions}
              currencyQuantities={currencyQuantities}
              iconSize={iconSize}
              collapsedVendorHashes={collapsedVendorHashes}
              onToggleVendor={toggleVendorCollapsed}
            />
          ))}
        </main>

        {visibleVendorHashes.length > 0 && (
          <div className="pointer-events-none sticky bottom-4 z-30 flex justify-end">
            <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2 border border-white/15 bg-[#0f151b]/75 p-2 shadow-2xl backdrop-blur-md">
              <button
                type="button"
                onClick={() =>
                  setAllVisibleVendorsCollapsed(!areAllVisibleVendorsCollapsed)
                }
                className={cn(
                  "flex items-center gap-2 border px-4 py-2 transition-all whitespace-nowrap",
                  areAllVisibleVendorsCollapsed
                    ? "bg-destiny-gold/10 border-destiny-gold text-destiny-gold hover:cursor-pointer"
                    : "border-white/10 text-slate-400 hover:border-white/70 hover:text-white hover:cursor-pointer"
                )}
                aria-pressed={areAllVisibleVendorsCollapsed}
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    areAllVisibleVendorsCollapsed && "-rotate-90"
                  )}
                />
                <span className="uppercase tracking-wider font-bold text-sm">
                  {areAllVisibleVendorsCollapsed ? "Expand All" : "Collapse All"}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
