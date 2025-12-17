/**
 * Profile Cache Service
 * 
 * Uses Dexie (IndexedDB) to cache Destiny profile data for:
 * - Instant display on page load (stale-while-revalidate pattern)
 * - Offline viewing of last known inventory
 * - Tracking inventory changes over time
 */

import { db, CachedProfile, isDatabaseAvailable } from './db';

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

/**
 * How long cached data is considered "fresh" (in milliseconds)
 * Data older than this will show a "stale" indicator
 */
export const PROFILE_FRESH_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Maximum age before cached data is considered too old to use
 */
export const PROFILE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

/**
 * Get cached profile data
 */
export async function getCachedProfile(membershipId: string): Promise<CachedProfile | null> {
    if (!isDatabaseAvailable()) return null;
    
    try {
        const cached = await db.profiles.get(membershipId);
        return cached ?? null;
    } catch (error) {
        console.warn('[ProfileCache] Error getting cached profile:', error);
        return null;
    }
}

/**
 * Cache profile data
 */
export async function cacheProfile(
    membershipId: string,
    membershipType: number,
    data: any,
    displayName?: string
): Promise<void> {
    if (!isDatabaseAvailable()) return;
    
    try {
        await db.profiles.put({
            membershipId,
            membershipType,
            displayName,
            data,
            lastUpdated: Date.now(),
        });
    } catch (error) {
        console.warn('[ProfileCache] Error caching profile:', error);
    }
}

/**
 * Delete cached profile
 */
export async function deleteCachedProfile(membershipId: string): Promise<void> {
    if (!isDatabaseAvailable()) return;
    
    try {
        await db.profiles.delete(membershipId);
    } catch (error) {
        console.warn('[ProfileCache] Error deleting cached profile:', error);
    }
}

/**
 * Clear all cached profiles
 */
export async function clearProfileCache(): Promise<void> {
    if (!isDatabaseAvailable()) return;
    
    try {
        await db.profiles.clear();
    } catch (error) {
        console.warn('[ProfileCache] Error clearing profile cache:', error);
    }
}

// ============================================================================
// STALENESS CHECKING
// ============================================================================

/**
 * Check if cached profile is fresh (recently updated)
 */
export function isProfileFresh(profile: CachedProfile): boolean {
    const age = Date.now() - profile.lastUpdated;
    return age < PROFILE_FRESH_DURATION;
}

/**
 * Check if cached profile is stale but still usable
 */
export function isProfileStale(profile: CachedProfile): boolean {
    const age = Date.now() - profile.lastUpdated;
    return age >= PROFILE_FRESH_DURATION && age < PROFILE_MAX_AGE;
}

/**
 * Check if cached profile is too old to use
 */
export function isProfileExpired(profile: CachedProfile): boolean {
    const age = Date.now() - profile.lastUpdated;
    return age >= PROFILE_MAX_AGE;
}

/**
 * Get profile age in milliseconds
 */
export function getProfileAge(profile: CachedProfile): number {
    return Date.now() - profile.lastUpdated;
}

/**
 * Get human-readable profile age
 */
export function getProfileAgeString(profile: CachedProfile): string {
    const age = getProfileAge(profile);
    
    if (age < 60 * 1000) {
        return 'just now';
    } else if (age < 60 * 60 * 1000) {
        const minutes = Math.floor(age / (60 * 1000));
        return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    } else if (age < 24 * 60 * 60 * 1000) {
        const hours = Math.floor(age / (60 * 60 * 1000));
        return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    } else {
        const days = Math.floor(age / (24 * 60 * 60 * 1000));
        return `${days} day${days === 1 ? '' : 's'} ago`;
    }
}

// ============================================================================
// CACHE INFO
// ============================================================================

/**
 * Get cache status for a profile
 */
export interface ProfileCacheStatus {
    isCached: boolean;
    isFresh: boolean;
    isStale: boolean;
    isExpired: boolean;
    lastUpdated: number | null;
    ageString: string | null;
}

export async function getProfileCacheStatus(membershipId: string): Promise<ProfileCacheStatus> {
    const cached = await getCachedProfile(membershipId);
    
    if (!cached) {
        return {
            isCached: false,
            isFresh: false,
            isStale: false,
            isExpired: false,
            lastUpdated: null,
            ageString: null,
        };
    }
    
    return {
        isCached: true,
        isFresh: isProfileFresh(cached),
        isStale: isProfileStale(cached),
        isExpired: isProfileExpired(cached),
        lastUpdated: cached.lastUpdated,
        ageString: getProfileAgeString(cached),
    };
}

