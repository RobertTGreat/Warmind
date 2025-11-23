import { BUCKETS } from "./destinyUtils";

export interface ParsedSearch {
    text: string;
    filters: SearchFilter[];
    hideNonMatches: boolean; // True if query starts with 'h:' or contains 'is:dupe' (maybe?)
}

export interface SearchFilter {
    type: 'is' | 'power' | 'slot' | 'element' | 'season' | 'tag' | 'tier';
    value: string;
    op?: '>' | '<' | '=' | '>=' | '<=';
}

const DAMAGE_TYPE_HASHES: Record<string, number> = {
    'kinetic': 3373582085,
    'arc': 2303181850,
    'solar': 1847026933,
    'void': 3454344768,
    'stasis': 151347233,
    'strand': 3949783978
};

const SLOT_BUCKETS: Record<string, number> = {
    'kinetic': BUCKETS.KINETIC_WEAPON,
    'energy': BUCKETS.ENERGY_WEAPON,
    'power': BUCKETS.POWER_WEAPON,
    'helmet': BUCKETS.HELMET,
    'gauntlets': BUCKETS.GAUNTLETS,
    'chest': BUCKETS.CHEST_ARMOR,
    'leg': BUCKETS.LEG_ARMOR,
    'class': BUCKETS.CLASS_ARMOR
};

export function parseSearchQuery(query: string): ParsedSearch {
    if (!query) return { text: "", filters: [], hideNonMatches: false };

    let rawQuery = query.trim();
    const hideNonMatches = rawQuery.startsWith("h:");
    
    if (hideNonMatches) {
        rawQuery = rawQuery.substring(2).trim();
    }

    const terms: string[] = [];
    const filters: SearchFilter[] = [];

    const parts = rawQuery.split(/\s+/);

    parts.forEach(part => {
        const lower = part.toLowerCase();
        
        // Power Filters
        if (lower.startsWith("power") || lower.startsWith("light")) {
            const match = lower.match(/(?:power|light)([><]=?|=)(.+)/);
            if (match) {
                filters.push({ type: 'power', op: match[1] as any, value: match[2] });
                return;
            }
        }

        // IS: Filters
        if (lower.startsWith("is:")) {
            const value = lower.substring(3);
            filters.push({ type: 'is', value });
            return;
        }

        // Tier Filters (tier:5 or is:tier5)
        if (lower.startsWith("tier:")) {
            const value = lower.substring(5);
            filters.push({ type: 'tier', value });
            return;
        }

        // Normal terms
        terms.push(lower);
    });

    return {
        text: terms.join(" "),
        filters,
        hideNonMatches
    };
}

export function checkItemMatch(
    item: any, 
    def: any, 
    parsed: ParsedSearch, 
    instance?: any,
    allInventory?: any[] // Needed for dupe check
): boolean {
    if (!item || !def) return false;

    // 1. Check Text
    if (parsed.text) {
        const name = def.displayProperties?.name?.toLowerCase() || "";
        const type = def.itemTypeDisplayName?.toLowerCase() || "";
        if (!name.includes(parsed.text) && !type.includes(parsed.text)) {
            return false;
        }
    }

    // 2. Check Filters
    for (const filter of parsed.filters) {
        switch (filter.type) {
            case 'is':
                if (!checkIsFilter(filter.value, item, def, instance, allInventory)) return false;
                break;
            case 'power':
                if (!checkPowerFilter(filter.value, filter.op, instance)) return false;
                break;
            case 'tier': // Added Tier Check
                if (!checkTierFilter(filter.value, item, def, instance, allInventory)) return false;
                break;
            // Future: slot, element
        }
    }

    return true;
}

