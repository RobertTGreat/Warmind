/**
 * Wishlist Service
 * 
 * Dexie-based service for managing wish lists.
 * Stores wishlist metadata and rolls in IndexedDB for:
 * - Fast querying of rolls by item hash
 * - Efficient storage of large wish lists
 * - Better performance than localStorage
 */

import { db, DBWishlist, DBWishlistRoll } from './db';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type { DBWishlist as Wishlist, DBWishlistRoll as WishlistRoll };

// ============================================================================
// WISHLIST CRUD
// ============================================================================

/**
 * Create or update a wishlist
 */
export async function saveWishlist(wishlist: DBWishlist): Promise<void> {
    await db.wishlists.put(wishlist);
}

/**
 * Get all wishlists
 */
export async function getAllWishlists(): Promise<DBWishlist[]> {
    return db.wishlists.toArray();
}

/**
 * Get wishlist by ID
 */
export async function getWishlistById(id: string): Promise<DBWishlist | undefined> {
    return db.wishlists.get(id);
}

/**
 * Get enabled wishlists
 */
export async function getEnabledWishlists(): Promise<DBWishlist[]> {
    return db.wishlists.where('enabled').equals(1).toArray();
}

/**
 * Delete wishlist and all its rolls
 */
export async function deleteWishlist(id: string): Promise<void> {
    // Delete all rolls for this wishlist
    await db.wishlistRolls.where('wishlistId').equals(id).delete();
    // Delete the wishlist itself
    await db.wishlists.delete(id);
}

/**
 * Toggle wishlist enabled state
 */
export async function toggleWishlist(id: string): Promise<boolean> {
    const wishlist = await getWishlistById(id);
    if (!wishlist) return false;
    
    const newState = !wishlist.enabled;
    await db.wishlists.update(id, { enabled: newState });
    return newState;
}

// ============================================================================
// ROLL MANAGEMENT
// ============================================================================

/**
 * Save rolls for a wishlist
 */
export async function saveWishlistRolls(
    wishlistId: string,
    rolls: Omit<DBWishlistRoll, 'id' | 'wishlistId'>[]
): Promise<void> {
    // Clear existing rolls for this wishlist
    await db.wishlistRolls.where('wishlistId').equals(wishlistId).delete();
    
    // Add new rolls in batches
    const BATCH_SIZE = 1000;
    const rollsWithId: Omit<DBWishlistRoll, 'id'>[] = rolls.map(roll => ({
        ...roll,
        wishlistId,
    }));
    
    for (let i = 0; i < rollsWithId.length; i += BATCH_SIZE) {
        const batch = rollsWithId.slice(i, i + BATCH_SIZE);
        await db.wishlistRolls.bulkAdd(batch as DBWishlistRoll[]);
    }
}

/**
 * Get all rolls for a wishlist
 */
export async function getWishlistRolls(wishlistId: string): Promise<DBWishlistRoll[]> {
    return db.wishlistRolls.where('wishlistId').equals(wishlistId).toArray();
}

/**
 * Get rolls for a specific item (across all enabled wishlists)
 */
export async function getRollsForItem(itemHash: number): Promise<DBWishlistRoll[]> {
    // Get enabled wishlist IDs
    const enabledLists = await getEnabledWishlists();
    const enabledIds = enabledLists.map(l => l.id);
    
    if (enabledIds.length === 0) return [];
    
    // Get rolls for this item from enabled wishlists
    const rolls = await db.wishlistRolls
        .where('[wishlistId+itemHash]')
        .anyOf(enabledIds.map(id => [id, itemHash]))
        .toArray();
    
    return rolls;
}

/**
 * Check if an item has wishlist rolls
 */
export async function hasWishlistRolls(itemHash: number): Promise<boolean> {
    const rolls = await getRollsForItem(itemHash);
    return rolls.length > 0;
}

/**
 * Get good rolls for an item (non-trash)
 */
export async function getGoodRollsForItem(itemHash: number): Promise<DBWishlistRoll[]> {
    const rolls = await getRollsForItem(itemHash);
    return rolls.filter(r => !r.isTrash);
}

/**
 * Get trash rolls for an item
 */
