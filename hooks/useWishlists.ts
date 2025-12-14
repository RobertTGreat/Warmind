/**
 * useWishlists Hook
 * 
 * React hooks for managing wish lists using Dexie.
 * Uses Dexie's useLiveQuery for reactive updates.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useState } from 'react';
import { db, DBWishlist, DBWishlistRoll } from '@/lib/db';
import * as wishlistService from '@/lib/wishlistService';

// Re-export types
export type { DBWishlist as Wishlist, DBWishlistRoll as WishlistRoll };

// ============================================================================
// MAIN HOOKS
// ============================================================================

/**
 * Hook to get all wishlists
 */
export function useWishlists() {
    const wishlists = useLiveQuery(
        () => db.wishlists.toArray(),
        [],
        []
    );

    return {
        wishlists: wishlists ?? [],
        isLoading: wishlists === undefined,
    };
}

/**
 * Hook to get enabled wishlists only
 */
export function useEnabledWishlists() {
    const wishlists = useLiveQuery(
        () => db.wishlists.where('enabled').equals(1).toArray(),
        [],
        []
    );

    return {
        wishlists: wishlists ?? [],
        isLoading: wishlists === undefined,
    };
}

/**
 * Hook to get a single wishlist
 */
export function useWishlist(id: string | null | undefined) {
    const wishlist = useLiveQuery(
        async () => {
            if (!id) return null;
            return db.wishlists.get(id) ?? null;
        },
        [id],
        null
    );

    return {
        wishlist,
        isLoading: wishlist === undefined,
    };
}

// ============================================================================
// WISHLIST MANAGEMENT HOOK
// ============================================================================

/**
 * Hook with full wishlist management capabilities
 */
export function useWishlistManager() {
    const { wishlists, isLoading } = useWishlists();
    const [isAdding, setIsAdding] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);

    const addWishlist = useCallback(async (url: string) => {
        setIsAdding(true);
        setAddError(null);
        
        try {
            const wishlist = await wishlistService.addWishlistFromUrl(url);
            setIsAdding(false);
            return wishlist;
        } catch (e) {
            const error = e instanceof Error ? e.message : 'Failed to add wishlist';
            setAddError(error);
            setIsAdding(false);
            throw e;
        }
    }, []);

    const deleteWishlist = useCallback(async (id: string) => {
        return wishlistService.deleteWishlist(id);
    }, []);

    const toggleWishlist = useCallback(async (id: string) => {
        return wishlistService.toggleWishlist(id);
    }, []);

    const refreshWishlist = useCallback(async (id: string) => {
        return wishlistService.refreshWishlist(id);
    }, []);

    const refreshAllWishlists = useCallback(async () => {
        const results: { id: string; success: boolean; error?: string }[] = [];
        
        for (const wishlist of wishlists) {
            try {
                await wishlistService.refreshWishlist(wishlist.id);
                results.push({ id: wishlist.id, success: true });
            } catch (e) {
                results.push({
                    id: wishlist.id,
                    success: false,
                    error: e instanceof Error ? e.message : 'Unknown error',
                });
            }
        }
        
        return results;
    }, [wishlists]);

    return {
        wishlists,
        isLoading,
        isAdding,
        addError,
        addWishlist,
        deleteWishlist,
        toggleWishlist,
        refreshWishlist,
        refreshAllWishlists,
    };
}

// ============================================================================
// ROLL MATCHING HOOKS
// ============================================================================

/**
 * Hook to get wishlist rolls for an item
 */
export function useItemWishlistRolls(itemHash: number | null | undefined) {
    const rolls = useLiveQuery(
        async () => {
            if (!itemHash) return [];
            return wishlistService.getRollsForItem(itemHash);
        },
        [itemHash],
        []
    );

    return {
        rolls: rolls ?? [],
        goodRolls: (rolls ?? []).filter(r => !r.isTrash),
        trashRolls: (rolls ?? []).filter(r => r.isTrash),
        hasRolls: (rolls?.length ?? 0) > 0,
        isLoading: rolls === undefined,
    };
}

/**
 * Hook to match an item's perks against wishlist rolls
 */
export function useItemRollMatch(
    itemHash: number | null | undefined,
    itemPerks: number[]
) {
    const matches = useLiveQuery(
        async () => {
            if (!itemHash || itemPerks.length === 0) return [];
            return wishlistService.matchItemRolls(itemHash, itemPerks);
        },
        [itemHash, itemPerks.join(',')],
        []
    );

    const bestMatch = (matches ?? []).find(m => !m.roll.isTrash);
    const isGodRoll = bestMatch?.matchPercentage === 100;
    const isTrash = (matches ?? []).some(m => m.roll.isTrash && m.matchPercentage === 100);

    return {
        matches: matches ?? [],
        bestMatch,
        isGodRoll,
        isTrash,
        isLoading: matches === undefined,
    };
}

/**
 * Hook to check if an item is a god roll (simple check)
 */
export function useIsGodRoll(
    itemHash: number | null | undefined,
    itemPerks: number[]
) {
    const result = useLiveQuery(
        async () => {
            if (!itemHash || itemPerks.length === 0) return false;
            return wishlistService.isGodRoll(itemHash, itemPerks);
        },
        [itemHash, itemPerks.join(',')],
        false
    );

    return result ?? false;
}

/**
 * Hook to check if an item is trash
 */
export function useIsTrashRoll(
    itemHash: number | null | undefined,
    itemPerks: number[]
) {
    const result = useLiveQuery(
        async () => {
            if (!itemHash || itemPerks.length === 0) return false;
            return wishlistService.isTrashRoll(itemHash, itemPerks);
        },
        [itemHash, itemPerks.join(',')],
        false
    );

    return result ?? false;
}

// ============================================================================
// WISHLIST STATISTICS
// ============================================================================

/**
 * Hook to get wishlist statistics
 */
export function useWishlistStats() {
    const stats = useLiveQuery(
        async () => {
            return wishlistService.getWishlistStats();
        },
        [],
        {
            totalWishlists: 0,
            enabledWishlists: 0,
            totalRolls: 0,
            totalTrashRolls: 0,
            uniqueItems: 0,
        }
    );

    return {
        stats: stats ?? {
            totalWishlists: 0,
            enabledWishlists: 0,
            totalRolls: 0,
            totalTrashRolls: 0,
            uniqueItems: 0,
        },
        isLoading: stats === undefined,
    };
}

// ============================================================================
// DEFAULT WISHLISTS
// ============================================================================

export const DEFAULT_WISHLISTS = [
    {
        name: 'Voltron PVE',
        url: 'https://raw.githubusercontent.com/48klocs/dim-wish-list-sources/master/voltron.txt',
        description: 'Community-curated PVE god rolls',
    },
    {
        name: 'Pandapaxxy PVP',
        url: 'https://raw.githubusercontent.com/48klocs/dim-wish-list-sources/master/choosy_voltron.txt',
        description: 'Community-curated PVP god rolls',
    },
] as const;