/**
 * Get all cached profiles (for debugging/management)
 */
export async function getAllCachedProfiles(): Promise<CachedProfile[]> {
    if (!isDatabaseAvailable()) return [];
    
    try {
        return await db.profiles.toArray();
    } catch (error) {
        console.warn('[ProfileCache] Error getting all cached profiles:', error);
        return [];
    }
}

/**
 * Get cache statistics
 */
export async function getProfileCacheStats(): Promise<{
    totalProfiles: number;
    freshProfiles: number;
    staleProfiles: number;
    expiredProfiles: number;
}> {
    const profiles = await getAllCachedProfiles();
    
    return {
        totalProfiles: profiles.length,
        freshProfiles: profiles.filter(isProfileFresh).length,
        staleProfiles: profiles.filter(isProfileStale).length,
        expiredProfiles: profiles.filter(isProfileExpired).length,
    };
}

/**
 * Clean up expired profiles
 */
export async function cleanupExpiredProfiles(): Promise<number> {
    if (!isDatabaseAvailable()) return 0;
    
    const profiles = await getAllCachedProfiles();
    const expired = profiles.filter(isProfileExpired);
    
    for (const profile of expired) {
        await deleteCachedProfile(profile.membershipId);
    }
    
    return expired.length;
}

// ============================================================================
// INVENTORY SNAPSHOT (for tracking changes)
// ============================================================================

export interface InventorySnapshot {
    membershipId: string;
    characterId: string;
    timestamp: number;
    items: {
        itemInstanceId: string;
        itemHash: number;
        bucketHash: number;
        location: 'character' | 'vault' | 'postmaster';
    }[];
}

/**
 * Create an inventory snapshot from profile data
 */
export function createInventorySnapshot(
    membershipId: string,
    characterId: string,
    profileData: any
): InventorySnapshot {
    const items: InventorySnapshot['items'] = [];
    
    // Character inventory
    const charInventory = profileData?.characterInventories?.data?.[characterId]?.items || [];
    for (const item of charInventory) {
        items.push({
            itemInstanceId: item.itemInstanceId,
            itemHash: item.itemHash,
            bucketHash: item.bucketHash,
            location: 'character',
        });
    }
    
    // Character equipment
    const charEquipment = profileData?.characterEquipment?.data?.[characterId]?.items || [];
    for (const item of charEquipment) {
        items.push({
            itemInstanceId: item.itemInstanceId,
            itemHash: item.itemHash,
            bucketHash: item.bucketHash,
            location: 'character',
        });
    }
    
    // Vault (profile inventory with vault bucket)
    const profileInventory = profileData?.profileInventory?.data?.items || [];
    for (const item of profileInventory) {
        if (item.bucketHash === 138197802) { // Vault bucket
            items.push({
                itemInstanceId: item.itemInstanceId,
                itemHash: item.itemHash,
                bucketHash: item.bucketHash,
                location: 'vault',
            });
        }
    }
    
    return {
        membershipId,
        characterId,
        timestamp: Date.now(),
        items,
    };
}

/**
 * Compare two snapshots and find changes
 */
export function compareSnapshots(
    oldSnapshot: InventorySnapshot,
    newSnapshot: InventorySnapshot
): {
    added: InventorySnapshot['items'];
    removed: InventorySnapshot['items'];
    moved: { item: InventorySnapshot['items'][0]; from: string; to: string }[];
} {
    const oldItems = new Map(oldSnapshot.items.map(i => [i.itemInstanceId, i]));
    const newItems = new Map(newSnapshot.items.map(i => [i.itemInstanceId, i]));
    
    const added: InventorySnapshot['items'] = [];
    const removed: InventorySnapshot['items'] = [];
    const moved: { item: InventorySnapshot['items'][0]; from: string; to: string }[] = [];
    
    // Find added and moved items
    for (const [id, item] of newItems) {
        const oldItem = oldItems.get(id);
        if (!oldItem) {
            added.push(item);
        } else if (oldItem.location !== item.location) {
            moved.push({ item, from: oldItem.location, to: item.location });
        }
    }
    
    // Find removed items
    for (const [id, item] of oldItems) {
        if (!newItems.has(id)) {
            removed.push(item);
        }
    }
    
    return { added, removed, moved };
}









