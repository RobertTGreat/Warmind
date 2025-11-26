import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { BUCKETS } from '@/lib/destinyUtils';

// ===== Type Definitions =====

export interface LoadoutItem {
    itemHash: number;
    itemInstanceId?: string;
    bucketHash: number;
    socketOverrides?: Record<number, number>; // socketIndex -> plugHash
}

// Fashion/Appearance configuration for a single armor piece
export interface FashionConfig {
    bucketHash: number;
    shaderHash?: number;
    ornamentHash?: number;
}

// Armor mod configuration per slot
export interface ArmorModConfig {
    bucketHash: number;
    mods: Array<{
        socketIndex: number;
        plugHash: number;
        name?: string;
        icon?: string;
    }>;
}

// Subclass configuration with abilities, aspects, and fragments
export interface SubclassConfig {
    itemHash: number;
    itemInstanceId?: string;
    damageType?: number; // 1: Kinetic, 2: Arc, 3: Solar, 4: Void, 5: Prismatic, 6: Stasis, 7: Strand
    super?: { plugHash: number; name?: string; icon?: string };
    abilities?: { 
        melee?: { plugHash: number; name?: string; icon?: string };
        grenade?: { plugHash: number; name?: string; icon?: string };
        classAbility?: { plugHash: number; name?: string; icon?: string };
        movement?: { plugHash: number; name?: string; icon?: string };
    };
    aspects?: Array<{ plugHash: number; name?: string; icon?: string; description?: string; fragmentSlots?: number }>;
    fragments?: Array<{ plugHash: number; name?: string; icon?: string; statBonuses?: Record<string, number> }>;
}

// Stat constraints for optimizer-generated loadouts
export interface StatConstraints {
    minTier?: Record<string, number>; // statHash -> min tier (0-10)
    priority?: string[]; // statHashes in priority order
}

export interface CustomLoadout {
    id: string;
    name: string;
    description?: string;
    notes?: string; // User notes
    classType: number; // 0: Titan, 1: Hunter, 2: Warlock
    icon: string; // Icon path or emoji
    color: string; // Hex color
    items: LoadoutItem[];
    mods?: LoadoutItem[]; // Legacy mods
    armorMods?: ArmorModConfig[]; // Enhanced armor mod configuration
    fashion?: FashionConfig[]; // Shaders and ornaments
    subclass?: LoadoutItem; // Legacy - simple subclass reference
    subclassConfig?: SubclassConfig; // Full subclass configuration
    statConstraints?: StatConstraints; // For optimizer integration
    inGameId?: string; // Link to in-game loadout if applicable
    tags?: string[]; // User tags (e.g., "PvP", "Raid", "GM")
    createdAt: string;
    updatedAt: string;
    // Sharing
    shareId?: string; // Unique share identifier
    isShared?: boolean;
    sharedAt?: string;
    importedFrom?: string; // Source if imported
}

export interface LoadoutState {
    loadouts: CustomLoadout[];
    activeLoadoutId: string | null;
    isEditing: boolean;
    editingLoadout: CustomLoadout | null;
}

export interface LoadoutActions {
    // CRUD Operations
    createLoadout: (loadout: Omit<CustomLoadout, 'id' | 'createdAt' | 'updatedAt'>) => string;
    updateLoadout: (id: string, updates: Partial<CustomLoadout>) => void;
    deleteLoadout: (id: string) => void;
    duplicateLoadout: (id: string) => string;
    
    // Item Management
    addItemToLoadout: (loadoutId: string, item: LoadoutItem) => void;
    removeItemFromLoadout: (loadoutId: string, bucketHash: number) => void;
    setSubclass: (loadoutId: string, subclass: LoadoutItem | null) => void;
    
    // Armor Mods
    setArmorMods: (loadoutId: string, mods: ArmorModConfig[]) => void;
    updateArmorMod: (loadoutId: string, bucketHash: number, mod: ArmorModConfig) => void;
    
    // Fashion/Appearance
    setFashion: (loadoutId: string, fashion: FashionConfig[]) => void;
    updateFashionItem: (loadoutId: string, bucketHash: number, config: Partial<FashionConfig>) => void;
    
