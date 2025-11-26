import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
    byTier: boolean;
}

// ===== Syncable Settings Interface =====
// These are the settings that can be synced across devices

export interface SyncableSettings {
    // Appearance
    theme: Theme;
    accentColor: AccentColor;
    compactMode: boolean;
    reducedMotion: boolean;
    
    // Inventory & Vault
    iconSize: IconSize;
    sortMethod: SortMethod;
    vaultGrouping: VaultGroupingOptions;
    showLockedHighlight: boolean;
    postmasterWarningThreshold: number;
    
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
}

// ===== Full Settings State =====

export interface SettingsState extends SyncableSettings {
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
    setCompactMode: (enabled: boolean) => void;
    setReducedMotion: (enabled: boolean) => void;
    
    // Inventory & Vault
    setIconSize: (size: IconSize) => void;
    setSortMethod: (method: SortMethod) => void;
    setVaultGrouping: (grouping: Partial<VaultGroupingOptions>) => void;
    setShowLockedHighlight: (enabled: boolean) => void;
    setPostmasterWarningThreshold: (threshold: number) => void;
    
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
    applySyncedSettings: (settings: Partial<SyncableSettings>) => void;
}

type SettingsStore = SettingsState & SettingsActions;

// ===== Default Values =====

const defaultSyncableSettings: SyncableSettings = {
    // Appearance
    theme: 'dark',
    accentColor: 'gold',
    compactMode: false,
    reducedMotion: false,
    
    // Inventory & Vault
    iconSize: 'medium',
    sortMethod: 'power',
    vaultGrouping: { byClass: false, byRarity: false, byTier: false },
    showLockedHighlight: true,
    postmasterWarningThreshold: 18,
    
    // Activity History
    defaultActivityTab: 'raids',
    hideInvalidReports: true,
    showFailedRuns: 'always',
    
    // Date & Time
    timeFormat: '12h',
    dateFormat: 'MM/DD/YYYY',
    
    // Data & Performance
    cacheDurationMinutes: 60,
    autoRefreshMinutes: 0,
    
    // Notifications
    weeklyResetReminder: false,
    postmasterWarning: true,
    
    // Social
    favoriteMembers: [],
    
    // Privacy
    profileVisibility: 'public',
};

const defaultSettings: SettingsState = {
    ...defaultSyncableSettings,
    
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

function getSupabaseClient(): SupabaseClient | null {
    if (typeof window === 'undefined') return null;
    
    if (!supabaseClient) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        if (url && anonKey) {
            supabaseClient = createClient(url, anonKey);
        }
    }
    
    return supabaseClient;
}

// ===== Sync Helper Functions =====

async function pushSettingsToCloud(bungieId: string, settings: SyncableSettings): Promise<void> {
    const supabase = getSupabaseClient();
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
    const supabase = getSupabaseClient();
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
                set({ cacheDurationMinutes });
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
                        get().applySyncedSettings(cloudSettings);
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
            resetToDefaults: () => set({ ...defaultSyncableSettings }),
            
            getSyncableSettings: () => {
                const state = get();
                return {
                    theme: state.theme,
                    accentColor: state.accentColor,
                    compactMode: state.compactMode,
                    reducedMotion: state.reducedMotion,
                    iconSize: state.iconSize,
                    sortMethod: state.sortMethod,
                    vaultGrouping: state.vaultGrouping,
                    showLockedHighlight: state.showLockedHighlight,
                    postmasterWarningThreshold: state.postmasterWarningThreshold,
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
                };
            },
            
            applySyncedSettings: (settings) => {
                set((state) => ({
                    ...state,
                    ...settings,
                }));
            },
        }),
        {
            name: 'warmind-settings',
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
        compactMode: state.compactMode,
        reducedMotion: state.reducedMotion,
        setTheme: state.setTheme,
        setAccentColor: state.setAccentColor,
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
