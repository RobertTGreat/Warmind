
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
    ENHANCEMENT_PRISM: 4257549984,
    ASCENDANT_SHARD: 4257549985,
    ASCENDANT_ALLOY: 353704689,
    STRANGE_COIN: 800069450, // 30th Anni (Redeemable)
    STRANGE_COIN_XUR: 2569113415, // Current Xur Strange Coin (Currency)
};

// Presentation Node Hashes
export const PRESENTATION_NODES = {
    COLLECTIONS_ROOT: 3790247699,
    TRIUMPHS_ROOT: 1024788583,
    SEALS_ROOT: 616318467,
    EXOTICS: 1068557105, // Added Exotics
};

// Armor Stat Hashes (Primary use - these are the canonical hashes for armor)
// Armor 3.0 (Edge of Fate) renamed stats but hashes remain the same:
// - MOBILITY (2996146975) → Weapons: reload, handling, damage
// - RESILIENCE (392767087) → Health: shields, flinch resistance  
// - RECOVERY (1943323491) → Class: class ability cooldown
// - DISCIPLINE (1735777505) → Grenade: grenade cooldown
// - INTELLECT (144602215) → Super: super energy gain
// - STRENGTH (4244567218) → Melee: melee cooldown
// Stats now cap at 200 (T20) - T10+ (100+) unlocks enhanced effects
export const STAT_HASHES = {
    // Legacy names kept for API compatibility - map to new names in UI
    MOBILITY: 2996146975,    // Now "Weapons"
    RESILIENCE: 392767087,   // Now "Health"
    RECOVERY: 1943323491,    // Now "Class"
    DISCIPLINE: 1735777505,  // Now "Grenade"
    INTELLECT: 144602215,    // Now "Super"
    STRENGTH: 4244567218     // Now "Melee"
};

// Array of armor stat hashes for iteration (no duplicates)
export const ARMOR_STAT_HASHES = [
    STAT_HASHES.MOBILITY,
    STAT_HASHES.RESILIENCE,
    STAT_HASHES.RECOVERY,
    STAT_HASHES.DISCIPLINE,
    STAT_HASHES.INTELLECT,
    STAT_HASHES.STRENGTH
] as const;

/**
 * Calculates the Base Stats for armor by removing Masterwork and Mod bonuses.
 * 
 * @param currentStats - The live stats from the item instance.
 * @param activePlugs - Array of active plug definitions (mods, perks).
 * @param isMasterworked - Whether the item is Masterworked (Tier 10).
 * @returns Record of statHash -> baseValue
 */