    // Subclass Configuration
    setSubclassConfig: (loadoutId: string, config: SubclassConfig | null) => void;
    updateSubclassConfig: (loadoutId: string, updates: Partial<SubclassConfig>) => void;
    
    // Tags
    addTag: (loadoutId: string, tag: string) => void;
    removeTag: (loadoutId: string, tag: string) => void;
    
    // Editing State
    startEditing: (loadout: CustomLoadout | null) => void;
    stopEditing: () => void;
    updateEditingLoadout: (updates: Partial<CustomLoadout>) => void;
    saveEditingLoadout: () => void;
    
    // Helpers
    getLoadoutsByClass: (classType: number) => CustomLoadout[];
    getLoadoutById: (id: string) => CustomLoadout | undefined;
    getLoadoutsWithSubclass: (classType: number) => CustomLoadout[];
    getLoadoutsByTag: (tag: string) => CustomLoadout[];
    
    // Import/Export/Sharing
    importLoadouts: (loadouts: CustomLoadout[]) => void;
    importFromShareCode: (shareCode: string) => CustomLoadout | null;
    exportLoadouts: () => CustomLoadout[];
    exportToShareCode: (loadoutId: string) => string | null;
    generateShareId: (loadoutId: string) => string;
    getLoadoutByShareId: (shareId: string) => CustomLoadout | undefined;
}

type LoadoutStore = LoadoutState & LoadoutActions;

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
            console.warn('LocalStorage quota exceeded or not available.', e);
        }
    },
    removeItem: (name) => {
        if (typeof window === 'undefined') return;
        try {
            localStorage.removeItem(name);
        } catch (e) {}
    },
};

// ===== Default Loadout Template =====

const createDefaultLoadout = (classType: number): Omit<CustomLoadout, 'id' | 'createdAt' | 'updatedAt'> => ({
    name: 'New Loadout',
    classType,
    icon: '⚔️',
    color: '#e3ce62',
    items: [],
});

// ===== Utility Functions =====

