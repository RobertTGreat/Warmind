/**
 * useItemDefinitions Hook
 * 
 * Fetches and caches item definitions from the Destiny manifest.
 * Uses a hybrid storage approach:
 * - Cache API for full definitions (HTTP response caching)
 * - In-memory cache for runtime performance
 * - Falls back to Bungie API for uncached items
 */

import { useState, useEffect, useMemo } from 'react';
import { bungieApi, endpoints } from '@/lib/bungie';
import { 
    getItemDefinitions as getCachedDefinitions,
    cacheItemDefinition,
} from '@/lib/manifestCache';

// Global in-memory cache to avoid refetching on every component render
const globalCache: Record<number, ItemDefinition> = {};

// Track pending fetches to avoid duplicate requests
const pendingFetches = new Map<number, Promise<ItemDefinition | null>>();

export interface ItemDefinition {
    hash: number;
    displayProperties: {
        name: string;
        icon: string;
        description: string;
    };
    itemType: number;
    itemTypeDisplayName: string;
    inventory: {
        bucketTypeHash: number;
        tierTypeName: string;
        tierType?: number;
    };
    classType: number;
    defaultDamageTypeHash?: number;
    itemCategoryHashes?: number[];
    isHolofoil?: boolean;
    screenshot?: string;
    flavorText?: string;
    stats?: any;
    investmentStats?: any;
    iconWatermark?: string;
    iconWatermarkShelved?: string;
    equippable?: boolean;
    nonTransferrable?: boolean;
    [key: string]: any;
}

/**
 * Hook to fetch item definitions for given hashes
 */
export function useItemDefinitions(itemHashes: number[]) {
    const [definitions, setDefinitions] = useState<Record<number, ItemDefinition>>({});
    const [isLoading, setIsLoading] = useState(true);

    // Generate a stable key for the dependency array
    const hashesKey = useMemo(() => {
        const sorted = [...new Set(itemHashes)].sort((a, b) => a - b);
        return sorted.join(',');
    }, [itemHashes]);

    useEffect(() => {
        let isMounted = true;

        if (!itemHashes.length) {
            setIsLoading(false);
            return;
        }

        const loadDefinitions = async () => {
            setIsLoading(true);
            
            const uniqueHashes = [...new Set(itemHashes)];
            const currentDefs: Record<number, ItemDefinition> = {};
            const missingHashes: number[] = [];

            // 1. Check global in-memory cache first (instant)
            for (const hash of uniqueHashes) {
                if (globalCache[hash]) {
                    currentDefs[hash] = globalCache[hash];
                } else {
                    missingHashes.push(hash);
                }
            }

            // Update state with what we have from memory
            if (Object.keys(currentDefs).length > 0 && isMounted) {
                setDefinitions(prev => ({ ...prev, ...currentDefs }));
            }

            if (missingHashes.length === 0) {
                setIsLoading(false);
                return;
            }

            // 2. Check Cache API for missing items
            try {
                const cachedDefs = await getCachedDefinitions(missingHashes);
                const stillMissing: number[] = [];

                for (const hash of missingHashes) {
                    if (cachedDefs[hash]) {
                        // Cast to ItemDefinition - the shapes are compatible
                        const def = cachedDefs[hash] as unknown as ItemDefinition;
                        globalCache[hash] = def;
                        currentDefs[hash] = def;
                    } else {
                        stillMissing.push(hash);
                    }
                }

                // Update state with Cache API results
                if (isMounted) {
                    setDefinitions(prev => ({ ...prev, ...currentDefs }));
                }

                // 3. Fetch remaining from API
                if (stillMissing.length > 0) {
                    await fetchFromApi(stillMissing, currentDefs, isMounted, setDefinitions);
                }
            } catch (error) {
                console.warn('[useItemDefinitions] Cache API error, falling back to API', error);
                // Fallback: fetch all missing from API
                await fetchFromApi(missingHashes, currentDefs, isMounted, setDefinitions);
            }

            if (isMounted) {
                setIsLoading(false);
            }
        };

        loadDefinitions();

        return () => {
            isMounted = false;
        };
    }, [hashesKey]);

    return { definitions, isLoading };
}

/**
 * Fetch definitions from Bungie API
 */
