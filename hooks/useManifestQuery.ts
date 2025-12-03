/**
 * useManifestQuery Hook
 * 
 * React hooks for querying the manifest index using Dexie.
 * Enables queries like "find all exotic weapons" or "find all titan armor".
 * 
 * Uses Dexie's useLiveQuery for reactive updates when the database changes.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { db, ManifestIndex } from '@/lib/db';
import { 
    queryManifestItems, 
    ManifestQueryFilters,
    ITEM_TYPES,
    TIER_TYPES,
    CLASS_TYPES,
    DAMAGE_TYPES,
    buildManifestIndex,
    isManifestIndexBuilt,
    getManifestIndexStats,
} from '@/lib/manifestIndex';
import { useState, useEffect, useCallback } from 'react';

// Re-export constants for convenience
export { ITEM_TYPES, TIER_TYPES, CLASS_TYPES, DAMAGE_TYPES };

// ============================================================================
// MANIFEST INDEX MANAGEMENT
// ============================================================================

/**
 * Hook to manage manifest index initialization
 */
export function useManifestIndex() {
    const [isBuilding, setIsBuilding] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<{
        totalItems: number;
        weapons: number;
        armor: number;
        exotics: number;
        legendaries: number;
    } | null>(null);

    const initialize = useCallback(async (forceRebuild = false) => {
        setIsBuilding(true);
        setError(null);

        try {
            const result = await buildManifestIndex(forceRebuild);
            console.log(`[useManifestIndex] Index ready: ${result.itemCount} items, version ${result.version}`);
            
            const indexStats = await getManifestIndexStats();
            setStats(indexStats);
            setIsReady(true);
        } catch (err) {
            console.error('[useManifestIndex] Failed to build index:', err);
            setError(err instanceof Error ? err.message : 'Failed to build manifest index');
        } finally {
            setIsBuilding(false);
        }
    }, []);

    // Check if index is already built on mount
    useEffect(() => {
        const checkIndex = async () => {
            const built = await isManifestIndexBuilt();
            if (built) {
                const indexStats = await getManifestIndexStats();
                setStats(indexStats);
                setIsReady(true);
            }
        };
        checkIndex();
    }, []);

    return {
        isBuilding,
        isReady,
        error,
        stats,
        initialize,
        rebuild: () => initialize(true),
    };
}

// ============================================================================
// GENERIC QUERY HOOK
// ============================================================================

/**
 * Generic hook for querying manifest items with filters
 */
export function useManifestQuery(filters: ManifestQueryFilters, enabled = true) {
    const items = useLiveQuery(
        async () => {
            if (!enabled) return [];
            return queryManifestItems(filters);
        },
        [JSON.stringify(filters), enabled],
        [] // Default value while loading
    );

    return {
        items: items ?? [],
        isLoading: items === undefined,
    };
}

// ============================================================================
// WEAPON QUERY HOOKS
// ============================================================================

/**
 * Get all weapons (optionally filtered by tier)
 */
export function useAllWeapons(tierType?: number) {
    return useManifestQuery({
        itemType: ITEM_TYPES.WEAPON,
        tierType,
        equippable: true,
    });
}

/**
 * Get exotic weapons
 */
export function useExoticWeapons() {
    return useManifestQuery({
        itemType: ITEM_TYPES.WEAPON,
        tierType: TIER_TYPES.EXOTIC,
        equippable: true,
    });
}

/**
 * Get legendary weapons
 */
export function useLegendaryWeapons() {
    return useManifestQuery({
        itemType: ITEM_TYPES.WEAPON,
        tierType: TIER_TYPES.LEGENDARY,
        equippable: true,
    });
}

/**
 * Get weapons by slot (kinetic, energy, power)
 */
export function useWeaponsBySlot(bucketTypeHash: number, tierType?: number) {
    return useManifestQuery({
        itemType: ITEM_TYPES.WEAPON,
        bucketTypeHash,
        tierType,
        equippable: true,
    });
}

/**
 * Get weapons by damage type
 */
export function useWeaponsByDamageType(damageType: number) {
    return useManifestQuery({
        itemType: ITEM_TYPES.WEAPON,
        damageType,
        equippable: true,
    });
}

/**
 * Get weapons by subtype (hand cannon, scout rifle, etc.)
 */
export function useWeaponsBySubType(itemSubType: number, tierType?: number) {
    return useManifestQuery({
        itemType: ITEM_TYPES.WEAPON,
        itemSubType,
        tierType,
        equippable: true,
    });
}

// ============================================================================
// ARMOR QUERY HOOKS
// ============================================================================

/**
 * Get all armor (optionally filtered by class and tier)
 */
