import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { getFromDB, setInDB, deleteFromDB } from '@/lib/indexedDB';

// ===== Type Definitions =====

export interface WishListRoll {
    itemHash: number;
    perkHashes: number[]; // Empty array means any roll of this item
    isTrash: boolean;
    notes?: string;
    tags?: string[];
}

export interface WishList {
    id: string;
    url: string;
    title: string;
    description?: string;
    rolls: Map<number, WishListRoll[]>; // Keyed by itemHash for fast lookup
    lastUpdated: string;
    enabled: boolean;
    rollCount: number;
    trashRollCount: number;
}

export interface WishListState {
    // Wish lists
    wishLists: WishList[];
    
    // Loading state
    isLoading: boolean;
    loadingUrl: string | null;
    error: string | null;
    
    // Settings
    showWishListIndicators: boolean;
    showTrashIndicators: boolean;
    
    // Computed lookup map (built from all enabled wish lists)
    wishListLookup: Map<number, WishListRoll[]>;
    trashListLookup: Map<number, WishListRoll[]>;
}

export interface WishListActions {
    // Wish list management
    addWishList: (url: string) => Promise<void>;
    removeWishList: (id: string) => Promise<void>;
    toggleWishList: (id: string) => void;
    refreshWishList: (id: string) => Promise<void>;
    refreshAllWishLists: () => Promise<void>;
    updateWishListRolls: (id: string, rolls: Map<number, WishListRoll[]>) => void;
    
    // Settings
    setShowWishListIndicators: (show: boolean) => void;
    setShowTrashIndicators: (show: boolean) => void;
    
    // Lookup methods
    getWishListInfo: (itemHash: number, perkHashes?: number[]) => { 
        isWishListed: boolean; 
        isTrash: boolean; 
        notes?: string;
        tags?: string[];
        matchType: 'exact' | 'partial' | 'item' | 'none';
        matchedPerkHashes: number[]; // Perks that matched the wish list
    };
    
    // Internal
    rebuildLookups: () => void;
}

type WishListStore = WishListState & WishListActions;

// ===== Default Values =====

const defaultState: WishListState = {
    wishLists: [],
    isLoading: false,
    loadingUrl: null,
    error: null,
    showWishListIndicators: true,
    showTrashIndicators: true,
    wishListLookup: new Map(),
    trashListLookup: new Map(),
};

// ===== Default Wish Lists =====

export const DEFAULT_WISH_LIST_URL = 'https://raw.githubusercontent.com/48klocs/dim-wish-list-sources/master/voltron.txt';

// Popular community wish lists
export interface PresetWishList {
    id: string;
    name: string;
    description: string;
    url: string;
    author?: string;
}

