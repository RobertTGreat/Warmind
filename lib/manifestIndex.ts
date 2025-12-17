/**
 * Manifest Index Service
 * 
 * Uses Dexie (IndexedDB) to store a queryable index of manifest items.
 * This enables queries like "find all exotic weapons" or "find all titan armor".
 * 
 * Full definitions are stored in Cache API (see manifestCache.ts).
 * This index stores only the queryable fields for efficiency.
 */

import { db, ManifestIndex, isDatabaseAvailable } from './db';
import { 
    getItemDefinitions, 
    cacheItemDefinitions, 
    getStoredManifestVersion, 
    storeManifestVersion,
    hasManifestVersionChanged,
    clearManifestCache,
    ManifestDefinition
} from './manifestCache';
import { bungieApi } from './bungie';

// ============================================================================
// CONSTANTS
// ============================================================================

const MANIFEST_INDEX_VERSION_KEY = 'warmind-manifest-index-version';

// Item types
export const ITEM_TYPES = {
    NONE: 0,
    CURRENCY: 1,
    ARMOR: 2,
    WEAPON: 3,
    MESSAGE: 7,
    ENGRAM: 8,
    CONSUMABLE: 9,
    EXCHANGE_MATERIAL: 10,
    MISSION_REWARD: 11,
    QUEST_STEP: 12,
    QUEST_STEP_COMPLETE: 13,
    EMBLEM: 14,
    QUEST: 15,
    SUBCLASS: 16,
    CLAN_BANNER: 17,
    AURA: 18,
    MOD: 19,
    DUMMY: 20,
    SHIP: 21,
    VEHICLE: 22,
    EMOTE: 23,
    GHOST: 24,
    PACKAGE: 25,
    BOUNTY: 26,
    WRAPPER: 27,
    SEASONAL_ARTIFACT: 28,
    FINISHER: 29,
    PATTERN: 30,
} as const;

// Tier types
export const TIER_TYPES = {
    UNKNOWN: 0,
    CURRENCY: 1,
    BASIC: 2,
    COMMON: 3,
    RARE: 4,
    LEGENDARY: 5,
    EXOTIC: 6,
} as const;

// Class types
export const CLASS_TYPES = {
    TITAN: 0,
    HUNTER: 1,
    WARLOCK: 2,
    UNKNOWN: 3,
} as const;

// Damage types
export const DAMAGE_TYPES = {
    NONE: 0,
    KINETIC: 1,
    ARC: 2,
    SOLAR: 3,
    VOID: 4,
    RAID: 5,
    STASIS: 6,
    STRAND: 7,
} as const;

// ============================================================================
// INDEX BUILDING
// ============================================================================

/**
 * Build the manifest index from API or cache
 */
export async function buildManifestIndex(forceRebuild = false): Promise<{ 
    itemCount: number; 
    fromCache: boolean;
    version: string;
}> {
    if (!isDatabaseAvailable()) {
        throw new Error('IndexedDB not available');
    }

    // Check if we already have an up-to-date index
    const storedIndexVersion = localStorage.getItem(MANIFEST_INDEX_VERSION_KEY);
    const manifestInfo = getStoredManifestVersion();
    
    if (!forceRebuild && storedIndexVersion && manifestInfo && storedIndexVersion === manifestInfo.version) {
        const count = await db.manifestIndex.count();
        if (count > 0) {
            console.log(`[ManifestIndex] Using existing index with ${count} items`);
            return { itemCount: count, fromCache: true, version: manifestInfo.version };
        }
    }

    console.log('[ManifestIndex] Building new index...');

    // Fetch manifest metadata
    const manifestResponse = await bungieApi.get('/Destiny2/Manifest/');
    const manifest = manifestResponse.data.Response;
    const version = manifest.version;

    // Check if version changed and clear old cache
    if (hasManifestVersionChanged(version)) {
        console.log('[ManifestIndex] Manifest version changed, clearing old cache');
        await clearManifestCache();
        await db.manifestIndex.clear();
    }

    // Get the JSON world content URL for items
    const itemDefsPath = manifest.jsonWorldComponentContentPaths?.en?.DestinyInventoryItemDefinition;
    
    if (!itemDefsPath) {
        throw new Error('Could not find item definitions path in manifest');
    }

    // Fetch all item definitions
    const itemDefsResponse = await fetch(`https://www.bungie.net${itemDefsPath}`);
    const itemDefs: Record<string, any> = await itemDefsResponse.json();

    // Build index entries
    const indexEntries: ManifestIndex[] = [];
    const cacheEntries: Record<number, ManifestDefinition> = {};

    for (const [hashStr, item] of Object.entries(itemDefs)) {
        const hash = parseInt(hashStr, 10);
        
        // Skip items without names or icons (usually internal/placeholder items)
        if (!item.displayProperties?.name) continue;

        // Create index entry with queryable fields only
        indexEntries.push({
            hash,
            name: item.displayProperties.name,
            itemType: item.itemType ?? 0,
            itemSubType: item.itemSubType ?? 0,
            tierType: item.inventory?.tierType ?? 0,
            bucketTypeHash: item.inventory?.bucketTypeHash ?? 0,
            classType: item.classType ?? 3,
            damageType: item.defaultDamageTypeHash,
            defaultDamageTypeHash: item.defaultDamageTypeHash,
            itemCategoryHashes: item.itemCategoryHashes ?? [],
            equippable: item.equippable ?? false,
            nonTransferrable: item.nonTransferrable ?? false,
            iconPath: item.displayProperties.icon,
        });

        // Store full definition for cache
        cacheEntries[hash] = item;
    }

    // Clear and rebuild index
    await db.manifestIndex.clear();
    
    // Bulk insert in chunks
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < indexEntries.length; i += CHUNK_SIZE) {
        const chunk = indexEntries.slice(i, i + CHUNK_SIZE);
        await db.manifestIndex.bulkPut(chunk);
    }

    // Cache full definitions
    await cacheItemDefinitions(cacheEntries);

    // Store version info
    storeManifestVersion({
        version,
        lastChecked: Date.now(),
        jsonWorldContentPaths: manifest.jsonWorldComponentContentPaths,
    });
    localStorage.setItem(MANIFEST_INDEX_VERSION_KEY, version);

    console.log(`[ManifestIndex] Built index with ${indexEntries.length} items`);
    
    return { 
        itemCount: indexEntries.length, 
        fromCache: false,
        version 
    };
}

