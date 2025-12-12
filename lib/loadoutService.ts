/**
 * Loadout Service
 * 
 * Dexie-based service for managing custom loadouts.
 * Replaces localStorage persistence with IndexedDB for:
 * - Better performance with large loadout collections
 * - Queryable data (by class, tags, etc.)
 * - Larger storage capacity
 */

import { db, DBLoadout, LoadoutItemData, ArmorModData, FashionData, SubclassConfigData } from './db';

// ============================================================================
// TYPE EXPORTS (for compatibility with existing code)
// ============================================================================

export type { DBLoadout as Loadout };
export type { LoadoutItemData, ArmorModData, FashionData, SubclassConfigData };

// ============================================================================
// ID GENERATION
// ============================================================================

/**
 * Generate a unique loadout ID
 */
export function generateLoadoutId(): string {
    return `loadout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Create a new loadout
 */
export async function createLoadout(
    data: Omit<DBLoadout, 'id' | 'externalId' | 'createdAt' | 'updatedAt'>
): Promise<DBLoadout> {
    const now = new Date().toISOString();
    const externalId = generateLoadoutId();
    
    const loadout: DBLoadout = {
        ...data,
        externalId,
        tags: data.tags || [],
        isShared: data.isShared || false,
        createdAt: now,
        updatedAt: now,
    };
    
    const id = await db.loadouts.add(loadout);
    return { ...loadout, id };
}

/**
 * Get all loadouts
 */
export async function getAllLoadouts(): Promise<DBLoadout[]> {
    return db.loadouts.toArray();
}

/**
 * Get loadout by internal ID
 */
export async function getLoadoutById(id: number): Promise<DBLoadout | undefined> {
    return db.loadouts.get(id);
}

/**
 * Get loadout by external ID (string ID)
 */
export async function getLoadoutByExternalId(externalId: string): Promise<DBLoadout | undefined> {
    return db.loadouts.where('externalId').equals(externalId).first();
}

/**
 * Update a loadout
 */
export async function updateLoadout(
    id: number,
    updates: Partial<Omit<DBLoadout, 'id' | 'externalId' | 'createdAt'>>
): Promise<void> {
    await db.loadouts.update(id, {
        ...updates,
        updatedAt: new Date().toISOString(),
    });
}

/**
 * Delete a loadout
 */
export async function deleteLoadout(id: number): Promise<void> {
    await db.loadouts.delete(id);
}

/**
 * Delete loadout by external ID
 */
export async function deleteLoadoutByExternalId(externalId: string): Promise<void> {
    await db.loadouts.where('externalId').equals(externalId).delete();
}

/**
 * Duplicate a loadout
 */
export async function duplicateLoadout(id: number): Promise<DBLoadout | null> {
    const original = await getLoadoutById(id);
    if (!original) return null;
    
    const { id: _, externalId: __, createdAt, updatedAt, shareId, isShared, sharedAt, ...rest } = original;
    
    return createLoadout({
        ...rest,
        name: `${rest.name} (Copy)`,
        isShared: false,
    });
}

// ============================================================================
// QUERY OPERATIONS
// ============================================================================

/**
 * Get loadouts by class type
 */
export async function getLoadoutsByClass(classType: number): Promise<DBLoadout[]> {
    return db.loadouts.where('classType').equals(classType).toArray();
}

/**
 * Get loadouts by tag
 */
export async function getLoadoutsByTag(tag: string): Promise<DBLoadout[]> {
    return db.loadouts.where('tags').equals(tag).toArray();
}

/**
 * Get loadouts with subclass configured
 */
export async function getLoadoutsWithSubclass(): Promise<DBLoadout[]> {
    const all = await getAllLoadouts();
    return all.filter(l => l.subclassConfig);
}

/**
 * Search loadouts by name
 */
export async function searchLoadoutsByName(search: string): Promise<DBLoadout[]> {
    const searchLower = search.toLowerCase();
    const all = await getAllLoadouts();
    return all.filter(l => l.name.toLowerCase().includes(searchLower));
}

/**
 * Get shared loadouts
 */
export async function getSharedLoadouts(): Promise<DBLoadout[]> {
    const all = await getAllLoadouts();
    return all.filter(l => l.isShared);
}

/**
 * Get loadout by share ID
 */
export async function getLoadoutByShareId(shareId: string): Promise<DBLoadout | undefined> {
    const all = await getAllLoadouts();
    return all.find(l => l.shareId === shareId);
}

// ============================================================================
// ITEM MANAGEMENT
// ============================================================================

/**
 * Add or update an item in a loadout
 */
export async function setLoadoutItem(
    loadoutId: number,
    item: LoadoutItemData
): Promise<void> {
    const loadout = await getLoadoutById(loadoutId);
    if (!loadout) return;
    
    const existingIndex = loadout.items.findIndex(i => i.bucketHash === item.bucketHash);
    
    let newItems: LoadoutItemData[];
    if (existingIndex >= 0) {
        newItems = loadout.items.map((i, idx) => idx === existingIndex ? item : i);
    } else {
        newItems = [...loadout.items, item];
    }
    
    await updateLoadout(loadoutId, { items: newItems });
}

/**
 * Remove an item from a loadout
 */
export async function removeLoadoutItem(
    loadoutId: number,
    bucketHash: number
): Promise<void> {
    const loadout = await getLoadoutById(loadoutId);
    if (!loadout) return;
    
    const newItems = loadout.items.filter(i => i.bucketHash !== bucketHash);
    await updateLoadout(loadoutId, { items: newItems });
}

// ============================================================================
// SUBCLASS MANAGEMENT
// ============================================================================

/**
 * Set subclass configuration for a loadout
 */
export async function setLoadoutSubclass(
    loadoutId: number,
    subclassConfig: SubclassConfigData | null
): Promise<void> {
    await updateLoadout(loadoutId, { subclassConfig: subclassConfig || undefined });
}

// ============================================================================
// ARMOR MODS MANAGEMENT
// ============================================================================

/**
 * Set armor mods for a loadout
 */
export async function setLoadoutArmorMods(
    loadoutId: number,
    armorMods: ArmorModData[]
): Promise<void> {
    await updateLoadout(loadoutId, { armorMods });
}

/**
 * Update armor mod for a specific slot
 */
export async function updateLoadoutArmorMod(
    loadoutId: number,
    bucketHash: number,
    mod: ArmorModData
): Promise<void> {
    const loadout = await getLoadoutById(loadoutId);
    if (!loadout) return;
    
    const existingMods = loadout.armorMods || [];
    const existingIdx = existingMods.findIndex(m => m.bucketHash === bucketHash);
    
    let newMods: ArmorModData[];
    if (existingIdx >= 0) {
        newMods = existingMods.map((m, idx) => idx === existingIdx ? mod : m);
    } else {
        newMods = [...existingMods, mod];
    }
    
    await updateLoadout(loadoutId, { armorMods: newMods });
}

// ============================================================================
// FASHION MANAGEMENT
// ============================================================================

/**
 * Set fashion configuration for a loadout
 */
export async function setLoadoutFashion(
    loadoutId: number,
    fashion: FashionData[]
): Promise<void> {
    await updateLoadout(loadoutId, { fashion });
}

/**
 * Update fashion for a specific slot
 */
export async function updateLoadoutFashionItem(
    loadoutId: number,
    bucketHash: number,
    config: Partial<FashionData>
): Promise<void> {
    const loadout = await getLoadoutById(loadoutId);
    if (!loadout) return;
    
    const existingFashion = loadout.fashion || [];
    const existingIdx = existingFashion.findIndex(f => f.bucketHash === bucketHash);
    
    let newFashion: FashionData[];
    if (existingIdx >= 0) {
        newFashion = existingFashion.map((f, idx) => 
            idx === existingIdx ? { ...f, ...config } : f
        );
    } else {
        newFashion = [...existingFashion, { bucketHash, ...config }];
    }
    
    await updateLoadout(loadoutId, { fashion: newFashion });
}

// ============================================================================
// TAGS MANAGEMENT
// ============================================================================

/**
 * Add a tag to a loadout
 */
export async function addLoadoutTag(loadoutId: number, tag: string): Promise<void> {
    const loadout = await getLoadoutById(loadoutId);
    if (!loadout) return;
    
    if (loadout.tags.includes(tag)) return;
    
    await updateLoadout(loadoutId, { tags: [...loadout.tags, tag] });
}

/**
 * Remove a tag from a loadout
 */
export async function removeLoadoutTag(loadoutId: number, tag: string): Promise<void> {
    const loadout = await getLoadoutById(loadoutId);
    if (!loadout) return;
    
    await updateLoadout(loadoutId, { tags: loadout.tags.filter(t => t !== tag) });
}

// ============================================================================
// SHARING
// ============================================================================

/**
 * Generate a share ID for a loadout
 */
export async function generateShareId(loadoutId: number): Promise<string | null> {
    const loadout = await getLoadoutById(loadoutId);
    if (!loadout) return null;
    
    const shareId = `WM${Date.now().toString(36)}${Math.random().toString(36).substr(2, 6)}`.toUpperCase();
    
    await updateLoadout(loadoutId, {
        shareId,
        isShared: true,
        sharedAt: new Date().toISOString(),
    });
    
    return shareId;
}

// ============================================================================
// IMPORT/EXPORT
// ============================================================================

/**
 * Export all loadouts
 */
export async function exportLoadouts(): Promise<DBLoadout[]> {
    return getAllLoadouts();
}

/**
 * Import loadouts
 */
export async function importLoadouts(loadouts: DBLoadout[]): Promise<number> {
    let imported = 0;
    
    for (const loadout of loadouts) {
        const { id, externalId, createdAt, updatedAt, shareId, isShared, sharedAt, ...rest } = loadout;
        
        await createLoadout({
            ...rest,
            importedFrom: shareId || 'external',
            isShared: false,
        });
        
        imported++;
    }
    
    return imported;
}

/**
 * Encode loadout for sharing (base64 JSON)
 */
export function encodeLoadoutShareCode(loadout: DBLoadout): string {
    try {
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
        if (typeof window !== 'undefined') {
            return btoa(encodeURIComponent(json));
        }
        return Buffer.from(json).toString('base64');
    } catch (e) {
        console.error('Failed to encode loadout:', e);
        return '';
    }
}

/**
 * Decode loadout from share code
 */
export function decodeLoadoutShareCode(
    code: string
): Omit<DBLoadout, 'id' | 'externalId' | 'createdAt' | 'updatedAt'> | null {
    try {
        let json: string;
        if (typeof window !== 'undefined') {
            json = decodeURIComponent(atob(code));
        } else {
            json = Buffer.from(code, 'base64').toString('utf-8');
        }
        
        const data = JSON.parse(json);
        
        const loadout: Omit<DBLoadout, 'id' | 'externalId' | 'createdAt' | 'updatedAt'> = {
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
            tags: data.t || [],
            notes: data.nt,
            isShared: false,
        };
        
        return loadout;
    } catch (e) {
        console.error('Failed to decode share code:', e);
        return null;
    }
}

/**
 * Import loadout from share code
 */
export async function importFromShareCode(code: string): Promise<DBLoadout | null> {
    const decoded = decodeLoadoutShareCode(code);
    if (!decoded) return null;
    
    return createLoadout({
        ...decoded,
        importedFrom: code.slice(0, 8),
    });
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get loadout statistics
 */
export async function getLoadoutStats(): Promise<{
    total: number;
    byClass: Record<number, number>;
    byTag: Record<string, number>;
    shared: number;
}> {
    const loadouts = await getAllLoadouts();
    
    const byClass: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
    const byTag: Record<string, number> = {};
    let shared = 0;
    
    for (const loadout of loadouts) {
        byClass[loadout.classType] = (byClass[loadout.classType] || 0) + 1;
        
        for (const tag of loadout.tags) {
            byTag[tag] = (byTag[tag] || 0) + 1;
        }
        
        if (loadout.isShared) shared++;
    }
    
    return {
        total: loadouts.length,
        byClass,
        byTag,
        shared,
    };
}