export const PRESET_WISH_LISTS: PresetWishList[] = [
    {
        id: 'voltron',
        name: 'Voltron (Default)',
        description: 'The default DIM wish list - a compilation of god rolls from top community minds including Mercules904, PandaPaxxy, and more.',
        url: 'https://raw.githubusercontent.com/48klocs/dim-wish-list-sources/master/voltron.txt',
        author: '48klocs & Community'
    },
    {
        id: 'choosy-voltron',
        name: 'Choosy Voltron',
        description: 'Voltron with additional opinionated trash rolls added in. More aggressive about marking bad rolls.',
        url: 'https://raw.githubusercontent.com/48klocs/dim-wish-list-sources/master/choosy_voltron.txt',
        author: '48klocs & Community'
    },
    {
        id: 'pandapaxxy-pvp',
        name: 'PandaPaxxy PvP',
        description: 'Curated PvP-focused weapon rolls from the Massive Breakdowns community.',
        url: 'https://raw.githubusercontent.com/48klocs/dim-wish-list-sources/master/PandaPaxxy/pandapaxxy_pvp.txt',
        author: 'PandaPaxxy'
    },
    {
        id: 'pandapaxxy-pve',
        name: 'PandaPaxxy PvE',
        description: 'Curated PvE-focused weapon rolls from the Massive Breakdowns community.',
        url: 'https://raw.githubusercontent.com/48klocs/dim-wish-list-sources/master/PandaPaxxy/pandapaxxy_pve.txt',
        author: 'PandaPaxxy'
    },
    {
        id: 'yeezygt',
        name: 'YeezyGT',
        description: 'Comprehensive wish list from popular content creator YeezyGT.',
        url: 'https://raw.githubusercontent.com/48klocs/dim-wish-list-sources/master/YeezyGT/YeezyGT.txt',
        author: 'YeezyGT'
    },
    {
        id: 'ayyitschevy',
        name: 'AyyItsChevy',
        description: 'Curated rolls from content creator Chevy.',
        url: 'https://raw.githubusercontent.com/48klocs/dim-wish-list-sources/master/AyyItsChevy/chevy_list.txt',
        author: 'AyyItsChevy'
    },
    {
        id: 'justanotherteam',
        name: 'Just Another Team',
        description: 'Roll recommendations from Azared, Alpharius and BeenLab - comprehensive picks for both PvE and PvP.',
        url: 'https://raw.githubusercontent.com/dsf000z/JAT-wishlists-bundler/main/bundles/DIM-strict/just-another-team-mnk.txt',
        author: 'Azared, Alpharius & BeenLab'
    },
];

// ===== IndexedDB Helpers for Wishlist Rolls =====

const WISHLIST_ROLLS_PREFIX = 'wishlist_rolls_';

async function saveRollsToIndexedDB(wishListId: string, rolls: Map<number, WishListRoll[]>): Promise<void> {
    // Convert Map to array for serialization
    const rollsArray = Array.from(rolls.entries());
    await setInDB(`${WISHLIST_ROLLS_PREFIX}${wishListId}`, rollsArray);
}

async function loadRollsFromIndexedDB(wishListId: string): Promise<Map<number, WishListRoll[]> | null> {
    const rollsArray = await getFromDB<[number, WishListRoll[]][]>(`${WISHLIST_ROLLS_PREFIX}${wishListId}`);
    if (!rollsArray) return null;
    return new Map(rollsArray);
}

async function deleteRollsFromIndexedDB(wishListId: string): Promise<void> {
    await deleteFromDB(`${WISHLIST_ROLLS_PREFIX}${wishListId}`);
}

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

// ===== Enhanced to Base Perk Mapping =====
// Enhanced perks have different hashes but should match their base versions
// This maps enhanced perk hashes to their base versions for wishlist matching
const ENHANCED_TO_BASE_PERK_MAP: Record<number, number> = {
    // Damage/Trait Perks
    3744057135: 3078487919, // Enhanced Bait and Switch -> Bait and Switch
    1563455254: 3418782618, // Enhanced Rewind Rounds -> Rewind Rounds
    
    // Add more common enhanced perks here
    // Format: enhancedHash: baseHash
    
    // Firing Line
    4094100260: 1771339417, // Enhanced Firing Line -> Firing Line
    
    // Vorpal Weapon
    2723159620: 1546637391, // Enhanced Vorpal Weapon -> Vorpal Weapon
    
    // Frenzy  
    243326113: 4104185692, // Enhanced Frenzy -> Frenzy
    
    // Fourth Time's the Charm
    3557516320: 1354429876, // Enhanced Fourth Time's -> Fourth Time's the Charm
    
    // Triple Tap
    2190027472: 3400784728, // Enhanced Triple Tap -> Triple Tap
    
    // Overflow
    3048851909: 3643424744, // Enhanced Overflow -> Overflow
    
    // Rampage
    1853616089: 3425386926, // Enhanced Rampage -> Rampage
    
    // Kill Clip
    3656557598: 1015611457, // Enhanced Kill Clip -> Kill Clip
    
    // Demolitionist
    4285249471: 3523296417, // Enhanced Demolitionist -> Demolitionist
    
    // Surrounded
    3114718539: 3708227201, // Enhanced Surrounded -> Surrounded
    
    // Explosive Payload
    1529143571: 3038247973, // Enhanced Explosive Payload -> Explosive Payload
    
    // One for All
    1986147658: 4049631843, // Enhanced One for All -> One for All
    
    // Swashbuckler  
    1548876013: 4082225868, // Enhanced Swashbuckler -> Swashbuckler
    
    // Incandescent
    3195606601: 4293542123, // Enhanced Incandescent -> Incandescent
    
    // Voltshot
    1000556632: 2173046394, // Enhanced Voltshot -> Voltshot
};

