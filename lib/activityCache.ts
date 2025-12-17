import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'warmind_cache';
const STORE_NAME = 'activity_history';
const INVALID_STORE_NAME = 'invalid_instances';
const DB_VERSION = 2; // Increment version

// Key for storing invalid instance IDs in localStorage (legacy)
const INVALID_INSTANCES_KEY = 'warmind_invalid_activity_instances';

interface CacheEntry {
    key: string;
    data: any;
    timestamp: number;
}

// Cache validity duration (e.g., 24 hours for old activities, 15 minutes for recent?)
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

let dbPromise: Promise<IDBPDatabase<any>>;

if (typeof window !== 'undefined') {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains(INVALID_STORE_NAME)) {
                db.createObjectStore(INVALID_STORE_NAME);
            }
            
            // Migrate from localStorage to IDB if version is 1
            if (oldVersion < 2) {
                try {
                    const stored = localStorage.getItem(INVALID_INSTANCES_KEY);
                    if (stored) {
                        const ids = JSON.parse(stored) as string[];
                        // We'll handle migration in a separate step or just let the next calls handle it
                    }
                } catch {}
            }
        },
    });
}

// ===== Invalid Instance ID Management =====

// Keep a local set for fast synchronous checks
let cachedInvalidIds: Set<string> | null = null;

export async function getInvalidInstanceIds(): Promise<Set<string>> {
    if (typeof window === 'undefined') return new Set();
    if (cachedInvalidIds) return cachedInvalidIds;
    
    try {
        const db = await dbPromise;
        const keys = await db.getAllKeys(INVALID_STORE_NAME);
        const idSet = new Set(keys.map(k => String(k)));
        
        // Also check legacy localStorage
        const legacyStored = localStorage.getItem(INVALID_INSTANCES_KEY);
        if (legacyStored) {
            const legacyIds = JSON.parse(legacyStored) as string[];
            for (const id of legacyIds) {
                idSet.add(id);
                // Migrate to IDB
                await db.put(INVALID_STORE_NAME, true, id);
            }
            // Clear legacy
            localStorage.removeItem(INVALID_INSTANCES_KEY);
        }
        
        cachedInvalidIds = idSet;
        return idSet;
    } catch {
        return new Set();
    }
}

// Synchronous version for components that can't await (uses the cached set)
export function getInvalidInstanceIdsSync(): Set<string> {
    return cachedInvalidIds || new Set();
}

export async function addInvalidInstanceId(instanceId: string): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
        const db = await dbPromise;
        await db.put(INVALID_STORE_NAME, true, instanceId);
        
        if (cachedInvalidIds) {
            cachedInvalidIds.add(instanceId);
        } else {
            cachedInvalidIds = new Set([instanceId]);
        }
    } catch {
        // Ignore storage errors
    }
}

export async function clearInvalidInstanceIds(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
        const db = await dbPromise;
        await db.clear(INVALID_STORE_NAME);
        cachedInvalidIds = new Set();
    } catch {
        // Ignore storage errors
    }
}

// Helper to filter out invalid instances from activity data
async function filterInvalidActivities(data: { raids: any[]; dungeons: any[] }): Promise<{ raids: any[]; dungeons: any[] }> {
    const invalidIds = await getInvalidInstanceIds();
    const hasMethod = typeof (invalidIds as any)?.has === 'function';
    if (!hasMethod || (invalidIds as Set<string>).size === 0) return data;
    
    return {
        raids: data.raids.filter(a => !(invalidIds as Set<string>).has(a.activityDetails?.instanceId)),
        dungeons: data.dungeons.filter(a => !(invalidIds as Set<string>).has(a.activityDetails?.instanceId))
    };
}

export const getCachedHistory = async (key: string) => {
    if (!dbPromise) return null;
    try {
        const db = await dbPromise;
        const entry = await db.get(STORE_NAME, key) as CacheEntry | undefined;
        
        if (!entry) return null;

        // Check if expired
        if (Date.now() - entry.timestamp > CACHE_DURATION) {
            await db.delete(STORE_NAME, key);
            return null;
        }

        // Filter out invalid instances when loading from cache
        return await filterInvalidActivities(entry.data);
    } catch (e) {
        console.error("IDB Get Error", e);
        return null;
    }
};

export const setCachedHistory = async (key: string, data: any) => {
    if (!dbPromise) return;
    try {
        const db = await dbPromise;
        // Filter out invalid instances before saving to cache
        const filteredData = await filterInvalidActivities(data);
        await db.put(STORE_NAME, {
            key,
            data: filteredData,
            timestamp: Date.now()
        });
    } catch (e) {
        console.error("IDB Set Error", e);
    }
};

export const clearCache = async () => {
    if (!dbPromise) return;
    const db = await dbPromise;
    await db.clear(STORE_NAME);
};

// Remove invalid instances from cached data and update the cache
export const purgeInvalidInstancesFromCache = async () => {
    if (!dbPromise) return;
    try {
        const db = await dbPromise;
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        // Get all entries
        const entries = await store.getAll();
        
        for (const entry of entries) {
            if (entry.data && (entry.data.raids || entry.data.dungeons)) {
                // Filter out invalid instances
                const filteredData = await filterInvalidActivities(entry.data);
                
                // Update the entry with filtered data
                await store.put({
                    ...entry,
                    data: filteredData
                });
            }
        }
        
        await tx.done;
        console.log('Purged invalid instances from activity cache');
    } catch (e) {
        console.error("IDB Purge Error", e);
    }
};


