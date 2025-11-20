
/**
 * Utilities for Destiny 2 item logic, tiering, and categorization.
 */

// Bucket Hashes
export const BUCKETS = {
    KINETIC_WEAPON: 1498876634,
    ENERGY_WEAPON: 2465295065,
    POWER_WEAPON: 953998645,
    HELMET: 3448274439,
    GAUNTLETS: 3551918588,
    CHEST_ARMOR: 14239492,
    LEG_ARMOR: 20886954,
    CLASS_ARMOR: 1585787867,
    SUBCLASS: 3284755031,
    ENGRAMS: 375726501,
    LOST_ITEMS: 215593132,
    VAULT: 138197802,
    CONSUMABLES: 1469714392,
    MODS: 3313201758,
};

// Currency Hashes
export const CURRENCIES = {
    GLIMMER: 3159615086,
    BRIGHT_DUST: 2817410917,
};

// Material Item Hashes
export const MATERIALS = {
    ENHANCEMENT_CORE: 3853748946,
    ENHANCEMENT_PRISM: 4257549241,
    ASCENDANT_SHARD: 4257549242,
    ASCENDANT_ALLOY: 2979281381,
};

// Presentation Node Hashes
export const PRESENTATION_NODES = {
    COLLECTIONS_ROOT: 3790247699,
    TRIUMPHS_ROOT: 1024788583,
    SEALS_ROOT: 616318467,
};

/**
 * Determines the Tier of an item based on its Intrinsic Plug and Sockets.
 * Mirroring DIM's logic for "Edge of Fate" / Custom Tiering.
 * 
 * Logic:
 * 1. Inspect Intrinsic Socket.
 * 2. Check plugCategoryIdentifier for `intrinsic.edgeoffate.tierX` or `intrinsic.tier.X`.
 * 3. Check Plug Name for "Tier X" pattern.
 * 4. Fallback: Check for presence of Kill Effect / Combat Flair socket/plug (Tier 5).
 * 
 * @param itemDef - The DestinyInventoryItemDefinition of the item.
 * @param socketsData - The DestinyItemSocketsComponent (live socket data).
 * @param plugDefinitions - Map of plugHash to DestinyInventoryItemDefinition.
 * @returns The tier number (1-5). Defaults to 1.
 */
export function getItemTier(
    itemDef: any,
    socketsData: any,
    plugDefinitions: Record<number, any>
): number {
    if (!itemDef || !socketsData || !plugDefinitions) return 1;

    let detectedTier = 1;
    let foundIntrinsicTier = false;

    // Iterate all sockets to find the Intrinsic Plug with Tier info
    if (socketsData.sockets) {
        for (const socket of socketsData.sockets) {
            if (!socket.plugHash) continue;
            const plugDef = plugDefinitions[socket.plugHash];
            if (!plugDef) continue;

            const name = plugDef.displayProperties?.name || "";
            const typeName = plugDef.itemTypeDisplayName?.toLowerCase() || "";
            const categoryId = plugDef.plug?.plugCategoryIdentifier || "";

            // Exclude Masterworks
            if (typeName.includes("masterwork") || categoryId.includes("masterwork")) {
                continue;
            }

            // 1. Explicit Category Identifier Check (Edge of Fate Spec)
            // "intrinsic.edgeoffate.tier1" through "intrinsic.edgeoffate.tier5"
            if (categoryId.includes("intrinsic.edgeoffate.tier")) {
                 const match = categoryId.match(/intrinsic\.edgeoffate\.tier(\d+)/);
                 if (match) {
                     detectedTier = parseInt(match[1], 10);
                     foundIntrinsicTier = true;
                     break;
                 }
            }
            
            // Also check legacy/DIM custom pattern: "intrinsic.tier.5"
            if (categoryId.includes("intrinsic.tier")) {
                const match = categoryId.match(/intrinsic\.tier\.(\d+)/);
                if (match) {
                     detectedTier = parseInt(match[1], 10);
                     foundIntrinsicTier = true;
                     break;
                }
            }

            // 2. Name Regex Check
            // Spec: Name contains "Tier X"
            const tierMatch = name.match(/Tier (\d+)/);
            if (tierMatch) {
                // Ensure it's an Intrinsic-like plug to avoid false positives
                const isIntrinsic = 
                    typeName.includes("intrinsic") || 
                    typeName.includes("frame") ||
                    categoryId.includes("intrinsic") || 
                    categoryId.includes("frame") || 
                    name.includes("Tuning") || 
                    name.includes("Processing");
                
                // If it's explicitly Intrinsic OR we're confident in the match context
                if (isIntrinsic) { 
                     detectedTier = parseInt(tierMatch[1], 10);
                     foundIntrinsicTier = true;
                     break; 
                }
            }
        }
    }

    if (foundIntrinsicTier) return detectedTier;

    // 3. Tier 5 Validation (Kill Effect / Combat Flair)
    // "Does any socket utilize the Kill Effect Socket Type?"
    // "Often labeled 'Visual Tuning' or 'Kill Effect'"
    const hasKillEffect = Object.values(plugDefinitions).some((plug: any) => {
        if (!plug) return false;
        const typeName = plug.itemTypeDisplayName?.toLowerCase() || "";
        const name = plug.displayProperties?.name || "";
        const categoryId = plug.plug?.plugCategoryIdentifier || "";
        
        return typeName.includes("kill effect") || 
               typeName.includes("visual tuning") ||
               name.includes("Kill Effect") || 
               name.includes("Blue Flame") || 
               name.includes("Red Flame") ||
               categoryId.includes("kill_effect"); // Hypothetical
    });

    if (hasKillEffect) {
        return 5;
    }

    return 1; // Default
}