// Helper function to get the base perk hash for matching
function getBasePerkHash(perkHash: number): number {
    return ENHANCED_TO_BASE_PERK_MAP[perkHash] || perkHash;
}

// ===== Wish List Parser =====

interface ParsedWishList {
    title: string;
    description?: string;
    rolls: WishListRoll[];
}

function parseWishListText(text: string): ParsedWishList {
    const lines = text.split('\n');
    const rolls: WishListRoll[] = [];
    let title = 'Imported Wish List';
    let description: string | undefined;
    let currentNotes: string | undefined;
    let currentTags: string[] = [];
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip empty lines
        if (!trimmed) {
            currentNotes = undefined;
            currentTags = [];
            continue;
        }
        
        // Parse title
        if (trimmed.startsWith('title:')) {
            title = trimmed.substring(6).trim();
            continue;
        }
        
        // Parse description
        if (trimmed.startsWith('description:')) {
            description = trimmed.substring(12).trim();
            continue;
        }
        
        // Parse notes comment (//notes: format)
        // Notes can also contain tags at the end: //notes: some notes tags:pve
        if (trimmed.startsWith('//notes:')) {
            let noteContent = trimmed.substring(8).trim();
            
            // Check for tags embedded in notes (e.g., "notes text tags:pve,pvp")
            const tagsMatch = noteContent.match(/\s+tags:([^\s]+)$/i);
            if (tagsMatch) {
                noteContent = noteContent.substring(0, noteContent.length - tagsMatch[0].length).trim();
                currentTags = tagsMatch[1].split(/[,\s]+/).filter(t => t.length > 0);
            }
            
            currentNotes = noteContent;
            continue;
        }
        
        // Parse standalone tags line (tags:pve or tags:pvp,pve format)
        if (trimmed.startsWith('tags:')) {
            const tagsPart = trimmed.substring(5).trim();
            currentTags = tagsPart.split(/[,\s]+/).filter(t => t.length > 0);
            continue;
        }
        
        // Skip regular comments
        if (trimmed.startsWith('//')) {
            continue;
        }
        
        // Parse wish list entries
        // Format: dimwishlist:item=HASH or dimwishlist:item=HASH&perks=PERK1,PERK2,PERK3,PERK4
        // Negative hash = trash roll
        // Can also have #notes: at the end
        if (trimmed.startsWith('dimwishlist:item=')) {
            const entry = trimmed.substring(17);
            
            // Extract inline notes if present
            let entryPart = entry;
            let inlineNotes: string | undefined;
            const notesIndex = entry.indexOf('#notes:');
            if (notesIndex !== -1) {
                entryPart = entry.substring(0, notesIndex);
                inlineNotes = entry.substring(notesIndex + 7).trim();
            }
            
            // Extract inline tags if present (|tags: format)
            let tags: string[] = [...currentTags];
            const tagsIndex = entryPart.indexOf('|tags:');
            if (tagsIndex !== -1) {
                const tagsPart = entryPart.substring(tagsIndex + 6).trim();
                tags = tagsPart.split(/[,\s]+/).filter(t => t.length > 0);
                entryPart = entryPart.substring(0, tagsIndex);
            }
            
            // Parse item hash and perks
            const parts = entryPart.split('&');
            let itemHashStr = parts[0];
            let perkHashes: number[] = [];
            
            // Check for perks
            if (parts.length > 1) {
                const perksPart = parts.find(p => p.startsWith('perks='));
                if (perksPart) {
                    const perksStr = perksPart.substring(6);
                    perkHashes = perksStr.split(',')
                        .map(p => parseInt(p.trim(), 10))
                        .filter(p => !isNaN(p) && p !== 0);
                }
            }
            
            // Parse item hash (negative = trash)
            const itemHash = parseInt(itemHashStr, 10);
            if (isNaN(itemHash)) continue;
            
            const isTrash = itemHash < 0;
            const actualHash = Math.abs(itemHash);
            
            rolls.push({
                itemHash: actualHash,
                perkHashes,
                isTrash,
                notes: inlineNotes || currentNotes,
                tags: tags.length > 0 ? tags : undefined,
            });
        }
    }
    
    return { title, description, rolls };
}