/**
 * Check if manifest index is built
 */
export async function isManifestIndexBuilt(): Promise<boolean> {
    if (!isDatabaseAvailable()) return false;
    const count = await db.manifestIndex.count();
    return count > 0;
}

/**
 * Get manifest index stats
 */
export async function getManifestIndexStats(): Promise<{
    totalItems: number;
    weapons: number;
    armor: number;
    exotics: number;
    legendaries: number;
}> {
    const [total, weapons, armor, exotics, legendaries] = await Promise.all([
        db.manifestIndex.count(),
        db.manifestIndex.where('itemType').equals(ITEM_TYPES.WEAPON).count(),
        db.manifestIndex.where('itemType').equals(ITEM_TYPES.ARMOR).count(),
        db.manifestIndex.where('tierType').equals(TIER_TYPES.EXOTIC).count(),
        db.manifestIndex.where('tierType').equals(TIER_TYPES.LEGENDARY).count(),
    ]);

    return {
        totalItems: total,
        weapons,
        armor,
        exotics,
        legendaries,
    };
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Query manifest items by filters
 */
export interface ManifestQueryFilters {
    itemType?: number;
    itemSubType?: number;
    tierType?: number;
    classType?: number;
    bucketTypeHash?: number;
    damageType?: number;
    itemCategoryHash?: number;
    nameSearch?: string;
    equippable?: boolean;
    limit?: number;
}

export async function queryManifestItems(filters: ManifestQueryFilters): Promise<ManifestIndex[]> {
    if (!isDatabaseAvailable()) return [];

    let collection = db.manifestIndex.toCollection();

    // Apply indexed filters first (most efficient)
    if (filters.itemType !== undefined) {
        collection = db.manifestIndex.where('itemType').equals(filters.itemType);
    } else if (filters.tierType !== undefined) {
        collection = db.manifestIndex.where('tierType').equals(filters.tierType);
    } else if (filters.classType !== undefined) {
        collection = db.manifestIndex.where('classType').equals(filters.classType);
    } else if (filters.bucketTypeHash !== undefined) {
        collection = db.manifestIndex.where('bucketTypeHash').equals(filters.bucketTypeHash);
    } else if (filters.damageType !== undefined) {
        collection = db.manifestIndex.where('damageType').equals(filters.damageType);
    } else if (filters.itemCategoryHash !== undefined) {
        collection = db.manifestIndex.where('itemCategoryHashes').equals(filters.itemCategoryHash);
    }

    // Apply additional filters
    let result = collection.filter(item => {
        if (filters.itemType !== undefined && item.itemType !== filters.itemType) return false;
        if (filters.itemSubType !== undefined && item.itemSubType !== filters.itemSubType) return false;
        if (filters.tierType !== undefined && item.tierType !== filters.tierType) return false;
        if (filters.classType !== undefined && item.classType !== filters.classType) return false;
        if (filters.bucketTypeHash !== undefined && item.bucketTypeHash !== filters.bucketTypeHash) return false;
        if (filters.damageType !== undefined && item.damageType !== filters.damageType) return false;
        if (filters.equippable !== undefined && item.equippable !== filters.equippable) return false;
        if (filters.itemCategoryHash !== undefined && !item.itemCategoryHashes.includes(filters.itemCategoryHash)) return false;
        if (filters.nameSearch) {
            const search = filters.nameSearch.toLowerCase();
            if (!item.name.toLowerCase().includes(search)) return false;
        }
        return true;
    });

    if (filters.limit) {
        result = result.limit(filters.limit);
    }

    return result.toArray();
}

// ============================================================================
// CONVENIENCE QUERY FUNCTIONS
// ============================================================================

/**
 * Get all weapons
 */
export async function getAllWeapons(tierType?: number): Promise<ManifestIndex[]> {
    return queryManifestItems({ 
        itemType: ITEM_TYPES.WEAPON,
        tierType,
        equippable: true,
    });
}

/**
 * Get all armor
 */
export async function getAllArmor(classType?: number, tierType?: number): Promise<ManifestIndex[]> {
    return queryManifestItems({ 
        itemType: ITEM_TYPES.ARMOR,
        classType,
        tierType,
        equippable: true,
    });
}

/**
 * Get all exotic weapons
 */
export async function getExoticWeapons(): Promise<ManifestIndex[]> {
    return queryManifestItems({ 
        itemType: ITEM_TYPES.WEAPON,
        tierType: TIER_TYPES.EXOTIC,
        equippable: true,
    });
}

/**
 * Get all exotic armor for a class
 */
export async function getExoticArmor(classType?: number): Promise<ManifestIndex[]> {
    return queryManifestItems({ 
        itemType: ITEM_TYPES.ARMOR,
        tierType: TIER_TYPES.EXOTIC,
        classType,
        equippable: true,
    });
}

/**
 * Get legendary weapons
 */
export async function getLegendaryWeapons(): Promise<ManifestIndex[]> {
    return queryManifestItems({ 
        itemType: ITEM_TYPES.WEAPON,
        tierType: TIER_TYPES.LEGENDARY,
        equippable: true,
    });
}

/**
 * Get weapons by damage type
 */
export async function getWeaponsByDamageType(damageType: number): Promise<ManifestIndex[]> {
    return queryManifestItems({ 
        itemType: ITEM_TYPES.WEAPON,
        damageType,
        equippable: true,
    });
}

/**
 * Get weapons by bucket (slot)
 */
export async function getWeaponsBySlot(bucketTypeHash: number, tierType?: number): Promise<ManifestIndex[]> {
    return queryManifestItems({ 
        itemType: ITEM_TYPES.WEAPON,
        bucketTypeHash,
        tierType,
        equippable: true,
    });
}

/**
 * Get armor by slot
 */
export async function getArmorBySlot(bucketTypeHash: number, classType?: number, tierType?: number): Promise<ManifestIndex[]> {
    return queryManifestItems({ 
        itemType: ITEM_TYPES.ARMOR,
        bucketTypeHash,
        classType,
        tierType,
        equippable: true,
    });
}

/**
 * Search items by name
 */
export async function searchItemsByName(search: string, limit = 50): Promise<ManifestIndex[]> {
    return queryManifestItems({ 
        nameSearch: search,
        equippable: true,
        limit,
    });
}

/**
 * Get item by hash (from index)
 */
export async function getItemFromIndex(hash: number): Promise<ManifestIndex | undefined> {
    return db.manifestIndex.get(hash);
}

/**
 * Get multiple items by hash (from index)
 */
export async function getItemsFromIndex(hashes: number[]): Promise<ManifestIndex[]> {
    return db.manifestIndex.where('hash').anyOf(hashes).toArray();
}

// ============================================================================
// COMBINED LOOKUP (Index + Full Definition)
// ============================================================================

/**
 * Get full item definitions for index results
 */
export async function getFullDefinitionsForIndexItems(
    indexItems: ManifestIndex[]
): Promise<Record<number, ManifestDefinition>> {
    const hashes = indexItems.map(item => item.hash);
    return getItemDefinitions(hashes);
}

/**
 * Query items and return full definitions
 */
export async function queryItemsWithDefinitions(
    filters: ManifestQueryFilters
): Promise<{ index: ManifestIndex; definition: ManifestDefinition | null }[]> {
    const indexItems = await queryManifestItems(filters);
    const definitions = await getFullDefinitionsForIndexItems(indexItems);
    
    return indexItems.map(item => ({
        index: item,
        definition: definitions[item.hash] || null,
    }));
}