const generateId = () => `loadout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Share Code Encoding/Decoding (similar to DIM's approach)
// Uses base64 encoded JSON with compression for shareability

export function encodeLoadoutShareCode(loadout: CustomLoadout): string {
    try {
        // Create a minimal shareable object (strip instance IDs as they're user-specific)
        const shareable = {
            n: loadout.name,
            d: loadout.description,
            c: loadout.classType,
            i: loadout.icon,
            cl: loadout.color,
            it: loadout.items.map((item) => ({
                h: item.itemHash,
                b: item.bucketHash,
                s: item.socketOverrides,
            })),
            am: loadout.armorMods?.map((mod) => ({
                b: mod.bucketHash,
                m: mod.mods.map((m) => ({ si: m.socketIndex, ph: m.plugHash })),
            })),
            f: loadout.fashion?.map((f) => ({
                b: f.bucketHash,
                sh: f.shaderHash,
                o: f.ornamentHash,
            })),
            sc: loadout.subclassConfig ? {
                h: loadout.subclassConfig.itemHash,
                dt: loadout.subclassConfig.damageType,
                su: loadout.subclassConfig.super?.plugHash,
                ab: loadout.subclassConfig.abilities ? {
                    m: loadout.subclassConfig.abilities.melee?.plugHash,
                    g: loadout.subclassConfig.abilities.grenade?.plugHash,
                    c: loadout.subclassConfig.abilities.classAbility?.plugHash,
                    mv: loadout.subclassConfig.abilities.movement?.plugHash,
                } : undefined,
                as: loadout.subclassConfig.aspects?.map((a) => a.plugHash),
                fr: loadout.subclassConfig.fragments?.map((f) => f.plugHash),
            } : undefined,
            t: loadout.tags,
            nt: loadout.notes,
        };
        
        const json = JSON.stringify(shareable);
        // Use base64 encoding
        if (typeof window !== 'undefined') {
            return btoa(encodeURIComponent(json));
        }
        return Buffer.from(json).toString('base64');
    } catch (e) {
        console.error('Failed to encode loadout:', e);
        return '';
    }
}

export function decodeLoadoutShareCode(code: string): Omit<CustomLoadout, 'id' | 'createdAt' | 'updatedAt'> | null {
    try {
        let json: string;
        if (typeof window !== 'undefined') {
            json = decodeURIComponent(atob(code));
        } else {
            json = Buffer.from(code, 'base64').toString('utf-8');
        }
        
        const data = JSON.parse(json);
        
        // Reconstruct the full loadout object
        const loadout: Omit<CustomLoadout, 'id' | 'createdAt' | 'updatedAt'> = {
            name: data.n || 'Imported Loadout',
            description: data.d,
            classType: data.c ?? 0,
            icon: data.i || '⚔️',
            color: data.cl || '#e3ce62',
            items: (data.it || []).map((item: any) => ({
                itemHash: item.h,
                bucketHash: item.b,
                socketOverrides: item.s,
            })),
            armorMods: data.am?.map((mod: any) => ({
                bucketHash: mod.b,
                mods: mod.m?.map((m: any) => ({
                    socketIndex: m.si,
                    plugHash: m.ph,
                })) || [],
            })),
            fashion: data.f?.map((f: any) => ({
                bucketHash: f.b,
                shaderHash: f.sh,
                ornamentHash: f.o,
            })),
            subclassConfig: data.sc ? {
                itemHash: data.sc.h,
                damageType: data.sc.dt,
                super: data.sc.su ? { plugHash: data.sc.su } : undefined,
                abilities: data.sc.ab ? {
                    melee: data.sc.ab.m ? { plugHash: data.sc.ab.m } : undefined,
                    grenade: data.sc.ab.g ? { plugHash: data.sc.ab.g } : undefined,
                    classAbility: data.sc.ab.c ? { plugHash: data.sc.ab.c } : undefined,
                    movement: data.sc.ab.mv ? { plugHash: data.sc.ab.mv } : undefined,
                } : undefined,
                aspects: data.sc.as?.map((h: number) => ({ plugHash: h })),
                fragments: data.sc.fr?.map((h: number) => ({ plugHash: h })),
            } : undefined,
            tags: data.t,
            notes: data.nt,
        };
        
        return loadout;
    } catch (e) {
        console.error('Failed to decode share code:', e);
        return null;
    }
}

// ===== Store =====

export const useLoadoutStore = create<LoadoutStore>()(
    persist(
        (set, get) => ({
            loadouts: [],
            activeLoadoutId: null,
            isEditing: false,
            editingLoadout: null,
            
            // CRUD Operations
            createLoadout: (loadoutData) => {
                const id = generateId();
                const now = new Date().toISOString();
                
                const newLoadout: CustomLoadout = {
                    ...loadoutData,
                    id,
                    createdAt: now,
                    updatedAt: now,
                };
                
                set((state) => ({
                    loadouts: [...state.loadouts, newLoadout],
                }));
                
                return id;
            },
            
            updateLoadout: (id, updates) => {
                set((state) => ({
                    loadouts: state.loadouts.map((loadout) =>
                        loadout.id === id
                            ? { ...loadout, ...updates, updatedAt: new Date().toISOString() }
                            : loadout
                    ),
                }));
            },
            
            deleteLoadout: (id) => {
                set((state) => ({
                    loadouts: state.loadouts.filter((loadout) => loadout.id !== id),
                    activeLoadoutId: state.activeLoadoutId === id ? null : state.activeLoadoutId,
                }));
            },
            
            duplicateLoadout: (id) => {
                const original = get().loadouts.find((l) => l.id === id);
                if (!original) return '';
                
                const newId = generateId();
                const now = new Date().toISOString();
                
                const duplicated: CustomLoadout = {
                    ...original,
                    id: newId,
                    name: `${original.name} (Copy)`,
                    createdAt: now,
                    updatedAt: now,
                };
                
                set((state) => ({
                    loadouts: [...state.loadouts, duplicated],
                }));
                
                return newId;
            },
            
            // Item Management
            addItemToLoadout: (loadoutId, item) => {
                set((state) => ({
                    loadouts: state.loadouts.map((loadout) => {
                        if (loadout.id !== loadoutId) return loadout;
                        
                        // Replace item in same bucket or add new
                        const existingIndex = loadout.items.findIndex(
                            (i) => i.bucketHash === item.bucketHash
                        );
                        
                        const newItems = existingIndex >= 0
                            ? loadout.items.map((i, idx) => idx === existingIndex ? item : i)
                            : [...loadout.items, item];
                        
                        return {
                            ...loadout,
                            items: newItems,
                            updatedAt: new Date().toISOString(),
                        };
                    }),
                }));
            },
            
            removeItemFromLoadout: (loadoutId, bucketHash) => {
                set((state) => ({
                    loadouts: state.loadouts.map((loadout) => {
                        if (loadout.id !== loadoutId) return loadout;
                        
                        return {
                            ...loadout,
                            items: loadout.items.filter((i) => i.bucketHash !== bucketHash),
                            updatedAt: new Date().toISOString(),
                        };
                    }),
                }));
            },
            
            setSubclass: (loadoutId, subclass) => {
                set((state) => ({
                    loadouts: state.loadouts.map((loadout) =>
                        loadout.id === loadoutId
                            ? { ...loadout, subclass: subclass || undefined, updatedAt: new Date().toISOString() }
                            : loadout
                    ),
                }));
            },
            
            // Armor Mods
            setArmorMods: (loadoutId, mods) => {
                set((state) => ({
                    loadouts: state.loadouts.map((loadout) =>
                        loadout.id === loadoutId
                            ? { ...loadout, armorMods: mods, updatedAt: new Date().toISOString() }
                            : loadout
                    ),
                }));
            },
            
            updateArmorMod: (loadoutId, bucketHash, mod) => {
                set((state) => ({
                    loadouts: state.loadouts.map((loadout) => {
                        if (loadout.id !== loadoutId) return loadout;
                        const existingMods = loadout.armorMods || [];
                        const existingIdx = existingMods.findIndex((m) => m.bucketHash === bucketHash);
                        const newMods = existingIdx >= 0
                            ? existingMods.map((m, idx) => (idx === existingIdx ? mod : m))
                            : [...existingMods, mod];
                        return { ...loadout, armorMods: newMods, updatedAt: new Date().toISOString() };
                    }),
                }));
            },
            
            // Fashion/Appearance
            setFashion: (loadoutId, fashion) => {
                set((state) => ({
                    loadouts: state.loadouts.map((loadout) =>
                        loadout.id === loadoutId
                            ? { ...loadout, fashion, updatedAt: new Date().toISOString() }
                            : loadout
                    ),
                }));
            },
            
            updateFashionItem: (loadoutId, bucketHash, config) => {
                set((state) => ({
                    loadouts: state.loadouts.map((loadout) => {
                        if (loadout.id !== loadoutId) return loadout;
                        const existingFashion = loadout.fashion || [];
                        const existingIdx = existingFashion.findIndex((f) => f.bucketHash === bucketHash);
                        
                        if (existingIdx >= 0) {
                            const newFashion = existingFashion.map((f, idx) => 
                                idx === existingIdx ? { ...f, ...config } : f
                            );
                            return { ...loadout, fashion: newFashion, updatedAt: new Date().toISOString() };
                        } else {
                            return { 
                                ...loadout, 
                                fashion: [...existingFashion, { bucketHash, ...config }],
                                updatedAt: new Date().toISOString() 
                            };
                        }
                    }),
                }));
            },
            
            // Subclass Configuration
            setSubclassConfig: (loadoutId, config) => {
                set((state) => ({
                    loadouts: state.loadouts.map((loadout) =>
                        loadout.id === loadoutId
                            ? { ...loadout, subclassConfig: config || undefined, updatedAt: new Date().toISOString() }
                            : loadout
                    ),
                }));
            },
            
            updateSubclassConfig: (loadoutId, updates) => {
                set((state) => ({
                    loadouts: state.loadouts.map((loadout) => {
                        if (loadout.id !== loadoutId || !loadout.subclassConfig) return loadout;
                        return {
                            ...loadout,
                            subclassConfig: { ...loadout.subclassConfig, ...updates },
                            updatedAt: new Date().toISOString(),
                        };
                    }),
                }));
            },
            
            // Tags
            addTag: (loadoutId, tag) => {
                set((state) => ({
                    loadouts: state.loadouts.map((loadout) => {
                        if (loadout.id !== loadoutId) return loadout;
                        const tags = loadout.tags || [];
                        if (tags.includes(tag)) return loadout;
                        return { ...loadout, tags: [...tags, tag], updatedAt: new Date().toISOString() };
                    }),
                }));
            },
            
            removeTag: (loadoutId, tag) => {
                set((state) => ({
                    loadouts: state.loadouts.map((loadout) => {
                        if (loadout.id !== loadoutId) return loadout;
                        return { 
                            ...loadout, 
                            tags: (loadout.tags || []).filter((t) => t !== tag),
                            updatedAt: new Date().toISOString() 
                        };
                    }),
                }));
            },
            
            // Editing State
            startEditing: (loadout) => {
                set({
                    isEditing: true,
                    editingLoadout: loadout ? { ...loadout } : null,
                });
            },
            
            stopEditing: () => {
                set({
                    isEditing: false,
                    editingLoadout: null,
                });
            },
            
            updateEditingLoadout: (updates) => {
                set((state) => ({
                    editingLoadout: state.editingLoadout
                        ? { ...state.editingLoadout, ...updates }
                        : null,
                }));
            },
            
            saveEditingLoadout: () => {
                const { editingLoadout } = get();
                if (!editingLoadout) return;
                
                const exists = get().loadouts.some((l) => l.id === editingLoadout.id);
                
                if (exists) {
                    get().updateLoadout(editingLoadout.id, editingLoadout);
                } else {
                    const now = new Date().toISOString();
                    set((state) => ({
                        loadouts: [...state.loadouts, { ...editingLoadout, createdAt: now, updatedAt: now }],
                    }));
                }
                
                set({ isEditing: false, editingLoadout: null });
            },
            
            // Helpers
            getLoadoutsByClass: (classType) => {
                return get().loadouts.filter((l) => l.classType === classType);
            },
            
            getLoadoutById: (id) => {
                return get().loadouts.find((l) => l.id === id);
            },
            
            getLoadoutsWithSubclass: (classType) => {
                return get().loadouts.filter(
                    (l) => l.classType === classType && (l.subclassConfig || l.subclass)
                );
            },
            
            getLoadoutsByTag: (tag) => {
                return get().loadouts.filter((l) => l.tags?.includes(tag));
            },
            
            // Import/Export/Sharing
            importLoadouts: (loadouts) => {
                set((state) => ({
                    loadouts: [
                        ...state.loadouts,
                        ...loadouts.map((l) => ({
                            ...l,
                            id: generateId(),
                            importedFrom: l.shareId || 'external',
                            shareId: undefined, // Clear share ID on import
                            isShared: false,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                        })),
                    ],
                }));
            },
            
            importFromShareCode: (shareCode) => {
                try {
                    const decoded = decodeLoadoutShareCode(shareCode);
                    if (!decoded) return null;
                    
                    const id = generateId();
                    const now = new Date().toISOString();
                    
                    const newLoadout: CustomLoadout = {
                        ...decoded,
                        id,
                        importedFrom: shareCode.slice(0, 8),
                        shareId: undefined,
                        isShared: false,
                        createdAt: now,
                        updatedAt: now,
                    };
                    
                    set((state) => ({
                        loadouts: [...state.loadouts, newLoadout],
                    }));
                    
                    return newLoadout;
                } catch (e) {
                    console.error('Failed to import from share code:', e);
                    return null;
                }
            },
            
            exportLoadouts: () => get().loadouts,
            
            exportToShareCode: (loadoutId) => {
                const loadout = get().loadouts.find((l) => l.id === loadoutId);
                if (!loadout) return null;
                return encodeLoadoutShareCode(loadout);
            },
            
            generateShareId: (loadoutId) => {
                const shareId = `WM${Date.now().toString(36)}${Math.random().toString(36).substr(2, 6)}`.toUpperCase();
                
                set((state) => ({
                    loadouts: state.loadouts.map((loadout) =>
                        loadout.id === loadoutId
                            ? { ...loadout, shareId, isShared: true, sharedAt: new Date().toISOString() }
                            : loadout
                    ),
                }));
                
                return shareId;
            },
            
            getLoadoutByShareId: (shareId) => {
                return get().loadouts.find((l) => l.shareId === shareId);
            },
        }),
        {
            name: 'warmind-loadouts',
            storage: createJSONStorage(() => safeLocalStorage),
        }
    )
);

// ===== Bucket Configuration for Loadouts =====

export const LOADOUT_BUCKETS = {
    weapons: [
        { hash: BUCKETS.KINETIC_WEAPON, name: 'Kinetic', icon: '🔫' },
        { hash: BUCKETS.ENERGY_WEAPON, name: 'Energy', icon: '⚡' },
        { hash: BUCKETS.POWER_WEAPON, name: 'Power', icon: '💥' },
    ],
    armor: [
        { hash: BUCKETS.HELMET, name: 'Helmet', icon: '🪖' },
        { hash: BUCKETS.GAUNTLETS, name: 'Gauntlets', icon: '🧤' },
        { hash: BUCKETS.CHEST_ARMOR, name: 'Chest', icon: '🦺' },
        { hash: BUCKETS.LEG_ARMOR, name: 'Legs', icon: '👖' },
        { hash: BUCKETS.CLASS_ARMOR, name: 'Class', icon: '🎗️' },
    ],
};

export const LOADOUT_ICONS = [
    '⚔️', '🗡️', '🛡️', '🏹', '🔥', '❄️', '⚡', '💜', '💚', 
    '🌟', '💀', '👁️', '🎯', '💎', '🌙', '☀️', '🌊', '🍃',
    '🐺', '🦅', '🐍', '🦁', '🔮', '⭐', '🎮', '🏆',
];

export const LOADOUT_COLORS = [
    '#e3ce62', // Gold
    '#9b59b6', // Void Purple
    '#e74c3c', // Solar Red
    '#3498db', // Arc Blue
    '#2ecc71', // Strand Green
    '#1abc9c', // Stasis Teal
    '#f39c12', // Orange
    '#95a5a6', // Gray
    '#ffffff', // White
];

// Preset tags for organizing loadouts (similar to DIM)
export const LOADOUT_TAGS = [
    'PvE',
    'PvP',
    'Raid',
    'Dungeon',
    'Nightfall',
    'GM',
    'Gambit',
    'Trials',
    'Iron Banner',
    'Farming',
    'Fashion',
    'Build',
    'Exotic',
    'Movement',
    'DPS',
    'Support',
    'Add Clear',
    'Boss',
    'Survival',
];

// Damage type icons/colors for subclass display
export const DAMAGE_TYPES: Record<number, { name: string; color: string; icon: string; apiIcon?: string }> = {
    1: { name: 'Kinetic', color: '#ffffff', icon: '⚪' },
    2: { name: 'Arc', color: '#7bade3', icon: '⚡', apiIcon: 'https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_092d066688b879c807c3b460afdd61e6.png' },
    3: { name: 'Solar', color: '#f2721b', icon: '🔥', apiIcon: 'https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_2a1773e10968f2d088b97c22b22bba9e.png' },
    4: { name: 'Void', color: '#b185df', icon: '💜', apiIcon: 'https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_ceb2f6197dccf3958bb31cc783eb97a0.png' },
    5: { name: 'Prismatic', color: '#ffffff', icon: '🌈', apiIcon: 'https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_b9c5a3f0c98bc973e8e507e2d9b31c5e.png' },
    6: { name: 'Stasis', color: '#4d88ff', icon: '❄️', apiIcon: 'https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_530c4c3e7981dc2aefd24fd3293482bf.png' },
    7: { name: 'Strand', color: '#35d378', icon: '💚', apiIcon: 'https://www.bungie.net/common/destiny2_content/icons/DestinyDamageTypeDefinition_b2fe51a94f3533f97079dfa0d27a4096.png' },
};

// Helper to generate a shareable URL
export function getLoadoutShareUrl(shareCode: string): string {
    if (typeof window !== 'undefined') {
        return `${window.location.origin}/character/loadouts?import=${encodeURIComponent(shareCode)}`;
    }
    return `/character/loadouts?import=${encodeURIComponent(shareCode)}`;
}


