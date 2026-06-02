import useSWR from 'swr';
import Image from 'next/image';
import { bungieApi, endpoints, getBungieImage } from '@/lib/bungie';
import { displayPixelsForCssEdge, itemIconDecodeBudgetPx, ITEM_ICON_CSS_PX } from '@/lib/itemIconImage';
import {
  buildBungieIconUrl,
  buildBungieImageProxyUrl,
  getClientManifestVersionCacheKey,
  normalizeBungieAssetPath,
  USE_BUNGIE_ICON_PROXY,
} from '@/lib/bungieImageProxy';
import { cn } from '@/lib/utils';
import { getWishListMatchTextClass } from '@/lib/wishlistVisuals';
import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { ItemTooltip } from './ItemTooltip';
import { ItemContextMenu } from './ItemContextMenu';
import { useItemDefinitions } from '@/hooks/useItemDefinitions';
import { useTransferStore, TransferStatus } from '@/store/transferStore';
import { getArmorBaseStats, getArmorQuality, BUCKETS } from '@/lib/destinyUtils';
import { useWishListStore } from '@/store/wishlistStore';
import { RefreshCw } from 'lucide-react';
import { FastBungieIcon } from '@/components/FastBungieIcon';

const fetcher = (url: string) => bungieApi.get(url).then((res) => res.data);

interface DestinyItemCardProps {
  itemHash: number;
  instanceData?: any;
  socketsData?: any;
  className?: string;
  isHighlighted?: boolean; 
  onDefinitionLoaded?: (hash: number, def: any) => void;
    itemInstanceId?: string;
    ownerId?: string;
    quantity?: number;
    powerDiff?: number;
    classFilter?: number; // If provided, hides item if classType doesn't match (and isn't 3)
    hidePower?: boolean;
    hideTooltipPower?: boolean;
    hideBorder?: boolean;
    minimal?: boolean;
    showClassSymbolOnMismatch?: boolean;
    size?: 'small' | 'medium' | 'large';
    reusablePlugs?: any[]; // Passed from profile.itemComponents.reusablePlugs
    tierAsNumber?: boolean; // If true, show tier as a number in top right instead of stars
    imagePriority?: boolean;
    /** Use `low` in vault / virtualized grids so icons don’t compete with visible content. */
    imageFetchPriority?: 'auto' | 'high' | 'low';
    definitionIsPartial?: boolean;
    /** Skip expensive socket/perk detail work until hover or context menu. */
    deferDetails?: boolean;
    /** Render only tooltip/context menu logic; the caller owns the visible tile. */
    renderTile?: boolean;
    forcedTooltipPosition?: { x: number; y: number };
    forcedContextMenuPosition?: { x: number; y: number };
    onCloseForcedContextMenu?: () => void;
    hideTooltipScreenshot?: boolean;
}

// Element Icons (Updated with transparent PNGs where possible)
const ELEMENT_ICONS: Record<number, string> = {
    1847026933: 'https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_2a1773e10968f2d088b97c22b22bba9e.png', // Solar
    2303181850: 'https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_092d066688b879c807c3b460afdd61e6.png', // Arc
    3454344768: 'https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_ceb2f6197dccf3958bb31cc783eb97a0.png', // Void
    151347233: 'https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_530c4c3e7981dc2aefd24fd3293482bf.png', // Stasis
    3949783978: 'https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_b2fe51a94f3533f97079dfa0d27a4096.png', // Strand
    2817963223: 'https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_b9c5a3f0c98bc973e8e507e2d9b31c5e.png', // Prismatic
    3373582085: '', // Kinetic
};

const CLASS_ICONS: Record<number, string> = {
    0: '/class-titan.svg', // Titan
    1: '/class-hunter.svg', // Hunter
    2: '/class-warlock.svg', // Warlock
};

function getReusablePlugsForSocket(reusablePlugs: any, socket: any, socketIndex: number): any[] {
    const profileReusablePlugs =
        reusablePlugs?.[socketIndex] ?? reusablePlugs?.[String(socketIndex)];

    if (Array.isArray(profileReusablePlugs)) {
        return profileReusablePlugs;
    }

    if (Array.isArray(socket?.reusablePlugs)) {
        return socket.reusablePlugs;
    }

    return [];
}