export async function getTrashRollsForItem(itemHash: number): Promise<DBWishlistRoll[]> {
    const rolls = await getRollsForItem(itemHash);
    return rolls.filter(r => r.isTrash);
}

// ============================================================================
// ROLL MATCHING
// ============================================================================

export interface RollMatch {
    roll: DBWishlistRoll;
    wishlist: DBWishlist;
    matchingPerks: number[];
    missingPerks: number[];
    matchPercentage: number;
}

/**
 * Match an item's perks against wishlist rolls
 */
export async function matchItemRolls(
    itemHash: number,
    itemPerks: number[]
): Promise<RollMatch[]> {
    const rolls = await getRollsForItem(itemHash);
    if (rolls.length === 0) return [];
    
    const wishlists = await getAllWishlists();
    const wishlistMap = new Map(wishlists.map(w => [w.id, w]));
    
    const matches: RollMatch[] = [];
    
    for (const roll of rolls) {
        const wishlist = wishlistMap.get(roll.wishlistId);
        if (!wishlist) continue;
        
        const matchingPerks = roll.perkHashes.filter(h => itemPerks.includes(h));
        const missingPerks = roll.perkHashes.filter(h => !itemPerks.includes(h));
        const matchPercentage = roll.perkHashes.length > 0
            ? (matchingPerks.length / roll.perkHashes.length) * 100
            : 0;
        
        if (matchingPerks.length > 0) {
            matches.push({
                roll,
                wishlist,
                matchingPerks,
                missingPerks,
                matchPercentage,
            });
        }
    }
    
    // Sort by match percentage (highest first)
    matches.sort((a, b) => b.matchPercentage - a.matchPercentage);
    
    return matches;
}

/**
 * Check if an item is a "god roll" (100% match)
 */
export async function isGodRoll(
    itemHash: number,
    itemPerks: number[]
): Promise<boolean> {
    const matches = await matchItemRolls(itemHash, itemPerks);
    return matches.some(m => m.matchPercentage === 100 && !m.roll.isTrash);
}

/**
 * Check if an item is trash (matches a trash roll)
 */
export async function isTrashRoll(
    itemHash: number,
    itemPerks: number[]
): Promise<boolean> {
    const trashRolls = await getTrashRollsForItem(itemHash);
    
    for (const roll of trashRolls) {
        const matchingPerks = roll.perkHashes.filter(h => itemPerks.includes(h));
        if (matchingPerks.length === roll.perkHashes.length) {
            return true;
        }
    }
    
    return false;
}

// ============================================================================
// PARSING (DIM / Little Light format)
// ============================================================================

/**
 * Parse DIM wishlist text format
 */
