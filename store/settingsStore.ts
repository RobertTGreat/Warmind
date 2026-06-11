import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useWishListStore } from './wishlistStore';
import { DEFAULT_PAGE_FALLBACK, normalizeDefaultPage, type DefaultPage } from '@/lib/defaultPages';
import { defaultFavouriteHeaderNavHrefs } from '@/lib/navigation';

// ===== Type Definitions =====

export type IconSize = 'small' | 'medium' | 'large';
export type SortMethod = 'power' | 'name' | 'rarity' | 'newest';
export type Theme = 'dark' | 'oled' | 'titan' | 'hunter' | 'warlock';
export type AccentColor = 'gold' | 'void' | 'solar' | 'arc' | 'strand' | 'stasis';
export type TimeFormat = '12h' | '24h';
export type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
export type DefaultTab = 'raids' | 'dungeons' | 'all';
export type FailedRunsDisplay = 'always' | 'collapsed' | 'hidden';
export type SubscriptionTier = 'free' | 'premium';

export interface VaultGroupingOptions {
    byClass: boolean;
    byRarity: boolean;
    byAmmoType: boolean;
    byTier: boolean;
}

// ===== Syncable Settings Interface =====
// These are the settings that can be synced across devices

export interface SyncableSettings {
    // Appearance
    theme: Theme;
    accentColor: AccentColor;
    defaultPage: DefaultPage;
    favouriteHeaderNavHrefs: string[];
    compactMode: boolean;
    reducedMotion: boolean;
    
    // Inventory & Vault
    iconSize: IconSize;
    sortMethod: SortMethod;
    vaultGrouping: VaultGroupingOptions;
    showLockedHighlight: boolean;
    postmasterWarningThreshold: number;

    // Triumphs, Titles & Collections
    hideCompletedTriumphs: boolean;
    hideInvisibleTriumphs: boolean;
    hideUnobtainableTriumphs: boolean;
    hideAcquiredCollectionItems: boolean;
    hideInvisibleCollectionItems: boolean;
    groupCollectionItems: boolean;
    groupTitles: boolean;
    revealLegacyTitles: boolean;
    
    // Activity History
    defaultActivityTab: DefaultTab;
    hideInvalidReports: boolean;
    showFailedRuns: FailedRunsDisplay;
    
    // Date & Time
    timeFormat: TimeFormat;
    dateFormat: DateFormat;
    
    // Data & Performance
    cacheDurationMinutes: number;
    autoRefreshMinutes: number;
    
    // Notifications
    weeklyResetReminder: boolean;
    postmasterWarning: boolean;
    
    // Social
    favoriteMembers: string[];
    
    // Privacy
    profileVisibility: 'public' | 'clan' | 'private';
    
    // Wish Lists (URLs only - rolls are fetched on demand)
    wishListUrls: string[];
    showWishListIndicators: boolean;
    showTrashIndicators: boolean;
}

// ===== Full Settings State =====

export interface SettingsState extends SyncableSettings {
    hasChosenDefaultPage: boolean;

    // Subscription & Sync
    subscriptionTier: SubscriptionTier;
    syncEnabled: boolean;
    lastSyncedAt: string | null;
    isSyncing: boolean;
    syncError: string | null;
    bungieId: string | null; // Used as user identifier for sync
}

export interface SettingsActions {
    // Appearance
    setTheme: (theme: Theme) => void;
    setAccentColor: (color: AccentColor) => void;
    setDefaultPage: (page: DefaultPage) => void;
    setFavouriteHeaderNavItems: (hrefs: string[]) => void;
    toggleFavouriteHeaderNavItem: (href: string) => void;
    setCompactMode: (enabled: boolean) => void;
    setReducedMotion: (enabled: boolean) => void;
    
    // Inventory & Vault
    setIconSize: (size: IconSize) => void;
    setSortMethod: (method: SortMethod) => void;
    setVaultGrouping: (grouping: Partial<VaultGroupingOptions>) => void;
    setShowLockedHighlight: (enabled: boolean) => void;
    setPostmasterWarningThreshold: (threshold: number) => void;