export function DestinyItemCard({ 
    itemHash, 
    instanceData, 
    socketsData, 
    className, 
    isHighlighted, 
    onDefinitionLoaded,
    itemInstanceId,
    ownerId,
    quantity,
    definition,
    objectives,
    powerDiff,
    classFilter,
    hidePower,
    hideTooltipPower,
    hideBorder,
    minimal,
    showClassSymbolOnMismatch,
    size = 'medium',
    reusablePlugs,
    tierAsNumber,
    imagePriority,
    imageFetchPriority,
    definitionIsPartial,
    deferDetails,
    renderTile = true,
    forcedTooltipPosition,
    forcedContextMenuPosition,
    onCloseForcedContextMenu,
}: DestinyItemCardProps & { definition?: any; objectives?: any[] }) {
  "use no memo"; // Opt out — avoids compiler/runtime `icon is not defined` in this component.

  const [isHovered, setIsHovered] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState<{x: number, y: number} | null>(null);
  const [initialTooltipPos, setInitialTooltipPos] = useState<{x: number, y: number} | undefined>(undefined);
  const activeContextMenuPosition = forcedContextMenuPosition ?? contextMenuPos;
  const activeTooltipPosition = forcedTooltipPosition ?? initialTooltipPos;
  const shouldResolveFullDetails =
    !deferDetails || isHovered || activeContextMenuPosition !== null || Boolean(forcedTooltipPosition);

  const shouldFetchFullDefinition = Boolean(
    itemHash &&
    (!definition ||
      (definitionIsPartial &&
        (isHovered ||
          contextMenuPos ||
          forcedTooltipPosition ||
          forcedContextMenuPosition)))
  );

  const { data: defResponse, error } = useSWR(
    shouldFetchFullDefinition ? endpoints.getItemDefinition(itemHash) : null,
    fetcher,
    {
        revalidateOnFocus: false,
        dedupingInterval: 600000, 
    }
  );
  
  // Watch store for this item's transfer status
  const transferStatus = useTransferStore(
    useCallback(
      (state) => {
        if (!itemInstanceId) return null;

        return (
          state.pendingOperations.find(
            (operation) => operation.itemInstanceId === itemInstanceId
          )?.status ?? null
        );
      },
      [itemInstanceId]
    )
  ) as TransferStatus | null;
  const isPending = transferStatus !== null;
  const isSyncing = transferStatus === 'syncing';
  const isError = transferStatus === 'error';
  
  // Track drag state for visual feedback
  const [isDragging, setIsDragging] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const def = defResponse?.Response || definition;

  // Check if item is a subclass
  const isSubclass = def?.inventory?.bucketTypeHash === BUCKETS.SUBCLASS;

  // Calculate plug hashes to fetch
  // Fetch ALL active plugs AND reusable plugs (options)
  const hashesToFetch = useMemo(() => {
      const allHashes: number[] = [];
      
      if (socketsData?.sockets) {
          socketsData.sockets.forEach((s: any, index: number) => {
              // Active plug
              if (s.plugHash) allHashes.push(s.plugHash);

              if (!shouldResolveFullDetails) {
                  return;
              }

              // Reusable plugs (options) - Check prop or socket
              const options = getReusablePlugsForSocket(reusablePlugs, s, index);
              if (options) {
                  options.forEach((rp: any) => allHashes.push(rp.plugItemHash));
              }
          });
      }
      
      const intrinsic = socketsData?.sockets?.[0]?.plugHash;
      if (intrinsic) allHashes.push(intrinsic);

      if (shouldResolveFullDetails && def?.sockets?.socketEntries) {
          def.sockets.socketEntries.forEach((socketEntry: any) => {
              if (socketEntry.singleInitialItemHash) {
                  allHashes.push(socketEntry.singleInitialItemHash);
              }
          });
      }
      
      return Array.from(new Set(allHashes));
  }, [def, socketsData, reusablePlugs, shouldResolveFullDetails]);

  const { definitions: plugDefs } = useItemDefinitions(hashesToFetch);

  // Determine Shiny Status (Heuristic: Legendary Weapon + Double Perks in both Trait Columns)
  // Or check for specific ornament if we had a list.
  // Using Multi-Perk Logic:
  const isShiny = useMemo(() => {
      // 1. Check API property first if available (Bungie added isHolofoil in later updates for BRAVE weapons)
      if (def?.isHolofoil) return true;
      if (!shouldResolveFullDetails) return false;

      // 2. Fallback Heuristic Logic
      if (!def || def.itemType !== 3 || def.inventory?.tierTypeName !== 'Legendary') return false;
      if (!socketsData?.sockets || !plugDefs) return false;

      let multiPerkColumns = 0;
      socketsData.sockets.forEach((socket: any) => {
          if (!socket.plugHash) return;
          const plug = plugDefs[socket.plugHash];
          if (!plug) return;
          
          const typeName = plug.itemTypeDisplayName?.toLowerCase() || "";
          // Check for gameplay sockets (traits, barrels, mags)
           const isGameplaySocket = 
                typeName.includes("trait") || 
                typeName.includes("magazine") || 
                typeName.includes("barrel") ||
                typeName.includes("sight");

           const options = getReusablePlugsForSocket(
               reusablePlugs,
               socket,
               socketsData.sockets.indexOf(socket)
           );
           if (isGameplaySocket && options?.length > 1) {
               multiPerkColumns++;
           }
      });

      // BRAVE Shiny weapons have double perks in at least 2 columns (usually 3 and 4)
      return multiPerkColumns >= 2;
  }, [def, socketsData, plugDefs, reusablePlugs, shouldResolveFullDetails]);

  // Calculate detailed perks for tooltip
  const detailedPerks = useMemo(() => {
    if (!shouldResolveFullDetails || !plugDefs) return undefined;
    
    const perksList: any[] = [];
    const itemIsExotic = def?.inventory?.tierTypeName === "Exotic";

    const shouldShowPlugAsTrait = (
        activePlug: any,
        socketIndex: number
    ) => {
        const typeName = activePlug.itemTypeDisplayName?.toLowerCase() || "";
        const category = activePlug.plug?.plugCategoryIdentifier?.toLowerCase() || "";
        const name = activePlug.displayProperties?.name?.toLowerCase() || "";
        const description = activePlug.displayProperties?.description?.toLowerCase() || "";
        const isExoticArmor = def?.itemType === 2 && itemIsExotic;
        const isExoticArmorIntrinsic =
            isExoticArmor &&
            (
                typeName.includes("intrinsic") ||
                category.includes("intrinsic") ||
                category.includes("exotic") ||
                description.includes("intrinsic trait")
            );
        const isExoticWeaponIntrinsic =
            def?.itemType === 3 &&
            itemIsExotic &&
            (
                socketIndex === 0 ||
                typeName.includes("intrinsic") ||
                category.includes("intrinsic")
            );

        // Exclude mods, shaders, ornaments, masterworks, trackers
        if (typeName.includes("mod") || 
            typeName.includes("shader") || 
            typeName.includes("ornament") || 
            typeName.includes("masterwork") ||
            typeName.includes("tracker") ||
            name.includes("kill tracker")) return false;

        return (
            typeName.includes("trait") ||
            typeName.includes("perk") ||
            category.includes("trait") ||
            category.includes("frames") ||
            typeName.includes("barrel") ||
            typeName.includes("magazine") ||
            typeName.includes("sight") ||
            typeName.includes("scope") ||
            isExoticArmorIntrinsic ||
            isExoticWeaponIntrinsic
        );
    };

    const addActivePlug = (activePlug: any, socketIndex: number, options: any[]) => {
        if (!activePlug || !shouldShowPlugAsTrait(activePlug, socketIndex)) return;

        const resolvedOptions = options.length > 0 ? options : [activePlug];

        perksList.push({
            socketIndex,
            activePlug,
            options: resolvedOptions,
        });
    };

    if (socketsData?.sockets) {
      socketsData.sockets.forEach((s: any, idx: number) => {
        if (!s.plugHash) return;
        const activePlug = plugDefs[s.plugHash];
        if (!activePlug) return;

        const socketOptions = getReusablePlugsForSocket(reusablePlugs, s, idx);
        const options = socketOptions
            .map((reusablePlug: any) => plugDefs[reusablePlug.plugItemHash])
            .filter(Boolean);

        addActivePlug(activePlug, idx, options);
      });
    } else if (def?.sockets?.socketEntries) {
        def.sockets.socketEntries.forEach((socketEntry: any, socketIndex: number) => {
            const activePlugHash = socketEntry.singleInitialItemHash;
            const activePlug = activePlugHash ? plugDefs[activePlugHash] : null;

            addActivePlug(activePlug, socketIndex, activePlug ? [activePlug] : []);
        });
    }
    
    return perksList.length > 0 ? perksList : undefined;
  }, [def, socketsData, plugDefs, reusablePlugs, shouldResolveFullDetails]);

  useEffect(() => {
      if (def && onDefinitionLoaded) {
          onDefinitionLoaded(itemHash, def);
      }
  }, [def, itemHash, onDefinitionLoaded]);


  // EARLY RETURNS AFTER ALL HOOKS
  // Note: We MUST NOT return null before all hooks are called.
  // We use useMemo for values that depend on props/state, and only conditionally render in the return statement or use dummy components.
  
  const classMismatch = classFilter !== undefined && def && def.classType !== 3 && def.classType !== classFilter;
  const showMismatch = classMismatch && showClassSymbolOnMismatch;
  const shouldRenderMismatch = classMismatch && showMismatch;
  const shouldHideItem = classMismatch && !showMismatch;

  const isLoading = !def && !error;
  const isDimmed = isHighlighted === false;

  const itemIconPack = useMemo(() => {
    if (!def) {
      return {
        itemIconSrc: null as string | null,
        watermarkSrc: null as string | null,
      };
    }
    const w = itemIconDecodeBudgetPx(size, 2);
    const manifestVersion = getClientManifestVersionCacheKey();
    const iconPath = normalizeBungieAssetPath(def.displayProperties?.icon);
    const itemIconSrc = iconPath
      ? USE_BUNGIE_ICON_PROXY
        ? buildBungieImageProxyUrl(iconPath, w, manifestVersion)
        : getBungieImage(iconPath)
      : null;
    const watermarkPath = normalizeBungieAssetPath(def.iconWatermark || def.iconWatermarkShelved);
    const watermarkSrc = watermarkPath
      ? buildBungieIconUrl(watermarkPath, w, manifestVersion)
      : null;
    return { itemIconSrc, watermarkSrc };
  }, [def, size]);
  const itemIconSrc = itemIconPack.itemIconSrc;
  const watermarkSrc = itemIconPack.watermarkSrc;

  const name = def?.displayProperties?.name;
  const rarity = def?.inventory?.tierTypeName; 
  const itemType = def?.itemTypeDisplayName;
  const damageTypeHash = instanceData?.damageTypeHash || def?.defaultDamageTypeHash;
  const elementIcon = ELEMENT_ICONS[damageTypeHash];
  const elementIconSrc = useMemo(() => {
    if (!elementIcon) {
      return null;
    }
    const p = normalizeBungieAssetPath(elementIcon);
    if (!p) {
      return elementIcon;
    }
    return buildBungieImageProxyUrl(
      p,
      displayPixelsForCssEdge(12, 2),
      getClientManifestVersionCacheKey()
    );
  }, [elementIcon]);

  // Plugs Logic (Mods/Perks) - Moved logic into useMemo to be hook-safe
  // We already compute 'detailedPerks' with useMemo which iterates sockets.
  // We can just extract cosmetic lists from socketsData + plugDefs directly here or memorize them.
  const { perks, mods, shaders, ornaments, killEffects, killTrackers, enhancementTierDerived } = useMemo(() => {
      const p: any[] = [];
      const m: any[] = [];
      const s: any[] = [];
      const o: any[] = [];
      const ke: any[] = [];
      const kt: any[] = [];
      let et: number | null = null;

      if (shouldResolveFullDetails && socketsData?.sockets && plugDefs) {
          socketsData.sockets.forEach((socket: any) => {
              if (!socket.plugHash) return;
              const plug = plugDefs[socket.plugHash];
              if (!plug) return;

              const typeName = plug.itemTypeDisplayName?.toLowerCase() || "";
              const category = plug.plug?.plugCategoryIdentifier || "";
              const n = plug.displayProperties?.name?.toLowerCase() || "";
              
              if (typeName.includes("masterwork") || category.includes("masterwork")) {
                 const tierMatch = plug.displayProperties?.name?.match(/Tier (\d+)/);
                 if (tierMatch) {
                     et = parseInt(tierMatch[1], 10);
                 }
              }

              let isCosmetic = false;

              if (typeName.includes("shader")) {
                  s.push(plug);
                  isCosmetic = true;
              } 
              
              if (typeName.includes("ornament") || category.includes("skins")) {
                  o.push(plug);
                  isCosmetic = true;
              } 
              
              if (n.includes("kill tracker") || typeName.includes("tracker")) {
                  kt.push(plug);
                  isCosmetic = true;
              } 
              
              if (typeName.includes("transmat")) {
                  ke.push(plug);
                  isCosmetic = true;
              }
              
              if (!isCosmetic) {
                  if (typeName.includes("mod")) {
                      m.push(plug);
                  }
                  else if (typeName.includes("trait") || typeName.includes("perk") || category.includes("trait") || category.includes("frames")) {
                      p.push(plug);
                  }
              }
          });
      }
      return { perks: p, mods: m, shaders: s, ornaments: o, killEffects: ke, killTrackers: kt, enhancementTierDerived: et };
  }, [socketsData, plugDefs, shouldResolveFullDetails]);

  // Derived properties
  const isMasterwork = (instanceData ? (instanceData.state & 4) === 4 : false) || (enhancementTierDerived === 10);
  const enhancementTier = (isMasterwork && (!enhancementTierDerived || enhancementTierDerived < 10)) ? 10 : enhancementTierDerived;

  const rarityBorder = hideBorder ? 'border-transparent' : (
      isMasterwork ? 'border-destiny-gold shadow-[0_0_4px_rgba(227,206,98,0.5)]' :
      ({
      'Exotic': 'border-yellow-500',
      'Legendary': 'border-purple-500',
      'Rare': 'border-blue-500',
      'Common': 'border-green-500',
      'Basic': 'border-white/20'
  }[rarity as string] || 'border-white/20'));

  // Stats Logic
  const stats = useMemo(() => {
      if (!def) return {};
      let initialStats = { ...(def.stats?.stats || {}) };
      if (Object.keys(initialStats).length === 0 && def.investmentStats) {
          def.investmentStats.forEach((stat: any) => {
              initialStats[stat.statTypeHash] = {
                  statHash: stat.statTypeHash,
                  value: stat.value,
                  minimum: 0,
                  maximum: 100,
                  displayMaximum: 100
              };
          });
      }
      const s = { ...initialStats };
      if (instanceData?.stats) {
          Object.entries(instanceData.stats).forEach(([hash, stat]: [string, any]) => {
              s[hash] = { ...s[hash], value: stat.value };
          });
      }
      return s;
  }, [def, instanceData]);

  // DIM-style item drop tier comes from the live instance, not socket text.
  const tierNumber = instanceData?.gearTier ?? 0;
  const tier = tierNumber > 1 ? `Tier ${tierNumber}` : null;

  // Calculate Armor Quality
  const armorQuality = useMemo(() => {
      if (!shouldResolveFullDetails) return null;
      if (def?.itemType !== 2 || !instanceData?.stats) return null;
       // We need activePlugs for base stat calculation
      const activePlugs: any[] = [];
      if (socketsData?.sockets && plugDefs) {
          socketsData.sockets.forEach((socket: any) => {
              if (socket.plugHash && plugDefs[socket.plugHash]) {
                  activePlugs.push(plugDefs[socket.plugHash]);
              }
          });
      }
      const isMw = (instanceData.state & 4) === 4;
      const baseStats = getArmorBaseStats(instanceData.stats, activePlugs, isMw);
      return getArmorQuality(baseStats, def);
  }, [def, instanceData, socketsData, plugDefs, shouldResolveFullDetails]);

  // Extract perk hashes for wish list matching
  // Include ALL available perks (reusable plugs), not just currently selected ones
  const perkHashes = useMemo(() => {
      if (!shouldResolveFullDetails) return [];

      const hashes: number[] = [];
      
      if (socketsData?.sockets) {
          socketsData.sockets.forEach((socket: any, index: number) => {
              // Add currently selected plug
              if (socket.plugHash) {
                  hashes.push(socket.plugHash);
              }
              
              // Add all reusable plugs from the socket itself
              if (socket.reusablePlugHashes) {
                  socket.reusablePlugHashes.forEach((hash: number) => {
                      if (!hashes.includes(hash)) {
                          hashes.push(hash);
                      }
                  });
              }
              
              // Also check reusablePlugItems if available (some API versions)
              if (socket.reusablePlugItems) {
                  socket.reusablePlugItems.forEach((plug: any) => {
                      if (plug.plugItemHash && !hashes.includes(plug.plugItemHash)) {
                          hashes.push(plug.plugItemHash);
                      }
                  });
              }
              
              // Check socket's nested reusablePlugs
              if (socket.reusablePlugs) {
                  socket.reusablePlugs.forEach((plug: any) => {
                      const hash = plug.plugItemHash || plug;
                      if (hash && !hashes.includes(hash)) {
                          hashes.push(hash);
                      }
                  });
              }
              
              // Use the reusablePlugs prop (from itemComponents.reusablePlugs.data)
              // This is indexed by socket index
              const profileReusablePlugOptions = getReusablePlugsForSocket(reusablePlugs, socket, index);
              if (profileReusablePlugOptions.length > 0) {
                  profileReusablePlugOptions.forEach((plug: any) => {
                      const hash = plug.plugItemHash || plug;
                      if (hash && !hashes.includes(hash)) {
                          hashes.push(hash);
                      }
                  });
              }
          });
      }
      
      // Also extract from reusablePlugs if socketsData is missing or we didn't get gameplay perks
      // The reusablePlugs prop is keyed by socket index as strings
      if (reusablePlugs) {
          Object.entries(reusablePlugs).forEach(([socketIndex, plugs]: [string, any]) => {
              if (Array.isArray(plugs)) {
                  plugs.forEach((plug: any) => {
                      const hash = plug.plugItemHash || plug;
                      if (hash && typeof hash === 'number' && !hashes.includes(hash)) {
                          hashes.push(hash);
                      }
                  });
              }
          });
      }
      
      return hashes;
  }, [socketsData, reusablePlugs, shouldResolveFullDetails]);

  // Wish List Integration
  const getWishListInfo = useWishListStore(state => state.getWishListInfo);
  const wishListLookup = useWishListStore(state => state.wishListLookup);
  const trashListLookup = useWishListStore(state => state.trashListLookup);
  
  const wishListInfo = useMemo(() => {
      if (!itemHash) return { isWishListed: false, isTrash: false, matchType: 'none' as const, matchedPerkHashes: [] };
      
      const info = getWishListInfo(itemHash, perkHashes.length > 0 ? perkHashes : undefined);
      
      return info;
  }, [itemHash, perkHashes, getWishListInfo, wishListLookup, trashListLookup]);

  // Handlers
  const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      if (forcedContextMenuPosition) return;
      setContextMenuPos({ x: e.clientX, y: e.clientY });
      setIsHovered(false);
      setInitialTooltipPos(undefined);
  };

  const handleDragStart = (e: React.DragEvent) => {
      if (!itemInstanceId) return;
      setIsDragging(true);
      setIsHovered(false);
      setInitialTooltipPos(undefined);
      
      e.dataTransfer.setData('application/json', JSON.stringify({
          itemHash,
          itemInstanceId,
          ownerId,
          def
      }));
      e.dataTransfer.setData('text/plain', itemInstanceId);
      
      // Set custom drag image (semi-transparent)
      if (cardRef.current) {
          const rect = cardRef.current.getBoundingClientRect();
          e.dataTransfer.setDragImage(cardRef.current, rect.width / 2, rect.height / 2);
      }
  };
  
  const handleDragEnd = () => {
      setIsDragging(false);
  };

  const handleMouseLeave = () => {
      setIsHovered(false);
      setInitialTooltipPos(undefined);
  };

  const isLocked = instanceData ? (instanceData.state & 1) === 1 : false;

  const expirationDate = instanceData?.expirationDate ? new Date(instanceData.expirationDate) : null;
  const timeLeft = expirationDate ? (() => {
      const diff = expirationDate.getTime() - new Date().getTime();
      if (diff <= 0) return "Expired";
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours > 24) return `${Math.floor(hours / 24)}d`;
      if (hours > 0) return `${hours}h`;
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}m`;
  })() : null;

  const handleMouseEnter = (e: React.MouseEvent) => {
      if (!contextMenuPos) {
          setInitialTooltipPos({ x: e.clientX, y: e.clientY });
          setIsHovered(true);
      }
  };

  const starConfig = {
      small: { text: 'text-[7px]', top: 'top-2.5', left: 'left-[0.25rem]', gap: '-space-y-1' },
      medium: { text: 'text-[8px]', top: 'top-3', left: 'left-[0.28rem]', gap: '-space-y-1' },
      large: { text: 'text-[9px]', top: 'top-3.5', left: 'left-[0.3rem]', gap: '-space-y-0.5' }
  }[size];

  const wantsStatsRow = !!(
    instanceData?.primaryStat?.value ||
    elementIcon ||
    quantity ||
    timeLeft ||
    wishListInfo.isWishListed
  );
  const showExpandedBottom =
    !minimal &&
    !hidePower &&
    !!(
      instanceData?.primaryStat?.value ||
      elementIcon ||
      quantity ||
      (objectives && objectives.length > 0) ||
      timeLeft ||
      wishListInfo.isWishListed
    );

  const statsRowEl = (
    <div className="flex items-center justify-between w-full gap-1 min-h-3">
      {quantity ? (
        <span className="text-[10px] font-bold leading-none text-white">{quantity}</span>
      ) : timeLeft ? (
        <span className="text-[10px] font-bold leading-none text-yellow-400 flex items-center gap-1">
          <span className="text-[8px]">⏳</span> {timeLeft}
        </span>
      ) : (
        <div className="flex flex-col leading-none">
          <span
            className={cn(
              'text-[10px] font-bold',
              instanceData?.primaryStat?.value ? 'text-destiny-gold' : 'text-transparent'
            )}
          >
            {instanceData?.primaryStat?.value || '0'}
          </span>
          {powerDiff !== undefined && powerDiff !== 0 && (
            <span
              className={cn(
                'text-[9px] font-bold',
                powerDiff > 0 ? 'text-green-400' : 'text-red-400'
              )}
            >
              {powerDiff > 0 ? '+' : ''}
              {powerDiff}
            </span>
          )}
        </div>
      )}

      {wishListInfo.isWishListed && !wishListInfo.isTrash && (
        <span
          className={cn(
            'text-[8px] drop-shadow-sm leading-none',
            getWishListMatchTextClass(wishListInfo.matchType)
          )}
        >
          {"\u2605"}
        </span>
      )}

      {elementIcon && (
        // Native img: lighter than next/image for hundreds of 12px chips in dense grids
        <img
          src={elementIconSrc || elementIcon}
          width={12}
          height={12}
          alt=""
          decoding="async"
          loading="lazy"
          fetchPriority={imageFetchPriority ?? "low"}
          className="object-contain shrink-0"
        />
      )}
    </div>
  );

  // RENDER LOGIC START

  if (shouldHideItem) return null;

  if (shouldRenderMismatch && def) {
      return (
          <div className={cn(
              "flex items-center justify-center bg-black/20 border border-white/5 opacity-40 select-none pointer-events-none",
              className
          )}>
              <Image 
                src={CLASS_ICONS[def.classType] || ""} 
                alt="Class Mismatch" 
                width={24} 
                height={24} 
                className="object-contain opacity-50" 
              />
          </div>
      );
  }

  if (isLoading) {
      return (
          <div className={cn("w-16 h-16 bg-slate-800/50 animate-pulse", className)} />
      );
  }

  if (!def) {
      return (
          <div className={cn("w-16 h-16 bg-red-900/20 border border-red-500/20 flex items-center justify-center text-xs text-red-500", className)}>
              ?
          </div>
      );
  }

  const isLcpImage = imagePriority === true;
  const iconFetchPriority = isLcpImage ? "high" : imageFetchPriority ?? "low";
  const shouldShowTooltip =
    Boolean(activeTooltipPosition) &&
    (Boolean(forcedTooltipPosition) || isHovered) &&
    !isDimmed &&
    !activeContextMenuPosition;
  const closeContextMenu = () => {
      setContextMenuPos(null);
      onCloseForcedContextMenu?.();
  };
  const tooltipNode = shouldShowTooltip ? (
      <ItemTooltip
          name={name}
          itemType={itemType}
          rarity={rarity}
          icon={itemIconSrc || undefined}
          power={hideTooltipPower ? undefined : instanceData?.primaryStat?.value}
          flavorText={def.flavorText}
          seasonBadge={getBungieImage(def.iconWatermark || def.iconWatermarkShelved) || undefined}
          elementIcon={elementIcon}
          stats={stats}
          itemHash={itemHash}
          perks={perks}
          mods={mods}
          shaders={shaders}
          ornaments={ornaments}
          killEffects={killEffects}
          killTrackers={killTrackers}
          enhancementTier={enhancementTier}
          tier={tier || undefined}
          initialPosition={activeTooltipPosition}
          objectives={objectives}
          itemDef={def}
          isShiny={isShiny}
          detailedPerks={detailedPerks}
          armorQuality={armorQuality}
          socketsData={socketsData}
          plugDefs={plugDefs}
          wishListInfo={wishListInfo}
      />
  ) : null;
  const contextMenuNode = activeContextMenuPosition ? (
      <ItemContextMenu
          x={activeContextMenuPosition.x}
          y={activeContextMenuPosition.y}
          onClose={closeContextMenu}
          itemHash={itemHash}
          itemInstanceId={itemInstanceId}
          ownerId={ownerId}
          isLocked={isLocked}
          itemDef={def}
          instanceData={instanceData}
          perks={perks}
          mods={mods}
          shaders={shaders}
          ornaments={ornaments}
          killEffects={killEffects}
          killTrackers={killTrackers}
          objectives={objectives}
          detailedPerks={detailedPerks}
          wishListInfo={wishListInfo}
          socketsData={socketsData}
          plugDefs={plugDefs}
          tooltipSeasonBadge={getBungieImage(def.iconWatermark || def.iconWatermarkShelved) || undefined}
          tooltipElementIcon={elementIcon}
          tooltipTier={tier}
          tooltipEnhancementTier={enhancementTier}
          tooltipIsShiny={isShiny}
          tooltipArmorQuality={armorQuality}
      />
  ) : null;

  if (!renderTile) {
      return (
          <>
              {tooltipNode}
              {contextMenuNode}
          </>
      );
  }

    return (
    <>
        <div 
            ref={cardRef}
            className={cn(
                "group relative flex flex-col bg-transparent transition-all cursor-pointer select-none", 
                "h-auto! border-none! overflow-visible!",
                className,
                // Dragging state - slightly transparent, no pointer events
                isDragging && "opacity-40 scale-95 pointer-events-none",
                // Syncing state - show with sync animation
                isSyncing && "animate-snap-in",
                // Error state - shake animation
                isError && "animate-error-shake"
            )} 
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onContextMenu={handleContextMenu}
            draggable={!!itemInstanceId && !isPending}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            {/* Main Icon Container */}
            <div className={cn(
                "relative w-full aspect-square overflow-hidden border-2",
                isSubclass ? "bg-transparent border-none" : "bg-slate-900",
                rarityBorder,
                isDimmed ? "opacity-20 grayscale" : ""
            )}>
                {itemIconSrc && (
                  <FastBungieIcon
                    src={itemIconSrc}
                    alt={name || ""}
                    size={ITEM_ICON_CSS_PX[size]}
                    fetchPriority={iconFetchPriority}
                    className="absolute inset-0"
                  />
                )}
                
                {/* Seasonal Badge */}
                {watermarkSrc && (
                    <div className="absolute inset-0 z-10 pointer-events-none">
                        <FastBungieIcon
                            src={watermarkSrc}
                            alt=""
                            size={ITEM_ICON_CSS_PX[size]}
                            fetchPriority="low"
                            className="absolute inset-0 opacity-100 pointer-events-none"
                        />
                    </div>
                )}

                {/* Lock Icon Overlay */}
                {isLocked && !isSyncing && (
                    <div className="absolute top-0.5 right-0.5 z-20">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full shadow-sm" />
                    </div>
                )}
                
                {/* Sync Icon Overlay - Shows during optimistic transfer */}
                {isSyncing && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                        <div className="relative">
                            <RefreshCw className={cn(
                                "text-destiny-gold animate-sync-spin drop-shadow-lg",
                                size === 'small' ? "w-3.5 h-3.5" : "w-4 h-4"
                            )} />
                        </div>
                    </div>
                )}
                
                {/* Error state overlay */}
                {isError && (
                    <div className="absolute inset-0 z-30 border-2 border-red-500/50 pointer-events-none" />
                )}

                {/* Trash Indicator - Only show on icon for trash rolls */}
                {wishListInfo.isTrash && (
                    <div className={cn(
                        "absolute bottom-0.5 right-0.5 z-20 flex items-center justify-center rounded-sm shadow-lg bg-red-500/90 text-white font-bold",
                        size === 'small' ? "w-3 h-3 text-[6px]" : "w-3.5 h-3.5 text-[7px]"
                    )}>
                        ✕
                    </div>
                )}

                {/* Tier Indicator Overlay - Weapons and Armor */}
                {(def.itemType === 3 || def.itemType === 2) && tierNumber > 1 && (
                    tierAsNumber ? (
                        // Number display in top right corner
                        <div className={cn(
                            "absolute top-0.5 right-0.5 z-20 flex items-center justify-center rounded-sm font-bold drop-shadow-md",
                            size === 'small' ? "w-3 h-3 text-[7px]" : "w-3.5 h-3.5 text-[8px]",
                            tierNumber === 5 ? "bg-destiny-gold/90 text-slate-900" : "bg-black/70 text-white border border-white/20"
                        )}>
                            {tierNumber}
                        </div>
                    ) : (
                        // Stars display
                        <div className={cn(
                            "absolute z-20 flex flex-col leading-[0.65]",
                            starConfig.top,
                            starConfig.left,
                            starConfig.gap
                        )}>
                             {Array.from({ length: tierNumber }).map((_, i) => (
                                 <span key={i} className={cn(
                                     "drop-shadow-md",
                                     starConfig.text,
                                     tierNumber === 5 ? "text-destiny-gold" : "text-white"
                                 )}>
                                    ✦
                                 </span>
                             ))}
                        </div>
                    )
                )}

                {/* Hover Border Overlay */}
                <div className="absolute inset-0 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </div>

            {showExpandedBottom && (
                <div className="mt-1 w-full flex flex-col gap-1 px-1.5 py-0.5 [contain:layout]">
                    {wantsStatsRow && statsRowEl}

                    {objectives?.map((obj: any, i: number) => {
                         const progress = obj.progress || 0;
                         const total = obj.completionValue || 100;
                         const percent = Math.min(100, (progress / total) * 100);
                         const isComplete = obj.complete;

                         return (
                             <div key={i} className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                                 <div 
                                     className={cn("h-full transition-all duration-500", isComplete ? "bg-destiny-gold" : "bg-blue-500")}
                                     style={{ width: `${percent}%` }}
                                 />
                             </div>
                         );
                    })}
                </div>
            )}
        </div>

        {/* Portal Tooltip */}
        {tooltipNode}

        {/* Context Menu */}
        {contextMenuNode}
    </>
  );
}
