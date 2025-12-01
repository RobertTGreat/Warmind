/**
 * Item Annotations Service
 * 
 * Manages item tags and notes using Dexie (IndexedDB).
 * Allows users to tag items (keep, junk, favorite, etc.) and add personal notes.
 */

import { db, DBItemTag, DBItemNote } from './db';

// ============================================================================
// PREDEFINED TAGS
// ============================================================================

export const ITEM_TAGS = {
    KEEP: 'keep',
    JUNK: 'junk',
    FAVORITE: 'favorite',
    INFUSE: 'infuse',
    ARCHIVE: 'archive',
    PVE: 'pve',
    PVP: 'pvp',
    RAID: 'raid',
    GM: 'gm',
} as const;

export type ItemTagType = (typeof ITEM_TAGS)[keyof typeof ITEM_TAGS] | string;

export const TAG_COLORS: Record<string, string> = {
    [ITEM_TAGS.KEEP]: '#22c55e',      // Green
    [ITEM_TAGS.JUNK]: '#ef4444',      // Red
    [ITEM_TAGS.FAVORITE]: '#f59e0b',  // Amber
    [ITEM_TAGS.INFUSE]: '#3b82f6',    // Blue
    [ITEM_TAGS.ARCHIVE]: '#6b7280',   // Gray
    [ITEM_TAGS.PVE]: '#8b5cf6',       // Purple
    [ITEM_TAGS.PVP]: '#ec4899',       // Pink
    [ITEM_TAGS.RAID]: '#f97316',      // Orange
    [ITEM_TAGS.GM]: '#14b8a6',        // Teal
};

export const TAG_ICONS: Record<string, string> = {
    [ITEM_TAGS.KEEP]: '✓',
    [ITEM_TAGS.JUNK]: '✕',
    [ITEM_TAGS.FAVORITE]: '★',
    [ITEM_TAGS.INFUSE]: '↑',
    [ITEM_TAGS.ARCHIVE]: '📦',
    [ITEM_TAGS.PVE]: '🎯',
    [ITEM_TAGS.PVP]: '⚔️',
    [ITEM_TAGS.RAID]: '👥',
    [ITEM_TAGS.GM]: '💀',
};

// ============================================================================
// TAG OPERATIONS
// ============================================================================

/**
 * Add a tag to an item
 */
export async function addItemTag(itemInstanceId: string, tag: string): Promise<void> {
    const existing = await db.itemTags
        .where('[itemInstanceId+tag]')
        .equals([itemInstanceId, tag])
        .first();
    if (existing) return; // Already has this tag
    
    await db.itemTags.add({
        itemInstanceId,
        tag,
        createdAt: new Date().toISOString(),
    });
}

/**
 * Remove a tag from an item
 */
export async function removeItemTag(itemInstanceId: string, tag: string): Promise<void> {
    await db.itemTags.where('[itemInstanceId+tag]').equals([itemInstanceId, tag]).delete();
}

/**
 * Toggle a tag on an item
 */
export async function toggleItemTag(itemInstanceId: string, tag: string): Promise<boolean> {
    const existing = await db.itemTags
        .where('[itemInstanceId+tag]')
        .equals([itemInstanceId, tag])
        .first();
    
    if (existing) {
        await removeItemTag(itemInstanceId, tag);
        return false; // Tag removed
    } else {
        await addItemTag(itemInstanceId, tag);
        return true; // Tag added
    }
}

/**
 * Get all tags for an item
 */
export async function getItemTags(itemInstanceId: string): Promise<string[]> {
    const tags = await db.itemTags.where('itemInstanceId').equals(itemInstanceId).toArray();
    return tags.map(t => t.tag);
}

/**
 * Check if an item has a specific tag
 */
export async function hasItemTag(itemInstanceId: string, tag: string): Promise<boolean> {
    const existing = await db.itemTags
        .where('[itemInstanceId+tag]')
        .equals([itemInstanceId, tag])
        .first();
    return !!existing;
}

/**
 * Set all tags for an item (replaces existing)
 */
export async function setItemTags(itemInstanceId: string, tags: string[]): Promise<void> {
    // Remove existing tags
    await db.itemTags.where('itemInstanceId').equals(itemInstanceId).delete();
    
    // Add new tags
    const now = new Date().toISOString();
    const tagEntries: DBItemTag[] = tags.map(tag => ({
        itemInstanceId,
        tag,
        createdAt: now,
    }));
    
    await db.itemTags.bulkAdd(tagEntries);
}

/**
 * Remove all tags from an item
 */
export async function clearItemTags(itemInstanceId: string): Promise<void> {
    await db.itemTags.where('itemInstanceId').equals(itemInstanceId).delete();
}

// ============================================================================
// TAG QUERIES
// ============================================================================

/**
 * Get all items with a specific tag
 */
export async function getItemsWithTag(tag: string): Promise<string[]> {
    const entries = await db.itemTags.where('tag').equals(tag).toArray();
    return entries.map(e => e.itemInstanceId);
}

/**
 * Get all items with any of the given tags
 */
export async function getItemsWithAnyTag(tags: string[]): Promise<string[]> {
    const entries = await db.itemTags.where('tag').anyOf(tags).toArray();
    return [...new Set(entries.map(e => e.itemInstanceId))];
}

/**
 * Get all unique tags used
 */
export async function getAllUsedTags(): Promise<string[]> {
    const entries = await db.itemTags.toArray();
    return [...new Set(entries.map(e => e.tag))];
}

/**
 * Get tag counts
 */
export async function getTagCounts(): Promise<Record<string, number>> {
    const entries = await db.itemTags.toArray();
    const counts: Record<string, number> = {};
    
    for (const entry of entries) {
        counts[entry.tag] = (counts[entry.tag] || 0) + 1;
    }
    
    return counts;
}

