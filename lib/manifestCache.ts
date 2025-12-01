/**
 * Manifest Cache Service
 * 
 * Uses the Cache API to store full item definitions from the Bungie API.
 * This is ideal for HTTP response caching - the manifest is essentially
 * a collection of API responses that rarely change.
 * 
 * For queryable manifest data, see manifestIndex.ts which uses Dexie.
 */

const MANIFEST_CACHE_NAME = 'destiny-manifest-v1';
const BUNGIE_API_BASE = 'https://www.bungie.net/Platform';
const BUNGIE_MANIFEST_BASE = '/Destiny2/Manifest';

// ============================================================================
// TYPES
// ============================================================================

export interface ManifestDefinition {
    hash: number;
    displayProperties: {
        name: string;
        description: string;
        icon: string;
        hasIcon: boolean;
    };
    [key: string]: any;
}

export interface ManifestVersionInfo {
    version: string;
    lastChecked: number;
    jsonWorldContentPaths: Record<string, string>;
}

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

/**
 * Open the manifest cache
 */
async function getCache(): Promise<Cache | null> {
    if (typeof caches === 'undefined') return null;
    return caches.open(MANIFEST_CACHE_NAME);
}

/**
 * Get a single item definition from cache
 */
export async function getCachedDefinition(
    definitionType: string,
    hash: number | string
): Promise<ManifestDefinition | null> {
    const cache = await getCache();
    if (!cache) return null;

    const url = `${BUNGIE_API_BASE}${BUNGIE_MANIFEST_BASE}/${definitionType}/${hash}/`;
    const response = await cache.match(url);

    if (response) {
        try {
            const data = await response.json();
            return data.Response || null;
        } catch {
            return null;
        }
    }

    return null;
}

/**
 * Cache a single item definition
 */
export async function cacheDefinition(
    definitionType: string,
    hash: number | string,
    definition: ManifestDefinition
): Promise<void> {
    const cache = await getCache();
    if (!cache) return;

    const url = `${BUNGIE_API_BASE}${BUNGIE_MANIFEST_BASE}/${definitionType}/${hash}/`;
    
    // Create a synthetic response to cache
    const response = new Response(JSON.stringify({ Response: definition }), {
        headers: {
            'Content-Type': 'application/json',
            'X-Cached-At': new Date().toISOString(),
        },
    });

    await cache.put(url, response);
}

/**
 * Cache multiple definitions at once
 */
export async function cacheDefinitions(
    definitionType: string,
    definitions: Record<number | string, ManifestDefinition>
): Promise<void> {
    const cache = await getCache();
    if (!cache) return;

    const entries = Object.entries(definitions);
    
    // Batch in chunks to avoid overwhelming the cache
    const BATCH_SIZE = 100;
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE);
        await Promise.all(
            batch.map(async ([hash, definition]) => {
                const url = `${BUNGIE_API_BASE}${BUNGIE_MANIFEST_BASE}/${definitionType}/${hash}/`;
                const response = new Response(JSON.stringify({ Response: definition }), {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Cached-At': new Date().toISOString(),
                    },
                });
                await cache.put(url, response);
            })
        );
    }
}

/**
 * Get multiple definitions from cache
 */
export async function getCachedDefinitions(
    definitionType: string,
    hashes: (number | string)[]
): Promise<Record<number, ManifestDefinition>> {
    const cache = await getCache();
    if (!cache) return {};

    const results: Record<number, ManifestDefinition> = {};
    
    await Promise.all(
        hashes.map(async (hash) => {
            const url = `${BUNGIE_API_BASE}${BUNGIE_MANIFEST_BASE}/${definitionType}/${hash}/`;
            const response = await cache.match(url);
            
            if (response) {
                try {
                    const data = await response.json();
                    if (data.Response) {
                        results[Number(hash)] = data.Response;
                    }
                } catch {
                    // Skip invalid entries
                }
            }
        })
    );

    return results;
}

/**
 * Check if a definition is cached
 */
export async function isDefinitionCached(
    definitionType: string,
    hash: number | string
): Promise<boolean> {
    const cache = await getCache();
    if (!cache) return false;

    const url = `${BUNGIE_API_BASE}${BUNGIE_MANIFEST_BASE}/${definitionType}/${hash}/`;
    const response = await cache.match(url);
    return !!response;
}

/**
 * Delete a cached definition
 */
