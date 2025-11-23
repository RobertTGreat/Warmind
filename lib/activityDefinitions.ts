export interface ActivityDefinition {
    id: string;
    name: string;
    type: 'RAID' | 'DUNGEON';
    activityHash: number; // For looking up display properties
    relatedActivityHashes?: number[]; // For matching multiple versions (Master, etc.)
    metricHash?: number; // For completion count
    triumphHash?: number; // For completion count (fallback or primary for older stuff)
    flawlessRecordHash?: number;
    soloRecordHash?: number; // Dungeons only
    soloFlawlessRecordHash?: number; // Dungeons only
    exoticItemHash?: number; // To check if acquired
    dayOneRecordHash?: number;
    image?: string; // Manual override if needed
}

// Metric Hashes (Completions)
const METRICS = {
    // RAIDS
    LAST_WISH: 905240985,
    GARDEN: 1168279855,
    DSC: 954805812,
    VOG: 2506886274,
    VOW: 3585185883,
    KINGS_FALL: 1624029217,
    RON: 321051454,
    CROTA: 2552956848,
    SALVATIONS_EDGE: 31271381,
    DESERT_PERPETUAL: 2512468158, 

    // DUNGEONS
    PIT: 1451729471,
    PROPHECY: 352659556,
    GRASP: 451157118,
    DUALITY: 166128401,
    SPIRE: 3702217360,
    GHOSTS: 3846201365,
    WARLORD: 3932004679,
    VESPER: 2695240656,
    SUNDERED_DOCTRINE: 1777540712
};

// Record Hashes (Flawless / Etc)
const RECORDS = {
    // RAIDS
    LAST_WISH_FLAWLESS: 4177910003,
    GARDEN_FLAWLESS: 1558682416,
    DSC_FLAWLESS: 3850081629,
    VOG_FLAWLESS: 3950276630,
    VOW_FLAWLESS: 2286623864,
    KINGS_FALL_FLAWLESS: 261554605,
    RON_FLAWLESS: 3056824086,
    CROTA_FLAWLESS: 2298029928,
    SALVATIONS_EDGE_FLAWLESS: 3553593767,
    DESERT_PERPETUAL_FLAWLESS: 2936644752, 

    // DUNGEONS (Solo Flawless)
    PIT_SOLO_FLAWLESS: 3232684501,
    PROPHECY_SOLO_FLAWLESS: 3191784400,
    GRASP_SOLO_FLAWLESS: 3718971745,
    DUALITY_SOLO_FLAWLESS: 3539526313,
    SPIRE_SOLO_FLAWLESS: 3708410994,
    GHOSTS_SOLO_FLAWLESS: 3305873442,
    WARLORD_SOLO_FLAWLESS: 2620674022,
    VESPER_SOLO_FLAWLESS: 3254829425, // "Perfect Solitude"
    SUNDERED_DOCTRINE_SOLO_FLAWLESS: 1670591875
};

