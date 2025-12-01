/**
 * Data Migration Service
 * 
 * Handles migration from old localStorage-based storage to the new
 * Dexie/IndexedDB architecture. Runs automatically on app startup
 * and is idempotent (safe to run multiple times).
 */

import { db, isDatabaseAvailable, DBLoadout, DBWishlist } from './db';
import * as loadoutService from './loadoutService';
import * as wishlistService from './wishlistService';

// ============================================================================
// MIGRATION VERSION
// ============================================================================

const MIGRATION_VERSION = 1;
const MIGRATION_KEY = 'warmind-migration-version';

/**
 * Get current migration version
 */
export function getCurrentMigrationVersion(): number {
    if (typeof localStorage === 'undefined') return 0;
    const version = localStorage.getItem(MIGRATION_KEY);
    return version ? parseInt(version, 10) : 0;
}

/**
 * Set migration version
 */
function setMigrationVersion(version: number): void {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(MIGRATION_KEY, version.toString());
    }
}

// ============================================================================
// MIGRATION STATUS
// ============================================================================

export interface MigrationResult {
    success: boolean;
    loadoutsMigrated: number;
    wishlistsMigrated: number;
    rollsMigrated: number;
    errors: string[];
    skipped: string[];
}

// ============================================================================
// LOADOUT MIGRATION
// ============================================================================

interface OldLoadout {
    id: string;
    name: string;
    description?: string;
    notes?: string;
    classType: number;
    icon: string;
    color: string;
    items: {
        itemHash: number;
        itemInstanceId?: string;
        bucketHash: number;
        socketOverrides?: Record<number, number>;
    }[];
    armorMods?: any[];
    fashion?: any[];
    subclassConfig?: any;
    tags: string[];
    inGameId?: string;
    shareId?: string;
    isShared?: boolean;
    sharedAt?: string;
    importedFrom?: string;
    createdAt?: string;
    updatedAt?: string;
}

/**
 * Migrate loadouts from localStorage to Dexie
 */
async function migrateLoadouts(): Promise<{ migrated: number; errors: string[] }> {
    const errors: string[] = [];
    let migrated = 0;

    try {
        // Check for old loadout store data
        const oldData = localStorage.getItem('loadout-storage');
        if (!oldData) {
            console.log('[Migration] No old loadout data found');
            return { migrated: 0, errors: [] };
        }

        const parsed = JSON.parse(oldData);
        const oldLoadouts: OldLoadout[] = parsed?.state?.customLoadouts || [];

        if (oldLoadouts.length === 0) {
            console.log('[Migration] No loadouts to migrate');
            return { migrated: 0, errors: [] };
        }

        console.log(`[Migration] Found ${oldLoadouts.length} loadouts to migrate`);

        // Check if we already have loadouts in Dexie
        const existingCount = await db.loadouts.count();
        if (existingCount > 0) {
            console.log(`[Migration] Dexie already has ${existingCount} loadouts, checking for duplicates`);
        }

        for (const oldLoadout of oldLoadouts) {
            try {
                // Check if this loadout already exists (by externalId)
                const existing = await loadoutService.getLoadoutByExternalId(oldLoadout.id);
                if (existing) {
                    console.log(`[Migration] Loadout "${oldLoadout.name}" already exists, skipping`);
                    continue;
                }

                // Create new loadout in Dexie
                await db.loadouts.add({
                    externalId: oldLoadout.id,
                    name: oldLoadout.name,
                    description: oldLoadout.description,
                    notes: oldLoadout.notes,
                    classType: oldLoadout.classType,
                    icon: oldLoadout.icon,
                    color: oldLoadout.color,
                    items: oldLoadout.items || [],
                    armorMods: oldLoadout.armorMods,
                    fashion: oldLoadout.fashion,
                    subclassConfig: oldLoadout.subclassConfig,
                    tags: oldLoadout.tags || [],
                    inGameId: oldLoadout.inGameId,
                    shareId: oldLoadout.shareId,
                    isShared: oldLoadout.isShared || false,
                    sharedAt: oldLoadout.sharedAt,
                    importedFrom: oldLoadout.importedFrom,
                    createdAt: oldLoadout.createdAt || new Date().toISOString(),
                    updatedAt: oldLoadout.updatedAt || new Date().toISOString(),
                } as DBLoadout);

                migrated++;
                console.log(`[Migration] Migrated loadout: ${oldLoadout.name}`);
            } catch (e) {
                const error = `Failed to migrate loadout "${oldLoadout.name}": ${e}`;
                errors.push(error);
                console.error('[Migration]', error);
            }
        }

        return { migrated, errors };
    } catch (e) {
        errors.push(`Failed to parse old loadout data: ${e}`);
        return { migrated, errors };
    }
}

