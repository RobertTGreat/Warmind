import { useState, useEffect } from 'react';
import { bungieApi, endpoints } from '@/lib/bungie';

const CACHE_KEY_PREFIX = 'destiny_manifest_item_';
const CACHE_VERSION = 'v1'; // Bump this to clear cache if logic changes

// Global in-memory cache to avoid refetching/re-reading localstorage on every hover
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
  [key: string]: any;
}

export function useItemDefinitions(itemHashes: number[]) {
  const [definitions, setDefinitions] = useState<Record<number, ItemDefinition>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Generate a stable key for the dependency array
  // We sort to ensure order doesn't trigger reload
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

        // 1. Check Global Cache & LocalStorage
        uniqueHashes.forEach(hash => {
            // Check Memory Cache
            if (globalCache[hash]) {
                currentDefs[hash] = globalCache[hash];
                return;
            }

            // Check Local Storage
            const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${hash}_${CACHE_VERSION}`);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    globalCache[hash] = parsed; // Promote to memory cache
                    currentDefs[hash] = parsed;
                    return;
                } catch (e) {
                    // Invalid cache, will fetch
                }
            } 
            
            // If not in memory or local storage, mark for fetch
            missingHashes.push(hash);
        });

        if (isMounted) {
            setDefinitions(prev => ({ ...prev, ...currentDefs }));
        }

        // 2. Fetch Missing
        if (missingHashes.length > 0) {
            const BATCH_SIZE = 5; 
            for (let i = 0; i < missingHashes.length; i += BATCH_SIZE) {
                if (!isMounted) break;

                const batch = missingHashes.slice(i, i + BATCH_SIZE);
                const newDefs: Record<number, ItemDefinition> = {};
                
                await Promise.all(batch.map(async (hash) => {
                    try {
                        // Double check if another request filled it (optional optimization)
                        if (globalCache[hash]) {
                             newDefs[hash] = globalCache[hash];
                             return;
                        }

                        const res = await bungieApi.get(endpoints.getItemDefinition(hash));
                        const def = res.data.Response;
                        if (def) {
                            newDefs[hash] = def;
                            globalCache[hash] = def; // Update global cache
                            
                            // Update local storage
                            try {
                                localStorage.setItem(`${CACHE_KEY_PREFIX}${hash}_${CACHE_VERSION}`, JSON.stringify(def));
                            } catch (e) {
                                // Storage full
                            }
                        }
                    } catch (err) {
                        console.error(`Failed to fetch def for ${hash}`, err);
                    }
                }));
                
                if (isMounted) {
                    // Update state incrementally
                    setDefinitions(prev => ({ ...prev, ...newDefs }));
                }
            }
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