// ============================================================================
// NOTE OPERATIONS
// ============================================================================

/**
 * Set note for an item
 */
export async function setItemNote(itemInstanceId: string, note: string): Promise<void> {
    if (!note.trim()) {
        // Remove empty notes
        await deleteItemNote(itemInstanceId);
        return;
    }
    
    await db.itemNotes.put({
        itemInstanceId,
        note: note.trim(),
        updatedAt: new Date().toISOString(),
    });
}

/**
 * Get note for an item
 */
export async function getItemNote(itemInstanceId: string): Promise<string | null> {
    const entry = await db.itemNotes.get(itemInstanceId);
    return entry?.note ?? null;
}

/**
 * Delete note for an item
 */
export async function deleteItemNote(itemInstanceId: string): Promise<void> {
    await db.itemNotes.delete(itemInstanceId);
}

/**
 * Get all items with notes
 */
export async function getItemsWithNotes(): Promise<DBItemNote[]> {
    return db.itemNotes.toArray();
}

/**
 * Search notes
 */
export async function searchNotes(search: string): Promise<DBItemNote[]> {
    const searchLower = search.toLowerCase();
    const notes = await db.itemNotes.toArray();
    return notes.filter(n => n.note.toLowerCase().includes(searchLower));
}

// ============================================================================
// COMBINED OPERATIONS
// ============================================================================

/**
 * Get full annotation info for an item
 */
export interface ItemAnnotation {
    itemInstanceId: string;
    tags: string[];
    note: string | null;
}

export async function getItemAnnotation(itemInstanceId: string): Promise<ItemAnnotation> {
    const [tags, note] = await Promise.all([
        getItemTags(itemInstanceId),
        getItemNote(itemInstanceId),
    ]);
    
    return {
        itemInstanceId,
        tags,
        note,
    };
}

/**
 * Get annotations for multiple items
 */
export async function getItemAnnotations(itemInstanceIds: string[]): Promise<Record<string, ItemAnnotation>> {
    const result: Record<string, ItemAnnotation> = {};
    
    await Promise.all(
        itemInstanceIds.map(async (id) => {
            result[id] = await getItemAnnotation(id);
        })
    );
    
    return result;
}

/**
 * Check if an item has any annotations
 */
export async function hasAnnotations(itemInstanceId: string): Promise<boolean> {
    const [tags, note] = await Promise.all([
        getItemTags(itemInstanceId),
        getItemNote(itemInstanceId),
    ]);
    
    return tags.length > 0 || !!note;
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Clear all annotations for multiple items
 */
export async function clearAnnotationsForItems(itemInstanceIds: string[]): Promise<void> {
    await db.itemTags.where('itemInstanceId').anyOf(itemInstanceIds).delete();
    await db.itemNotes.where('itemInstanceId').anyOf(itemInstanceIds).delete();
}

/**
 * Clear ALL annotations (use with caution)
 */
export async function clearAllAnnotations(): Promise<void> {
    await db.itemTags.clear();
    await db.itemNotes.clear();
}

// ============================================================================
// EXPORT/IMPORT
// ============================================================================

export interface AnnotationExport {
    tags: DBItemTag[];
    notes: DBItemNote[];
    exportedAt: string;
}

/**
 * Export all annotations
 */
export async function exportAnnotations(): Promise<AnnotationExport> {
    const [tags, notes] = await Promise.all([
        db.itemTags.toArray(),
        db.itemNotes.toArray(),
    ]);
    
    return {
        tags,
        notes,
        exportedAt: new Date().toISOString(),
    };
}

/**
 * Import annotations
 */
export async function importAnnotations(
    data: AnnotationExport,
    merge = true
): Promise<{ tagsImported: number; notesImported: number }> {
    if (!merge) {
        await clearAllAnnotations();
    }
    
    let tagsImported = 0;
    let notesImported = 0;
    
    // Import tags (skip duplicates if merging)
    for (const tag of data.tags) {
        try {
            if (merge) {
                const existing = await db.itemTags.get([tag.itemInstanceId, tag.tag]);
                if (!existing) {
                    await db.itemTags.add(tag);
                    tagsImported++;
                }
            } else {
                await db.itemTags.add(tag);
                tagsImported++;
            }
        } catch {
            // Skip duplicates
        }
    }
    
    // Import notes (newer wins if merging)
    for (const note of data.notes) {
        try {
            if (merge) {
                const existing = await db.itemNotes.get(note.itemInstanceId);
                if (!existing || new Date(note.updatedAt) > new Date(existing.updatedAt)) {
                    await db.itemNotes.put(note);
                    notesImported++;
                }
            } else {
                await db.itemNotes.add(note);
                notesImported++;
            }
        } catch {
            // Skip errors
        }
    }
    
    return { tagsImported, notesImported };
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get annotation statistics
 */
export async function getAnnotationStats(): Promise<{
    totalTaggedItems: number;
    totalNotedItems: number;
    tagCounts: Record<string, number>;
}> {
    const [tagEntries, noteEntries] = await Promise.all([
        db.itemTags.toArray(),
        db.itemNotes.count(),
    ]);
    
    const uniqueTaggedItems = new Set(tagEntries.map(e => e.itemInstanceId));
    const tagCounts: Record<string, number> = {};
    
    for (const entry of tagEntries) {
        tagCounts[entry.tag] = (tagCounts[entry.tag] || 0) + 1;
    }
    
    return {
        totalTaggedItems: uniqueTaggedItems.size,
        totalNotedItems: noteEntries,
        tagCounts,
    };
}

