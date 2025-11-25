import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'warmind_cache';
const STORE_NAME = 'activity_history';
const DB_VERSION = 1;

// Key for storing invalid instance IDs in localStorage
const INVALID_INSTANCES_KEY = 'warmind_invalid_activity_instances';

interface CacheEntry {
    key: string;
    data: any;
    timestamp: number;
}

// Cache validity duration (e.g., 24 hours for old activities, 15 minutes for recent?)
// Actually, activity history doesn't change for the past. Only "new" items appear.
// But we fetch by page.
// Let's cache specific pages for a short duration or longer if they are "full".
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

let dbPromise: Promise<IDBPDatabase<any>>;

if (typeof window !== 'undefined') {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
        },
    });
}

// ===== Invalid Instance ID Management =====

export function getInvalidInstanceIds(): Set<string> {
    if (typeof window === 'undefined') return new Set();
    try {
        const stored = localStorage.getItem(INVALID_INSTANCES_KEY);
        return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
        return new Set();
    }
}

export function addInvalidInstanceId(instanceId: string): void {
    if (typeof window === 'undefined') return;
    try {
        const current = getInvalidInstanceIds();
        current.add(instanceId);
        localStorage.setItem(INVALID_INSTANCES_KEY, JSON.stringify([...current]));
    } catch {
        // Ignore storage errors
    }
}

export function clearInvalidInstanceIds(): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.removeItem(INVALID_INSTANCES_KEY);
    } catch {
        // Ignore storage errors
    }
}

// Helper to filter out invalid instances from activity data
function filterInvalidActivities(data: { raids: any[]; dungeons: any[] }): { raids: any[]; dungeons: any[] } {
    const invalidIds = getInvalidInstanceIds();
    if (invalidIds.size === 0) return data;
    
    return {
        raids: data.raids.filter(a => !invalidIds.has(a.activityDetails?.instanceId)),
        dungeons: data.dungeons.filter(a => !invalidIds.has(a.activityDetails?.instanceId))
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
        return filterInvalidActivities(entry.data);
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
        const filteredData = filterInvalidActivities(data);
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
                const filteredData = filterInvalidActivities(entry.data);
                
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