async function fetchFromApi(
    hashes: number[],
    currentDefs: Record<number, ItemDefinition>,
    isMounted: boolean,
    setDefinitions: React.Dispatch<React.SetStateAction<Record<number, ItemDefinition>>>
): Promise<void> {
    // Batch fetch with concurrency limit
    const CONCURRENCY = 30;
    const newDefs: Record<number, ItemDefinition> = {};

    const fetchSingle = async (hash: number): Promise<void> => {
        // Check if already being fetched
        if (pendingFetches.has(hash)) {
            const result = await pendingFetches.get(hash);
            if (result) {
                newDefs[hash] = result;
            }
            return;
        }

        // Check cache again (might have been populated by another component)
        if (globalCache[hash]) {
            newDefs[hash] = globalCache[hash];
            return;
        }

        // Create fetch promise
        const fetchPromise = (async (): Promise<ItemDefinition | null> => {
            try {
                const response = await bungieApi.get(endpoints.getItemDefinition(hash));
                const def = response.data.Response as ItemDefinition;
                
                if (def) {
                    // Update caches
                    globalCache[hash] = def;
                    await cacheItemDefinition(hash, def as any);
                    return def;
                }
            } catch (error) {
                // Silently fail for individual items
                console.warn(`[useItemDefinitions] Failed to fetch ${hash}`);
            }
            return null;
        })();

        pendingFetches.set(hash, fetchPromise);
        
        try {
            const result = await fetchPromise;
            if (result) {
                newDefs[hash] = result;
            }
        } finally {
            pendingFetches.delete(hash);
        }
    };

    // Process in batches
    for (let i = 0; i < hashes.length; i += CONCURRENCY) {
        const batch = hashes.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(fetchSingle));

        // Update state incrementally
        if (isMounted && Object.keys(newDefs).length > 0) {
            setDefinitions(prev => ({ ...prev, ...newDefs }));
        }
    }
}

/**
 * Hook to get a single item definition
 */
export function useItemDefinition(itemHash: number | null | undefined) {
    const hashes = useMemo(() => itemHash ? [itemHash] : [], [itemHash]);
    const { definitions, isLoading } = useItemDefinitions(hashes);
    
    return {
        definition: itemHash ? definitions[itemHash] : undefined,
        isLoading,
    };
}

/**
 * Preload item definitions into cache
 * Useful for prefetching commonly needed items
 */
export async function preloadItemDefinitions(hashes: number[]): Promise<void> {
    const uncached = hashes.filter(hash => !globalCache[hash]);
    
    if (uncached.length === 0) return;

    // Check Cache API
    const cached = await getCachedDefinitions(uncached);
    const stillMissing: number[] = [];

    for (const hash of uncached) {
        if (cached[hash]) {
            globalCache[hash] = cached[hash] as unknown as ItemDefinition;
        } else {
            stillMissing.push(hash);
        }
    }

    // Fetch missing from API
    if (stillMissing.length > 0) {
        const BATCH_SIZE = 50;
        for (let i = 0; i < stillMissing.length; i += BATCH_SIZE) {
            const batch = stillMissing.slice(i, i + BATCH_SIZE);
            await Promise.all(
                batch.map(async (hash) => {
                    try {
                        const response = await bungieApi.get(endpoints.getItemDefinition(hash));
                        const def = response.data.Response;
                        if (def) {
                            globalCache[hash] = def;
                            await cacheItemDefinition(hash, def);
                        }
                    } catch {
                        // Silently fail
                    }
                })
            );
        }
    }
}

/**
 * Get item definition from cache synchronously (if available)
 */
export function getItemDefinitionSync(hash: number): ItemDefinition | undefined {
    return globalCache[hash];
}

/**
 * Clear the in-memory cache
 */
export function clearItemDefinitionCache(): void {
    Object.keys(globalCache).forEach(key => delete globalCache[Number(key)]);
}

/**
 * Get cache stats
 */
export function getItemDefinitionCacheStats(): { 
    inMemoryCount: number;
    pendingFetchCount: number;
} {
    return {
        inMemoryCount: Object.keys(globalCache).length,
        pendingFetchCount: pendingFetches.size,
    };
}

export default useItemDefinitions;