export function getArmorBaseStats(
    currentStats: Record<string, { value: number }>,
    activePlugs: any[],
    isMasterworked: boolean
): Record<number, number> {
    const baseStats: Record<number, number> = {};

    // Initialize with current stats using the armor stat hashes array (no duplicates)
    ARMOR_STAT_HASHES.forEach(hash => {
        // Handle string/number keys
        const val = currentStats[hash]?.value ?? currentStats[String(hash)]?.value ?? 0;
        baseStats[hash] = val;
    });

    // 1. Remove Masterwork Bonus (+2 to all stats if MW)
    // Note: In current D2, MW gives +2 to all stats.
    if (isMasterworked) {
        ARMOR_STAT_HASHES.forEach(hash => {
            baseStats[hash] = Math.max(0, baseStats[hash] - 2);
        });
    }

    // 2. Remove Mod Bonuses
    // Look for General Armor Mods (e.g. "Major Recovery Mod" +10, "Minor Mobility Mod" +5)
    // And Artifice Mods (+3)
    if (activePlugs) {
        activePlugs.forEach(plug => {
            if (!plug || !plug.investmentStats) return;

            // Filter for Stat Mods
            // Heuristic: Check plugCategoryIdentifier for "armor_mods" or "enhancements"
            // And ensure it's not an intrinsic (which are usually permanent)
            // Or just check if it has investmentStats and is in a mod socket.
            // Assuming `activePlugs` passed here are from "Mod" sockets mostly.
            
            // Check categories
            const category = plug.plug?.plugCategoryIdentifier || "";
            const typeName = plug.itemTypeDisplayName?.toLowerCase() || "";
            
            const isStatMod = 
                category.includes("armor_mods") || 
                category.includes("enhancements.v2.general") ||
                typeName.includes("general armor mod") ||
                (typeName.includes("artifice") && typeName.includes("mod"));

            if (isStatMod) {
                plug.investmentStats.forEach((stat: any) => {
                    if (ARMOR_STAT_HASHES.includes(stat.statTypeHash)) {
                        baseStats[stat.statTypeHash] = Math.max(0, baseStats[stat.statTypeHash] - stat.value);
                    }
                });
            }
        });
    }

    return baseStats;
}

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
 * ARMOR TIERS (Base Stats):
 * TIER 1: < 57
 * TIER 2: 58 - 63
 * TIER 3: 64 - 69
 * TIER 4: 70 - 75
 * TIER 5: >= 75 (God Roll)
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
    instanceData?: any,
    reusablePlugsData?: Record<number, any[]> // Socket index -> array of available plugs
): number {
    if (!itemDef) return 1;

    // Disable tiering for Exotics (TierType 6)
    if (itemDef.inventory?.tierType === 6) return 1;

    // --- Armor Logic ---
    // Check if item has stats in instance data (Armor always has stats)
    if (instanceData?.stats && itemDef.itemType === 2) {
        // Artifice/Trade-off mod hashes (only usable on Artificer armor)
        // Armor 3.0 stats: Weapons, Health, Class, Grenade, Super, Melee
        const ARTIFICE_MOD_HASHES = [
            4030660414, // +Class / -Health (was Recovery/Resilience)
            455024236,  // +Grenade / -Health (was Discipline/Resilience)
            4164883102, // +Melee / -Health (was Strength/Resilience)
            4026414261, // +Super / -Health (was Intellect/Resilience)
            3121760799  // +Weapons / -Health (was Mobility/Resilience)
        ];
        
        // Collect active plugs to find mods and check for Artifice slot
        const activePlugs: any[] = [];
        let hasArtificeSlot = false;
        
        if (socketsData?.sockets && plugDefinitions) {
            socketsData.sockets.forEach((socket: any, socketIndex: number) => {
                // Check if an Artifice mod is equipped (by hash)
                if (ARTIFICE_MOD_HASHES.includes(socket.plugHash)) {
                    hasArtificeSlot = true;
                }
                
                // Check reusable plugs from socket data
                if (socket.reusablePlugs) {
                    socket.reusablePlugs.forEach((rp: any) => {
                        if (ARTIFICE_MOD_HASHES.includes(rp.plugItemHash)) {
                            hasArtificeSlot = true;
                        }
                    });
                }
                
                // Check reusable plugs from separate reusablePlugsData (profile.itemComponents.reusablePlugs)
                if (reusablePlugsData?.[socketIndex]) {
                    reusablePlugsData[socketIndex].forEach((rp: any) => {
                        if (ARTIFICE_MOD_HASHES.includes(rp.plugItemHash)) {
                            hasArtificeSlot = true;
                        }
                    });
                }
                
                if (socket.plugHash && plugDefinitions[socket.plugHash]) {
                    const plug = plugDefinitions[socket.plugHash];
                    activePlugs.push(plug);
                }
            });
        }

        const isMasterworked = (instanceData.state & 4) === 4;
        const baseStats = getArmorBaseStats(instanceData.stats, activePlugs, isMasterworked);
        
        let total = 0;
        ARMOR_STAT_HASHES.forEach(h => {
            total += baseStats[h] || 0;
        });

        // Armor Tiering (ItemType 2)
        // TIER 5: 75 base stats + Artifice mod slot - true god roll
        // TIER 4: MW + 70+ stats OR has Artifice slot (any stats)
        // TIER 3: MW + 64-69 OR non-MW + 70+
        // TIER 2: 58-63 stats
        // TIER 1: < 58 stats

        // Tier 5: 75+ base stats AND has Artifice mod slot
        if (total >= 75 && hasArtificeSlot) return 5;
        
        // Tier 4: MW + high stats OR any Artifice armor OR 75 stats without Artifice
        if ((isMasterworked && total >= 70) || hasArtificeSlot || total >= 75) return 4;
        
        // Tier 3: MW + good stats OR high stats without MW
        if ((isMasterworked && total >= 64) || total >= 70) return 3;
        
        // Tier 2: Decent stats
        if (total >= 58) return 2;
        
        return 1;
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

export interface ArmorQuality {
    min: number; // Current base total
    max: number; // Max possible for this tier
    percentage: number; // Quality percentage
}

/**
 * Calculates the quality of an armor roll based on its base stats.
 * 
 * @param baseStats - The base stats (without mods/MW).
 * @param itemDef - The item definition.
 * @returns ArmorQuality object or null if not applicable.
 */
export function getArmorQuality(
    baseStats: Record<number, number>,
    itemDef: any
): ArmorQuality | null {
    if (!itemDef || itemDef.itemType !== 2) return null;
    
    // Calculate total
    let total = 0;
    Object.values(baseStats).forEach(v => total += v);

    // Determine Max Base Stats
    // Exotic: 71 (Some go higher, but 71 is a safe "100%")
    // Legendary: 68
    // Class Item: 0 (or ignore)
    
    // If it's a class item, quality is usually irrelevant (always "perfect" or 0)
    if (itemDef.inventory?.bucketTypeHash === BUCKETS.CLASS_ARMOR) {
        return { min: 0, max: 0, percentage: 100 };
    }

    const isExotic = itemDef.inventory?.tierType === 6;
    const max = isExotic ? 71 : 68; // simplified DIM logic

    // Percentage
    const percentage = Math.min(100, (total / max) * 100);

    return {
        min: total,
        max: max,
        percentage: parseFloat(percentage.toFixed(1))
    };
}