// ============================================================================
// WISHLIST MIGRATION
// ============================================================================

interface OldWishlist {
    id: string;
    url: string;
    title: string;
    enabled: boolean;
}

/**
 * Migrate wishlists from localStorage to Dexie
 */
async function migrateWishlists(): Promise<{ 
    wishlistsMigrated: number; 
    rollsMigrated: number; 
    errors: string[] 
}> {
    const errors: string[] = [];
    let wishlistsMigrated = 0;
    let rollsMigrated = 0;

    try {
        // Check for old wishlist store data
        const oldData = localStorage.getItem('wishlist-storage');
        if (!oldData) {
            console.log('[Migration] No old wishlist data found');
            return { wishlistsMigrated: 0, rollsMigrated: 0, errors: [] };
        }

        const parsed = JSON.parse(oldData);
        const oldWishlists: OldWishlist[] = parsed?.state?.wishLists || [];

        if (oldWishlists.length === 0) {
            console.log('[Migration] No wishlists to migrate');
            return { wishlistsMigrated: 0, rollsMigrated: 0, errors: [] };
        }

        console.log(`[Migration] Found ${oldWishlists.length} wishlists to migrate`);

        for (const oldWishlist of oldWishlists) {
            try {
                // Check if this wishlist already exists
                const existing = await wishlistService.getWishlistById(oldWishlist.id);
                if (existing) {
                    console.log(`[Migration] Wishlist "${oldWishlist.title}" already exists, skipping`);
                    continue;
                }

                // Try to get old rolls from IndexedDB
                let rollCount = 0;
                let trashRollCount = 0;

                // Try to read from old IndexedDB format
                const oldRollsKey = `wishlist_rolls_${oldWishlist.id}`;
                const oldRollsData = localStorage.getItem(oldRollsKey);

                if (oldRollsData) {
                    try {
                        const oldRolls = JSON.parse(oldRollsData);
                        
                        // Create wishlist entry first
                        const wishlist: DBWishlist = {
                            id: oldWishlist.id,
                            url: oldWishlist.url,
                            title: oldWishlist.title,
                            enabled: oldWishlist.enabled,
                            lastUpdated: new Date().toISOString(),
                            rollCount: Object.values(oldRolls).flat().filter((r: any) => !r.isTrash).length,
                            trashRollCount: Object.values(oldRolls).flat().filter((r: any) => r.isTrash).length,
                        };
                        
                        await wishlistService.saveWishlist(wishlist);

                        // Migrate rolls
                        const rollsToAdd: any[] = [];
                        for (const [itemHash, rolls] of Object.entries(oldRolls)) {
                            const itemRolls = rolls as any[];
                            for (const roll of itemRolls) {
                                rollsToAdd.push({
                                    itemHash: parseInt(itemHash, 10),
                                    perkHashes: roll.perks || roll.perkHashes || [],
                                    isTrash: roll.isTrash || false,
                                    notes: roll.notes,
                                    tags: roll.tags,
                                });
                            }
                        }

                        if (rollsToAdd.length > 0) {
                            await wishlistService.saveWishlistRolls(oldWishlist.id, rollsToAdd);
                            rollsMigrated += rollsToAdd.length;
                        }

                        wishlistsMigrated++;
                        console.log(`[Migration] Migrated wishlist: ${oldWishlist.title} (${rollsToAdd.length} rolls)`);
                    } catch (e) {
                        errors.push(`Failed to parse rolls for wishlist "${oldWishlist.title}": ${e}`);
                    }
                } else {
                    // No cached rolls, just create the wishlist entry
                    // Rolls will be fetched when the wishlist is refreshed
                    const wishlist: DBWishlist = {
                        id: oldWishlist.id,
                        url: oldWishlist.url,
                        title: oldWishlist.title,
                        enabled: oldWishlist.enabled,
                        lastUpdated: new Date().toISOString(),
                        rollCount: 0,
                        trashRollCount: 0,
                    };
                    
                    await wishlistService.saveWishlist(wishlist);
                    wishlistsMigrated++;
                    console.log(`[Migration] Migrated wishlist entry: ${oldWishlist.title} (no cached rolls)`);
                }
            } catch (e) {
                const error = `Failed to migrate wishlist "${oldWishlist.title}": ${e}`;
                errors.push(error);
                console.error('[Migration]', error);
            }
        }

        return { wishlistsMigrated, rollsMigrated, errors };
    } catch (e) {
        errors.push(`Failed to parse old wishlist data: ${e}`);
        return { wishlistsMigrated, rollsMigrated, errors };
    }
}