export async function deleteCachedDefinition(
    definitionType: string,
    hash: number | string
): Promise<boolean> {
    const cache = await getCache();
    if (!cache) return false;

    const url = `${BUNGIE_API_BASE}${BUNGIE_MANIFEST_BASE}/${definitionType}/${hash}/`;
    return cache.delete(url);
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

/**
 * Clear the entire manifest cache
 */
export async function clearManifestCache(): Promise<boolean> {
    if (typeof caches === 'undefined') return false;
    return caches.delete(MANIFEST_CACHE_NAME);
}

/**
 * Get all cached URLs (for debugging)
 */
export async function getCachedUrls(): Promise<string[]> {
    const cache = await getCache();
    if (!cache) return [];

    const keys = await cache.keys();
    return keys.map(request => request.url);
}

/**
 * Get cache size estimate
 */
export async function getCacheSize(): Promise<number> {
    const urls = await getCachedUrls();
    return urls.length;
}

// ============================================================================
// MANIFEST VERSION MANAGEMENT
// ============================================================================

const MANIFEST_VERSION_KEY = 'warmind-manifest-version';

/**
 * Get stored manifest version info
 */
export function getStoredManifestVersion(): ManifestVersionInfo | null {
    if (typeof localStorage === 'undefined') return null;
    
    const stored = localStorage.getItem(MANIFEST_VERSION_KEY);
    if (!stored) return null;
    
    try {
        return JSON.parse(stored);
    } catch {
        return null;
    }
}

/**
 * Store manifest version info
 */
export function storeManifestVersion(info: ManifestVersionInfo): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(MANIFEST_VERSION_KEY, JSON.stringify(info));
}

/**
 * Check if manifest version has changed
 */
export function hasManifestVersionChanged(newVersion: string): boolean {
    const stored = getStoredManifestVersion();
    if (!stored) return true;
    return stored.version !== newVersion;
}

/**
 * Clear manifest version info
 */
export function clearManifestVersion(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(MANIFEST_VERSION_KEY);
}

// ============================================================================
// ITEM DEFINITION HELPERS
// ============================================================================

/**
 * Get item definition (convenience wrapper)
 */
export async function getItemDefinition(hash: number): Promise<ManifestDefinition | null> {
    return getCachedDefinition('DestinyInventoryItemDefinition', hash);
}

/**
 * Get multiple item definitions
 */
export async function getItemDefinitions(hashes: number[]): Promise<Record<number, ManifestDefinition>> {
    return getCachedDefinitions('DestinyInventoryItemDefinition', hashes);
}

/**
 * Cache item definition
 */
export async function cacheItemDefinition(hash: number, definition: ManifestDefinition): Promise<void> {
    return cacheDefinition('DestinyInventoryItemDefinition', hash, definition);
}

/**
 * Cache multiple item definitions
 */
export async function cacheItemDefinitions(definitions: Record<number, ManifestDefinition>): Promise<void> {
    return cacheDefinitions('DestinyInventoryItemDefinition', definitions);
}

// ============================================================================
// ACTIVITY DEFINITION HELPERS
// ============================================================================

/**
 * Get activity definition
 */
export async function getActivityDefinition(hash: number): Promise<ManifestDefinition | null> {
    return getCachedDefinition('DestinyActivityDefinition', hash);
}

/**
 * Get multiple activity definitions
 */
export async function getActivityDefinitions(hashes: number[]): Promise<Record<number, ManifestDefinition>> {
    return getCachedDefinitions('DestinyActivityDefinition', hashes);
}

/**
 * Cache activity definitions
 */
export async function cacheActivityDefinitions(definitions: Record<number, ManifestDefinition>): Promise<void> {
    return cacheDefinitions('DestinyActivityDefinition', definitions);
}

// ============================================================================
// RECORD/TRIUMPH DEFINITION HELPERS
// ============================================================================

/**
 * Get record definition
 */
export async function getRecordDefinition(hash: number): Promise<ManifestDefinition | null> {
    return getCachedDefinition('DestinyRecordDefinition', hash);
}

/**
 * Cache record definitions
 */
export async function cacheRecordDefinitions(definitions: Record<number, ManifestDefinition>): Promise<void> {
    return cacheDefinitions('DestinyRecordDefinition', definitions);
}

// ============================================================================
// COLLECTIBLE DEFINITION HELPERS  
// ============================================================================

/**
 * Get collectible definition
 */
export async function getCollectibleDefinition(hash: number): Promise<ManifestDefinition | null> {
    return getCachedDefinition('DestinyCollectibleDefinition', hash);
}

/**
 * Cache collectible definitions
 */
export async function cacheCollectibleDefinitions(definitions: Record<number, ManifestDefinition>): Promise<void> {
    return cacheDefinitions('DestinyCollectibleDefinition', definitions);
}

