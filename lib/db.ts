import Dexie, { Table } from 'dexie';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Manifest Index Entry - Queryable subset of item definition
 * Full definitions stored in Cache API, this is just for queries
 */
export interface ManifestIndex {
    hash: number;
    name: string;
    itemType: number;           // 3 = weapon, 2 = armor, 19 = emblem, etc.
    itemSubType: number;        // 6 = hand cannon, 7 = scout rifle, etc.
    tierType: number;           // 6 = exotic, 5 = legendary, 4 = rare
    bucketTypeHash: number;     // Inventory slot
    classType: number;          // 0 = titan, 1 = hunter, 2 = warlock, 3 = any
    damageType?: number;        // Element type
    itemCategoryHashes: number[];
    defaultDamageTypeHash?: number;
    equippable: boolean;
    nonTransferrable: boolean;
    iconPath?: string;          // For quick display without full lookup
}

/**
 * Cached Profile Snapshot
 */
export interface CachedProfile {
    membershipId: string;
    membershipType: number;
    displayName?: string;
    data: any;                  // Full profile response
    lastUpdated: number;        // Timestamp
}

// Re-export for convenience
export type { CachedProfile as ProfileCache };

/**
 * Custom Loadout (migrated from localStorage)
 */
export interface DBLoadout {
    id?: number;                // Auto-increment
    externalId: string;         // Original string ID for compatibility
    name: string;
    description?: string;
    notes?: string;
    classType: number;
    icon: string;
    color: string;
    items: LoadoutItemData[];
    armorMods?: ArmorModData[];
    fashion?: FashionData[];
    subclassConfig?: SubclassConfigData;
    tags: string[];
    inGameId?: string;
    shareId?: string;
    isShared: boolean;
    sharedAt?: string;
    importedFrom?: string;
    createdAt: string;
    updatedAt: string;
}

export interface LoadoutItemData {
    itemHash: number;
    itemInstanceId?: string;
    bucketHash: number;
    socketOverrides?: Record<number, number>;
}

export interface ArmorModData {
    bucketHash: number;
    mods: Array<{
        socketIndex: number;
        plugHash: number;
        name?: string;
        icon?: string;
    }>;
}

export interface FashionData {
    bucketHash: number;
    shaderHash?: number;
    ornamentHash?: number;
}

export interface SubclassConfigData {
    itemHash: number;
    itemInstanceId?: string;
    damageType?: number;
    super?: { plugHash: number; name?: string; icon?: string };
    abilities?: {
        melee?: { plugHash: number; name?: string; icon?: string };
        grenade?: { plugHash: number; name?: string; icon?: string };
        classAbility?: { plugHash: number; name?: string; icon?: string };
        movement?: { plugHash: number; name?: string; icon?: string };
    };
    aspects?: Array<{ plugHash: number; name?: string; icon?: string; description?: string; fragmentSlots?: number }>;
    fragments?: Array<{ plugHash: number; name?: string; icon?: string; statBonuses?: Record<string, number> }>;
}

/**
 * Wishlist Entry
 */
export interface DBWishlist {
    id: string;
    url: string;
    title: string;
    description?: string;
    enabled: boolean;
    lastUpdated: string;
    rollCount: number;
    trashRollCount: number;
}

/**
 * Wishlist Roll Entry
 */
export interface DBWishlistRoll {
    id?: number;                // Auto-increment for uniqueness
    wishlistId: string;
    itemHash: number;
    perkHashes: number[];
    isTrash: boolean;
    notes?: string;
    tags?: string[];
}

/**
 * Item Tag
 */
export interface DBItemTag {
    itemInstanceId: string;
    tag: string;
    createdAt: string;
}

/**
 * Item Note
 */
export interface DBItemNote {
    itemInstanceId: string;
    note: string;
    updatedAt: string;
}

/**
 * Key-Value Setting
 */
export interface DBSetting {
    key: string;
    value: any;
}

/**
 * Activity Cache Entry
 */
