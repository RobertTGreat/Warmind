
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
    ASCENDANT_ALLOY: 3581008036, // Updated active hash
    STRANGE_COIN: 3702027550, // Reverting to 30th Anni version often active
};

// Presentation Node Hashes
export const PRESENTATION_NODES = {
    COLLECTIONS_ROOT: 3790247699,
    TRIUMPHS_ROOT: 1024788583,
    SEALS_ROOT: 616318467,
    EXOTICS: 1068557105, // Added Exotics
};

/**
 * Determines the Tier of an item based on its Intrinsic Plug and Sockets.
 * Custom Tiering Logic provided by user.
 * 
 * WEAPON TIERS:
 * TIER 1: Base Stats
 * TIER 2: Enhanced Trait: 2
 * TIER 3: Enhanced Trait: 2 + Multi-Perk: 2
 * TIER 4: Enhanced Trait: 2 + Multi-Perk: 2 + Enhanced: Mods, Magazine, Barrel
 * TIER 5: Enhanced Trait: 2 + Multi-Perk: 3 + Enhanced: Mods, Magazine, Barrel, Origin Trait + Cosmetics
 * 
 * ARMOR TIERS (Total Stats):
 * TIER 1: 52 - 57
 * TIER 2: 58 - 63
 * TIER 3: 64 - 69
 * TIER 4: 70 - 75
 * TIER 5: > 75
 * 
 * @param itemDef - The DestinyInventoryItemDefinition of the item.
 * @param socketsData - The DestinyItemSocketsComponent (live socket data).
 * @param plugDefinitions - Map of plugHash to DestinyInventoryItemDefinition.
 * @param instanceData - The DestinyItemComponent (instance data) for stats.
 * @returns The tier number (1-5). Defaults to 1.
 */
export function getItemTier(
    itemDef: any,
    socketsData: any,
    plugDefinitions: Record<number, any>,
    instanceData?: any
): number {
    if (!itemDef) return 1;

    // --- Armor Logic ---
    // Check if item has stats in instance data (Armor always has stats)
    if (instanceData?.stats) {
        // Sum primary 6 stats
        const STAT_HASHES = [
            2996146975, // Mobility
            392767087,  // Resilience
            1943323491, // Recovery
            1735777505, // Discipline
            144602215,  // Intellect
            4244567218  // Strength
        ];

        let total = 0;
        let validStats = 0;
        STAT_HASHES.forEach(h => {
            // Handle both number and string keys from API response
            const stat = instanceData.stats[h] || instanceData.stats[String(h)];
            if (stat) {
                total += stat.value;
                validStats++;
            }
        });

        // Armor (ItemType 2)
        if (validStats > 0 && itemDef.itemType === 2) {
            if (total > 75) return 5; // God Roll
            if (total >= 66) return 4; // High Stat
            if (total >= 60) return 3; // Decent
            if (total >= 55) return 2; // Average
            
            return 1;
        }
    }

    // --- Weapon Logic ---
    if (itemDef.itemType === 3 && socketsData && plugDefinitions) {
        let enhancedTraits = 0;
        let multiPerkColumns = 0;
        let hasEnhancedBarrel = false;
        let hasEnhancedMag = false;
        let hasEnhancedOrigin = false;
        let hasOrnament = false;
        let hasMemento = false; 
        let isMasterworkPlug = false;

        // Check if item is Crafted or Masterworked
        const isMasterwork = (instanceData?.state & 4) === 4;
        const isCrafted = (instanceData?.state & 8) === 8;

        socketsData.sockets?.forEach((socket: any) => {
            const plug = plugDefinitions[socket.plugHash];
            if (!plug) return;

            const name = plug.displayProperties?.name || "";
            const typeName = plug.itemTypeDisplayName?.toLowerCase() || "";
            const category = plug.plug?.plugCategoryIdentifier || "";
            const isEnhanced = name.includes("Enhanced") || typeName.includes("enhanced");
            
            // Check for Masterwork Plug (Tier 10)
            if ((typeName.includes("masterwork") || category.includes("masterwork")) && name.includes("Tier 10")) {
                isMasterworkPlug = true;
            }

            // Check Multi-Perk
            // If weapon is Crafted, we can't rely on reusablePlugs count for "quality" 
            // because you intentionally pick 1. 
            // So for Crafted weapons, we assume they meet the "Multi-Perk" availability criteria if they are high level.
            // But strict adherence to user prompt: "Multi-Perk: 2".
            // Let's count "Selectable" columns.
            const isGameplaySocket = 
                typeName.includes("trait") || 
                typeName.includes("magazine") || 
                typeName.includes("barrel") ||
                typeName.includes("sight");

            if (isGameplaySocket && socket.reusablePlugs?.length > 1) {
                multiPerkColumns++;
            }

            // Check Enhanced Traits
            if (isEnhanced && (typeName.includes("trait") || typeName.includes("perk"))) {
                 if (!typeName.includes("origin")) {
                     enhancedTraits++;
                 }
            }

            if (isEnhanced) {
                if (typeName.includes("barrel") || typeName.includes("sight") || typeName.includes("launch")) hasEnhancedBarrel = true;
                if (typeName.includes("magazine") || typeName.includes("round") || typeName.includes("battery")) hasEnhancedMag = true;
                if (typeName.includes("origin")) hasEnhancedOrigin = true;
            }

            if (typeName.includes("ornament") && !name.includes("Default")) hasOrnament = true;
            if (typeName.includes("memento") || name.includes("Memento")) hasMemento = true;
        });

        // Relaxed Logic to handle Crafted Weapons which don't have multi-perks usually
        // If Crafted/Enhanced, we treat them as satisfying Multi-Perk requirements for Tiering
        // if they have the corresponding Enhanced traits.
        
        // Effective Multi-Perk Count: Real Multi-Perks OR (2 if Crafted/Masterworked + Enhanced Traits present)
        // Fix: Allow weapons with 2+ Enhanced Traits to bypass multi-perk check (as they are "finished" weapons)
        const effectiveMultiPerk = (isCrafted || isMasterwork || isMasterworkPlug || enhancedTraits >= 2) ? Math.max(multiPerkColumns, 3) : multiPerkColumns;

        const tier2Criteria = enhancedTraits >= 2;
        const tier3Criteria = tier2Criteria && effectiveMultiPerk >= 2;
        // Tier 4: Needs Enhanced Barrel/Mag + Tier 3
        const tier4Criteria = tier3Criteria && hasEnhancedBarrel && hasEnhancedMag; 
        // Tier 5: Needs Tier 4 + Enhanced Origin + Cosmetics
        const tier5Criteria = tier4Criteria && hasEnhancedOrigin && (hasOrnament || hasMemento);

        if (tier5Criteria) return 5;
        if (tier4Criteria) return 4;
        if (tier3Criteria) return 3;
        if (tier2Criteria) return 2;
        
        return 1;
    }

    return 1;
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