// ============================================================================
// OLD DATA CLEANUP
// ============================================================================

/**
 * Clean up old localStorage data after successful migration
 */
export async function cleanupOldData(options: {
    cleanupLoadouts?: boolean;
    cleanupWishlists?: boolean;
    cleanupManifest?: boolean;
} = {}): Promise<void> {
    const { cleanupLoadouts = false, cleanupWishlists = false, cleanupManifest = false } = options;

    if (cleanupLoadouts) {
        localStorage.removeItem('loadout-storage');
        console.log('[Migration] Cleaned up old loadout data');
    }

    if (cleanupWishlists) {
        localStorage.removeItem('wishlist-storage');
        
        // Clean up old roll entries
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('wishlist_rolls_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log(`[Migration] Cleaned up old wishlist data (${keysToRemove.length} roll entries)`);
    }

    if (cleanupManifest) {
        // Clean up old manifest cache entries
        const manifestKeys = ['manifest_items', 'manifest_version'];
        manifestKeys.forEach(key => localStorage.removeItem(key));
        console.log('[Migration] Cleaned up old manifest data');
    }
}

// ============================================================================
// MAIN MIGRATION FUNCTION
// ============================================================================

/**
 * Run all migrations
 * This is idempotent - safe to call multiple times
 */
export async function runMigrations(): Promise<MigrationResult> {
    const result: MigrationResult = {
        success: false,
        loadoutsMigrated: 0,
        wishlistsMigrated: 0,
        rollsMigrated: 0,
        errors: [],
        skipped: [],
    };

    // Check if running on server
    if (typeof window === 'undefined') {
        result.skipped.push('Running on server, skipping migration');
        result.success = true;
        return result;
    }

    // Check if IndexedDB is available
    if (!isDatabaseAvailable()) {
        result.errors.push('IndexedDB not available');
        return result;
    }

    // Check migration version
    const currentVersion = getCurrentMigrationVersion();
    if (currentVersion >= MIGRATION_VERSION) {
        console.log(`[Migration] Already at version ${currentVersion}, skipping`);
        result.skipped.push(`Already migrated to version ${currentVersion}`);
        result.success = true;
        return result;
    }

    console.log(`[Migration] Starting migration from version ${currentVersion} to ${MIGRATION_VERSION}`);

    try {
        // Run loadout migration
        const loadoutResult = await migrateLoadouts();
        result.loadoutsMigrated = loadoutResult.migrated;
        result.errors.push(...loadoutResult.errors);

        // Run wishlist migration
        const wishlistResult = await migrateWishlists();
        result.wishlistsMigrated = wishlistResult.wishlistsMigrated;
        result.rollsMigrated = wishlistResult.rollsMigrated;
        result.errors.push(...wishlistResult.errors);

        // Update migration version
        setMigrationVersion(MIGRATION_VERSION);
        
        result.success = result.errors.length === 0;
        
        console.log('[Migration] Migration complete:', {
            loadouts: result.loadoutsMigrated,
            wishlists: result.wishlistsMigrated,
            rolls: result.rollsMigrated,
            errors: result.errors.length,
        });

        return result;
    } catch (e) {
        result.errors.push(`Migration failed: ${e}`);
        return result;
    }
}

// ============================================================================
// EXPORT/IMPORT ALL DATA
// ============================================================================

export interface FullDataExport {
    version: number;
    exportedAt: string;
    loadouts: DBLoadout[];
    wishlists: {
        metadata: DBWishlist[];
        // Rolls are not exported due to size - they can be re-fetched
    };
    settings: Record<string, any>;
    annotations: {
        tags: any[];
        notes: any[];
    };
}

/**
 * Export all user data
 */
export async function exportAllData(): Promise<FullDataExport> {
    const loadouts = await db.loadouts.toArray();
    const wishlists = await db.wishlists.toArray();
    const tags = await db.itemTags.toArray();
    const notes = await db.itemNotes.toArray();
    
    // Get settings from localStorage
    const settingsData = localStorage.getItem('warmind-settings');
    const settings = settingsData ? JSON.parse(settingsData) : {};

    return {
        version: MIGRATION_VERSION,
        exportedAt: new Date().toISOString(),
        loadouts,
        wishlists: {
            metadata: wishlists,
        },
        settings: settings.state || {},
        annotations: {
            tags,
            notes,
        },
    };
}

/**
 * Import all user data
 */
export async function importAllData(
    data: FullDataExport,
    options: { merge?: boolean } = {}
): Promise<{ success: boolean; errors: string[] }> {
    const { merge = true } = options;
    const errors: string[] = [];

    try {
        // Clear existing data if not merging
        if (!merge) {
            await db.loadouts.clear();
            await db.wishlists.clear();
            await db.wishlistRolls.clear();
            await db.itemTags.clear();
            await db.itemNotes.clear();
        }

        // Import loadouts
        for (const loadout of data.loadouts) {
            try {
                if (merge) {
                    const existing = await loadoutService.getLoadoutByExternalId(loadout.externalId);
                    if (existing) continue;
                }
                await db.loadouts.add(loadout);
            } catch (e) {
                errors.push(`Failed to import loadout "${loadout.name}": ${e}`);
            }
        }

        // Import wishlist metadata (rolls will need to be re-fetched)
        for (const wishlist of data.wishlists.metadata) {
            try {
                if (merge) {
                    const existing = await wishlistService.getWishlistById(wishlist.id);
                    if (existing) continue;
                }
                await wishlistService.saveWishlist(wishlist);
            } catch (e) {
                errors.push(`Failed to import wishlist "${wishlist.title}": ${e}`);
            }
        }

        // Import annotations
        if (data.annotations) {
            for (const tag of data.annotations.tags) {
                try {
                    await db.itemTags.put(tag);
                } catch (e) {
                    // Skip duplicates
                }
            }
            for (const note of data.annotations.notes) {
                try {
                    await db.itemNotes.put(note);
                } catch (e) {
                    // Skip errors
                }
            }
        }

        // Import settings
        if (data.settings && Object.keys(data.settings).length > 0) {
            const existingSettings = localStorage.getItem('warmind-settings');
            const existing = existingSettings ? JSON.parse(existingSettings) : { state: {} };
            
            if (merge) {
                existing.state = { ...existing.state, ...data.settings };
            } else {
                existing.state = data.settings;
            }
            
            localStorage.setItem('warmind-settings', JSON.stringify(existing));
        }

        return { success: errors.length === 0, errors };
    } catch (e) {
        errors.push(`Import failed: ${e}`);
        return { success: false, errors };
    }
}

// ============================================================================
// STORAGE STATISTICS
// ============================================================================

export interface StorageStats {
    indexedDB: {
        available: boolean;
        usage: number;
        quota: number;
        usagePercent: number;
    };
    localStorage: {
        used: number;
        estimatedMax: number;
    };
    cacheAPI: {
        available: boolean;
        urls: number;
    };
    tables: {
        loadouts: number;
        wishlists: number;
        wishlistRolls: number;
        manifestIndex: number;
        profiles: number;
        itemTags: number;
        itemNotes: number;
        activityCache: number;
    };
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<StorageStats> {
    const stats: StorageStats = {
        indexedDB: {
            available: isDatabaseAvailable(),
            usage: 0,
            quota: 0,
            usagePercent: 0,
        },
        localStorage: {
            used: 0,
            estimatedMax: 5 * 1024 * 1024, // 5MB typical
        },
        cacheAPI: {
            available: typeof caches !== 'undefined',
            urls: 0,
        },
        tables: {
            loadouts: 0,
            wishlists: 0,
            wishlistRolls: 0,
            manifestIndex: 0,
            profiles: 0,
            itemTags: 0,
            itemNotes: 0,
            activityCache: 0,
        },
    };

    // IndexedDB stats
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
        try {
            const estimate = await navigator.storage.estimate();
            stats.indexedDB.usage = estimate.usage || 0;
            stats.indexedDB.quota = estimate.quota || 0;
            stats.indexedDB.usagePercent = stats.indexedDB.quota > 0 
                ? (stats.indexedDB.usage / stats.indexedDB.quota) * 100 
                : 0;
        } catch {
            // Ignore errors
        }
    }

    // localStorage stats
    if (typeof localStorage !== 'undefined') {
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                total += (localStorage.getItem(key) || '').length * 2; // UTF-16
            }
        }
        stats.localStorage.used = total;
    }

    // Cache API stats
    if (stats.cacheAPI.available) {
        try {
            const cache = await caches.open('destiny-manifest-v1');
            const keys = await cache.keys();
            stats.cacheAPI.urls = keys.length;
        } catch {
            // Ignore errors
        }
    }

    // Table counts
    if (isDatabaseAvailable()) {
        try {
            stats.tables = {
                loadouts: await db.loadouts.count(),
                wishlists: await db.wishlists.count(),
                wishlistRolls: await db.wishlistRolls.count(),
                manifestIndex: await db.manifestIndex.count(),
                profiles: await db.profiles.count(),
                itemTags: await db.itemTags.count(),
                itemNotes: await db.itemNotes.count(),
                activityCache: await db.activityCache.count(),
            };
        } catch {
            // Ignore errors
        }
    }

    return stats;
}

