"use client";

import { useEffect, useRef } from "react";
import { useWishListStore } from "@/store/wishlistStore";
import { getFromDB } from "@/lib/indexedDB";

const WISHLIST_ROLLS_PREFIX = 'wishlist_rolls_';

async function loadRollsFromIndexedDB(wishListId: string): Promise<Map<number, any> | null> {
    const rollsArray = await getFromDB<[number, any[]][]>(`${WISHLIST_ROLLS_PREFIX}${wishListId}`);
    if (!rollsArray) return null;
    return new Map(rollsArray);
}

export function WishListInitializer() {
    const hasInitializedRef = useRef(false);
    const retryCountRef = useRef(0);

    useEffect(() => {
        // Only run once on mount
        if (hasInitializedRef.current) return;
        hasInitializedRef.current = true;
        
        const initializeWishlists = async () => {
            // Get current state from store
            const store = useWishListStore.getState();
            
            if (store.isLoading && retryCountRef.current < 10) {
                // Wait a bit and try again
                retryCountRef.current++;
                setTimeout(initializeWishlists, 500);
                return;
            }

            const enabledWishLists = store.wishLists.filter(wl => wl.enabled);
            
            if (enabledWishLists.length === 0) {
                console.log("[Wishlist] No enabled wishlists to load");
                return;
            }

            console.log(`[Wishlist] Initializing ${enabledWishLists.length} enabled wishlist(s)...`);

            let loadedCount = 0;
            const loadPromises: Promise<void>[] = [];

            for (const wl of enabledWishLists) {
                // Skip if already has rolls
                if (wl.rolls && wl.rolls.size > 0) {
                    console.log(`[Wishlist] Wishlist ${wl.title} already has ${wl.rolls.size} items loaded`);
                    loadedCount++;
                    continue;
                }

                // Try to load from IndexedDB first
                const loadPromise = (async () => {
                    try {
                        const rolls = await loadRollsFromIndexedDB(wl.id);
                        
                        if (rolls && rolls.size > 0) {
                            console.log(`[Wishlist] Loaded ${rolls.size} items from IndexedDB for ${wl.title}`);
                            store.updateWishListRolls(wl.id, rolls);
                            loadedCount++;
                        } else {
                            // No rolls in IndexedDB - refresh from URL
                            console.log(`[Wishlist] No rolls in IndexedDB for ${wl.title}, refreshing from URL...`);
                            await store.refreshWishList(wl.id);
                            loadedCount++;
                        }
                    } catch (error) {
                        console.error(`[Wishlist] Error loading ${wl.title}:`, error);
                        // Try to refresh as fallback
                        try {
                            await store.refreshWishList(wl.id);
                            loadedCount++;
                        } catch (err) {
                            console.warn(`[Wishlist] Failed to refresh ${wl.title}:`, err);
                        }
                    }
                })();
                
                loadPromises.push(loadPromise);
            }

            // Wait for all loads to complete
            await Promise.all(loadPromises);

            // Force a rebuild after all loads complete
            console.log(`[Wishlist] Loaded ${loadedCount}/${enabledWishLists.length} wishlists, rebuilding lookups...`);
            store.rebuildLookups();
        };

        // Small delay to ensure store is hydrated
        const timeoutId = setTimeout(initializeWishlists, 300);

        return () => {
            clearTimeout(timeoutId);
        };
    }, []); // Only run once on mount

    return null; // This component doesn't render anything
}

