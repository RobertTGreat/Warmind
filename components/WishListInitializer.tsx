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

    useEffect(() => {
        // Only run once on mount
        if (hasInitializedRef.current) return;
        hasInitializedRef.current = true;
        
        const initializeWishlists = async () => {
            // Get current state from store
            const store = useWishListStore.getState();
            
            if (store.isLoading) {
                // Wait a bit and try again
                setTimeout(initializeWishlists, 500);
                return;
            }

            const enabledWishLists = store.wishLists.filter(wl => wl.enabled);
            
            if (enabledWishLists.length === 0) {
                console.log("[Wishlist] No enabled wishlists to load");
                return;
            }

            console.log(`[Wishlist] Initializing ${enabledWishLists.length} enabled wishlist(s)...`);

            for (const wl of enabledWishLists) {
                // Skip if already has rolls
                if (wl.rolls && wl.rolls.size > 0) {
                    console.log(`[Wishlist] Wishlist ${wl.title} already has ${wl.rolls.size} items loaded`);
                    continue;
                }

                // Try to load from IndexedDB first
                try {
                    const rolls = await loadRollsFromIndexedDB(wl.id);
                    
                    if (rolls && rolls.size > 0) {
                        console.log(`[Wishlist] Loaded ${rolls.size} items from IndexedDB for ${wl.title}`);
                        store.updateWishListRolls(wl.id, rolls);
                    } else {
                        // No rolls in IndexedDB - refresh from URL
                        console.log(`[Wishlist] No rolls in IndexedDB for ${wl.title}, refreshing from URL...`);
                        store.refreshWishList(wl.id).catch(error => {
                            console.warn(`[Wishlist] Failed to refresh ${wl.title}:`, error);
                        });
                    }
                } catch (error) {
                    console.error(`[Wishlist] Error loading ${wl.title}:`, error);
                    // Try to refresh as fallback
                    store.refreshWishList(wl.id).catch(err => {
                        console.warn(`[Wishlist] Failed to refresh ${wl.title}:`, err);
                    });
                }
            }
        };

        // Small delay to ensure store is hydrated
        const timeoutId = setTimeout(initializeWishlists, 500);

        return () => {
            clearTimeout(timeoutId);
        };
    }, []); // Only run once on mount

    return null; // This component doesn't render anything
}

