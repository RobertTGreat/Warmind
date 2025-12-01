/**
 * Storage Hooks Module
 * 
 * Centralized exports for all storage-related React hooks.
 */

// Item Definitions (with Cache API backend)
export * from '../useItemDefinitions';

// Manifest Queries (with Dexie backend)
export {
    useManifestIndex,
    useManifestQuery,
    useAllWeapons,
    useExoticWeapons,
    useLegendaryWeapons,
    useWeaponsBySlot,
    useWeaponsByDamageType,
    useWeaponsBySubType,
    useAllArmor,
    useExoticArmor,
    useLegendaryArmor,
    useArmorBySlot,
    useTitanArmor,
    useHunterArmor,
    useWarlockArmor,
    useItemSearch,
    useManifestItem,
    useManifestItems,
    useItemsByCategory,
    useManifestStats,
    ITEM_TYPES,
    TIER_TYPES,
    DAMAGE_TYPES,
    WEAPON_BUCKETS,
    ARMOR_BUCKETS,
    OTHER_BUCKETS,
    WEAPON_SUBTYPES,
    // CLASS_TYPES exported from useLoadouts instead
} from '../useManifestQuery';

// Profile (with Dexie cache + stale-while-revalidate)
export { 
    useDestinyProfile,
    // CLASS_NAMES exported from useLoadouts instead
    type DestinyStats,
    type CharacterInfo,
    type ProfileCacheInfo,
} from '../useDestinyProfile';

// Item Annotations (tags/notes with Dexie backend)
export * from '../useItemAnnotations';

// Loadouts (with Dexie backend)
export * from '../useLoadouts';

// Wishlists (with Dexie backend)
export * from '../useWishlists';