export const ACTIVITIES: ActivityDefinition[] = [
    // --- RAIDS ---
    {
        id: 'the_desert_perpetual',
        name: "The Desert Perpetual",
        type: 'RAID',
        activityHash: 2413635930,                          // Normal mode activity hash (verified via Bungie API)
        relatedActivityHashes: [2413635930, 178748159],    // Normal + Master/Contest variants
        metricHash: METRICS.DESERT_PERPETUAL,              // Now valid: 2512468158
        triumphHash: 3954661385,                           // Unchanged: Clear triumph
        flawlessRecordHash: RECORDS.DESERT_PERPETUAL_FLAWLESS, // Now valid: 2936644752
        exoticItemHash: 3742953758,                        // "The When And Where" rocket launcher (light.gg verified)
        dayOneRecordHash: 1238672274,                      // Day One clear (optional)
    },
    {
        id: 'salvations_edge',
        name: "Salvation's Edge",
        type: 'RAID',
        activityHash: 940375169,
        relatedActivityHashes: [940375169, 4129614942],
        metricHash: METRICS.SALVATIONS_EDGE,
        flawlessRecordHash: RECORDS.SALVATIONS_EDGE_FLAWLESS,
        exoticItemHash: 267469843, // Euphony
    },
    {
        id: 'crotas_end',
        name: "Crota's End",
        type: 'RAID',
        activityHash: 540415767,
        relatedActivityHashes: [540415767, 1507509200],
        metricHash: METRICS.CROTA,
        flawlessRecordHash: RECORDS.CROTA_FLAWLESS,
        exoticItemHash: 1959368027, // Necrochasm
    },
    {
        id: 'root_of_nightmares',
        name: "Root of Nightmares",
        type: 'RAID',
        activityHash: 2381413764,
        relatedActivityHashes: [2381413764, 2918919505], // Normal, Master
        metricHash: METRICS.RON,
        flawlessRecordHash: RECORDS.RON_FLAWLESS,
        exoticItemHash: 2817568609, // Conditional Finality
    },
    {
        id: 'kings_fall',
        name: "King's Fall",
        type: 'RAID',
        activityHash: 1374392663,
        relatedActivityHashes: [1374392663, 3257594522], // Normal, Master
        metricHash: METRICS.KINGS_FALL,
        flawlessRecordHash: RECORDS.KINGS_FALL_FLAWLESS,
        exoticItemHash: 2820464090, // Touch of Malice
    },
    {
        id: 'vow_of_the_disciple',
        name: "Vow of the Disciple",
        type: 'RAID',
        activityHash: 1441982566,
        relatedActivityHashes: [1441982566, 3889634515], // Normal, Master
        metricHash: METRICS.VOW,
        flawlessRecordHash: RECORDS.VOW_FLAWLESS,
        exoticItemHash: 2212933383, // Collective Obligation
    },
    {
        id: 'vault_of_glass',
        name: "Vault of Glass",
        type: 'RAID',
        activityHash: 3881495763,
        relatedActivityHashes: [3881495763, 3022541210], // Normal, Master
        metricHash: METRICS.VOG,
        flawlessRecordHash: RECORDS.VOG_FLAWLESS,
        exoticItemHash: 247461753, // Vex Mythoclast
    },
    {
        id: 'deep_stone_crypt',
        name: "Deep Stone Crypt",
        type: 'RAID',
        activityHash: 910380154,
        relatedActivityHashes: [910380154], // No Master for DSC
        metricHash: METRICS.DSC,
        flawlessRecordHash: RECORDS.DSC_FLAWLESS,
        exoticItemHash: 2392655682, // Eyes of Tomorrow
    },
    {
        id: 'garden_of_salvation',
        name: "Garden of Salvation",
        type: 'RAID',
        activityHash: 1042180643,
        relatedActivityHashes: [1042180643], // No Master
        metricHash: METRICS.GARDEN,
        flawlessRecordHash: RECORDS.GARDEN_FLAWLESS,
        exoticItemHash: 3539486224, // Divinity
    },
    {
        id: 'last_wish',
        name: "Last Wish",
        type: 'RAID',
        activityHash: 2122313384,
        relatedActivityHashes: [2122313384], // No Master
        metricHash: METRICS.LAST_WISH,
        flawlessRecordHash: RECORDS.LAST_WISH_FLAWLESS,
        exoticItemHash: 2069224589, // One Thousand Voices
    },

    // --- DUNGEONS ---
    {
        id: 'sundered_doctrine',
        name: "Sundered Doctrine",
        type: 'DUNGEON',
        activityHash: 2105055614,                          // Seal/activity proxy (light.gg verified)
        relatedActivityHashes: [2105055614, 3479286171],   // Normal + Master variants
        metricHash: METRICS.SUNDERED_DOCTRINE,             // Now valid: 1777540712
        triumphHash: 2105055614,                           // Unchanged: Clear triumph
        soloFlawlessRecordHash: RECORDS.SUNDERED_DOCTRINE_SOLO_FLAWLESS, // Now valid: 1670591875
        exoticItemHash: 331231237,                         // Finality's Auger linear fusion rifle (light.gg verified)
    },
    {
        id: 'vespers_host',
        name: "Vesper's Host",
        type: 'DUNGEON',
        activityHash: 3492566689,
        relatedActivityHashes: [3492566689, 4293676253],
        metricHash: METRICS.VESPER,
        soloFlawlessRecordHash: RECORDS.VESPER_SOLO_FLAWLESS,
        exoticItemHash: 2535628877, // Ice Breaker
    },
    {
        id: 'warlords_ruin',
        name: "Warlord's Ruin",
        type: 'DUNGEON',
        activityHash: 2004855007, // Normal
        relatedActivityHashes: [2004855007, 2534833093], // Normal, Master
        metricHash: METRICS.WARLORD,
        exoticItemHash: 2978866586, // Buried Bloodline
        soloFlawlessRecordHash: RECORDS.WARLORD_SOLO_FLAWLESS,
    },
    {
        id: 'ghosts_of_the_deep',
        name: "Ghosts of the Deep",
        type: 'DUNGEON',
        activityHash: 313828469,
        relatedActivityHashes: [313828469, 2716998124], // Normal, Master
        metricHash: METRICS.GHOSTS,
        exoticItemHash: 3516380376, // The Navigator
        soloFlawlessRecordHash: RECORDS.GHOSTS_SOLO_FLAWLESS,
    },
    {
        id: 'spire_of_the_watcher',
        name: "Spire of the Watcher",
        type: 'DUNGEON',
        activityHash: 1262462921,
        relatedActivityHashes: [1262462921, 2296818662], // Normal, Master
        metricHash: METRICS.SPIRE,
        exoticItemHash: 192937277, // Hierarchy of Needs
        soloFlawlessRecordHash: RECORDS.SPIRE_SOLO_FLAWLESS,
    },
    {
        id: 'duality',
        name: "Duality",
        type: 'DUNGEON',
        activityHash: 2823159265,
        relatedActivityHashes: [2823159265, 3611083616], // Normal, Master
        metricHash: METRICS.DUALITY,
        exoticItemHash: 2526166644, // Heartshadow
        soloFlawlessRecordHash: RECORDS.DUALITY_SOLO_FLAWLESS,
    },
    {
        id: 'grasp_of_avarice',
        name: "Grasp of Avarice",
        type: 'DUNGEON',
        activityHash: 4078656646,
        relatedActivityHashes: [4078656646, 1112917203], // Normal, Master
        metricHash: METRICS.GRASP,
        exoticItemHash: 2390499981, // Gjallarhorn
        soloFlawlessRecordHash: RECORDS.GRASP_SOLO_FLAWLESS,
    },
    {
        id: 'prophecy',
        name: "Prophecy",
        type: 'DUNGEON',
        activityHash: 4148187374,
        relatedActivityHashes: [4148187374],
        metricHash: METRICS.PROPHECY,
        soloFlawlessRecordHash: RECORDS.PROPHECY_SOLO_FLAWLESS,
    },
    {
        id: 'pit_of_heresy',
        name: "Pit of Heresy",
        type: 'DUNGEON',
        activityHash: 2582501063,
        relatedActivityHashes: [2582501063],
        metricHash: METRICS.PIT,
        exoticItemHash: 1929472306,
        soloFlawlessRecordHash: RECORDS.PIT_SOLO_FLAWLESS,
    },
    {
        id: 'shattered_throne',
        name: "Shattered Throne",
        type: 'DUNGEON',
        activityHash: 2032534090,
        relatedActivityHashes: [2032534090],
        triumphHash: 2065646020, 
        soloFlawlessRecordHash: 3249247645,
        exoticItemHash: 1864563948, // Wish-Ender
    }
];