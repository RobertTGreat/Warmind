/**
 * useLoadouts Hook
 * 
 * React hooks for managing custom loadouts using Dexie.
 * Uses Dexie's useLiveQuery for reactive updates.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo } from 'react';
import { db, DBLoadout } from '@/lib/db';
import * as loadoutService from '@/lib/loadoutService';

// Re-export types
export type { DBLoadout as Loadout };
export type { 
    LoadoutItemData, 
    ArmorModData, 
    FashionData, 
    SubclassConfigData 
} from '@/lib/loadoutService';

// ============================================================================
// MAIN HOOKS
// ============================================================================

/**
 * Hook to get all loadouts
 */
export function useLoadouts() {
    const loadouts = useLiveQuery(
        () => db.loadouts.orderBy('updatedAt').reverse().toArray(),
        [],
        []
    );

    return {
        loadouts: loadouts ?? [],
        isLoading: loadouts === undefined,
    };
}

/**
 * Hook to get loadouts by class
 */
export function useLoadoutsByClass(classType: number) {
    const loadouts = useLiveQuery(
        () => db.loadouts.where('classType').equals(classType).toArray(),
        [classType],
        []
    );

    return {
        loadouts: loadouts ?? [],
        isLoading: loadouts === undefined,
    };
}

/**
 * Hook to get a single loadout by ID
 */
export function useLoadout(id: number | null | undefined) {
    const loadout = useLiveQuery(
        async () => {
            if (!id) return null;
            return db.loadouts.get(id) ?? null;
        },
        [id],
        null
    );

    return {
        loadout,
        isLoading: loadout === undefined,
    };
}

/**
 * Hook to get a loadout by external ID
 */
export function useLoadoutByExternalId(externalId: string | null | undefined) {
    const loadout = useLiveQuery(
        async () => {
            if (!externalId) return null;
            return loadoutService.getLoadoutByExternalId(externalId) ?? null;
        },
        [externalId],
        null
    );

    return {
        loadout,
        isLoading: loadout === undefined,
    };
}

// ============================================================================
// LOADOUT MANAGEMENT HOOK
// ============================================================================

/**
 * Hook with full loadout management capabilities
 */
export function useLoadoutManager() {
    const { loadouts, isLoading } = useLoadouts();

    const createLoadout = useCallback(
        async (data: Omit<DBLoadout, 'id' | 'externalId' | 'createdAt' | 'updatedAt'>) => {
            return loadoutService.createLoadout(data);
        },
        []
    );

    const updateLoadout = useCallback(
        async (id: number, updates: Partial<Omit<DBLoadout, 'id' | 'externalId' | 'createdAt'>>) => {
            return loadoutService.updateLoadout(id, updates);
        },
        []
    );

    const deleteLoadout = useCallback(
        async (id: number) => {
            return loadoutService.deleteLoadout(id);
        },
        []
    );

    const duplicateLoadout = useCallback(
        async (id: number) => {
            return loadoutService.duplicateLoadout(id);
        },
        []
    );

    const setLoadoutItem = useCallback(
        async (loadoutId: number, item: any) => {
            return loadoutService.setLoadoutItem(loadoutId, item);
        },
        []
    );

    const removeLoadoutItem = useCallback(
        async (loadoutId: number, bucketHash: number) => {
            return loadoutService.removeLoadoutItem(loadoutId, bucketHash);
        },
        []
    );

    const setSubclass = useCallback(
        async (loadoutId: number, subclassConfig: any) => {
            return loadoutService.setLoadoutSubclass(loadoutId, subclassConfig);
        },
        []
    );

    const setArmorMods = useCallback(
        async (loadoutId: number, armorMods: any[]) => {
            return loadoutService.setLoadoutArmorMods(loadoutId, armorMods);
        },
        []
    );

    const setFashion = useCallback(
        async (loadoutId: number, fashion: any[]) => {
            return loadoutService.setLoadoutFashion(loadoutId, fashion);
        },
        []
    );

    const addTag = useCallback(
        async (loadoutId: number, tag: string) => {
            return loadoutService.addLoadoutTag(loadoutId, tag);
        },
        []
    );

    const removeTag = useCallback(
        async (loadoutId: number, tag: string) => {
            return loadoutService.removeLoadoutTag(loadoutId, tag);
        },
        []
    );

    const generateShareCode = useCallback(
        (loadout: DBLoadout) => {
            return loadoutService.encodeLoadoutShareCode(loadout);
        },
        []
    );

    const importFromShareCode = useCallback(
        async (code: string) => {
            return loadoutService.importFromShareCode(code);
        },
        []
    );

    return {
        loadouts,
        isLoading,
        createLoadout,
        updateLoadout,
        deleteLoadout,
        duplicateLoadout,
        setLoadoutItem,
        removeLoadoutItem,
        setSubclass,
        setArmorMods,
        setFashion,
        addTag,
        removeTag,
        generateShareCode,
        importFromShareCode,
    };
}

// ============================================================================
// LOADOUT STATISTICS
// ============================================================================

/**
 * Hook to get loadout statistics
 */
export function useLoadoutStats() {
    const stats = useLiveQuery(
        async () => {
            return loadoutService.getLoadoutStats();
        },
        [],
        { total: 0, byClass: { 0: 0, 1: 0, 2: 0 }, byTag: {}, shared: 0 }
    );

    return {
        stats: stats ?? { total: 0, byClass: { 0: 0, 1: 0, 2: 0 }, byTag: {}, shared: 0 },
        isLoading: stats === undefined,
    };
}

// ============================================================================
// LOADOUT SEARCH
// ============================================================================

/**
 * Hook to search loadouts by name
 */
export function useLoadoutSearch(search: string) {
    const searchLower = search.toLowerCase();
    
    const results = useLiveQuery(
        async () => {
            if (!search || search.length < 2) return [];
            const all = await db.loadouts.toArray();
            return all.filter(l => l.name.toLowerCase().includes(searchLower));
        },
        [searchLower],
        []
    );

    return {
        results: results ?? [],
        isLoading: results === undefined,
    };
}

// ============================================================================
// CLASS CONSTANTS
// ============================================================================

export const CLASS_TYPES = {
    TITAN: 0,
    HUNTER: 1,
    WARLOCK: 2,
} as const;

export const CLASS_NAMES: Record<number, string> = {
    0: 'Titan',
    1: 'Hunter',
    2: 'Warlock',
};

export const CLASS_ICONS: Record<number, string> = {
    0: '/class-titan.svg',
    1: '/class-hunter.svg',
    2: '/class-warlock.svg',
};