    // Triumphs, Titles & Collections
    setHideCompletedTriumphs: (enabled: boolean) => void;
    setHideInvisibleTriumphs: (enabled: boolean) => void;
    setHideUnobtainableTriumphs: (enabled: boolean) => void;
    setHideAcquiredCollectionItems: (enabled: boolean) => void;
    setHideInvisibleCollectionItems: (enabled: boolean) => void;
    setGroupCollectionItems: (enabled: boolean) => void;
    setGroupTitles: (enabled: boolean) => void;
    setRevealLegacyTitles: (enabled: boolean) => void;
    
    // Activity History
    setDefaultActivityTab: (tab: DefaultTab) => void;
    setHideInvalidReports: (hide: boolean) => void;
    setShowFailedRuns: (display: FailedRunsDisplay) => void;
    
    // Date & Time
    setTimeFormat: (format: TimeFormat) => void;
    setDateFormat: (format: DateFormat) => void;
    
    // Data & Performance
    setCacheDuration: (minutes: number) => void;
    setAutoRefresh: (minutes: number) => void;
    
    // Notifications
    setWeeklyResetReminder: (enabled: boolean) => void;
    setPostmasterWarning: (enabled: boolean) => void;
    
    // Social
    toggleFavoriteMember: (memberId: string) => void;
    
    // Privacy
    setProfileVisibility: (visibility: 'public' | 'clan' | 'private') => void;
    
    // Subscription & Sync
    setSubscriptionTier: (tier: SubscriptionTier) => void;
    setSyncEnabled: (enabled: boolean) => void;
    setBungieId: (id: string | null) => void;
    syncToCloud: () => Promise<void>;
    syncFromCloud: () => Promise<void>;
    
    // Utility
    resetToDefaults: () => void;
    getSyncableSettings: () => SyncableSettings;
    applySyncedSettings: (settings: Partial<SyncableSettings>) => Promise<void>;
}

type SettingsStore = SettingsState & SettingsActions;

// ===== Default Values =====

const DEFAULT_CACHE_DURATION_MINUTES = 1440;
const PREVIOUS_DEFAULT_CACHE_DURATION_MINUTES = 60;
const MIN_CACHE_DURATION_MINUTES = 15;
const MAX_CACHE_DURATION_MINUTES = 1440;

function normalizeCacheDurationMinutes(minutes: number): number {
    if (!Number.isFinite(minutes)) {
        return DEFAULT_CACHE_DURATION_MINUTES;
    }

    const roundedMinutes = Math.round(minutes);
    return Math.min(MAX_CACHE_DURATION_MINUTES, Math.max(MIN_CACHE_DURATION_MINUTES, roundedMinutes));
}

function normalizeFavouriteHeaderNavHrefs(hrefs: string[]): string[] {
    return [...new Set(hrefs.filter(Boolean))];
}

const defaultSyncableSettings: SyncableSettings = {
    // Appearance
    theme: 'dark',
    accentColor: 'gold',
    defaultPage: DEFAULT_PAGE_FALLBACK,
    favouriteHeaderNavHrefs: [...defaultFavouriteHeaderNavHrefs],
    compactMode: false,
    reducedMotion: false,
    
    // Inventory & Vault
    iconSize: 'medium',
    sortMethod: 'power',
    vaultGrouping: { byClass: false, byRarity: false, byAmmoType: false, byTier: false },
    showLockedHighlight: true,
    postmasterWarningThreshold: 18,

    // Triumphs, Titles & Collections
    hideCompletedTriumphs: false,
    hideInvisibleTriumphs: true,
    hideUnobtainableTriumphs: true,
    hideAcquiredCollectionItems: false,
    hideInvisibleCollectionItems: true,
    groupCollectionItems: true,
    groupTitles: false,
    revealLegacyTitles: false,
    
    // Activity History
    defaultActivityTab: 'raids',
    hideInvalidReports: true,
    showFailedRuns: 'always',
    
    // Date & Time
    timeFormat: '12h',
    dateFormat: 'MM/DD/YYYY',
    
    // Data & Performance
    cacheDurationMinutes: DEFAULT_CACHE_DURATION_MINUTES,
    autoRefreshMinutes: 0,
    
    // Notifications
    weeklyResetReminder: false,
    postmasterWarning: true,
    
    // Social
    favoriteMembers: [],
    
    // Privacy
    profileVisibility: 'public',
    
    // Wish Lists
    wishListUrls: [],
    showWishListIndicators: true,
    showTrashIndicators: true,
};