// ===== Store =====

export const useWishListStore = create<WishListStore>()(
    persist(
        (set, get) => ({
            ...defaultState,
            
            addWishList: async (url: string) => {
                const state = get();
                
                // Check if already added
                if (state.wishLists.some(wl => wl.url === url)) {
                    set({ error: 'This wish list is already added' });
                    return;
                }
                
                set({ isLoading: true, loadingUrl: url, error: null });
                
                try {
                    const response = await fetch(url);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch wish list: ${response.statusText}`);
                    }
                    
                    const text = await response.text();
                    const parsed = parseWishListText(text);
                    
                    // Build rolls map
                    const rollsMap = new Map<number, WishListRoll[]>();
                    let trashCount = 0;
                    
                    for (const roll of parsed.rolls) {
                        const existing = rollsMap.get(roll.itemHash) || [];
                        existing.push(roll);
                        rollsMap.set(roll.itemHash, existing);
                        if (roll.isTrash) trashCount++;
                    }
                    
                    const wishList: WishList = {
                        id: crypto.randomUUID(),
                        url,
                        title: parsed.title,
                        description: parsed.description,
                        rolls: rollsMap,
                        lastUpdated: new Date().toISOString(),
                        enabled: true,
                        rollCount: parsed.rolls.length - trashCount,
                        trashRollCount: trashCount,
                    };
                    
                    // Save rolls to IndexedDB
                    await saveRollsToIndexedDB(wishList.id, rollsMap);
                    
                    set(state => ({
                        wishLists: [...state.wishLists, wishList],
                        isLoading: false,
                        loadingUrl: null,
                    }));
                    
                    get().rebuildLookups();
                } catch (error) {
                    set({ 
                        isLoading: false, 
                        loadingUrl: null,
                        error: error instanceof Error ? error.message : 'Failed to load wish list'
                    });
                }
            },
            
            removeWishList: async (id: string) => {
                // Delete rolls from IndexedDB
                await deleteRollsFromIndexedDB(id);
                
                set(state => ({
                    wishLists: state.wishLists.filter(wl => wl.id !== id)
                }));
                get().rebuildLookups();
            },
            
            toggleWishList: (id: string) => {
                set(state => ({
                    wishLists: state.wishLists.map(wl => 
                        wl.id === id ? { ...wl, enabled: !wl.enabled } : wl
                    )
                }));
                get().rebuildLookups();
            },
            
            refreshWishList: async (id: string) => {
                const state = get();
                const wishList = state.wishLists.find(wl => wl.id === id);
                if (!wishList) return;
                
                set({ isLoading: true, loadingUrl: wishList.url, error: null });
                
                try {
                    const response = await fetch(wishList.url);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch wish list: ${response.statusText}`);
                    }
                    
                    const text = await response.text();
                    const parsed = parseWishListText(text);
                    
                    // Build rolls map
                    const rollsMap = new Map<number, WishListRoll[]>();
                    let trashCount = 0;
                    
                    for (const roll of parsed.rolls) {
                        const existing = rollsMap.get(roll.itemHash) || [];
                        existing.push(roll);
                        rollsMap.set(roll.itemHash, existing);
                        if (roll.isTrash) trashCount++;
                    }
                    
                    // Save rolls to IndexedDB
                    await saveRollsToIndexedDB(id, rollsMap);
                    
                    set(state => ({
                        wishLists: state.wishLists.map(wl => 
                            wl.id === id ? {
                                ...wl,
                                title: parsed.title,
                                description: parsed.description,
                                rolls: rollsMap,
                                lastUpdated: new Date().toISOString(),
                                rollCount: parsed.rolls.length - trashCount,
                                trashRollCount: trashCount,
                            } : wl
                        ),
                        isLoading: false,
                        loadingUrl: null,
                    }));
                    
                    get().rebuildLookups();
                } catch (error) {
                    set({ 
                        isLoading: false, 
                        loadingUrl: null,
                        error: error instanceof Error ? error.message : 'Failed to refresh wish list'
                    });
                }
            },
            
            refreshAllWishLists: async () => {
                const state = get();
                for (const wishList of state.wishLists) {
                    await get().refreshWishList(wishList.id);
                }
            },
            
            setShowWishListIndicators: (show: boolean) => {
                set({ showWishListIndicators: show });
            },
            
            setShowTrashIndicators: (show: boolean) => {
                set({ showTrashIndicators: show });
            },
            
            getWishListInfo: (itemHash: number, perkHashes?: number[]) => {
                const state = get();
                
                if (!state.showWishListIndicators && !state.showTrashIndicators) {
                    return { isWishListed: false, isTrash: false, matchType: 'none' as const, matchedPerkHashes: [] };
                }
                
                // Check wish lists
                const wishRolls = state.wishListLookup.get(itemHash);
                const trashRolls = state.trashListLookup.get(itemHash);
                
                let isWishListed = false;
                let isTrash = false;
                let notes: string | undefined;
                let tags: string[] | undefined;
                let matchType: 'exact' | 'partial' | 'item' | 'none' = 'none';
                let matchedPerkHashes: number[] = [];
                
                // Check wish list rolls
                if (wishRolls && state.showWishListIndicators) {
                    for (const roll of wishRolls) {
                        // If roll has no perks, it's a "keep any" roll
                        if (roll.perkHashes.length === 0) {
                            isWishListed = true;
                            notes = roll.notes;
                            tags = roll.tags;
                            matchType = 'item';
                            break;
                        }
                        
                        // If we have perk hashes to compare
                        if (perkHashes && perkHashes.length > 0) {
                            // Check if all wish list perks are present in item perks
                            // Match both exact hashes AND normalized (enhanced -> base) hashes
                            const matchedPerks: number[] = [];
                            const actualMatchedItemPerks: number[] = [];
                            
                            for (const wishPerk of roll.perkHashes) {
                                // Direct match
                                const directIndex = perkHashes.indexOf(wishPerk);
                                if (directIndex !== -1) {
                                    matchedPerks.push(wishPerk);
                                    actualMatchedItemPerks.push(perkHashes[directIndex]);
                                    continue;
                                }
                                
                                // Check if item has enhanced version of this perk
                                // by comparing normalized versions
                                for (let i = 0; i < perkHashes.length; i++) {
                                    const itemPerk = perkHashes[i];
                                    const normalizedItemPerk = getBasePerkHash(itemPerk);
                                    if (normalizedItemPerk === wishPerk) {
                                        matchedPerks.push(wishPerk);
                                        actualMatchedItemPerks.push(itemPerk);
                                        break;
                                    }
                                }
                            }
                            
                            if (matchedPerks.length === roll.perkHashes.length) {
                                // Exact match - all wish list perks are on the item
                                isWishListed = true;
                                notes = roll.notes;
                                tags = roll.tags;
                                matchType = 'exact';
                                // Store the actual item perks that matched (including enhanced)
                                matchedPerkHashes = [...new Set([...matchedPerkHashes, ...actualMatchedItemPerks])];
                                break;
                            } else if (matchedPerks.length > 0 && matchType !== 'exact' as typeof matchType) {
                                // Partial match - some perks match
                                isWishListed = true;
                                notes = roll.notes;
                                tags = roll.tags;
                                matchType = 'partial';
                                matchedPerkHashes = [...new Set([...matchedPerkHashes, ...actualMatchedItemPerks])];
                            }
                        }
                    }
                }
                
                // Check trash rolls
                if (trashRolls && state.showTrashIndicators) {
                    for (const roll of trashRolls) {
                        // If roll has no perks, it's a "trash any" roll
                        if (roll.perkHashes.length === 0) {
                            isTrash = true;
                            if (!notes) notes = roll.notes;
                            if (!tags) tags = roll.tags;
                            if (matchType === 'none') matchType = 'item';
                            break;
                        }
                        
                        // If we have perk hashes to compare
                        if (perkHashes && perkHashes.length > 0) {
                            // Check with enhanced perk normalization
                            const matchedPerks: number[] = [];
                            
                            for (const trashPerk of roll.perkHashes) {
                                // Direct match
                                if (perkHashes.includes(trashPerk)) {
                                    matchedPerks.push(trashPerk);
                                    continue;
                                }
                                
                                // Check if item has enhanced version
                                for (const itemPerk of perkHashes) {
                                    if (getBasePerkHash(itemPerk) === trashPerk) {
                                        matchedPerks.push(trashPerk);
                                        break;
                                    }
                                }
                            }
                            
                            if (matchedPerks.length === roll.perkHashes.length) {
                                isTrash = true;
                                if (!notes) notes = roll.notes;
                                if (!tags) tags = roll.tags;
                                if (matchType === 'none') matchType = 'exact';
                                break;
                            }
                        }
                    }
                }
                
                return { isWishListed, isTrash, notes, tags, matchType, matchedPerkHashes };
            },
            
            updateWishListRolls: (id: string, rolls: Map<number, WishListRoll[]>) => {
                set(state => ({
                    wishLists: state.wishLists.map(wl => 
                        wl.id === id ? { ...wl, rolls } : wl
                    )
                }));
                // Rebuild lookups after updating rolls
                get().rebuildLookups();
                console.log(`[Wishlist] Updated rolls for wishlist ${id}, rebuilt lookups`);
            },
            
            rebuildLookups: () => {
                const state = get();
                const wishListLookup = new Map<number, WishListRoll[]>();
                const trashListLookup = new Map<number, WishListRoll[]>();
                
                let totalRolls = 0;
                for (const wishList of state.wishLists) {
                    if (!wishList.enabled) continue;
                    
                    for (const [itemHash, rolls] of wishList.rolls) {
                        totalRolls += rolls.length;
                        for (const roll of rolls) {
                            if (roll.isTrash) {
                                const existing = trashListLookup.get(itemHash) || [];
                                existing.push(roll);
                                trashListLookup.set(itemHash, existing);
                            } else {
                                const existing = wishListLookup.get(itemHash) || [];
                                existing.push(roll);
                                wishListLookup.set(itemHash, existing);
                            }
                        }
                    }
                }
                
                console.log(`[Wishlist] Rebuilt lookups: ${wishListLookup.size} wishlisted items, ${trashListLookup.size} trash items (${totalRolls} total rolls)`);
                set({ wishListLookup, trashListLookup });
            },
        }),
        {
            name: 'warmind-wishlists',
            storage: createJSONStorage(() => safeLocalStorage),
            partialize: (state) => ({
                // Only persist ENABLED wishlist URLs and metadata - rolls stored in IndexedDB
                enabledWishListUrls: state.wishLists
                    .filter(wl => wl.enabled)
                    .map(wl => ({
                        id: wl.id,
                        url: wl.url,
                        title: wl.title,
                        description: wl.description,
                        lastUpdated: wl.lastUpdated,
                        rollCount: wl.rollCount,
                        trashRollCount: wl.trashRollCount,
                    })),
                // Also save disabled wishlists so user can re-enable them
                disabledWishListUrls: state.wishLists
                    .filter(wl => !wl.enabled)
                    .map(wl => wl.url),
                showWishListIndicators: state.showWishListIndicators,
                showTrashIndicators: state.showTrashIndicators,
            }),
            onRehydrateStorage: () => (state) => {
                if (state && typeof window !== 'undefined') {
                    // Load enabled wishlist metadata from localStorage
                    const enabledUrls = (state as any).enabledWishListUrls || [];
                    const disabledUrls = (state as any).disabledWishListUrls || [];
                    
                    // Initialize wishlists with empty rolls first
                    const wishLists: WishList[] = [];
                    
                    // Load enabled wishlists (synchronously initialize, async load rolls)
                    for (const wlData of enabledUrls) {
                        wishLists.push({
                            id: wlData.id,
                            url: wlData.url,
                            title: wlData.title,
                            description: wlData.description,
                            lastUpdated: wlData.lastUpdated,
                            enabled: true,
                            rollCount: wlData.rollCount || 0,
                            trashRollCount: wlData.trashRollCount || 0,
                            rolls: new Map<number, WishListRoll[]>(), // Start empty, load async
                        });
                    }
                    
                    // Add disabled wishlists (just URLs, no rolls)
                    for (const url of disabledUrls) {
                        // Check if already added as enabled
                        if (!wishLists.some(wl => wl.url === url)) {
                            wishLists.push({
                                id: crypto.randomUUID(),
                                url,
                                title: 'Disabled Wish List',
                                lastUpdated: new Date().toISOString(),
                                enabled: false,
                                rollCount: 0,
                                trashRollCount: 0,
                                rolls: new Map<number, WishListRoll[]>(),
                            });
                        }
                    }
                    
                    state.wishLists = wishLists;
                    state.rebuildLookups(); // Rebuild with empty data first
                    
                    // Load rolls from IndexedDB asynchronously and update store
                    if (enabledUrls.length > 0) {
                        // Use setTimeout to ensure store is fully initialized
                        setTimeout(async () => {
                            const store = useWishListStore;
                            
                            for (const wlData of enabledUrls) {
                                // Try to load rolls from IndexedDB
                                const rolls = await loadRollsFromIndexedDB(wlData.id);
                                
                                if (rolls && rolls.size > 0) {
                                    // Rolls found in IndexedDB - update the wishlist in store
                                    console.log(`[Wishlist] Loaded ${rolls.size} items from IndexedDB for ${wlData.title}`);
                                    store.getState().updateWishListRolls(wlData.id, rolls);
                                } else {
                                    // No rolls in IndexedDB - refresh from URL (will save to IndexedDB)
                                    console.log(`[Wishlist] No rolls in IndexedDB for ${wlData.title}, refreshing from URL...`);
                                    store.getState().refreshWishList(wlData.id).catch(error => {
                                        console.warn(`Failed to refresh wishlist ${wlData.title}:`, error);
                                    });
                                }
                            }
                        }, 100);
                    }
                }
            },
        }
    )
);

// ===== Helper Hooks =====

export const useWishListSettings = () => useWishListStore(state => ({
    showWishListIndicators: state.showWishListIndicators,
    showTrashIndicators: state.showTrashIndicators,
    setShowWishListIndicators: state.setShowWishListIndicators,
    setShowTrashIndicators: state.setShowTrashIndicators,
}));

export const useWishListInfo = (itemHash: number, perkHashes?: number[]) => {
    const getWishListInfo = useWishListStore(state => state.getWishListInfo);
    return getWishListInfo(itemHash, perkHashes);
};