/**
 * Calculates the Base Power Level (BPL) for a character based on held items.
 * Considers Equipment and Inventory of the specific character.
 * Does NOT scan Vault or other characters (unless requested, but complex without definitions).
 * 
 * @param characterId - The ID of the character to calculate for.
 * @param characterEquipment - The characterEquipment component from profile.
 * @param characterInventories - The characterInventories component from profile.
 * @param itemInstances - The itemComponents.instances.data component.
 * @returns The calculated Base Power Level (floor of average of max per slot).
 */
export function calculateBasePowerLevel(
    characterId: string,
    characterEquipment: any,
    characterInventories: any,
    itemInstances: any
): number {
    const bestItems = getBestItemsPerSlot(characterId, characterEquipment, characterInventories, itemInstances);
    if (!bestItems) return 0;

    let totalPower = 0;
    let filledSlots = 0;

    Object.values(bestItems).forEach(item => {
         if (item.power > 0) {
             totalPower += item.power;
             filledSlots++;
         }
    });

    if (filledSlots === 0) return 0;
    
    // Always divide by 8 for base power, even if slots are missing (though realistic chars have all 8)
    return Math.floor(totalPower / 8);
}

/**
 * Finds the highest power item for each slot for a character.
 */
export function getBestItemsPerSlot(
    characterId: string,
    characterEquipment: any,
    characterInventories: any,
    itemInstances: any
): Record<number, { itemHash: number, itemInstanceId?: string, power: number, name?: string }> | null {
    if (!characterId || !characterEquipment || !characterInventories || !itemInstances) return null;

    const relevantBuckets = [
        BUCKETS.KINETIC_WEAPON,
        BUCKETS.ENERGY_WEAPON,
        BUCKETS.POWER_WEAPON,
        BUCKETS.HELMET,
        BUCKETS.GAUNTLETS,
        BUCKETS.CHEST_ARMOR,
        BUCKETS.LEG_ARMOR,
        BUCKETS.CLASS_ARMOR
    ];

    const bestItems: Record<number, { itemHash: number, itemInstanceId?: string, power: number }> = {};

    // Helper to process items
    const processItems = (items: any[]) => {
        if (!items) return;
        items.forEach(item => {
            if (relevantBuckets.includes(item.bucketHash)) {
                const instance = itemInstances[item.itemInstanceId];
                const power = instance?.primaryStat?.value;
                if (power) {
                    const currentMax = bestItems[item.bucketHash]?.power || 0;
                    if (power > currentMax) {
                        bestItems[item.bucketHash] = {
                            itemHash: item.itemHash,
                            itemInstanceId: item.itemInstanceId,
                            power: power
                        };
                    }
                }
            }
        });
    };

    // 1. Check Equipment
    if (characterEquipment[characterId]?.items) {
        processItems(characterEquipment[characterId].items);
    }

    // 2. Check Inventory
    if (characterInventories[characterId]?.items) {
        processItems(characterInventories[characterId].items);
    }

    return bestItems;
}