const defaultSettings: SettingsState = {
    ...defaultSyncableSettings,
    hasChosenDefaultPage: false,
    
    // Subscription & Sync
    subscriptionTier: 'free',
    syncEnabled: false,
    lastSyncedAt: null,
    isSyncing: false,
    syncError: null,
    bungieId: null,
};

// ===== Safe Storage Wrapper =====

const safeLocalStorage: StateStorage = {
    getItem: (name) => {
        if (typeof window === 'undefined') return null;
        try {
            return localStorage.getItem(name);
        } catch (e) {
            return null;
        }
    },
    setItem: (name, value) => {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(name, value);
        } catch (e) {
            console.warn('LocalStorage quota exceeded or not available. Settings will not be persisted.', e);
        }
    },
    removeItem: (name) => {
        if (typeof window === 'undefined') return;
        try {
            localStorage.removeItem(name);
        } catch (e) {}
    },
};

// ===== Supabase Client (Browser-side) =====

let supabaseClient: SupabaseClient | null = null;

async function getSupabaseClient(): Promise<SupabaseClient | null> {
    if (typeof window === 'undefined') return null;
    
    if (!supabaseClient) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        if (url && anonKey) {
            const { createClient } = await import('@supabase/supabase-js');
            supabaseClient = createClient(url, anonKey);
        }
    }
    
    return supabaseClient;
}

// ===== Sync Helper Functions =====

async function pushSettingsToCloud(bungieId: string, settings: SyncableSettings): Promise<void> {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available');
    
    const { error } = await supabase
        .from('user_settings')
        .upsert({
            bungie_id: bungieId,
            settings: settings,
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'bungie_id'
        });
    
    if (error) throw error;
}

async function pullSettingsFromCloud(bungieId: string): Promise<SyncableSettings | null> {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available');
    
    const { data, error } = await supabase
        .from('user_settings')
        .select('settings')
        .eq('bungie_id', bungieId)
        .single();
    
    if (error) {
        if (error.code === 'PGRST116') {
            // No rows returned - user has no saved settings
            return null;
        }
        throw error;
    }
    
    return data?.settings as SyncableSettings || null;
}

// ===== Store =====