export function parseDIMWishlist(text: string): {
    title: string;
    description: string;
    rolls: Omit<DBWishlistRoll, 'id' | 'wishlistId'>[];
} {
    const lines = text.split('\n');
    let title = 'Imported Wishlist';
    let description = '';
    const rolls: Omit<DBWishlistRoll, 'id' | 'wishlistId'>[] = [];
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Parse title comment
        if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
            const comment = trimmed.replace(/^[/#]+\s*/, '');
            if (comment.toLowerCase().startsWith('title:')) {
                title = comment.replace(/^title:\s*/i, '');
            } else if (comment.toLowerCase().startsWith('description:')) {
                description = comment.replace(/^description:\s*/i, '');
            }
            continue;
        }
        
        // Parse wishlist entry
        // Format: dimwishlist:item=HASH&perks=PERK1,PERK2,PERK3#notes:NOTES
        // or: dimwishlist:item=-HASH&perks=... (negative hash = trash)
        if (!trimmed.startsWith('dimwishlist:item=')) continue;
        
        try {
            const match = trimmed.match(/dimwishlist:item=(-?\d+)&perks=([^#]*)/);
            if (!match) continue;
            
            const isTrash = match[1].startsWith('-');
            const itemHash = Math.abs(parseInt(match[1], 10));
            const perkString = match[2];
            const perkHashes = perkString
                .split(',')
                .map(s => parseInt(s.trim(), 10))
                .filter(n => !isNaN(n) && n !== 0);
            
            // Parse notes
            let notes: string | undefined;
            const notesMatch = trimmed.match(/#notes:(.*)/);
            if (notesMatch) {
                notes = notesMatch[1].trim();
            }
            
            // Parse tags
            const tags: string[] = [];
            const tagsMatch = trimmed.match(/#tags:([^#]*)/);
            if (tagsMatch) {
                tags.push(...tagsMatch[1].split(',').map(t => t.trim()).filter(Boolean));
            }
            
            if (itemHash && perkHashes.length > 0) {
                rolls.push({
                    itemHash,
                    perkHashes,
                    isTrash,
                    notes,
                    tags: tags.length > 0 ? tags : undefined,
                });
            }
        } catch (e) {
            // Skip invalid lines
            console.warn('[WishlistService] Failed to parse line:', trimmed);
        }
    }
    
    return { title, description, rolls };
}

/**
 * Fetch and parse wishlist from URL
 */
export async function fetchWishlist(url: string): Promise<{
    title: string;
    description: string;
    rolls: Omit<DBWishlistRoll, 'id' | 'wishlistId'>[];
    rollCount: number;
    trashRollCount: number;
}> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch wishlist: ${response.statusText}`);
    }
    
    const text = await response.text();
    const parsed = parseDIMWishlist(text);
    
    return {
        ...parsed,
        rollCount: parsed.rolls.filter(r => !r.isTrash).length,
        trashRollCount: parsed.rolls.filter(r => r.isTrash).length,
    };
}

/**
 * Add a wishlist from URL
 */
export async function addWishlistFromUrl(url: string): Promise<DBWishlist> {
    const id = `wishlist_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    // Fetch and parse
    const { title, description, rolls, rollCount, trashRollCount } = await fetchWishlist(url);
    
    // Create wishlist entry
    const wishlist: DBWishlist = {
        id,
        url,
        title,
        description,
        enabled: true,
        lastUpdated: new Date().toISOString(),
        rollCount,
        trashRollCount,
    };
    
    // Save wishlist
    await saveWishlist(wishlist);
    
    // Save rolls
    await saveWishlistRolls(id, rolls);
    
    return wishlist;
}

/**
 * Refresh a wishlist from its URL
 */
export async function refreshWishlist(id: string): Promise<DBWishlist | null> {
    const existing = await getWishlistById(id);
    if (!existing) return null;
    
    // Fetch and parse
    const { title, description, rolls, rollCount, trashRollCount } = await fetchWishlist(existing.url);
    
    // Update wishlist entry
    const updated: DBWishlist = {
        ...existing,
        title,
        description,
        lastUpdated: new Date().toISOString(),
        rollCount,
        trashRollCount,
    };
    
    // Save updated wishlist
    await saveWishlist(updated);
    
    // Save rolls
    await saveWishlistRolls(id, rolls);
    
    return updated;
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get wishlist statistics
 */
export async function getWishlistStats(): Promise<{
    totalWishlists: number;
    enabledWishlists: number;
    totalRolls: number;
    totalTrashRolls: number;
    uniqueItems: number;
}> {
    const [wishlists, rollCount, trashCount, uniqueItemCount] = await Promise.all([
        getAllWishlists(),
        db.wishlistRolls.where('isTrash').equals(0).count(),
        db.wishlistRolls.where('isTrash').equals(1).count(),
        db.wishlistRolls.orderBy('itemHash').uniqueKeys(),
    ]);
    
    return {
        totalWishlists: wishlists.length,
        enabledWishlists: wishlists.filter(w => w.enabled).length,
        totalRolls: rollCount,
        totalTrashRolls: trashCount,
        uniqueItems: uniqueItemCount.length,
    };
}

// ============================================================================
// EXPORT/IMPORT
// ============================================================================

/**
 * Export all wishlists
 */
export async function exportWishlists(): Promise<{
    wishlists: DBWishlist[];
    rolls: DBWishlistRoll[];
}> {
    const [wishlists, rolls] = await Promise.all([
        getAllWishlists(),
        db.wishlistRolls.toArray(),
    ]);
    
    return { wishlists, rolls };
}

/**
 * Clear all wishlist data
 */
export async function clearAllWishlists(): Promise<void> {
    await db.wishlists.clear();
    await db.wishlistRolls.clear();
}