function checkTierFilter(value: string, item: any, def: any, instance: any, allInventory?: any[]): boolean {
    // Tier Logic requires full socket analysis which is heavy if we don't have cached tier data.
    // But checkIsFilter and checkItemMatch don't have access to sockets/plugDefs easily here unless passed.
    // We might need to rely on `item.tier` if we pre-calculated it, OR just skip complex tier logic for now 
    // and only support if `item` object has `tier` property attached (which we might need to ensure in the caller).
    
    // However, the `item` passed here is usually the raw item component from API + some context.
    // It doesn't have the calculated Tier (1-5) attached by default.
    // The caller (VaultPage/CharacterPage) calculates tier for display but doesn't attach it to the item object used for filtering.
    
    // To support `is:tier5`, we need to either:
    // 1. Pass calculated tier to this function
    // 2. Or re-calculate it here (needs plug definitions which we don't have)
    
    // OPTION 1 is best: Attach `tier` to the item object passed to `checkItemMatch` if possible.
    // But `checkItemMatch` signature is fixed for now.
    // Let's allow `instance` to carry it or check `item.calculatedTier`?
    
    // Let's assume the caller will attach `calculatedTier` to `item` if available.
    const tier = (item as any).calculatedTier;
    if (tier === undefined) return false; // Can't check if missing
    
    const targetTier = parseInt(value, 10);
    if (isNaN(targetTier)) return false;
    
    return tier === targetTier;
}

function checkIsFilter(value: string, item: any, def: any, instance: any, allInventory?: any[]): boolean {
    // ...
    // Handle `is:tierX` alias
    if (value.startsWith("tier")) {
        const tierVal = value.replace("tier", "");
        return checkTierFilter(tierVal, item, def, instance, allInventory);
    }

    switch (value) {
        // Rarity
        case 'exotic': return def.inventory?.tierTypeName === 'Exotic';
        case 'legendary': return def.inventory?.tierTypeName === 'Legendary';
        case 'rare': return def.inventory?.tierTypeName === 'Rare';
        case 'common': return def.inventory?.tierTypeName === 'Common';
        case 'basic': return def.inventory?.tierTypeName === 'Basic';
        
        // Type
        case 'weapon': return def.itemType === 3;
        case 'armor': return def.itemType === 2;
        
        // State
        case 'crafted': return (instance?.state & 8) === 8;
        case 'masterwork': return (instance?.state & 4) === 4;
        case 'locked': return (instance?.state & 1) === 1;
        
        // Damage Type (Simple Check via Default Damage)
        // Note: Instance damage type might differ (e.g. Osmosis), but usually default is fine for search
        case 'kinetic': return def.defaultDamageTypeHash === DAMAGE_TYPE_HASHES.kinetic || instance?.damageTypeHash === DAMAGE_TYPE_HASHES.kinetic;
        case 'arc': return def.defaultDamageTypeHash === DAMAGE_TYPE_HASHES.arc || instance?.damageTypeHash === DAMAGE_TYPE_HASHES.arc;
        case 'solar': return def.defaultDamageTypeHash === DAMAGE_TYPE_HASHES.solar || instance?.damageTypeHash === DAMAGE_TYPE_HASHES.solar;
        case 'void': return def.defaultDamageTypeHash === DAMAGE_TYPE_HASHES.void || instance?.damageTypeHash === DAMAGE_TYPE_HASHES.void;
        case 'stasis': return def.defaultDamageTypeHash === DAMAGE_TYPE_HASHES.stasis || instance?.damageTypeHash === DAMAGE_TYPE_HASHES.stasis;
        case 'strand': return def.defaultDamageTypeHash === DAMAGE_TYPE_HASHES.strand || instance?.damageTypeHash === DAMAGE_TYPE_HASHES.strand;

        // Complex
        case 'dupe':
            if (!allInventory) return false;
            // Count items with same itemHash
            // Note: Use a cached count map in real app for perf, but this is fine for client side < 600 items
            const count = allInventory.filter(i => i.itemHash === item.itemHash).length;
            return count > 1;
            
        case 'pattern':
             // Pattern logic is complex (requires querying presentation nodes or record hashes usually)
             // Fallback: Check if it has a pattern socket or similar? 
             // Actually, `inventory.recipeItemHash` exists on definition if it has a pattern usually?
             // Or `itemDef.sockets` has a recipe socket.
             // For now, let's skip strict pattern check unless we have profile records data.
             return false;

        default:
            return false;
    }
}

function checkPowerFilter(value: string, op: string | undefined, instance: any): boolean {
    if (!instance?.primaryStat?.value) return false;
    const itemPower = instance.primaryStat.value;
    const targetPower = parseInt(value, 10);
    
    if (isNaN(targetPower)) return false;

    switch (op) {
        case '>': return itemPower > targetPower;
        case '<': return itemPower < targetPower;
        case '>=': return itemPower >= targetPower;
        case '<=': return itemPower <= targetPower;
        case '=': return itemPower === targetPower;
        default: return itemPower === targetPower;
    }
}