export const useSettingsStore = create<SettingsStore>()(
    persist(
        (set, get) => ({
            ...defaultSettings,
            
            // Appearance
            setTheme: (theme) => {
                set({ theme });
                get().syncToCloud();
            },
            setAccentColor: (accentColor) => {
                set({ accentColor });
                get().syncToCloud();
            },
            setDefaultPage: (defaultPage) => {
                set({ defaultPage: normalizeDefaultPage(defaultPage), hasChosenDefaultPage: true });
                get().syncToCloud();
            },
            setFavouriteHeaderNavItems: (favouriteHeaderNavHrefs) => {
                set({ favouriteHeaderNavHrefs: normalizeFavouriteHeaderNavHrefs(favouriteHeaderNavHrefs) });
                get().syncToCloud();
            },
            toggleFavouriteHeaderNavItem: (href) => {
                set((state) => {
                    const isFavourite = state.favouriteHeaderNavHrefs.includes(href);
                    return {
                        favouriteHeaderNavHrefs: isFavourite
                            ? state.favouriteHeaderNavHrefs.filter((favouriteHref) => favouriteHref !== href)
                            : [...state.favouriteHeaderNavHrefs, href],
                    };
                });
                get().syncToCloud();
            },
            setCompactMode: (compactMode) => {
                set({ compactMode });
                get().syncToCloud();
            },
            setReducedMotion: (reducedMotion) => {
                set({ reducedMotion });
                get().syncToCloud();
            },
            
            // Inventory & Vault
            setIconSize: (iconSize) => {
                set({ iconSize });
                get().syncToCloud();
            },
            setSortMethod: (sortMethod) => {
                set({ sortMethod });
                get().syncToCloud();
            },
            setVaultGrouping: (grouping) => {
                set((state) => ({ 
                    vaultGrouping: { ...state.vaultGrouping, ...grouping } 
                }));
                get().syncToCloud();
            },
            setShowLockedHighlight: (showLockedHighlight) => {
                set({ showLockedHighlight });
                get().syncToCloud();
            },
            setPostmasterWarningThreshold: (postmasterWarningThreshold) => {
                set({ postmasterWarningThreshold });
                get().syncToCloud();
            },

            // Triumphs, Titles & Collections
            setHideCompletedTriumphs: (hideCompletedTriumphs) => {
                set({ hideCompletedTriumphs });
                get().syncToCloud();
            },
            setHideInvisibleTriumphs: (hideInvisibleTriumphs) => {
                set({ hideInvisibleTriumphs });
                get().syncToCloud();
            },
            setHideUnobtainableTriumphs: (hideUnobtainableTriumphs) => {
                set({ hideUnobtainableTriumphs });
                get().syncToCloud();
            },
            setHideAcquiredCollectionItems: (hideAcquiredCollectionItems) => {
                set({ hideAcquiredCollectionItems });
                get().syncToCloud();
            },
            setHideInvisibleCollectionItems: (hideInvisibleCollectionItems) => {
                set({ hideInvisibleCollectionItems });
                get().syncToCloud();
            },
            setGroupCollectionItems: (groupCollectionItems) => {
                set({ groupCollectionItems });
                get().syncToCloud();
            },
            setGroupTitles: (groupTitles) => {
                set({ groupTitles });
                get().syncToCloud();
            },
            setRevealLegacyTitles: (revealLegacyTitles) => {
                set({ revealLegacyTitles });
                get().syncToCloud();
            },
            
            // Activity History
            setDefaultActivityTab: (defaultActivityTab) => {
                set({ defaultActivityTab });
                get().syncToCloud();
            },
            setHideInvalidReports: (hideInvalidReports) => {
                set({ hideInvalidReports });
                get().syncToCloud();
            },
            setShowFailedRuns: (showFailedRuns) => {
                set({ showFailedRuns });
                get().syncToCloud();
            },
            
            // Date & Time
            setTimeFormat: (timeFormat) => {
                set({ timeFormat });
                get().syncToCloud();
            },
            setDateFormat: (dateFormat) => {
                set({ dateFormat });
                get().syncToCloud();
            },
            
            // Data & Performance
            setCacheDuration: (cacheDurationMinutes) => {
                set({ cacheDurationMinutes: normalizeCacheDurationMinutes(cacheDurationMinutes) });
                get().syncToCloud();
            },
            setAutoRefresh: (autoRefreshMinutes) => {
                set({ autoRefreshMinutes });
                get().syncToCloud();
            },
            
            // Notifications
            setWeeklyResetReminder: (weeklyResetReminder) => {
                set({ weeklyResetReminder });
                get().syncToCloud();
            },
            setPostmasterWarning: (postmasterWarning) => {
                set({ postmasterWarning });
                get().syncToCloud();
            },
            
            // Social
            toggleFavoriteMember: (memberId) => {
                set((state) => {
                    const isFav = state.favoriteMembers.includes(memberId);
                    return {
                        favoriteMembers: isFav 
                            ? state.favoriteMembers.filter(id => id !== memberId)
                            : [...state.favoriteMembers, memberId]
                    };
                });
                get().syncToCloud();
            },
            
            // Privacy
            setProfileVisibility: (profileVisibility) => {
                set({ profileVisibility });
                get().syncToCloud();
            },
            
            // Subscription & Sync
            setSubscriptionTier: (subscriptionTier) => set({ subscriptionTier }),
            setSyncEnabled: (syncEnabled) => set({ syncEnabled }),
            setBungieId: (bungieId) => set({ bungieId }),
            
            syncToCloud: async () => {
                const state = get();
                
                // Only sync if premium and sync is enabled
                if (state.subscriptionTier !== 'premium' || !state.syncEnabled || !state.bungieId) {
                    return;
                }
                
                // Debounce sync calls
                if (state.isSyncing) return;
                
                set({ isSyncing: true, syncError: null });
                
                try {
                    const syncableSettings = get().getSyncableSettings();
                    await pushSettingsToCloud(state.bungieId, syncableSettings);
                    set({ 
                        lastSyncedAt: new Date().toISOString(),
                        isSyncing: false 
                    });
                } catch (error) {
                    console.error('Failed to sync settings to cloud:', error);
                    set({ 
                        syncError: error instanceof Error ? error.message : 'Sync failed',
                        isSyncing: false 
                    });
                }
            },
            
            syncFromCloud: async () => {
                const state = get();
                
                if (state.subscriptionTier !== 'premium' || !state.bungieId) {
                    return;
                }
                
                set({ isSyncing: true, syncError: null });
                
                try {
                    const cloudSettings = await pullSettingsFromCloud(state.bungieId);
                    
                    if (cloudSettings) {
                        await get().applySyncedSettings(cloudSettings);
                        set({ 
                            lastSyncedAt: new Date().toISOString(),
                            syncEnabled: true 
                        });
                    }
                    
                    set({ isSyncing: false });
                } catch (error) {
                    console.error('Failed to sync settings from cloud:', error);
                    set({ 
                        syncError: error instanceof Error ? error.message : 'Sync failed',
                        isSyncing: false 
                    });
                }
            },
            
            // Utility
            resetToDefaults: () => set({ 
                ...defaultSyncableSettings,
                hasChosenDefaultPage: false,
            }),
            
            getSyncableSettings: () => {
                const state = get();
                // Get wishlist settings from wishlist store
                const wishlistState = useWishListStore.getState();
                
                return {
                    theme: state.theme,
                    accentColor: state.accentColor,
                    defaultPage: normalizeDefaultPage(state.defaultPage),
                    favouriteHeaderNavHrefs: normalizeFavouriteHeaderNavHrefs(state.favouriteHeaderNavHrefs),
                    compactMode: state.compactMode,
                    reducedMotion: state.reducedMotion,
                    iconSize: state.iconSize,
                    sortMethod: state.sortMethod,
                    vaultGrouping: state.vaultGrouping,
                    showLockedHighlight: state.showLockedHighlight,
                    postmasterWarningThreshold: state.postmasterWarningThreshold,
                    hideCompletedTriumphs: state.hideCompletedTriumphs,
                    hideInvisibleTriumphs: state.hideInvisibleTriumphs,
                    hideUnobtainableTriumphs: state.hideUnobtainableTriumphs,
                    hideAcquiredCollectionItems: state.hideAcquiredCollectionItems,
                    hideInvisibleCollectionItems: state.hideInvisibleCollectionItems,
                    groupCollectionItems: state.groupCollectionItems,
                    groupTitles: state.groupTitles,
                    revealLegacyTitles: state.revealLegacyTitles,
                    defaultActivityTab: state.defaultActivityTab,
                    hideInvalidReports: state.hideInvalidReports,
                    showFailedRuns: state.showFailedRuns,
                    timeFormat: state.timeFormat,
                    dateFormat: state.dateFormat,
                    cacheDurationMinutes: state.cacheDurationMinutes,
                    autoRefreshMinutes: state.autoRefreshMinutes,
                    weeklyResetReminder: state.weeklyResetReminder,
                    postmasterWarning: state.postmasterWarning,
                    favoriteMembers: state.favoriteMembers,
                    profileVisibility: state.profileVisibility,
                    // Wishlist settings from wishlist store
                    wishListUrls: wishlistState.wishLists.filter(wl => wl.enabled).map(wl => wl.url),
                    showWishListIndicators: wishlistState.showWishListIndicators,
                    showTrashIndicators: wishlistState.showTrashIndicators,
                };
            },
            
            applySyncedSettings: async (settings) => {
                // Apply main settings
                set((state) => ({
                    ...state,
                    ...settings,
                    defaultPage: settings.defaultPage
                        ? normalizeDefaultPage(settings.defaultPage)
                        : state.defaultPage,
                    favouriteHeaderNavHrefs: settings.favouriteHeaderNavHrefs
                        ? normalizeFavouriteHeaderNavHrefs(settings.favouriteHeaderNavHrefs)
                        : state.favouriteHeaderNavHrefs,
                    hasChosenDefaultPage: settings.defaultPage
                        ? true
                        : state.hasChosenDefaultPage,
                    // Remove wishlist fields from main state (they're in wishlist store)
                    wishListUrls: undefined,
                    showWishListIndicators: undefined,
                    showTrashIndicators: undefined,
                }));
                
                // Apply wishlist settings to wishlist store
                if (settings.showWishListIndicators !== undefined) {
                    useWishListStore.getState().setShowWishListIndicators(settings.showWishListIndicators);
                }
                if (settings.showTrashIndicators !== undefined) {
                    useWishListStore.getState().setShowTrashIndicators(settings.showTrashIndicators);
                }
                
                // Sync wishlist URLs - add any missing ones
                if (settings.wishListUrls && settings.wishListUrls.length > 0) {
                    const wishlistStore = useWishListStore.getState();
                    const existingUrls = wishlistStore.wishLists.map(wl => wl.url);
                    
                    for (const url of settings.wishListUrls) {
                        if (!existingUrls.includes(url)) {
                            // Add missing wishlist
                            await wishlistStore.addWishList(url);
                        }
                    }
                }
            },
        }),
        {
            name: 'warmind-settings',
            version: 1,
            migrate: (persistedState, version) => {
                const state = persistedState as Partial<SettingsState>;

                if (version < 1) {
                    const shouldUpgradeDefaultCache =
                        state.cacheDurationMinutes === undefined ||
                        state.cacheDurationMinutes === PREVIOUS_DEFAULT_CACHE_DURATION_MINUTES;

                    if (shouldUpgradeDefaultCache) {
                        state.cacheDurationMinutes = DEFAULT_CACHE_DURATION_MINUTES;
                    }
                }

                return state as SettingsStore;
            },
            storage: createJSONStorage(() => safeLocalStorage),
            partialize: (state) => ({
                // Persist everything except transient sync state
                ...state,
                isSyncing: false,
                syncError: null,
            }),
        }
    )
);

