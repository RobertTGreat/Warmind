// Simple key-value store for wishlists and other data
// Uses a separate DB name to avoid conflicts with WarmindDB (Dexie)
const DB_NAME = 'WarmindKV';
const DB_VERSION = 1;
const STORE_NAME = 'keyvalue';

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = () => {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        if (typeof window === 'undefined') {
            reject(new Error('IndexedDB not supported server-side'));
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = (event) => {
            resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onerror = (event) => {
            console.error('IndexedDB Open Error:', (event.target as IDBOpenDBRequest).error);
            // If there's a version error, delete and retry
            const error = (event.target as IDBOpenDBRequest).error;
            if (error?.name === 'VersionError') {
                console.log('Version conflict detected, deleting old database...');
                indexedDB.deleteDatabase(DB_NAME);
                dbPromise = null;
                // Retry after deletion
                setTimeout(() => {
                    openDB().then(resolve).catch(reject);
                }, 100);
            } else {
                reject(error);
            }
        };
    });

    return dbPromise;
};

export const getFromDB = async <T>(key: string): Promise<T | undefined> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.warn('IndexedDB Read Error', error);
        return undefined;
    }
};

export const setInDB = async (key: string, value: any): Promise<void> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(value, key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.warn('IndexedDB Write Error', error);
    }
};

export const deleteFromDB = async (key: string): Promise<void> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.warn('IndexedDB Delete Error', error);
    }
};

export const clearDB = async (): Promise<void> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.warn('IndexedDB Clear Error', error);
    }
};


