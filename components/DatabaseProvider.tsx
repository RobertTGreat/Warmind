'use client';

/**
 * Database Provider Component
 * 
 * Initializes the Dexie database, runs migrations, and provides
 * database status to the app.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db, isDatabaseAvailable, clearAllData, getStorageEstimate } from '@/lib/db';
import { runMigrations, MigrationResult, getStorageStats, StorageStats } from '@/lib/dataMigration';
import { buildManifestIndex, isManifestIndexBuilt } from '@/lib/manifestIndex';

// ============================================================================
// CONTEXT TYPES
// ============================================================================

interface DatabaseStatus {
    isReady: boolean;
    isInitializing: boolean;
    error: string | null;
    migrationResult: MigrationResult | null;
    manifestIndexReady: boolean;
    manifestIndexBuilding: boolean;
}

interface DatabaseContextValue {
    status: DatabaseStatus;
    initializeManifestIndex: (force?: boolean) => Promise<void>;
    clearAllData: () => Promise<void>;
    getStats: () => Promise<StorageStats>;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

interface DatabaseProviderProps {
    children: React.ReactNode;
    /**
     * Whether to automatically build the manifest index on initialization
     * Default: false (manifest index is built on-demand when needed)
     */
    autoInitManifest?: boolean;
}

export function DatabaseProvider({ 
    children, 
    autoInitManifest = false 
}: DatabaseProviderProps) {
    const [status, setStatus] = useState<DatabaseStatus>({
        isReady: false,
        isInitializing: true,
        error: null,
        migrationResult: null,
        manifestIndexReady: false,
        manifestIndexBuilding: false,
    });

    // Initialize database and run migrations
    useEffect(() => {
        let isMounted = true;

        const initialize = async () => {
            if (!isDatabaseAvailable()) {
                setStatus(prev => ({
                    ...prev,
                    isInitializing: false,
                    error: 'IndexedDB is not available in this browser',
                }));
                return;
            }

            try {
                // Open the database (Dexie handles this automatically, but we can ensure it's ready)
                await db.open();
                console.log('[DatabaseProvider] Database opened');

                // Run migrations
                const migrationResult = await runMigrations();
                console.log('[DatabaseProvider] Migrations complete:', migrationResult);

                // Check if manifest index is already built
                const manifestReady = await isManifestIndexBuilt();

                if (isMounted) {
                    setStatus({
                        isReady: true,
                        isInitializing: false,
                        error: null,
                        migrationResult,
                        manifestIndexReady: manifestReady,
                        manifestIndexBuilding: false,
                    });

                    // Optionally auto-init manifest index
                    if (autoInitManifest && !manifestReady) {
                        initializeManifestIndexInternal();
                    }
                }
            } catch (error) {
                console.error('[DatabaseProvider] Initialization error:', error);
                if (isMounted) {
                    setStatus(prev => ({
                        ...prev,
                        isInitializing: false,
                        error: error instanceof Error ? error.message : 'Database initialization failed',
                    }));
                }
            }
        };

        initialize();

        return () => {
            isMounted = false;
        };
    }, [autoInitManifest]);

    // Initialize manifest index
    const initializeManifestIndexInternal = useCallback(async (force = false) => {
        setStatus(prev => ({ ...prev, manifestIndexBuilding: true }));

        try {
            await buildManifestIndex(force);
            setStatus(prev => ({
                ...prev,
                manifestIndexReady: true,
                manifestIndexBuilding: false,
            }));
        } catch (error) {
            console.error('[DatabaseProvider] Manifest index build failed:', error);
            setStatus(prev => ({
                ...prev,
                manifestIndexBuilding: false,
                error: error instanceof Error ? error.message : 'Manifest index build failed',
            }));
        }
    }, []);

    // Public method to initialize manifest index
    const initializeManifestIndex = useCallback(async (force = false) => {
        return initializeManifestIndexInternal(force);
    }, [initializeManifestIndexInternal]);

    // Clear all data
    const clearAll = useCallback(async () => {
        await clearAllData();
        // Reset status
        setStatus(prev => ({
            ...prev,
            manifestIndexReady: false,
            migrationResult: null,
        }));
    }, []);

    // Get storage stats
    const getStats = useCallback(async () => {
        return getStorageStats();
    }, []);

    const contextValue: DatabaseContextValue = {
        status,
        initializeManifestIndex,
        clearAllData: clearAll,
        getStats,
    };

    return (
        <DatabaseContext.Provider value={contextValue}>
            {children}
        </DatabaseContext.Provider>
    );
}

// ============================================================================
// HOOK
// ============================================================================