export interface DBActivityCache {
    instanceId: string;
    membershipId: string;
    activityHash: number;
    dateCompleted: string;
    durationSeconds: number;
    completed: boolean;
    flawless: boolean;
    solo: boolean;
    data: any;                  // Full PGCR data
    cachedAt: number;
}

// ============================================================================
// DATABASE CLASS
// ============================================================================

export class WarmindDB extends Dexie {
    // Tables
    manifestIndex!: Table<ManifestIndex, number>;
    profiles!: Table<CachedProfile, string>;
    loadouts!: Table<DBLoadout, number>;
    wishlists!: Table<DBWishlist, string>;
    wishlistRolls!: Table<DBWishlistRoll, number>;
    itemTags!: Table<DBItemTag, string>;
    itemNotes!: Table<DBItemNote, string>;
    settings!: Table<DBSetting, string>;
    activityCache!: Table<DBActivityCache, string>;

    constructor() {
        super('WarmindDB');

        // Schema definition
        // Keys after '++' are auto-increment
        // Keys after '&' are unique
        // Keys after '*' are multi-entry (array indexes)
        // Compound keys use [key1+key2] syntax
        this.version(1).stores({
            // Manifest index for queries
            // Primary key: hash
            // Indexes: itemType, tierType, bucketTypeHash, classType, damageType, itemCategoryHashes (multi)
            manifestIndex: 'hash, itemType, itemSubType, tierType, bucketTypeHash, classType, damageType, *itemCategoryHashes',

            // Cached profiles
            // Primary key: membershipId
            profiles: 'membershipId, lastUpdated',

            // Custom loadouts
            // Primary key: auto-increment id
            // Indexes: classType, tags (multi), externalId (unique)
            loadouts: '++id, &externalId, classType, *tags, createdAt',

            // Wishlists
            // Primary key: id
            // Indexes: url, enabled
            wishlists: 'id, url, enabled',

            // Wishlist rolls
            // Primary key: auto-increment
            // Compound index: [wishlistId+itemHash] for fast lookups
            // Individual indexes for querying
            wishlistRolls: '++id, [wishlistId+itemHash], wishlistId, itemHash, isTrash',

            // Item tags
            // Primary key: itemInstanceId (one tag per item for simplicity, or use compound)
            // For multiple tags per item, use: '++id, itemInstanceId, tag'
            itemTags: '[itemInstanceId+tag], itemInstanceId, tag, createdAt',

            // Item notes
            // Primary key: itemInstanceId
            itemNotes: 'itemInstanceId, updatedAt',

            // Key-value settings
            // Primary key: key
            settings: 'key',

            // Activity/PGCR cache
            // Primary key: instanceId
            // Indexes for querying by membership, activity, date
            activityCache: 'instanceId, membershipId, activityHash, dateCompleted, cachedAt',
        });
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const db = new WarmindDB();

// Eager open is only for the browser. Next.js imports this module during SSG/SSR where
// IndexedDB does not exist; Dexie throws MissingAPIError if we call open() there.
if (typeof indexedDB !== 'undefined') {
    db.open().catch(async (err) => {
        if (err.name === 'VersionError') {
            console.warn('[WarmindDB] Version conflict detected, clearing database...');
            await Dexie.delete('WarmindDB');
            if (typeof window !== 'undefined') {
                window.location.reload();
            }
        } else {
            console.error('[WarmindDB] Failed to open database:', err);
        }
    });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if database is available (client-side only)
 */
export function isDatabaseAvailable(): boolean {
    return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

/**
 * Clear all data from database
 */
export async function clearAllData(): Promise<void> {
    await db.manifestIndex.clear();
    await db.profiles.clear();
    await db.loadouts.clear();
    await db.wishlists.clear();
    await db.wishlistRolls.clear();
    await db.itemTags.clear();
    await db.itemNotes.clear();
    await db.settings.clear();
    await db.activityCache.clear();
}

/**
 * Get database storage estimate
 */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        return {
            usage: estimate.usage || 0,
            quota: estimate.quota || 0,
        };
    }
    return null;
}

/**
 * Export database version info
 */
export const DB_VERSION = 1;
export const DB_NAME = 'WarmindDB';

