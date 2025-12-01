/**
 * useItemAnnotations Hook
 * 
 * React hooks for managing item tags and notes.
 * Uses Dexie's useLiveQuery for reactive updates.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo } from 'react';
import { db } from '@/lib/db';
import {
    addItemTag,
    removeItemTag,
    toggleItemTag,
    getItemTags,
    setItemTags,
    clearItemTags,
    setItemNote,
    getItemNote,
    deleteItemNote,
    getItemAnnotation,
    ItemAnnotation,
    ITEM_TAGS,
    TAG_COLORS,
    TAG_ICONS,
} from '@/lib/itemAnnotations';

// Re-export constants
export { ITEM_TAGS, TAG_COLORS, TAG_ICONS };

// ============================================================================
// SINGLE ITEM HOOKS
// ============================================================================

/**
 * Hook to manage tags for a single item
 */
export function useItemTags(itemInstanceId: string | null | undefined) {
    const tags = useLiveQuery(
        async () => {
            if (!itemInstanceId) return [] as string[];
            return getItemTags(itemInstanceId);
        },
        [itemInstanceId],
        [] as string[]
    );

    const add = useCallback(async (tag: string) => {
        if (!itemInstanceId) return;
        await addItemTag(itemInstanceId, tag);
    }, [itemInstanceId]);

    const remove = useCallback(async (tag: string) => {
        if (!itemInstanceId) return;
        await removeItemTag(itemInstanceId, tag);
    }, [itemInstanceId]);

    const toggle = useCallback(async (tag: string) => {
        if (!itemInstanceId) return false;
        return toggleItemTag(itemInstanceId, tag);
    }, [itemInstanceId]);

    const set = useCallback(async (newTags: string[]) => {
        if (!itemInstanceId) return;
        await setItemTags(itemInstanceId, newTags);
    }, [itemInstanceId]);

    const clear = useCallback(async () => {
        if (!itemInstanceId) return;
        await clearItemTags(itemInstanceId);
    }, [itemInstanceId]);

    const hasTag = useCallback((tag: string) => {
        return tags?.includes(tag) ?? false;
    }, [tags]);

    return {
        tags: tags ?? [],
        isLoading: tags === undefined,
        add,
        remove,
        toggle,
        set,
        clear,
        hasTag,
    };
}

/**
 * Hook to manage note for a single item
 */
export function useItemNote(itemInstanceId: string | null | undefined) {
    const note = useLiveQuery(
        async () => {
            if (!itemInstanceId) return null;
            return getItemNote(itemInstanceId);
        },
        [itemInstanceId],
        null
    );

    const setNote = useCallback(async (newNote: string) => {
        if (!itemInstanceId) return;
        await setItemNote(itemInstanceId, newNote);
    }, [itemInstanceId]);

    const deleteNote = useCallback(async () => {
        if (!itemInstanceId) return;
        await deleteItemNote(itemInstanceId);
    }, [itemInstanceId]);

    return {
        note,
        isLoading: note === undefined,
        setNote,
        deleteNote,
        hasNote: !!note,
    };
}

/**
 * Hook to get full annotation for a single item
 */
export function useItemAnnotation(itemInstanceId: string | null | undefined) {
    const annotation = useLiveQuery(
        async () => {
            if (!itemInstanceId) return null;
            return getItemAnnotation(itemInstanceId);
        },
        [itemInstanceId],
        null
    );

    return {
        annotation,
        isLoading: annotation === undefined,
        hasTags: (annotation?.tags?.length ?? 0) > 0,
        hasNote: !!annotation?.note,
        hasAnnotations: (annotation?.tags?.length ?? 0) > 0 || !!annotation?.note,
    };
}

// ============================================================================
// MULTI-ITEM HOOKS
// ============================================================================

/**
 * Hook to get annotations for multiple items
 */
export function useItemsAnnotations(itemInstanceIds: string[]) {
    const annotations = useLiveQuery(
        async () => {
            if (!itemInstanceIds.length) return {};
            
            const result: Record<string, ItemAnnotation> = {};
            
            await Promise.all(
                itemInstanceIds.map(async (id) => {
                    result[id] = await getItemAnnotation(id);
                })
            );
            
            return result;
        },
        [itemInstanceIds.join(',')],
        {}
    );

    return {
        annotations: annotations ?? {},
        isLoading: annotations === undefined,
    };
}

/**
 * Hook to get all items with a specific tag
 */
export function useItemsWithTag(tag: string) {
    const items = useLiveQuery(
        async () => {
            const entries = await db.itemTags.where('tag').equals(tag).toArray();
            return entries.map(e => e.itemInstanceId);
        },
        [tag],
        []
    );

    return {
        itemInstanceIds: items ?? [],
        isLoading: items === undefined,
        count: items?.length ?? 0,
    };
}

// ============================================================================
// STATISTICS HOOKS
// ============================================================================

/**
 * Hook to get tag counts
 */
export function useTagCounts() {
    const counts = useLiveQuery(
        async () => {
            const entries = await db.itemTags.toArray();
            const result: Record<string, number> = {};
            
            for (const entry of entries) {
                result[entry.tag] = (result[entry.tag] || 0) + 1;
            }
            
            return result;
        },
        [],
        {}
    );

    return {
        counts: counts ?? {},
        isLoading: counts === undefined,
    };
}

/**
 * Hook to get all unique tags used
 */
export function useAllUsedTags() {
    const tags = useLiveQuery(
        async () => {
            const entries = await db.itemTags.toArray();
            return [...new Set(entries.map(e => e.tag))];
        },
        [],
        []
    );

    return {
        tags: tags ?? [],
        isLoading: tags === undefined,
    };
}

/**
 * Hook to get annotation statistics
 */
export function useAnnotationStats() {
    const stats = useLiveQuery(
        async () => {
            const [tagEntries, noteCount] = await Promise.all([
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
                totalNotedItems: noteCount,
                tagCounts,
            };
        },
        [],
        { totalTaggedItems: 0, totalNotedItems: 0, tagCounts: {} }
    );

    return {
        stats: stats ?? { totalTaggedItems: 0, totalNotedItems: 0, tagCounts: {} },
        isLoading: stats === undefined,
    };
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook to check if an item has a specific tag (optimized)
 */
export function useHasTag(itemInstanceId: string | null | undefined, tag: string) {
    const hasTag = useLiveQuery(
        async () => {
            if (!itemInstanceId) return false;
            const entry = await db.itemTags.get([itemInstanceId, tag]);
            return !!entry;
        },
        [itemInstanceId, tag],
        false
    );

    return hasTag ?? false;
}

/**
 * Get tag display info
 */
export function getTagInfo(tag: string) {
    return {
        tag,
        color: TAG_COLORS[tag] || '#6b7280',
        icon: TAG_ICONS[tag] || '•',
        isPreset: Object.values(ITEM_TAGS).includes(tag as any),
    };
}

/**
 * Get all preset tags with info
 */
export function usePresetTags() {
    return useMemo(() => {
        return Object.values(ITEM_TAGS).map(tag => getTagInfo(tag));
    }, []);
}