export function useDatabase() {
    const context = useContext(DatabaseContext);
    
    if (!context) {
        throw new Error('useDatabase must be used within a DatabaseProvider');
    }
    
    return context;
}

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

/**
 * Component that shows while database is initializing
 */
export function DatabaseLoadingFallback({ 
    children 
}: { 
    children?: React.ReactNode 
}) {
    return (
        <div className="flex items-center justify-center min-h-[200px]">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#e3ce62] mx-auto mb-4" />
                <p className="text-gray-400 text-sm">
                    {children || 'Initializing database...'}
                </p>
            </div>
        </div>
    );
}

/**
 * Component that renders children only when database is ready
 */
export function DatabaseGate({ 
    children,
    fallback,
}: { 
    children: React.ReactNode;
    fallback?: React.ReactNode;
}) {
    const { status } = useDatabase();

    if (status.isInitializing) {
        return fallback || <DatabaseLoadingFallback />;
    }

    if (status.error) {
        return (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400">Database error: {status.error}</p>
            </div>
        );
    }

    return <>{children}</>;
}

/**
 * Component that renders children only when manifest index is ready
 */
export function ManifestGate({ 
    children,
    fallback,
    autoInit = true,
}: { 
    children: React.ReactNode;
    fallback?: React.ReactNode;
    autoInit?: boolean;
}) {
    const { status, initializeManifestIndex } = useDatabase();

    // Auto-initialize if needed
    useEffect(() => {
        if (autoInit && status.isReady && !status.manifestIndexReady && !status.manifestIndexBuilding) {
            initializeManifestIndex();
        }
    }, [autoInit, status.isReady, status.manifestIndexReady, status.manifestIndexBuilding, initializeManifestIndex]);

    if (!status.isReady) {
        return fallback || <DatabaseLoadingFallback>Initializing...</DatabaseLoadingFallback>;
    }

    if (status.manifestIndexBuilding) {
        return fallback || <DatabaseLoadingFallback>Building manifest index...</DatabaseLoadingFallback>;
    }

    if (!status.manifestIndexReady) {
        return fallback || (
            <div className="p-4 text-center">
                <p className="text-gray-400 mb-4">Manifest index not initialized</p>
                <button
                    onClick={() => initializeManifestIndex()}
                    className="px-4 py-2 bg-[#e3ce62] text-black rounded hover:bg-[#d4bf53] transition-colors"
                >
                    Initialize Manifest
                </button>
            </div>
        );
    }

    return <>{children}</>;
}

// ============================================================================
// STORAGE INFO COMPONENT
// ============================================================================

export function StorageInfo() {
    const { getStats } = useDatabase();
    const [stats, setStats] = useState<StorageStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        getStats().then(s => {
            setStats(s);
            setIsLoading(false);
        });
    }, [getStats]);

    if (isLoading || !stats) {
        return <div className="animate-pulse h-32 bg-white/5 rounded-lg" />;
    }

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="space-y-4 text-sm">
            <div>
                <h4 className="font-medium text-gray-300 mb-2">IndexedDB Usage</h4>
                <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-[#e3ce62]"
                            style={{ width: `${Math.min(stats.indexedDB.usagePercent, 100)}%` }}
                        />
                    </div>
                    <span className="text-gray-400">
                        {formatBytes(stats.indexedDB.usage)} / {formatBytes(stats.indexedDB.quota)}
                    </span>
                </div>
            </div>

            <div>
                <h4 className="font-medium text-gray-300 mb-2">Table Counts</h4>
                <div className="grid grid-cols-2 gap-2 text-gray-400">
                    <div>Loadouts: {stats.tables.loadouts}</div>
                    <div>Wishlists: {stats.tables.wishlists}</div>
                    <div>Wishlist Rolls: {stats.tables.wishlistRolls}</div>
                    <div>Manifest Items: {stats.tables.manifestIndex}</div>
                    <div>Cached Profiles: {stats.tables.profiles}</div>
                    <div>Item Tags: {stats.tables.itemTags}</div>
                    <div>Item Notes: {stats.tables.itemNotes}</div>
                    <div>Activity Cache: {stats.tables.activityCache}</div>
                </div>
            </div>

            <div>
                <h4 className="font-medium text-gray-300 mb-2">Other Storage</h4>
                <div className="grid grid-cols-2 gap-2 text-gray-400">
                    <div>localStorage: {formatBytes(stats.localStorage.used)}</div>
                    <div>Cache API URLs: {stats.cacheAPI.urls}</div>
                </div>
            </div>
        </div>
    );
}








