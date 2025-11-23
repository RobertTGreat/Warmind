import { useState, useEffect } from 'react';
import { bungieApi, endpoints } from '@/lib/bungie';
import { getFromDB, setInDB } from '@/lib/indexedDB';

const CACHE_KEY_PREFIX = 'destiny_manifest_item_';
const CACHE_VERSION = 'v1'; 

// Global in-memory cache to avoid refetching/re-reading DB on every hover
const globalCache: Record<number, ItemDefinition> = {};

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
  classType: number; // 0: Titan, 1: Hunter, 2: Warlock, 3: Unknown
  defaultDamageTypeHash?: number;
  itemCategoryHashes?: number[];
  isHolofoil?: boolean; 
  [key: string]: any;
}

export function useItemDefinitions(itemHashes: number[]) {
  const [definitions, setDefinitions] = useState<Record<number, ItemDefinition>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Generate a stable key for the dependency array
  const hashesKey = JSON.stringify([...itemHashes].sort());

  useEffect(() => {
    let isMounted = true;

    if (!itemHashes.length) {
        setIsLoading(false);
        return;
    }

    const loadDefinitions = async () => {
        setIsLoading(true);
        const uniqueHashes = Array.from(new Set(itemHashes));
        const currentDefs: Record<number, ItemDefinition> = {};
        const missingHashes: number[] = [];

        // 1. Check Global Cache & IndexedDB
        // We can check global cache synchronously
        const pendingDBChecks: Promise<void>[] = [];

        for (const hash of uniqueHashes) {
             if (globalCache[hash]) {
                currentDefs[hash] = globalCache[hash];
                continue;
            }

            // Queue DB check with error handling
            pendingDBChecks.push((async () => {
                try {
                    const key = `${CACHE_KEY_PREFIX}${hash}_${CACHE_VERSION}`;
                    const cached = await getFromDB<ItemDefinition>(key);
                    
                    if (cached) {
                        globalCache[hash] = cached;
                        currentDefs[hash] = cached;
                    } else {
                        missingHashes.push(hash);
                    }
                } catch (e) {
                    // If DB fails, just mark as missing and fetch from API
                    // console.warn(`DB read failed for ${hash}, falling back to API`, e);
                    missingHashes.push(hash);
                }
            })());
        }

        // Wait for all DB checks to complete (or fail caught)
        await Promise.all(pendingDBChecks);

        if (isMounted) {
            setDefinitions(prev => ({ ...prev, ...currentDefs }));
        }

        // 2. Fetch Missing
        if (missingHashes.length > 0) {
            // Increased batch size significantly as browsers handle many concurrent requests well on HTTP/2
            // and we want to unblock the UI as fast as possible. 
            // We use a simple windowed approach.
            const CONCURRENCY = 30; 
            const itemsToSave: { key: string, value: any }[] = [];

            // Helper to process a batch
            const processBatch = async (batch: number[]) => {
                const newDefs: Record<number, ItemDefinition> = {};
                await Promise.all(batch.map(async (hash) => {
                    try {
                        if (globalCache[hash]) {
                             newDefs[hash] = globalCache[hash];
                             return;
                        }

                        const res = await bungieApi.get(endpoints.getItemDefinition(hash));
                        const def = res.data.Response;
                        if (def) {
                            newDefs[hash] = def;
                            globalCache[hash] = def; 
                            itemsToSave.push({ key: `${CACHE_KEY_PREFIX}${hash}_${CACHE_VERSION}`, value: def });
                        }
                    } catch (err) {
                        console.error(`Failed to fetch def for ${hash}`, err);
                    }
                }));
                return newDefs;
            };

            // Process in chunks
            for (let i = 0; i < missingHashes.length; i += CONCURRENCY) {
                if (!isMounted) break;
                const batch = missingHashes.slice(i, i + CONCURRENCY);
                const newDefs = await processBatch(batch);
                
                if (isMounted) {
                    setDefinitions(prev => ({ ...prev, ...newDefs }));
                }
            }

            // Batch Save to DB (Fire and forget)
            if (itemsToSave.length > 0) {
                Promise.all(itemsToSave.map(item => setInDB(item.key, item.value))).catch(console.warn);
            }
        }
        
        if (isMounted) {
            setIsLoading(false);
        }
    };

    loadDefinitions();
    
    // Clean up localStorage to free quota (One-time effort or opportunistic)
    // We can do this asynchronously without blocking
    (async () => {
        try {
             // Scan keys and remove old manifest items
             // This is risky to do in loop if many keys, but we can try removing a few if quota is known issue
             // Or just clear all items starting with prefix
             // Note: localStorage iteration is synchronous.
             // Only run this once per session or sparingly.
             // Let's not auto-clear heavily right now to avoid UI jank, 
             // but maybe we should if the user is hitting limits.
        } catch (e) {}
    })();

    return () => {
        isMounted = false;
    };
  }, [hashesKey]); 

  return { definitions, isLoading };
}