export function useAllArmor(classType?: number, tierType?: number) {
    return useManifestQuery({
        itemType: ITEM_TYPES.ARMOR,
        classType,
        tierType,
        equippable: true,
    });
}

/**
 * Get exotic armor (optionally filtered by class)
 */
export function useExoticArmor(classType?: number) {
    return useManifestQuery({
        itemType: ITEM_TYPES.ARMOR,
        tierType: TIER_TYPES.EXOTIC,
        classType,
        equippable: true,
    });
}

/**
 * Get legendary armor (optionally filtered by class)
 */
export function useLegendaryArmor(classType?: number) {
    return useManifestQuery({
        itemType: ITEM_TYPES.ARMOR,
        tierType: TIER_TYPES.LEGENDARY,
        classType,
        equippable: true,
    });
}

/**
 * Get armor by slot
 */
export function useArmorBySlot(bucketTypeHash: number, classType?: number, tierType?: number) {
    return useManifestQuery({
        itemType: ITEM_TYPES.ARMOR,
        bucketTypeHash,
        classType,
        tierType,
        equippable: true,
    });
}

/**
 * Get titan armor
 */
export function useTitanArmor(tierType?: number) {
    return useAllArmor(CLASS_TYPES.TITAN, tierType);
}

/**
 * Get hunter armor
 */
export function useHunterArmor(tierType?: number) {
    return useAllArmor(CLASS_TYPES.HUNTER, tierType);
}

/**
 * Get warlock armor
 */
export function useWarlockArmor(tierType?: number) {
    return useAllArmor(CLASS_TYPES.WARLOCK, tierType);
}

// ============================================================================
// SEARCH HOOKS
// ============================================================================

/**
 * Search items by name
 */
export function useItemSearch(searchTerm: string, limit = 50) {
    const enabled = searchTerm.length >= 2;
    
    return useManifestQuery({
        nameSearch: searchTerm,
        equippable: true,
        limit,
    }, enabled);
}

/**
 * Get item by hash from index
 */
export function useManifestItem(hash: number | null | undefined) {
    const item = useLiveQuery(
        async () => {
            if (!hash) return null;
            return db.manifestIndex.get(hash) ?? null;
        },
        [hash],
        null
    );

    return {
        item,
        isLoading: item === undefined,
    };
}

/**
 * Get multiple items by hash from index
 */
export function useManifestItems(hashes: number[]) {
    const items = useLiveQuery(
        async () => {
            if (!hashes.length) return [];
            return db.manifestIndex.where('hash').anyOf(hashes).toArray();
        },
        [hashes.join(',')],
        []
    );

    return {
        items: items ?? [],
        isLoading: items === undefined,
    };
}

// ============================================================================
// CATEGORY HOOKS
// ============================================================================

/**
 * Get items by category hash
 */
export function useItemsByCategory(categoryHash: number, tierType?: number) {
    return useManifestQuery({
        itemCategoryHash: categoryHash,
        tierType,
        equippable: true,
    });
}

// ============================================================================
// STATS HOOK
// ============================================================================

/**
 * Get manifest index statistics
 */
export function useManifestStats() {
    const stats = useLiveQuery(async () => {
        return getManifestIndexStats();
    });

    return {
        stats,
        isLoading: stats === undefined,
    };
}

// ============================================================================
// BUCKET CONSTANTS
// ============================================================================

export const WEAPON_BUCKETS = {
    KINETIC: 1498876634,
    ENERGY: 2465295065,
    POWER: 953998645,
} as const;

export const ARMOR_BUCKETS = {
    HELMET: 3448274439,
    GAUNTLETS: 3551918588,
    CHEST: 14239492,
    LEGS: 20886954,
    CLASS: 1585787867,
} as const;

export const OTHER_BUCKETS = {
    GHOST: 4023194814,
    VEHICLE: 2025709351,
    SHIP: 284967655,
    EMBLEM: 4274335291,
    FINISHER: 3683254069,
    EMOTE: 3054419239,
} as const;

// ============================================================================
// WEAPON SUBTYPE CONSTANTS (Item Sub-Types)
// ============================================================================

export const WEAPON_SUBTYPES = {
    AUTO_RIFLE: 6,
    SHOTGUN: 7,
    MACHINE_GUN: 8,
    HAND_CANNON: 9,
    ROCKET_LAUNCHER: 10,
    FUSION_RIFLE: 11,
    SNIPER_RIFLE: 12,
    PULSE_RIFLE: 13,
    SCOUT_RIFLE: 14,
    SIDEARM: 17,
    SWORD: 18,
    LINEAR_FUSION: 22,
    GRENADE_LAUNCHER: 23,
    SUBMACHINE_GUN: 24,
    TRACE_RIFLE: 25,
    BOW: 31,
    GLAIVE: 33,
} as const;