// ===== Helper Hooks for Common Use Cases =====
// Using useShallow to prevent infinite re-renders from object selectors

export const useAppearanceSettings = () => useSettingsStore(
    useShallow((state) => ({
        theme: state.theme,
        accentColor: state.accentColor,
        defaultPage: state.defaultPage,
        compactMode: state.compactMode,
        reducedMotion: state.reducedMotion,
        setTheme: state.setTheme,
        setAccentColor: state.setAccentColor,
        setDefaultPage: state.setDefaultPage,
        setCompactMode: state.setCompactMode,
        setReducedMotion: state.setReducedMotion,
    }))
);

export const useInventorySettings = () => useSettingsStore(
    useShallow((state) => ({
        iconSize: state.iconSize,
        sortMethod: state.sortMethod,
        vaultGrouping: state.vaultGrouping,
        showLockedHighlight: state.showLockedHighlight,
        setIconSize: state.setIconSize,
        setSortMethod: state.setSortMethod,
        setVaultGrouping: state.setVaultGrouping,
        setShowLockedHighlight: state.setShowLockedHighlight,
    }))
);

export const useActivitySettings = () => useSettingsStore(
    useShallow((state) => ({
        defaultActivityTab: state.defaultActivityTab,
        hideInvalidReports: state.hideInvalidReports,
        showFailedRuns: state.showFailedRuns,
        setDefaultActivityTab: state.setDefaultActivityTab,
        setHideInvalidReports: state.setHideInvalidReports,
        setShowFailedRuns: state.setShowFailedRuns,
    }))
);

export const useDateTimeSettings = () => useSettingsStore(
    useShallow((state) => ({
        timeFormat: state.timeFormat,
        dateFormat: state.dateFormat,
        setTimeFormat: state.setTimeFormat,
        setDateFormat: state.setDateFormat,
    }))
);

export const useSyncSettings = () => useSettingsStore(
    useShallow((state) => ({
        subscriptionTier: state.subscriptionTier,
        syncEnabled: state.syncEnabled,
        lastSyncedAt: state.lastSyncedAt,
        isSyncing: state.isSyncing,
        syncError: state.syncError,
        bungieId: state.bungieId,
        setSubscriptionTier: state.setSubscriptionTier,
        setSyncEnabled: state.setSyncEnabled,
        setBungieId: state.setBungieId,
        syncToCloud: state.syncToCloud,
        syncFromCloud: state.syncFromCloud,
    }))
);

// ===== Premium Feature Check =====

export const useIsPremium = () => useSettingsStore((state) => state.subscriptionTier === 'premium');
