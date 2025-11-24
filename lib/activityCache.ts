import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'warmind_cache';
const STORE_NAME = 'activity_history';
const DB_VERSION = 1;

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

        return entry.data;
    } catch (e) {
        console.error("IDB Get Error", e);
        return null;
    }
};

export const setCachedHistory = async (key: string, data: any) => {
    if (!dbPromise) return;
    try {
        const db = await dbPromise;
        await db.put(STORE_NAME, {
            key,
            data,
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


