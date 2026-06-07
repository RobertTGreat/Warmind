import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { X, ChevronRight, Star, Shield, Crosshair, Zap, Activity } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useDestinyProfileContext } from '@/components/DestinyProfileProvider';
import { getBungieImage, bungieApi, endpoints, insertSocketPlug, insertSocketPlugFree } from '@/lib/bungie';
import { BUCKETS } from '@/lib/destinyUtils';
import { useItemDefinitions } from '@/hooks/useItemDefinitions';
import { useClarityDescriptions } from '@/hooks/useClarityDescriptions';
import { useManifestTable } from '@/hooks/useManifestTable';
import { cn } from '@/lib/utils';
import useSWR from 'swr';
import { toast } from 'sonner';
import { PretextLineClamp } from '@/components/PretextLineClamp';
import {
    buildWeaponSocketGroups,
    collectWeaponPlugHashes,
    getWeaponPlugSetHashes,
    isFunctionalWeaponPerk,
    type WeaponSocketGroup,
} from '@/lib/weaponPlugAnalysis';
import {
    getExoticArmorTraitPlugs,
    getPlugDisplayText,
    getPlugHash,
    getPlugTypeText,
} from '@/lib/armorTraits';
import {
    formatArmorSetBonusRequirement,
    getArmorSetBonusInfo,
    type ArmorSetBonusInfo,
} from '@/lib/armorSetBonus';
import type { ClarityDescription } from '@/lib/clarityDescriptions';
import { StatHashes } from '@/lib/dim-stats';

const fetcher = (url: string) => bungieApi.get(url).then((res) => res.data);

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

// Stat order matching the screenshot/game
const WEAPON_STAT_ORDER = [
    4284895488, // Impact
    3614673599, // Blast Radius
    4043523819, // Guard Resistance
    2961396640, // Range
    3897883278, // Defense / Shield Duration
    2523465841, // Velocity
    155624089,  // Stability
    943549884,  // Handling
    4188031367, // Reload Speed
    4284893193, // Rounds Per Minute
    1345609583, // Aim Assistance
    3555269338, // Zoom
    2715839340, // Recoil Direction
    1931675084, // Inventory Size
    2715839340, // Recoil
    1591432999, // Accuracy
    447667954,  // Draw Time
    2591150011, // Charge Time
    2837207746, // Swing Speed
    3022301683, // Charge Rate
    3736853112, // Guard Efficiency
    2762071195, // Guard Endurance
];

function getActiveOverlaySocketOption(socketGroup: any) {
    return (
        socketGroup.options?.find((option: any) => option.isActive) ??
        socketGroup.options?.[0] ??
        null
    );
}

function getOverlayIntrinsicPlug(socketGroups: any[]) {
    const intrinsicSocketGroup = socketGroups.find((socketGroup) => socketGroup.isIntrinsic);

    return intrinsicSocketGroup ? getActiveOverlaySocketOption(intrinsicSocketGroup) : null;
}

function getArmorSetBonusClarityHashes(armorSetBonus: ArmorSetBonusInfo | null) {
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

function getBasicSocketTitle(socketGroup: WeaponSocketGroup) {
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

function getDetailDamageTypeHash(itemDefinition: any, instanceData: any): number | null {
    const damageTypeHash =
        instanceData?.damageTypeHash ??
        instanceData?.damageType ??
        itemDefinition?.defaultDamageTypeHash;
    const numericDamageTypeHash = Number(damageTypeHash);

    return Number.isFinite(numericDamageTypeHash) ? numericDamageTypeHash : null;
}

function getDetailDamageTypeIcon(
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

export function ItemDetailsOverlay() {
  const detailsItem = useUIStore((state) => state.detailsItem);
  const setDetailsItem = useUIStore((state) => state.setDetailsItem);
  const setFullDetailsItem = useUIStore((state) => state.setFullDetailsItem);
  const { profile, membershipInfo, updateItemSocketPlug } = useDestinyProfileContext();
  const { table: equipableItemSetDefinitions } =
    useManifestTable<any>("DestinyEquipableItemSetDefinition");
  const { table: sandboxPerkDefinitions } =
    useManifestTable<any>("DestinySandboxPerkDefinition");
  const { table: damageTypeDefinitions } =
    useManifestTable<any>("DestinyDamageTypeDefinition");
  
  // Fetch definition for the item
  const { definitions } = useItemDefinitions(detailsItem ? [detailsItem.itemHash] : []);
  const itemDef = definitions[detailsItem?.itemHash || 0];

  const [socketPlugOverrides, setSocketPlugOverrides] = useState<Record<string, Record<number, number>>>({});
  const instance = detailsItem?.itemInstanceId ? profile?.itemComponents?.instances?.data?.[detailsItem.itemInstanceId] : undefined;
  const profileSockets = detailsItem?.itemInstanceId ? profile?.itemComponents?.sockets?.data?.[detailsItem.itemInstanceId]?.sockets : undefined;
  const activeSocketPlugOverrides = detailsItem?.itemInstanceId
    ? socketPlugOverrides[detailsItem.itemInstanceId]
    : undefined;
  const sockets = useMemo(() => {
    if (!profileSockets) return undefined;
    if (!activeSocketPlugOverrides) return profileSockets;

    return profileSockets.map((socket: any, socketIndex: number) => {
      const overridePlugHash = activeSocketPlugOverrides[socketIndex];

      return overridePlugHash
        ? {
            ...socket,
            plugHash: overridePlugHash,
          }
        : socket;
    });
  }, [activeSocketPlugOverrides, profileSockets]);
  const stats = detailsItem?.itemInstanceId ? profile?.itemComponents?.stats?.data?.[detailsItem.itemInstanceId]?.stats : undefined;
  const objectives = detailsItem?.itemInstanceId ? profile?.itemComponents?.objectives?.data?.[detailsItem.itemInstanceId]?.objectives : undefined;
  const selectedSocketsData = useMemo(
    () => (sockets ? { sockets } : undefined),
    [sockets]
  );
  const reusablePlugsData = detailsItem?.itemInstanceId
    ? profile?.itemComponents?.reusablePlugs?.data?.[detailsItem.itemInstanceId]?.plugs
    : undefined;
  const plugSetHashes = useMemo(
    () => getWeaponPlugSetHashes(itemDef),
    [itemDef]
  );
  const { definitions: plugSetDefinitions } = usePlugSets(plugSetHashes);
  const overlayPlugHashes = useMemo(
    () =>
      collectWeaponPlugHashes({
        itemDefinition: itemDef,
        socketsData: selectedSocketsData,
        reusablePlugsData,
        plugSetDefinitions,
      }),
    [itemDef, selectedSocketsData, reusablePlugsData, plugSetDefinitions]
  );
  const { definitions: overlayPlugDefinitions } = useItemDefinitions(overlayPlugHashes);
  const overlaySocketGroups = useMemo(
    () =>
      buildWeaponSocketGroups({
        itemDefinition: itemDef,
        socketsData: selectedSocketsData,
        reusablePlugsData,
        plugDefinitions: overlayPlugDefinitions,
        plugSetDefinitions,
      }),
    [
      itemDef,
      selectedSocketsData,
      reusablePlugsData,
      overlayPlugDefinitions,
      plugSetDefinitions,
    ]
  );
  const overlayIntrinsicPlug = useMemo(
    () => getOverlayIntrinsicPlug(overlaySocketGroups),
    [overlaySocketGroups]
  );
  const exoticArmorTraitPlugs = useMemo(
    () =>
      getExoticArmorTraitPlugs({
        itemDefinition: itemDef,
        itemType: itemDef?.itemTypeDisplayName ?? "",
        socketsData: selectedSocketsData,
        plugDefinitions: overlayPlugDefinitions,
      }),
    [itemDef, selectedSocketsData, overlayPlugDefinitions]
  );
  const detailTraitPlugs = useMemo(() => {
    if (itemDef?.itemType === 2) return exoticArmorTraitPlugs;

    return overlayIntrinsicPlug?.definition ? [overlayIntrinsicPlug.definition] : [];
  }, [itemDef, exoticArmorTraitPlugs, overlayIntrinsicPlug]);
  const detailTraitHashes = useMemo(
    () =>
      detailTraitPlugs
        .map((traitPlug) => getPlugHash(traitPlug))
        .filter((traitHash): traitHash is number => Boolean(traitHash)),
    [detailTraitPlugs]
  );
  const armorSetBonus = useMemo(
    () =>
      getArmorSetBonusInfo({
        itemDefinition: itemDef,
        itemType: itemDef?.itemTypeDisplayName ?? "",
        equipableItemSetDefinitions,
        sandboxPerkDefinitions,
        socketsData: selectedSocketsData,
        plugDefinitions: overlayPlugDefinitions,
      }),
    [
      equipableItemSetDefinitions,
      itemDef,
      overlayPlugDefinitions,
      sandboxPerkDefinitions,
      selectedSocketsData,
    ]
  );
  const armorSetBonusClarityHashes = useMemo(
    () => getArmorSetBonusClarityHashes(armorSetBonus),
    [armorSetBonus]
  );
  const basicClarityHashes = useMemo(
    () =>
      Array.from(
        new Set([
          ...overlayPlugHashes,
          ...detailTraitHashes,
          ...armorSetBonusClarityHashes,
        ])
      ),
    [armorSetBonusClarityHashes, detailTraitHashes, overlayPlugHashes]
  );
  const { descriptions: basicClarityDescriptions } =
    useClarityDescriptions(basicClarityHashes);
  const tierNumber = instance?.gearTier ?? 0;
  const damageTypeHash = getDetailDamageTypeHash(itemDef, instance);
  const damageTypeIcon = getDetailDamageTypeIcon(damageTypeHash, damageTypeDefinitions);
  const [backgroundImageFailed, setBackgroundImageFailed] = useState(false);

  useEffect(() => {
    setBackgroundImageFailed(false);
  }, [detailsItem?.itemHash, itemDef?.screenshot]);

  const handleSocketPlugChange = useCallback(
    (itemInstanceId: string, socketIndex: number, plugItemHash: number) => {
      updateItemSocketPlug(itemInstanceId, socketIndex, plugItemHash);
      setSocketPlugOverrides((currentOverrides) => ({
        ...currentOverrides,
        [itemInstanceId]: {
          ...(currentOverrides[itemInstanceId] ?? {}),
          [socketIndex]: plugItemHash,
        },
      }));
    },
    [updateItemSocketPlug]
  );

  if (!detailsItem) return null;

    const isSubclass = itemDef?.inventory?.bucketTypeHash === BUCKETS.SUBCLASS;
    const isWeapon = itemDef?.itemType === 3;
    const isArmor = itemDef?.itemType === 2;
    const backgroundImage = itemDef?.screenshot && !backgroundImageFailed
        ? getBungieImage(itemDef.screenshot)
        : "/blank.jpg";
    const handleOpenFullDetails = () => {
        setFullDetailsItem({
            itemHash: detailsItem.itemHash,
            itemInstanceId: detailsItem.itemInstanceId,
            ownerId: detailsItem.ownerId,
        });
        setDetailsItem(null);
    };

    return (
    <div 
        className="fixed inset-0 z-100 flex justify-center items-center p-4 md:p-8 bg-black/90 backdrop-blur-sm"
        onClick={() => setDetailsItem(null)}
    >
        <div 
            className="relative isolate flex h-full max-h-[calc(100vh-2rem)] w-full max-w-[1400px] flex-col overflow-hidden rounded-lg border border-white/10 bg-[#1e1e1e] shadow-2xl md:aspect-video md:h-auto md:max-h-[90vh] md:flex-row"
            onClick={(e) => e.stopPropagation()}
        >
             {/* Background Image (Blurred/Faded) */}
             <div className="absolute inset-0 z-[-1] bg-[#0f0f0f]">
                <Image
                    src={backgroundImage}
                    fill
                    sizes="100vw"
                    className="object-cover opacity-60"
                    onError={() => setBackgroundImageFailed(true)}
                    alt=""
                />
                {/* Gradients to make text readable */}
                <div className="absolute inset-0 bg-linear-to-r from-[#121212] via-[#121212]/80 to-transparent w-2/3" />
                <div className="absolute inset-0 bg-linear-to-t from-[#121212] via-transparent to-transparent h-1/2 bottom-0 top-auto" />
                <div className="absolute inset-y-0 right-0 w-1/3 bg-linear-to-l from-[#121212]/90 to-transparent" />
             </div>

             {/* Controls */}
             <div className="absolute right-4 top-4 z-50 flex max-w-[calc(100%-2rem)] items-center gap-2 md:right-6 md:top-6 md:gap-4">
                {isWeapon && (
                    <button
                        onClick={handleOpenFullDetails}
                        className="whitespace-nowrap border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-bold uppercase text-slate-300 transition-colors hover:border-destiny-gold/50 hover:text-destiny-gold"
                    >
                        Full Details
                    </button>
                )}

                <button 
                    onClick={() => setDetailsItem(null)}
                    className="p-2 text-slate-400 hover:text-white bg-black/20 hover:bg-white/10 rounded-full transition-colors"
                >
                    <X className="w-8 h-8" />
                </button>
             </div>

             {/* Left Panel: Header & Sockets */}
             <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden p-5 scrollbar-hide md:h-full md:w-[500px] md:flex-none md:gap-8 md:p-8">
                  
                  {/* Header */}
                  <div className="flex gap-5 items-start">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-sm border border-white/20 bg-[#2a2a2a] shadow-lg">
                          {itemDef?.displayProperties?.icon && (
                              <Image 
                                src={getBungieImage(itemDef.displayProperties.icon)} 
                                fill 
                                sizes="64px"
                                className="object-cover" 
                                alt="" 
                              />
                          )}
                          {/* Season Watermark Overlay if available */}
                          {itemDef?.iconWatermark && (
                              <Image 
                                src={getBungieImage(itemDef.iconWatermark)} 
                                fill
                                sizes="64px"
                                className="object-cover opacity-80"
                                alt=""
                              />
                          )}
                      </div>
                      <div className="min-w-0 flex-1 pr-24 md:pr-0">
                          <h2 className="break-words text-2xl font-bold uppercase leading-tight tracking-wide text-white md:text-3xl">{itemDef?.displayProperties?.name}</h2>
                      </div>
                  </div>

                  <BasicItemInfo
                    traitPlugs={isWeapon ? [] : detailTraitPlugs}
                    clarityDescriptions={basicClarityDescriptions}
                    armorSetBonus={armorSetBonus}
                    itemDef={itemDef}
                  />

                 {/* Sockets Section (Perks & Mods) */}
                 <div className="flex-1 mt-4">
                     {isSubclass ? (
                        <SubclassStats 
                            sockets={sockets}
                            itemDef={itemDef}
                            profile={profile}
                            item={detailsItem}
                            onSocketPlugChange={handleSocketPlugChange}
                        />
                     ) : (
                         sockets && (
                             <SocketViewer 
                                 sockets={sockets} 
                                 itemDef={itemDef} 
                                 item={detailsItem}
                                 profile={profile}
                                 membershipInfo={membershipInfo}
                                 isSubclass={isSubclass}
                                 clarityDescriptions={basicClarityDescriptions}
                                 onSocketPlugChange={handleSocketPlugChange}
                             />
                         )
                     )}
                 </div>
             </div>

             {/* Middle Spacer (Allows background to show) */}
             <div className="hidden md:block flex-1 relative overflow-hidden">
                <div className="absolute bottom-12 left-12 text-white/20 text-sm font-bold uppercase tracking-[0.2em] space-y-1 select-none pointer-events-none">
                    {instance?.itemInstanceId && <p>ID: {instance.itemInstanceId}</p>}
                </div>
             </div>

            {/* Right Panel: Stats & History */}
            <div className="relative z-10 flex max-h-[40vh] w-full shrink-0 flex-col gap-8 overflow-y-auto overflow-x-hidden border-t border-white/5 bg-[#121212]/60 p-5 md:h-full md:max-h-none md:w-[350px] md:border-l md:border-t-0 md:bg-transparent md:p-8 lg:w-[400px]">
               {/* Stats */}
               <div className="mt-auto">
                   {!isSubclass && (
                       <ItemStats 
                           stats={stats} 
                           itemDef={itemDef} 
                           instance={instance} 
                           objectives={objectives}
                           isWeapon={isWeapon}
                           tierNumber={tierNumber}
                           damageTypeIcon={damageTypeIcon}
                       />
                   )}
               </div>
            </div>
        </div>
    </div>
  );
}

// --- Sub-components ---

function BasicItemInfo({
    traitPlugs,
    clarityDescriptions,
    armorSetBonus,
    itemDef,
}: {
    traitPlugs: any[];
    clarityDescriptions: Record<number, ClarityDescription>;
    armorSetBonus: ArmorSetBonusInfo | null;
    itemDef: any;
}) {
    const hasTraits = traitPlugs.length > 0;
    const hasArmorSetBonus = Boolean(armorSetBonus);

    if (!hasTraits && !hasArmorSetBonus) return null;

    const isExotic = itemDef?.inventory?.tierTypeName === "Exotic";

    return (
        <div className="space-y-3 overflow-hidden border-y border-white/10 py-4">
            {hasTraits && (
                <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                        {isExotic ? "Exotic Trait" : "Intrinsic Trait"}
                    </p>
                    <div className="space-y-2">
                        {traitPlugs.map((traitPlug: any, traitIndex: number) => (
                            <BasicTraitCard
                                key={getPlugHash(traitPlug) ?? traitIndex}
                                traitPlug={traitPlug}
                                clarityDescription={
                                    getPlugHash(traitPlug)
                                        ? clarityDescriptions[getPlugHash(traitPlug)!]
                                        : undefined
                                }
                            />
                        ))}
                    </div>
                </div>
            )}

            {armorSetBonus && (
                <BasicArmorSetBonus
                    armorSetBonus={armorSetBonus}
                    clarityDescriptions={clarityDescriptions}
                />
            )}
        </div>
    );
}

function BasicTraitCard({
    traitPlug,
    clarityDescription,
}: {
    traitPlug: any;
    clarityDescription?: ClarityDescription;
}) {
    const traitName = getPlugDisplayText(traitPlug, "name");
    const traitDescription = getPlugDisplayText(traitPlug, "description");
    const traitType = getPlugTypeText(traitPlug);
    const traitIcon = traitPlug?.displayProperties?.icon
        ? getBungieImage(traitPlug.displayProperties.icon)
        : null;

    return (
        <div className="space-y-3 border border-white/10 bg-black/20 p-3">
            <div className="flex min-w-0 items-start gap-3">
            {traitIcon && (
                <div className="relative h-12 w-12 shrink-0 overflow-hidden">
                    <Image src={traitIcon} alt="" fill sizes="48px" className="object-contain" />
                </div>
            )}
            <div className="min-w-0">
                <p className="break-words text-sm font-bold leading-tight text-white">{traitName}</p>
                {traitType && (
                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-destiny-gold">
                        {traitType}
                    </p>
                )}
                {traitDescription && (
                    <p className="mt-1 break-words text-xs leading-relaxed text-slate-300">
                        {traitDescription}
                    </p>
                )}
            </div>
            </div>
            <BasicClaritySection clarityDescription={clarityDescription} />
        </div>
    );
}

function BasicArmorSetBonus({
    armorSetBonus,
    clarityDescriptions,
}: {
    armorSetBonus: ArmorSetBonusInfo;
    clarityDescriptions: Record<number, ClarityDescription>;
}) {
    return (
        <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Armor Set Bonus
            </p>
            <div className="flex items-start gap-3 border border-white/10 bg-black/20 p-3">
                {armorSetBonus.icon && (
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden border border-white/10 bg-white/5">
                        <Image
                            src={getBungieImage(armorSetBonus.icon)}
                            alt=""
                            fill
                            sizes="40px"
                            className="object-cover"
                        />
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-bold leading-tight text-destiny-gold">
                        {armorSetBonus.name}
                    </p>
                    <div className="mt-2 space-y-2">
                        {armorSetBonus.bonuses.map((bonusTier) => (
                            <div
                                key={`${bonusTier.requiredSetCount ?? "bonus"}-${bonusTier.sandboxPerkHash ?? bonusTier.plugHash ?? bonusTier.name}`}
                                className="border border-white/10 bg-black/20 p-2"
                            >
                                <p className="text-[11px] font-bold uppercase tracking-wide text-destiny-gold">
                                    {formatArmorSetBonusRequirement(bonusTier.requiredSetCount)}
                                    {bonusTier.name && (
                                        <span className="ml-1 normal-case tracking-normal text-slate-100">
                                            - {bonusTier.name}
                                        </span>
                                    )}
                                </p>
                                {bonusTier.description && (
                                    <p className="mt-1 break-words text-xs leading-relaxed text-slate-300">
                                        {bonusTier.description}
                                    </p>
                                )}
                                <BasicClaritySection
                                    clarityDescription={
                                        clarityDescriptions[
                                            bonusTier.plugHash ??
                                            bonusTier.sandboxPerkHash ??
                                            0
                                        ]
                                    }
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function BasicClaritySection({
    clarityDescription,
}: {
    clarityDescription?: ClarityDescription;
}) {
    if (!clarityDescription) return null;

    return (
        <div className="mt-3 border-t border-white/10 pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
                Clarity
            </p>
            <div className="mt-1 space-y-1.5 text-xs leading-relaxed text-slate-200">
                {clarityDescription.lines.map((line, lineIndex) =>
                    line ? (
                        <p
                            key={`${clarityDescription.hash}-${lineIndex}`}
                            className="break-words"
                        >
                            {line}
                        </p>
                    ) : (
                        <div
                            key={`${clarityDescription.hash}-${lineIndex}`}
                            className="h-1"
                            aria-hidden="true"
                        />
                    )
                )}
            </div>
        </div>
    );
}

function DetailTierDiamonds({ tier }: { tier?: number }) {
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

function isRoundsPerMinuteStat(statHash: number, statName: string): boolean {
    const normalizedStatName = statName.toLowerCase();

    return (
        statHash === StatHashes.RoundsPerMinute ||
        normalizedStatName === "rpm" ||
        normalizedStatName.includes("rounds per minute")
    );
}

function ItemStats({
    stats,
    itemDef,
    instance,
    objectives,
    isWeapon,
    tierNumber,
    damageTypeIcon,
}: any) {
    const relevantStats = useMemo(() => {
        if (!itemDef?.stats?.stats) return [];
        
        // Get raw stats from definition
        const defStats = itemDef.stats.stats;
        
        // Create array and merge with live stats
        let merged = Object.entries(defStats).map(([hash, def]: [string, any]) => {
            const statHash = Number(hash);
            const liveValue = stats?.[hash]?.value ?? def.value;
            return {
                hash: statHash,
                value: liveValue,
                ...def
            };
        });

        // Filter and Sort
        if (isWeapon) {
            merged = merged
                .filter(s => WEAPON_STAT_ORDER.includes(s.hash))
                .sort((a, b) => WEAPON_STAT_ORDER.indexOf(a.hash) - WEAPON_STAT_ORDER.indexOf(b.hash));
        } else {
            // Armor or other: Sort by index
            merged.sort((a, b) => a.index - b.index);
        }
        
        return merged;
    }, [itemDef, stats, isWeapon]);

    // Calculate Enemies Defeated from Objectives or Kill Tracker
    const killCount = useMemo(() => {
        if (!objectives) return null;
        // Look for kill tracker objectives (common hash patterns or just display)
        // This is simplified; real kill trackers are complex plugs.
        // But often the instance stats have a "Kills" record if it's a masterwork.
        // Let's check objectives for now.
        const killObj = objectives.find((o: any) => o.objectiveHash === 2302094943 || o.objectiveHash === 74070459); // Examples
        if (killObj) return killObj.progress;
        return null;
    }, [objectives]);
    const primaryStatValue = instance?.primaryStat?.value ?? itemDef?.primaryStat?.value ?? 0;

    return (
        <div className="flex flex-col gap-6">
             {/* Weapon Tier / Primary Stat */}
             <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/20 pb-4">
                 <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
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
                             <div className="text-sm text-slate-200">Power</div>
                            <div className="text-5xl font-bold leading-none text-white">
                                {primaryStatValue}
                            </div>
                        </div>
                    </div>
                 {tierNumber > 1 && (
                     <div className="pb-1">
                         <div className="text-sm font-medium text-slate-200">
                             {isWeapon ? "Weapon Tier" : "Armor Tier"}
                         </div>
                         <div className="mt-2">
                             <DetailTierDiamonds tier={tierNumber} />
                         </div>
                     </div>
                 )}
                 </div>
                 {killCount !== null && (
                     <div className="text-right">
                         <div className="text-slate-400 text-xs uppercase font-bold tracking-widest mb-1">Enemies Defeated</div>
                         <div className="text-2xl font-bold text-white">{killCount.toLocaleString()}</div>
                     </div>
                 )}
             </div>

             <div className="flex flex-col gap-2">
                 {relevantStats.map((stat: any) => (
                     <StatRow key={stat.hash} statHash={stat.hash} value={stat.value} isWeapon={isWeapon} />
                 ))}
             </div>
        </div>
    );
}

function StatRow({ statHash, value, isWeapon }: { statHash: number, value: number, isWeapon: boolean }) {
    const { data } = useSWR(endpoints.getStatDefinition(statHash), fetcher);
    const def = data?.Response;

    if (!def) return null;
    // Filter out "Attack" / "Defense" usually shown in header
    if (["Attack", "Defense", "Power"].includes(def.displayProperties.name)) return null;

    // Bar Logic
    const statName = def.displayProperties.name ?? "";
    const displayStatName = isRoundsPerMinuteStat(statHash, statName) ? "RPM" : statName;
    const nonBarStatNames = [
        "Recoil Direction",
        "Magazine",
        "Draw Time",
        "Charge Time",
        "Swing Speed",
    ];
    const showBar =
        isWeapon &&
        !isRoundsPerMinuteStat(statHash, statName) &&
        !nonBarStatNames.includes(displayStatName);

    return (
        <div className="flex items-center gap-4 text-sm group">
            <div className="w-32 text-slate-400 font-bold uppercase text-[11px] tracking-wider text-right group-hover:text-white transition-colors truncate">
                {displayStatName}
            </div>
            <div className="flex-1 flex items-center gap-3">
                {showBar ? (
                    <div className="flex-1 h-3 bg-white/10 overflow-hidden">
                        <div 
                            className={cn(
                                "h-full transition-all duration-500",
                                "bg-white"
                            )}
                            style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} 
                        />
                    </div>
                ) : (
                    <div className="flex-1" />
                )}
                <div className="w-8 text-right font-bold text-white">{value}</div>
            </div>
        </div>
    );
}

// Hook for plug sets
function usePlugSets(hashes: number[]) {
    const [definitions, setDefinitions] = useState<Record<number, any>>({});
    const uniqueHashes = useMemo(() => Array.from(new Set(hashes)).filter(h => h), [hashes]);
    const hashesKey = JSON.stringify(uniqueHashes.sort());

    useEffect(() => {
        if (!uniqueHashes.length) return;
        const load = async () => {
            const newDefs: Record<number, any> = {};
            await Promise.all(uniqueHashes.map(async (h) => {
                try {
                    const res = await bungieApi.get(endpoints.getPlugSetDefinition(h));
                    newDefs[h] = res.data.Response;
                } catch (e) {
                    // console.error(`Failed to fetch plugset ${h}`, e);
                }
            }));
            setDefinitions(newDefs);
        };
        load();
    }, [hashesKey]);
    return { definitions };
}

function SubclassStats({ sockets, itemDef, profile, item, onSocketPlugChange }: any) {
    const { membershipInfo } = useDestinyProfileContext();
    const [selectedSocket, setSelectedSocket] = useState<{ socketIndex: number, category: string } | null>(null);
    const [hoveredPlug, setHoveredPlug] = useState<any>(null);
    
    // reusablePlugs uses string keys like "0", "1", etc.
    const reusablePlugsData = profile?.itemComponents?.reusablePlugs?.data?.[item?.itemInstanceId]?.plugs;
    
    // 1. Identify PlugSet Hashes from itemDef
    const plugSetHashes = useMemo(() => {
        if (!itemDef?.sockets?.socketEntries) return [];
        return itemDef.sockets.socketEntries
            .map((s: any) => s.reusablePlugSetHash || s.randomizedPlugSetHash)
            .filter((h: number) => h);
    }, [itemDef]);

    // 2. Fetch PlugSets
    const { definitions: plugSets } = usePlugSets(plugSetHashes);

    // 3. Gather all plug hashes including available options from all sources
    const allPlugHashes = useMemo(() => {
        const hashes = new Set<number>();
        
        // Current equipped plugs
        sockets?.forEach((s: any) => {
            if (s.plugHash) hashes.add(s.plugHash);
        });
        
        // Reusable plugs from profile (uses string keys)
        if (reusablePlugsData) {
            Object.values(reusablePlugsData).forEach((plugs: any) => {
                if (Array.isArray(plugs)) {
                    plugs.forEach((p: any) => {
                        if (p.plugItemHash) hashes.add(p.plugItemHash);
                    });
                }
            });
        }
        
        // Static socket definitions
        if (itemDef?.sockets?.socketEntries) {
            itemDef.sockets.socketEntries.forEach((entry: any) => {
                if (entry.reusablePlugItems) {
                    entry.reusablePlugItems.forEach((p: any) => {
                        if (p.plugItemHash) hashes.add(p.plugItemHash);
                    });
                }
                // Add from PlugSets if available
                const setHash = entry.reusablePlugSetHash || entry.randomizedPlugSetHash;
                if (setHash && plugSets[setHash]) {
                    plugSets[setHash].reusablePlugItems?.forEach((p: any) => {
                        if (p.plugItemHash) hashes.add(p.plugItemHash);
                    });
                }
            });
        }
        
        return Array.from(hashes);
    }, [sockets, reusablePlugsData, itemDef, plugSets]);

    const { definitions: plugDefs } = useItemDefinitions(allPlugHashes);

    // Categorize sockets by type with available options
    const categorized = useMemo(() => {
        if (!sockets || !plugDefs) return { 
            super: null, classAbility: null, melee: null, grenade: null, 
            aspects: [], fragments: [], movement: null 
        };
        
        const result: Record<string, any> = {
            super: null,
            classAbility: null,
            melee: null,
            grenade: null,
            movement: null,
            aspects: [],
            fragments: []
        };

        sockets.forEach((socket: any, idx: number) => {
            const currentPlug = plugDefs[socket.plugHash];
            if (!currentPlug) return;

            const typeName = currentPlug.itemTypeDisplayName?.toLowerCase() || "";
            const category = currentPlug.plug?.plugCategoryIdentifier?.toLowerCase() || "";

            // Get available options for this socket - use STRING key for reusablePlugsData
            const socketKey = String(idx);
            let availablePlugs: any[] = [];
            const seenHashes = new Set<number>();
            
            // Helper to add plug without duplicates
            const addPlug = (hash: number, def: any) => {
                if (!seenHashes.has(hash) && def) {
                    // Filter out classified/redacted/dummies if needed
                    if (def.redacted || def.displayProperties?.name === "Classified") return;
                    
                    seenHashes.add(hash);
                    availablePlugs.push({ hash, def });
                }
            };
            
            // 1. Profile Reusable Plugs (Unlocked)
            if (reusablePlugsData?.[socketKey] && Array.isArray(reusablePlugsData[socketKey])) {
                reusablePlugsData[socketKey].forEach((p: any) => {
                    addPlug(p.plugItemHash, plugDefs[p.plugItemHash]);
                });
            }
            
            // 2. Socket-specific reusable plugs (Static)
            if (socket.reusablePlugs && Array.isArray(socket.reusablePlugs)) {
                socket.reusablePlugs.forEach((p: any) => {
                    addPlug(p.plugItemHash, plugDefs[p.plugItemHash]);
                });
            }
            
            // 3. Definition fallback + PlugSets
            if (itemDef?.sockets?.socketEntries?.[idx]) {
                const entry = itemDef.sockets.socketEntries[idx];
                
                // Static Items
                if (entry.reusablePlugItems) {
                    entry.reusablePlugItems.forEach((p: any) => {
                        addPlug(p.plugItemHash, plugDefs[p.plugItemHash]);
                    });
                }
                
                // Initial Item
                if (entry.singleInitialItemHash && plugDefs[entry.singleInitialItemHash]) {
                    addPlug(entry.singleInitialItemHash, plugDefs[entry.singleInitialItemHash]);
                }

                // PlugSets (Expanded)
                const setHash = entry.reusablePlugSetHash || entry.randomizedPlugSetHash;
                if (setHash && plugSets[setHash]) {
                     plugSets[setHash].reusablePlugItems?.forEach((p: any) => {
                        addPlug(p.plugItemHash, plugDefs[p.plugItemHash]);
                     });
                }
            }
            
            // Always ensure current plug is in the list
            if (currentPlug && !seenHashes.has(socket.plugHash)) {
                availablePlugs.unshift({ hash: socket.plugHash, def: currentPlug });
            }

            const socketData = {
                currentPlug,
                socketIndex: idx,
                activeHash: socket.plugHash,
                options: availablePlugs,
            };

            // Super abilities
            if (typeName.includes("super") || category.includes("super")) {
                result.super = socketData;
            }
            // Class abilities
            else if (typeName.includes("class ability") || category.includes("class_abilities")) {
                result.classAbility = socketData;
            }
            // Movement abilities (Blink, Glide, etc)
            else if (category.includes("movement") || typeName.includes("jump") || typeName.includes("glide") || typeName.includes("lift") || typeName.includes("blink")) {
                result.movement = socketData;
            }
            // Melee
            else if (typeName.includes("melee") || category.includes("melee")) {
                result.melee = socketData;
            }
            // Grenade
            else if (typeName.includes("grenade") || category.includes("grenade")) {
                result.grenade = socketData;
            }
            // Aspects
            else if (typeName.includes("aspect") || category.includes("aspects")) {
                result.aspects.push(socketData);
            }
            // Fragments
            else if (typeName.includes("fragment") || category.includes("fragments")) {
                result.fragments.push(socketData);
            }
        });

        return result;
    }, [sockets, plugDefs, reusablePlugsData, itemDef, plugSets]);

    const handleEquipPlug = async (socketIndex: number, plugHash: number, plugName: string) => {
        if (!membershipInfo || !item?.itemInstanceId) {
            toast.error("Unable to equip - missing data");
            return;
        }

        // Find character ID
        let characterId = item.characterId;
        if (!characterId && profile) {
            characterId = Object.keys(profile.characters?.data || {})[0];
        }

        try {
            toast.loading(`Equipping ${plugName}...`, { id: 'equip-plug' });
            
            // Subclass abilities are FREE to swap - use insertSocketPlugFree
            // This doesn't require the AdvancedWriteActions scope
            // Reference: https://github.com/DestinyItemManager/DIM/blob/master/src/app/inventory/advanced-write-actions.ts
            await insertSocketPlugFree(
                item.itemInstanceId,
                plugHash,
                socketIndex,
                characterId,
                membershipInfo.membershipType
            );
            onSocketPlugChange?.(item.itemInstanceId, socketIndex, plugHash);
            
            toast.success(`Equipped ${plugName}`, { id: 'equip-plug' });
        } catch (error: any) {
            const bungieError = error.response?.data;
            const message = bungieError?.Message || error.message || "Failed to equip";
            toast.error(message, { id: 'equip-plug' });
        }

        setSelectedSocket(null);
    };

    // Ability Selector Component
    const AbilitySelector = ({ 
        socketData, 
        label, 
        size = 'medium',
        category
    }: { 
        socketData: any, 
        label: string, 
        size?: 'small' | 'medium' | 'large',
        category: string
    }) => {
        if (!socketData) return null;
        
        const plug = socketData.currentPlug;
        const isSelected = selectedSocket?.socketIndex === socketData.socketIndex;
        const hasOptions = socketData.options.length >= 1; // Always clickable if any options
        
        const sizeClasses = {
            small: 'w-12 h-12',
            medium: 'w-16 h-16',
            large: 'w-20 h-20'
        };

        return (
            <div className="flex flex-col items-center gap-2">
                <button
                    onClick={() => hasOptions && setSelectedSocket(isSelected ? null : { socketIndex: socketData.socketIndex, category })}
                    onMouseEnter={() => setHoveredPlug(plug)}
                    onMouseLeave={() => setHoveredPlug(null)}
                    className={cn(
                        "relative rounded-lg overflow-hidden border-2 transition-all group",
                        sizeClasses[size],
                        hasOptions ? "cursor-pointer hover:scale-105 hover:border-destiny-gold/60" : "cursor-default",
                        isSelected 
                            ? "border-destiny-gold ring-2 ring-destiny-gold/50 scale-105" 
                            : "border-white/20"
                    )}
                >
                    {plug?.displayProperties?.icon && (
                        <Image 
                            src={getBungieImage(plug.displayProperties.icon)} 
                            fill
                            className="object-cover" 
                            alt="" 
                        />
                    )}
                    {/* Click indicator overlay */}
                    {hasOptions && (
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <ChevronRight className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    )}
                    {/* Options count badge */}
                    {socketData.options.length > 1 && (
                        <div className="absolute bottom-0 right-0 bg-black/80 px-1 py-0.5 text-[8px] font-bold text-destiny-gold">
                            {socketData.options.length}
                        </div>
                    )}
                </button>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{label}</span>
            </div>
        );
    };

    // Options Popup
    const OptionsPopup = () => {
        if (!selectedSocket) return null;

        let socketData: any = null;
        let title = "";

        switch (selectedSocket.category) {
            case 'super': socketData = categorized.super; title = "Super Abilities"; break;
            case 'classAbility': socketData = categorized.classAbility; title = "Class Abilities"; break;
            case 'movement': socketData = categorized.movement; title = "Movement"; break;
            case 'melee': socketData = categorized.melee; title = "Melee Abilities"; break;
            case 'grenade': socketData = categorized.grenade; title = "Grenades"; break;
            case 'aspect':
                socketData = categorized.aspects.find((a: any) => a.socketIndex === selectedSocket.socketIndex);
                title = "Aspects";
                break;
            case 'fragment':
                socketData = categorized.fragments.find((f: any) => f.socketIndex === selectedSocket.socketIndex);
                title = "Fragments";
                break;
        }

        if (!socketData) return null;

        return (
            <div className="fixed inset-0 z-200 flex items-center justify-center p-4" onClick={() => setSelectedSocket(null)}>
                <div 
                    className="bg-[#0a0a0a] border border-white/20 rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-4 border-b border-white/10 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-white uppercase tracking-wider">{title}</h3>
                        <button 
                            onClick={() => setSelectedSocket(null)}
                            className="p-1 text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="p-4 overflow-y-auto max-h-[60vh] space-y-2">
                        {/* Debug info */}
                        <div className="text-[10px] text-slate-600 mb-2 p-2 bg-white/5 rounded">
                            Socket {socketData.socketIndex} • {socketData.options.length} option(s) available
                        </div>
                        
                        {socketData.options.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">
                                <p className="text-sm">No options found</p>
                                <p className="text-xs mt-2 text-slate-500">
                                    The API may not have returned available abilities for this socket.
                                    Check the browser console for debug info.
                                </p>
                            </div>
                        ) : socketData.options.map((opt: any) => {
                            const isActive = opt.hash === socketData.activeHash;
                            return (
                                <button
                                    key={opt.hash}
                                    onClick={() => !isActive && handleEquipPlug(socketData.socketIndex, opt.hash, opt.def.displayProperties?.name)}
                                    className={cn(
                                        "w-full flex items-start gap-4 p-3 rounded-lg border transition-all text-left",
                                        isActive 
                                            ? "bg-destiny-gold/10 border-destiny-gold cursor-default" 
                                            : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer"
                                    )}
                                >
                                    <div className="w-14 h-14 rounded-lg overflow-hidden border border-white/20 shrink-0 bg-black/40">
                                        {opt.def.displayProperties?.icon && (
                                            <Image 
                                                src={getBungieImage(opt.def.displayProperties.icon)} 
                                                width={56} 
                                                height={56} 
                                                className="object-cover" 
                                                alt="" 
                                            />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className={cn(
                                                "font-bold",
                                                isActive ? "text-destiny-gold" : "text-white"
                                            )}>
                                                {opt.def.displayProperties?.name}
                                            </p>
                                            {isActive && (
                                                <span className="text-[9px] bg-destiny-gold text-black px-1.5 py-0.5 rounded font-bold uppercase">
                                                    Equipped
                                                </span>
                                            )}
                                        </div>
                                        <PretextLineClamp
                                            className="text-xs text-slate-400 mt-1 line-clamp-2"
                                            maxLines={2}
                                            text={opt.def.displayProperties?.description ?? ''}
                                        />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    // Hover Tooltip
    const HoverTooltip = () => {
        if (!hoveredPlug || selectedSocket) return null;
        
        return (
            <div className="fixed bottom-4 left-1/2 z-150 max-h-[calc(100vh-2rem)] w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 overflow-y-auto rounded-lg border border-white/20 bg-[#0a0a0a]/95 p-4 shadow-2xl backdrop-blur-md pointer-events-none custom-scrollbar">
                <p className="text-sm font-bold text-destiny-gold mb-1">{hoveredPlug.displayProperties?.name}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">{hoveredPlug.itemTypeDisplayName}</p>
                <p className="text-xs text-slate-300 leading-relaxed">{hoveredPlug.displayProperties?.description}</p>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full">
            {/* Super - Featured */}
            {categorized.super && (
                <div className="mb-6">
                    <button 
                        onClick={() => setSelectedSocket({ socketIndex: categorized.super.socketIndex, category: 'super' })}
                        className="w-full flex items-center gap-4 p-4 bg-linear-to-r from-destiny-gold/10 to-transparent rounded-lg border border-destiny-gold/20 hover:border-destiny-gold/40 hover:from-destiny-gold/20 transition-all text-left group"
                    >
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-destiny-gold/40 shrink-0 group-hover:border-destiny-gold transition-colors">
                            {categorized.super.currentPlug?.displayProperties?.icon && (
                                <Image 
                                    src={getBungieImage(categorized.super.currentPlug.displayProperties.icon)} 
                                    fill
                                    className="object-cover" 
                                    alt="" 
                                />
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                <ChevronRight className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] text-destiny-gold uppercase tracking-wider font-bold mb-1">Super Ability</p>
                            <p className="text-xl font-bold text-white">{categorized.super.currentPlug?.displayProperties?.name}</p>
                            <p className="text-[10px] text-slate-500 mt-1 group-hover:text-slate-300 transition-colors">
                                Click to change {categorized.super.options.length > 1 && `• ${categorized.super.options.length} available`}
                            </p>
                        </div>
                        <ChevronRight className="w-6 h-6 text-slate-500 group-hover:text-destiny-gold transition-colors" />
                    </button>
                </div>
            )}

            {/* Core Abilities Grid */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <AbilitySelector socketData={categorized.classAbility} label="Class" size="medium" category="classAbility" />
                <AbilitySelector socketData={categorized.movement} label="Jump" size="medium" category="movement" />
                <AbilitySelector socketData={categorized.melee} label="Melee" size="medium" category="melee" />
                <AbilitySelector socketData={categorized.grenade} label="Grenade" size="medium" category="grenade" />
            </div>

            {/* Aspects */}
            {categorized.aspects.length > 0 && (
                <div className="mb-6">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-3 flex items-center gap-2">
                        <Shield className="w-3 h-3" /> Aspects <span className="text-slate-600">• Click to change</span>
                    </p>
                    <div className="flex gap-4">
                        {categorized.aspects.map((aspect: any, i: number) => (
                            <button
                                key={i}
                                onClick={() => setSelectedSocket({ socketIndex: aspect.socketIndex, category: 'aspect' })}
                                className="flex flex-col items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10 hover:border-destiny-gold/40 hover:bg-white/10 transition-all group"
                            >
                                <div className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-white/20 group-hover:border-destiny-gold/60 transition-colors">
                                    {aspect.currentPlug?.displayProperties?.icon && (
                                        <Image 
                                            src={getBungieImage(aspect.currentPlug.displayProperties.icon)} 
                                            fill
                                            className="object-cover" 
                                            alt="" 
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                        <ChevronRight className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    {aspect.options.length > 1 && (
                                        <div className="absolute bottom-0 right-0 bg-black/80 px-1 py-0.5 text-[8px] font-bold text-destiny-gold">
                                            {aspect.options.length}
                                        </div>
                                    )}
                                </div>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider max-w-[80px] truncate group-hover:text-white transition-colors">
                                    {aspect.currentPlug?.displayProperties?.name?.split(' ').slice(0, 2).join(' ') || `Aspect ${i + 1}`}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Fragments */}
            {categorized.fragments.length > 0 && (
                <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-3 flex items-center gap-2">
                        <Zap className="w-3 h-3" /> Fragments <span className="text-slate-600">• Click to change</span>
                    </p>
                    <div className="grid grid-cols-5 gap-3">
                        {categorized.fragments.map((fragment: any, i: number) => (
                            <button
                                key={i}
                                onClick={() => setSelectedSocket({ socketIndex: fragment.socketIndex, category: 'fragment' })}
                                className="flex flex-col items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10 hover:border-destiny-gold/40 hover:bg-white/10 transition-all group"
                            >
                                <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-white/20 group-hover:border-destiny-gold/60 transition-colors">
                                    {fragment.currentPlug?.displayProperties?.icon && (
                                        <Image 
                                            src={getBungieImage(fragment.currentPlug.displayProperties.icon)} 
                                            fill
                                            className="object-cover" 
                                            alt="" 
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                        <ChevronRight className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    {fragment.options.length > 1 && (
                                        <div className="absolute bottom-0 right-0 bg-black/80 px-0.5 text-[7px] font-bold text-destiny-gold">
                                            {fragment.options.length}
                                        </div>
                                    )}
                                </div>
                                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider max-w-[60px] truncate text-center leading-tight group-hover:text-slate-300 transition-colors">
                                    {fragment.currentPlug?.displayProperties?.name?.replace(/^(Echo|Thread|Facet|Whisper) of /i, '') || `${i + 1}`}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Popups */}
            <OptionsPopup />
            <HoverTooltip />
        </div>
    );
}

function SocketViewer({
    sockets,
    itemDef,
    item,
    profile,
    membershipInfo,
    isSubclass,
    clarityDescriptions,
    onSocketPlugChange,
}: any) {
    const { definitions: categoryDefs } = useSocketCategoryDefinitions(itemDef?.sockets?.socketCategories?.map((c: any) => c.socketCategoryHash) || []);
    
    const reusablePlugsData = profile?.itemComponents?.reusablePlugs?.data?.[item.itemInstanceId]?.plugs;

    // Gather all plug hashes to fetch definitions
    const allPlugHashes = useMemo(() => {
        const hashes: number[] = [];
        sockets?.forEach((s: any) => {
            if (s.plugHash) hashes.push(s.plugHash);
            if (s.reusablePlugs) s.reusablePlugs.forEach((rp: any) => hashes.push(rp.plugItemHash));
        });

        // Also check profile reusablePlugs component
        if (reusablePlugsData) {
            Object.values(reusablePlugsData).forEach((plugs: any) => {
                 plugs.forEach((p: any) => hashes.push(p.plugItemHash));
            });
        }

        // And static definitions as fallback
        if (itemDef?.sockets?.socketEntries) {
             itemDef.sockets.socketEntries.forEach((s: any) => {
                 if (s.reusablePlugItems) {
                     s.reusablePlugItems.forEach((p: any) => hashes.push(p.plugItemHash));
                 }
             });
        }

        return hashes;
    }, [sockets, reusablePlugsData, itemDef]);

    const { definitions: plugDefs } = useItemDefinitions(allPlugHashes);

    // Filter out cosmetics completely
    const nonCosmeticCategories = useMemo(() => {
        if (!itemDef?.sockets?.socketCategories) return [];
        return itemDef.sockets.socketCategories.filter((c: any) => {
             const def = categoryDefs[c.socketCategoryHash];
             if (!def) return false;
             const name = def.displayProperties?.name || "";
             return !name.toLowerCase().includes("cosmetic");
        });
    }, [itemDef, categoryDefs]);

    const { intrinsic, mods, perks } = useMemo(() => {
        const intrinsic: any[] = [];
        const mods: any[] = [];
        const perks: any[] = [];

        nonCosmeticCategories.forEach((c: any) => {
            const def = categoryDefs[c.socketCategoryHash];
            const name = def?.displayProperties?.name || "";
            const nameLower = name.toLowerCase();
            
            if (nameLower.includes("intrinsic") || nameLower.includes("archetype")) {
                intrinsic.push(c);
            } else if (nameLower.includes("mod")) {
                mods.push(c);
            } else {
                perks.push(c);
            }
        });

        return { intrinsic, mods, perks };
    }, [nonCosmeticCategories, categoryDefs]);

    const renderCategory = (category: any) => {
        const categoryDef = categoryDefs[category.socketCategoryHash];
        if (!categoryDef) return null;

        const categorySockets = category.socketIndexes.map((idx: number) => ({
            ...sockets[idx],
            socketIndex: idx,
            def: itemDef.sockets.socketEntries[idx],
            reusablePlugs: reusablePlugsData?.[idx] || sockets[idx].reusablePlugs || [] 
        }));

        if (!categorySockets.length) return null;
        
        // Filter empty sockets
        const validSockets = categorySockets.filter((socket: any) => {
                const plug = plugDefs[socket.plugHash];
                // Keep empty sockets if they are meant to be visible (like empty mod slots)
                if (!plug && socket.isVisible) return true; 
                if (!plug) return false;

                // Filter Kill Trackers
                if (plug.displayProperties?.name?.includes("Kill Tracker") || plug.itemTypeDisplayName?.includes("Tracker")) {
                return false;
                }

                // Filter Cosmetics (Shaders, Ornaments)
                const type = plug.itemTypeDisplayName?.toLowerCase() || "";
                const category = plug.plug?.plugCategoryIdentifier?.toLowerCase() || "";
                
                if (type.includes("shader") || type.includes("ornament")) return false;
                if (category.includes("shader") || category.includes("skins")) return false;

                // Filter Transmat & Flair
                if (type.includes("transmat") || category.includes("transmat")) return false;
                if (type.includes("flair") || category.includes("flair")) return false;

                return true;
        });

        if (validSockets.length === 0) return null;

        const categoryName = categoryDef.displayProperties?.name ?? "";
        const categoryNameLower = categoryName.toLowerCase();
        const isWeaponPerkCategory =
            itemDef?.itemType === 3 &&
            !categoryNameLower.includes("intrinsic") &&
            !categoryNameLower.includes("mod") &&
            !categoryNameLower.includes("masterwork");
        const isWeaponIntrinsicCategory =
            itemDef?.itemType === 3 &&
            (categoryNameLower.includes("intrinsic") ||
                categoryNameLower.includes("archetype"));

        return (
            <div
                key={category.socketCategoryHash}
                className={cn(
                    "flex min-w-0 flex-col gap-3 overflow-visible",
                    isWeaponIntrinsicCategory && "self-end"
                )}
            >
                {!isWeaponIntrinsicCategory && (
                    <h3 className="border-b border-white/20 pb-1 text-sm font-medium text-slate-300">
                        {categoryDef.displayProperties?.name}
                    </h3>
                )}
                
                <div className={cn(
                    "flex max-w-full flex-wrap overflow-visible",
                    isWeaponPerkCategory ? "w-fit gap-x-3 gap-y-4" : "gap-1.5"
                )}>
                    {validSockets.map((socket: any, socketIndex: number) => (
                        <Socket 
                            key={socket.socketIndex} 
                            socket={socket} 
                            activePlug={plugDefs[socket.plugHash]} 
                            plugDefs={plugDefs}
                            item={item}
                            itemDef={itemDef}
                            categoryDef={categoryDef}
                            membershipInfo={membershipInfo}
                            profile={profile}
                            isSubclass={isSubclass}
                            clarityDescriptions={clarityDescriptions}
                            isFirstSocket={socketIndex === 0}
                            onSocketPlugChange={onSocketPlugChange}
                            socketTitle={getBasicSocketTitle({
                                socketIndex: socket.socketIndex,
                                socketName: categoryDef.displayProperties?.name ?? "",
                                categoryIdentifier: categoryDef.categoryStyleIdentifier ?? "",
                                activePlugHash: socket.plugHash,
                                activePlugDefinition: plugDefs[socket.plugHash],
                                options: [],
                                isIntrinsic: categoryNameLower.includes("intrinsic"),
                                isPerkColumn: isWeaponPerkCategory,
                                isMasterworkColumn: categoryNameLower.includes("masterwork"),
                                isOriginColumn: categoryNameLower.includes("origin"),
                                isCosmeticColumn: false,
                            })}
                        />
                    ))}
                </div>
            </div>
        );
    };

    if (!itemDef?.sockets?.socketCategories) return null;

    if (itemDef?.itemType === 3) {
        return (
            <div className="flex min-w-0 flex-col gap-6 overflow-x-hidden pb-6">
                {perks.map(renderCategory)}
                <div className="flex max-w-full flex-wrap items-end gap-3 overflow-visible">
                    {intrinsic.map(renderCategory)}
                    {mods.map(renderCategory)}
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-w-0 flex-col gap-8 overflow-x-hidden pb-6">
            {/* Intrinsic & Mods Row */}
            <div className="flex flex-wrap gap-8">
                {intrinsic.map(renderCategory)}
                {mods.map(renderCategory)}
            </div>

            {/* Perks (The rest) */}
            {perks.map(renderCategory)}
        </div>
    );
}

import { createPortal } from 'react-dom';

function PortalTooltip({ content, targetRect, position = 'top' }: any) {
    if (!targetRect || !content) return null;
    if (typeof document === 'undefined') return null;

    const viewportPadding = 16;
    const tooltipWidth = Math.min(320, window.innerWidth - viewportPadding * 2);
    const gap = 8;
    const targetCenter = targetRect.left + targetRect.width / 2;
    const left = Math.min(
        Math.max(targetCenter - tooltipWidth / 2, viewportPadding),
        window.innerWidth - viewportPadding - tooltipWidth
    );
    const topSpace = Math.max(0, targetRect.top - viewportPadding);
    const bottomSpace = Math.max(0, window.innerHeight - targetRect.bottom - viewportPadding);
    const shouldPlaceOnTop = position === 'top' && topSpace >= bottomSpace;
    const availableHeight = Math.max(
        0,
        (shouldPlaceOnTop ? topSpace : bottomSpace) - gap
    );
    const verticalPosition = shouldPlaceOnTop
        ? { bottom: window.innerHeight - targetRect.top + gap }
        : { top: targetRect.bottom + gap };

    return createPortal(
        <div 
            className="fixed z-200 pointer-events-none max-w-[calc(100vw-2rem)]"
            style={{ 
                left: left,
                width: tooltipWidth,
                maxHeight: availableHeight,
                ...verticalPosition,
            }}
        >
            <div className="max-h-full overflow-y-auto rounded border border-white/20 bg-[#1a1a1a] p-3 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 custom-scrollbar">
                {content}
            </div>
        </div>,
        document.body
    );
}

function BasicPlugTooltipContent({
    plug,
    fallbackType,
    clarityDescription,
}: {
    plug: any;
    fallbackType?: string;
    clarityDescription?: ClarityDescription;
}) {
    return (
        <>
            <p className="break-words text-sm font-bold leading-tight text-destiny-gold">
                {plug.displayProperties?.name}
            </p>
            <p className="mb-2 mt-1 break-words text-[10px] font-semibold uppercase text-slate-400">
                {plug.itemTypeDisplayName ?? fallbackType}
            </p>
            {plug.displayProperties?.description && (
                <p className="break-words text-xs leading-relaxed text-slate-300">
                    {plug.displayProperties.description}
                </p>
            )}
            <BasicClaritySection clarityDescription={clarityDescription} />
        </>
    );
}

function SocketOptionsOverlay({
    options,
    activePlugHash,
    isCircle,
    targetRect,
    onClose,
    onSelect,
}: {
    options: Array<{ hash: number; def: any }>;
    activePlugHash?: number;
    isCircle: boolean;
    targetRect: DOMRect;
    onClose: () => void;
    onSelect: (plugHash: number, plugName: string) => void;
}) {
    if (typeof document === 'undefined') return null;

    const viewportPadding = 16;
    const gap = 8;
    const overlayWidth = Math.min(260, window.innerWidth - viewportPadding * 2);
    const left = Math.min(
        Math.max(targetRect.left, viewportPadding),
        window.innerWidth - viewportPadding - overlayWidth
    );
    const bottomSpace = window.innerHeight - targetRect.bottom - viewportPadding;
    const topSpace = targetRect.top - viewportPadding;
    const shouldPlaceBelow = bottomSpace >= 220 || bottomSpace >= topSpace;
    const availableSpace = Math.max(
        120,
        (shouldPlaceBelow ? bottomSpace : topSpace) - gap
    );
    const maxHeight = Math.min(320, availableSpace);
    const verticalPosition = shouldPlaceBelow
        ? { top: targetRect.bottom + gap }
        : { bottom: window.innerHeight - targetRect.top + gap };

    return createPortal(
        <>
            <div
                className="fixed inset-0 z-[205] bg-transparent"
                onClick={(event) => {
                    event.stopPropagation();
                    onClose();
                }}
            />
            <div
                className="fixed z-[210] flex flex-col overflow-hidden rounded border border-white/20 bg-[#1a1a1a] p-2 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
                style={{
                    left,
                    width: overlayWidth,
                    maxHeight,
                    ...verticalPosition,
                }}
            >
                <div className="mb-1 border-b border-white/10 px-2 pb-1 text-xs font-bold uppercase text-slate-500">
                    Select Option
                </div>
                <div className="grid grid-cols-4 gap-2 overflow-y-auto p-1 custom-scrollbar">
                    {options.map((option) => {
                        const isSelected = option.hash === activePlugHash;

                        return (
                            <button
                                key={option.hash}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onSelect(
                                        option.hash,
                                        option.def.displayProperties?.name ?? "Option"
                                    );
                                }}
                                className={cn(
                                    "relative h-10 w-10 overflow-hidden border transition-transform hover:scale-110",
                                    isCircle ? "rounded-full" : "rounded-sm",
                                    isSelected
                                        ? "border-destiny-gold ring-1 ring-destiny-gold"
                                        : "border-slate-600 hover:border-white"
                                )}
                                title={option.def.displayProperties?.name}
                            >
                                {option.def.displayProperties?.icon && (
                                    <Image
                                        src={getBungieImage(option.def.displayProperties.icon)}
                                        fill
                                        className="object-cover"
                                        alt=""
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </>,
        document.body
    );
}

function Socket({
    socket,
    activePlug,
    plugDefs,
    item,
    itemDef,
    categoryDef,
    membershipInfo,
    profile,
    isSubclass,
    clarityDescriptions,
    isFirstSocket,
    socketTitle,
    onSocketPlugChange,
}: any) {
    const [isOpen, setIsOpen] = useState(false);
    const [hoveredPlug, setHoveredPlug] = useState<any>(null);
    const [hoverTarget, setHoverTarget] = useState<HTMLElement | null>(null);
    const socketButtonRef = useRef<HTMLButtonElement | null>(null);
    
    const handleMouseEnter = (e: React.MouseEvent<HTMLElement>, plug: any) => {
        setHoveredPlug(plug);
        setHoverTarget(e.currentTarget);
    };

    const handleMouseLeave = () => {
        setHoveredPlug(null);
        setHoverTarget(null);
    };
    
    // Determine if this is a weapon perk column (Circle + Vertical List)
    // Logic: Item is Weapon (Type 3) AND Category is NOT Cosmetic/Masterwork/Mod
    // Safe check: Check if category name contains "Trait", "Magazine", "Barrel", "Sight"
    const categoryName = categoryDef?.displayProperties?.name || "";
    const categoryNameLower = categoryName.toLowerCase();
    
    const isWeaponMod = itemDef?.itemType === 3 && categoryNameLower.includes("mod");
    
    // Determine Shape
    const isCircle = itemDef?.itemType === 3 && !categoryNameLower.includes("mod") && !categoryNameLower.includes("intrinsic"); // Weapon perks are circles, except intrinsics usually

    // Resolve Options
    // 1. Reusable Plugs (Profile)
    // 2. Static Definition
    const options = useMemo(() => {
        let hashes: number[] = [];
        
        // Profile Data
        if (socket.reusablePlugs && socket.reusablePlugs.length > 0) {
            hashes = socket.reusablePlugs.map((p: any) => p.plugItemHash);
        } 
        // Fallback to Definition (if not instanced or static)
        else if (socket.def?.reusablePlugItems) {
             hashes = socket.def.reusablePlugItems.map((p: any) => p.plugItemHash);
        }
        
        // Ensure active plug is included
        if (socket.plugHash && !hashes.includes(socket.plugHash)) {
            hashes.unshift(socket.plugHash);
        }

        // Remove duplicates
        hashes = Array.from(new Set(hashes));

        // Map to definitions (passed from parent)
        // Note: Parent might not have fetched ALL static definition plugs if we fell back to socket.def
        // But for live items, profile data usually covers it.
        return hashes.map(h => ({ hash: h, def: plugDefs[h] })).filter(o => o.def);
    }, [socket, plugDefs]);

    const handleSelectPlug = async (plugItemHash: number, plugName: string) => {
        if (plugItemHash === socket.plugHash) {
             setIsOpen(false);
             return; 
        }
        if (!membershipInfo) {
            toast.error("Login required");
            return;
        }

        let ownerId = item.characterId; 
        if (!ownerId && profile) ownerId = Object.keys(profile.characters?.data || {})[0];

        try {
            toast.loading(`Equipping ${plugName}...`, { id: 'equip-plug' });
            
            // Try the free endpoint first - works for:
            // - Weapon perk toggles (switching between rolled perks)
            // - Subclass abilities
            // - Free armor mods
            // Reference: https://github.com/DestinyItemManager/DIM/blob/master/src/app/inventory/advanced-write-actions.ts
            try {
                await insertSocketPlugFree(
                    item.itemInstanceId, 
                    plugItemHash, 
                    socket.socketIndex, 
                    ownerId, 
                    membershipInfo.membershipType
                );
                onSocketPlugChange?.(item.itemInstanceId, socket.socketIndex, plugItemHash);
                toast.success(`Equipped ${plugName}`, { id: 'equip-plug' });
            } catch (freeError: any) {
                // If free endpoint fails, it might need the paid endpoint (AdvancedWriteActions scope)
                // This will likely fail without the scope, but try anyway for completeness
                const freeErrorCode = freeError.response?.data?.ErrorCode;
                
                // ErrorCode 1641 = DestinySocketActionNotAllowed (can't use free endpoint)
                // In this case, we'd need the paid endpoint which requires AWA scope
                if (freeErrorCode === 1641) {
                    toast.error("This action requires materials or special permissions.", { id: 'equip-plug' });
                } else {
                    const message = freeError.response?.data?.Message || freeError.message || "Failed to equip";
                    toast.error(message, { id: 'equip-plug' });
                }
            }
        } catch (error: any) {
            const message = error.response?.data?.Message || error.message || "Failed to equip";
            toast.error(message, { id: 'equip-plug' });
        }
        
        setIsOpen(false);
    };

    if (!activePlug && options.length === 0) return <div className={cn("h-11 w-11 border border-dashed border-white/20 bg-white/5", isCircle ? "rounded-full" : "rounded-sm")} />;

    const displayPlug = activePlug || options[0]?.def;
    if (!displayPlug) return null;

    // Single View (Armor Mods, Cosmetics, Single Perks)
    const isEnhanced = displayPlug.displayProperties?.name?.includes("Enhanced");
    const hasOptions = options.length > 1;
    const displayPlugHash = getPlugHash(displayPlug);
    const displayClarityDescription = displayPlugHash
        ? clarityDescriptions?.[displayPlugHash]
        : undefined;
    const plugLooksLikeFunctionalWeaponPerk = isFunctionalWeaponPerk(displayPlug);
    const isWeaponPerk =
        itemDef?.itemType === 3 &&
        (categoryNameLower.includes("trait") ||
         categoryNameLower.includes("magazine") ||
         categoryNameLower.includes("barrel") ||
         categoryNameLower.includes("sight") ||
         categoryNameLower.includes("scope") ||
         categoryNameLower.includes("perk") ||
         plugLooksLikeFunctionalWeaponPerk) &&
        !categoryNameLower.includes("intrinsic") &&
        !categoryNameLower.includes("mod") &&
        !categoryNameLower.includes("masterwork");

    // Weapon Perks: Render as Vertical Column (Reusable Plugs System)
    if (isWeaponPerk) {
        return (
            <div className={cn(
                "w-12 shrink-0 border-l border-white/10 pl-2 first:border-l-0 first:pl-0",
                isFirstSocket && "border-l-0 pl-0"
            )}>
                <div className="flex flex-col gap-1.5 overflow-visible">
                 {options.map((opt: any) => {
                     const isSelected = opt.hash === socket.plugHash;
                     const isOptEnhanced = opt.def.displayProperties?.name?.includes("Enhanced");

                     return (
                        <div 
                            key={opt.hash}
                            className="relative group/plug"
                            onMouseEnter={(e) => handleMouseEnter(e, opt.def)}
                            onMouseLeave={handleMouseLeave}
                        >
                            <button
                                onClick={(e) => { e.stopPropagation(); handleSelectPlug(opt.hash, opt.def.displayProperties.name); }}
                                className={cn(
                                    "relative h-10 w-10 overflow-hidden rounded-full border transition-all",
                                    isSelected 
                                        ? "border-destiny-gold bg-[#5b94be] opacity-100 ring-1 ring-destiny-gold" 
                                        : "border-gray-600 bg-black/40 opacity-50 hover:opacity-100 hover:border-gray-400"
                                )}
                            >
                                {opt.def.displayProperties?.icon && (
                                    <Image 
                                        src={getBungieImage(opt.def.displayProperties.icon)} 
                                        fill 
                                        className="object-cover" 
                                        alt={opt.def.displayProperties.name} 
                                    />
                                )}
                                {isOptEnhanced && (
                                     <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[5px] border-b-destiny-gold" />
                                )}
                            </button>
                        </div>
                     );
                 })}

                 {/* Shared Tooltip for this column */}
                 {hoveredPlug && hoverTarget && (
                    <PortalTooltip 
                        targetRect={hoverTarget.getBoundingClientRect()} 
                        content={
                            <BasicPlugTooltipContent
                                plug={hoveredPlug}
                                fallbackType={socketTitle}
                                clarityDescription={
                                    clarityDescriptions?.[getPlugHash(hoveredPlug) ?? 0]
                                }
                            />
                        } 
                    />
                )}
                </div>
            </div>
        );
    }

    // Standard Single View (Armor Mods, Cosmetics, etc)
    return (
        <div className="relative group/socket">
            <button 
                ref={socketButtonRef}
                onClick={() => hasOptions && setIsOpen(true)}
                onMouseEnter={(e) => handleMouseEnter(e, displayPlug)}
                onMouseLeave={handleMouseLeave}
                className={cn(
                    "relative h-11 w-11 overflow-hidden border transition-all",
                    isCircle ? "rounded-full" : "rounded-sm",
                    hasOptions ? "cursor-pointer hover:border-white" : "cursor-default",
                    isEnhanced ? "border-destiny-gold" : "border-slate-500 bg-[#0f0f0f]",
                    isOpen ? "ring-2 ring-white scale-110 z-50" : ""
                )}
            >
                {displayPlug.displayProperties?.icon && (
                    <Image 
                        src={getBungieImage(displayPlug.displayProperties.icon)} 
                        fill 
                        className="object-cover" 
                        alt={displayPlug.displayProperties.name} 
                    />
                )}
                
                {/* Enhanced Triangle */}
                {isEnhanced && (
                     <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-8 border-b-destiny-gold" />
                )}
            </button>

            {/* Portal Tooltip for Single View */}
            {hoveredPlug && hoverTarget && (
                <PortalTooltip 
                    targetRect={hoverTarget.getBoundingClientRect()} 
                    content={
                        <>
                            <BasicPlugTooltipContent
                                plug={hoveredPlug}
                                fallbackType={socketTitle}
                                clarityDescription={displayClarityDescription}
                            />
                            {hasOptions && !isWeaponMod && (
                                <div className="mt-3 border-t border-white/10 pt-2">
                                    <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Available Options</p>
                                    <div className="flex flex-wrap gap-1">
                                        {options.map(opt => (
                                            <div 
                                                key={opt.hash} 
                                                className={cn(
                                                    "relative w-6 h-6 rounded-full overflow-hidden border",
                                                    opt.hash === socket.plugHash ? "border-destiny-gold" : "border-white/20 opacity-50"
                                                )} 
                                                title={opt.def.displayProperties?.name}
                                            >
                                                <Image src={getBungieImage(opt.def.displayProperties?.icon)} fill className="object-cover" alt="" />
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[9px] text-blue-400 mt-2 font-bold uppercase tracking-wide">Click to Select</p>
                                </div>
                            )}
                        </>
                    } 
                />
            )}

            {/* Options Popup (For Single View Types with Options - e.g. Mods) */}
            {isOpen && socketButtonRef.current && (
                <SocketOptionsOverlay
                    options={options}
                    activePlugHash={socket.plugHash}
                    isCircle={isCircle}
                    targetRect={socketButtonRef.current.getBoundingClientRect()}
                    onClose={() => setIsOpen(false)}
                    onSelect={handleSelectPlug}
                />
            )}
        </div>
    );
}

// Hook for socket categories
function useSocketCategoryDefinitions(hashes: number[]) {
    const [definitions, setDefinitions] = useState<Record<number, any>>({});
    
    const uniqueHashes = useMemo(() => Array.from(new Set(hashes)), [hashes]);
    const hashesKey = JSON.stringify(uniqueHashes.sort());

    useEffect(() => {
        if (!uniqueHashes.length) return;

        const load = async () => {
            // Check local cache or bulk fetch if possible to avoid N requests
            // Using simple promise.all for now
            const newDefs: Record<number, any> = {};
            await Promise.all(uniqueHashes.map(async (h) => {
                try {
                    const res = await bungieApi.get(endpoints.getSocketCategoryDefinition(h));
                    newDefs[h] = res.data.Response;
                } catch (e) {
                    console.error(e);
                }
            }));
            setDefinitions(newDefs);
        };
        load();
    }, [hashesKey]);

    return { definitions };
}

function PerkExplorer({ itemDef }: { itemDef: any }) {
    const perkSockets = useMemo(() => {
        if (!itemDef?.sockets?.socketEntries) return [];
        
        // Filter for sockets that look like perks (have randomized plugs or multiple options)
        return itemDef.sockets.socketEntries
            .map((s: any, index: number) => ({ ...s, index }))
            .filter((s: any) => {
                // Exclude cosmetics/stats/etc by simple heuristics if category not available
                // Or just show everything that has options.
                // Check randomizedPlugSetHash AND reusablePlugSetHash
                return (s.randomizedPlugSetHash || s.reusablePlugSetHash || (s.reusablePlugItems && s.reusablePlugItems.length > 1)) 
                    && s.socketTypeHash !== 0; 
            });
    }, [itemDef]);

    return (
        <div className="flex gap-3 h-full justify-center items-start pt-4">
             {perkSockets.map((socket: any) => (
                 <PerkColumn key={socket.index} socket={socket} />
             ))}
        </div>
    );
}

function PerkColumn({ socket }: { socket: any }) {
    const plugSetHash = socket.randomizedPlugSetHash || socket.reusablePlugSetHash;
    const { data } = useSWR(plugSetHash ? endpoints.getPlugSetDefinition(plugSetHash) : null, fetcher);
    const plugSet = data?.Response;
    
    const plugHashes = useMemo(() => {
        let hashes: number[] = [];
        
        // Start with socket-level reusable plugs (static definitions)
        if (socket.reusablePlugItems) {
            hashes.push(...socket.reusablePlugItems.map((p: any) => p.plugItemHash));
        }
        
        // Add plug set items (randomized/pool)
        if (plugSet?.reusablePlugItems) {
            hashes.push(...plugSet.reusablePlugItems.map((p: any) => p.plugItemHash));
        }
        
        return Array.from(new Set(hashes));
    }, [plugSet, socket]);
    
    const { definitions: plugs } = useItemDefinitions(plugHashes);
    
    const [hoveredPlug, setHoveredPlug] = useState<any>(null);
    const [hoverTarget, setHoverTarget] = useState<HTMLElement | null>(null);

    if (plugHashes.length === 0) return null;

    // Filter out undesirable plugs (Kill Trackers, empty, etc)
    const validPlugs = plugHashes
        .map(h => plugs[h])
        .filter(p => {
            if (!p) return false;
            const name = p.displayProperties?.name;
            const type = p.itemTypeDisplayName?.toLowerCase() || "";
            const category = p.plug?.plugCategoryIdentifier?.toLowerCase() || "";

            if (!name) return false;

            // Kill Trackers
            if (name.includes("Kill Tracker") || name.includes("Tracker")) return false;
            if (type.includes("tracker")) return false;
            
            // Cosmetics / Shaders / Ornaments
            if (type.includes("shader") || type.includes("ornament")) return false;
            if (category.includes("shader") || category.includes("skins")) return false;

            // Filter Transmat & Flair
            if (type.includes("transmat") || category.includes("transmat")) return false;
            if (type.includes("flair") || category.includes("flair")) return false;

            // Masterworks
            if (type.includes("masterwork") || name.includes("Masterwork")) return false;
            if (category.includes("masterwork")) return false;

            // Intrinsic & Origin Traits (Filtered from All Perks View)
            if (type.includes("intrinsic") || category.includes("intrinsic")) return false;
            if (type.includes("origin trait") || category.includes("origin")) return false;
            
            // Classified
            if (name.includes("Classified") || p.redacted) return false;

            // Mods
            if (type.includes("mod")) return false;
            if (category.includes("mod")) return false;

            return true;
        });

    if (validPlugs.length === 0) return null;

    return (
        <div className="flex flex-col gap-2 items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            {validPlugs.map((plug: any) => (
                 <div 
                    key={plug.hash} 
                    className="relative"
                    onMouseEnter={(e) => {
                        setHoveredPlug(plug);
                        setHoverTarget(e.currentTarget);
                    }}
                    onMouseLeave={() => {
                        setHoveredPlug(null);
                        setHoverTarget(null);
                    }}
                 >
                    <div className="w-16 h-16 rounded-full border border-white/10 bg-[#1a1a1a] overflow-hidden hover:border-white hover:scale-110 transition-all cursor-default relative">
                         <Image 
                            src={getBungieImage(plug.displayProperties.icon)}
                            fill
                            className="object-cover"
                            alt={plug.displayProperties.name}
                         />
                    </div>
                 </div>
            ))}
            
             {hoveredPlug && hoverTarget && (
                <PortalTooltip 
                    targetRect={hoverTarget.getBoundingClientRect()} 
                    content={
                        <>
                            <p className="text-sm font-bold text-destiny-gold mb-1">{hoveredPlug.displayProperties?.name}</p>
                            <p className="text-[10px] text-slate-400 uppercase mb-2">{hoveredPlug.itemTypeDisplayName}</p>
                            <p className="text-xs text-slate-300 leading-relaxed">{hoveredPlug.displayProperties?.description}</p>
                        </>
                    } 
                />
            )}
        </div>
    );
}

export default ItemDetailsOverlay;
