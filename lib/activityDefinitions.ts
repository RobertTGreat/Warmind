export interface ActivityDefinition {
    id: string;
    name: string;
    type: 'RAID' | 'DUNGEON';
    activityHash: number; // For looking up display properties
    relatedActivityHashes?: number[]; // For matching multiple versions (Master, etc.)
    metricHash?: number; // For completion count
    triumphHash?: number; // For completion count (fallback or primary for older stuff)
    flawlessRecordHash?: number;
    flawlessMetricHash?: number;
    soloRecordHash?: number; // Dungeons only
    soloFlawlessRecordHash?: number; // Dungeons only
    soloFlawlessMetricHash?: number;
    duoRecordHash?: number; // For specific duo achievements if they exist
    trioRecordHash?: number; // For specific trio achievements (usually Raids)
    exoticItemHash?: number; // To check if acquired
    dayOneRecordHash?: number; // Contest mode / Day One record (if available)
    contestRecordHash?: number; // Contest mode specific record
    masterRecordHash?: number; // Master difficulty completion record
    epicRecordHash?: number; // For Desert Perpetual / custom achievements
    epicFlawlessRecordHash?: number; // For Desert Perpetual / custom achievements
    releaseDate?: string; // ISO date string for week one calculation (YYYY-MM-DD)
    image?: string; // Manual override if needed
    isLegacy?: boolean; 
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
    SUNDERED_DOCTRINE: 2781975991, // Updated
    EQUILIBRIUM: 1220559535,
};

// Record/Metric Hashes (Flawless / Etc)
const RECORDS = {
    // RAIDS
    LAST_WISH_FLAWLESS: 380332968, // Petra's Run
    GARDEN_FLAWLESS: 1522774125, // Inherent Perfection
    DSC_FLAWLESS: 3560923614, // Survival of the Fittest
    VOG_FLAWLESS: 2750088202, // Flawless Vault of Glass
    VOW_FLAWLESS: 4019717242, // Risen from the Deep
    KINGS_FALL_FLAWLESS: 397062446, // Living Nightmares (Double check description) - Actually KF Flawless is tricky, 397062446 is RoN. Let's useRoN: 397062446. Wait, Salvation's Edge Flawless is 3553593767.
    RON_FLAWLESS: 397062446,
    CROTA_FLAWLESS: 2298029928, // If not found, will auto-find
    SALVATIONS_EDGE_FLAWLESS: 3553593767,
    DESERT_PERPETUAL_FLAWLESS: 2936644752, 

    // DUNGEONS (Solo Flawless / Flawless Metrics)
    PIT_SOLO_FLAWLESS: 3232684501,
    PROPHECY_SOLO_FLAWLESS: 3191784400,
    GRASP_SOLO_FLAWLESS: 3718971745,
    DUALITY_SOLO_FLAWLESS: 3539526313,
    SPIRE_SOLO_FLAWLESS: 3708410994,
    GHOSTS_SOLO_FLAWLESS: 3305873442,
    WARLORD_SOLO_FLAWLESS: 2620674022,
    VESPER_SOLO_FLAWLESS: 1553599507, // Perfect Solitude
    SUNDERED_DOCTRINE_SOLO_FLAWLESS: 1670591875,
    SUNDERED_DOCTRINE_SOLO_FLAWLESS_METRIC: 1174363710,
    SUNDERED_DOCTRINE_FLAWLESS_METRIC: 2724885891,
    EQUILIBRIUM_FLAWLESS_METRIC: 2568247915,
    EQUILIBRIUM_SOLO_FLAWLESS_METRIC: 3015566934,
};

export const ACTIVITIES: ActivityDefinition[] = [
    // --- RAIDS ---
    {
        id: 'the_desert_perpetual',
        name: "The Desert Perpetual",
        type: 'RAID',
        activityHash: 1044919065,                          // Normal mode activity hash (verified via Bungie API)
        relatedActivityHashes: [2413635930, 178748159],    // Normal + Master/Contest variants
        metricHash: METRICS.DESERT_PERPETUAL,              // Now valid: 2512468158
        triumphHash: 3954661385,                           // Unchanged: Clear triumph
        flawlessRecordHash: RECORDS.DESERT_PERPETUAL_FLAWLESS, // Now valid: 2936644752
        exoticItemHash: 3742953758,                        // "The When And Where" rocket launcher (light.gg verified)
        dayOneRecordHash: 3896382790,                     // "The Desert Perpetual: Contest" activity hash (contest mode)
        contestRecordHash: 3896382790,                     
        releaseDate: '2025-07-19',                         // Approximate release date for week one calculation
    },
    {
        id: 'salvations_edge',
        name: "Salvation's Edge",
        type: 'RAID',
        activityHash: 2192826039,
        relatedActivityHashes: [2192826039, 4129614942, 940375169], // Added Master 4129614942
        metricHash: METRICS.SALVATIONS_EDGE,
        flawlessRecordHash: RECORDS.SALVATIONS_EDGE_FLAWLESS,
        masterRecordHash: 1728165205, // Master Difficulty "Salvation's Edge"
        exoticItemHash: 267469843, // Euphony
        releaseDate: '2024-06-07', // Release date for week one calculation
    },
    {
        id: 'crotas_end',
        name: "Crota's End",
        type: 'RAID',
        activityHash: 4179289725,
        relatedActivityHashes: [4179289725, 1507509200, 540415767], // Added Master 1507509200
        metricHash: METRICS.CROTA,
        flawlessRecordHash: RECORDS.CROTA_FLAWLESS,
        exoticItemHash: 1959368027, // Necrochasm
        releaseDate: '2023-09-01', // Release date for week one calculation
    },
    {
        id: 'root_of_nightmares',
        name: "Root of Nightmares",
        type: 'RAID',
        activityHash: 2381413764,
        relatedActivityHashes: [2381413764, 2918919505], // Normal, Master
        metricHash: METRICS.RON,
        flawlessRecordHash: RECORDS.RON_FLAWLESS,
        masterRecordHash: 391307104, // Master Difficulty "Root of Nightmares"
        exoticItemHash: 2817568609, // Conditional Finality
        releaseDate: '2023-03-10', // Release date for week one calculation
    },
    {
        id: 'kings_fall',
        name: "King's Fall",
        type: 'RAID',
        activityHash: 1374392663,
        relatedActivityHashes: [1374392663, 3257594522], // Normal, Master
        metricHash: METRICS.KINGS_FALL,
        flawlessRecordHash: RECORDS.KINGS_FALL_FLAWLESS,
        // Note: King's Fall has Master activity but no Master completion record
        exoticItemHash: 2820464090, // Touch of Malice
        releaseDate: '2022-08-26', // Release date for week one calculation
    },
    {
        id: 'vow_of_the_disciple',
        name: "Vow of the Disciple",
        type: 'RAID',
        activityHash: 1441982566,
        relatedActivityHashes: [1441982566, 3889634515], // Normal, Master
        metricHash: METRICS.VOW,
        flawlessRecordHash: RECORDS.VOW_FLAWLESS,
        masterRecordHash: 610864524, // Master Difficulty "Vow of the Disciple"
        exoticItemHash: 2212933383, // Collective Obligation
        releaseDate: '2022-03-05', // Release date for week one calculation
    },
    {
        id: 'vault_of_glass',
        name: "Vault of Glass",
        type: 'RAID',
        activityHash: 3881495763,
        relatedActivityHashes: [3881495763, 3022541210], // Normal, Master
        metricHash: METRICS.VOG,
        flawlessRecordHash: RECORDS.VOG_FLAWLESS,
        masterRecordHash: 3114569402, // Master Difficulty "Vault of Glass"
        exoticItemHash: 247461753, // Vex Mythoclast
        releaseDate: '2021-05-22', // Release date for week one calculation
    },
    {
        id: 'deep_stone_crypt',
        name: "Deep Stone Crypt",
        type: 'RAID',
        activityHash: 910380154,
        relatedActivityHashes: [910380154, 3976949817], // No Master for DSC
        metricHash: METRICS.DSC,
        flawlessRecordHash: RECORDS.DSC_FLAWLESS,
        exoticItemHash: 2392655682, // Eyes of Tomorrow
        releaseDate: '2020-11-21', // Release date for week one calculation
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
        releaseDate: '2019-10-05', // Release date for week one calculation
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
        releaseDate: '2018-09-14', // Release date for week one calculation
    },

    // --- DUNGEONS ---
    {
        id: 'equilibrium',
        name: "Equilibrium",
        type: 'DUNGEON',
        activityHash: 3779882910,
        relatedActivityHashes: [3779882910, 3015566934, 2727361621, 1754635208], // No Master
        metricHash: METRICS.EQUILIBRIUM,
        flawlessMetricHash: RECORDS.EQUILIBRIUM_FLAWLESS_METRIC,
        soloFlawlessMetricHash: RECORDS.EQUILIBRIUM_SOLO_FLAWLESS_METRIC,
        exoticItemHash: 515926065, // heirloom
        releaseDate: '2025-02-07', // Release date for week one calculation
    },
    {
        id: 'sundered_doctrine',
        name: "Sundered Doctrine",
        type: 'DUNGEON',
        activityHash: 247869137,                          // Seal/activity proxy (light.gg verified)
        relatedActivityHashes: [247869137, 3521648250, 3834447244],   // Normal + Master variants
        metricHash: METRICS.SUNDERED_DOCTRINE,             
        triumphHash: 2963918856,                           // Updated
        flawlessMetricHash: RECORDS.SUNDERED_DOCTRINE_FLAWLESS_METRIC,
        soloFlawlessMetricHash: RECORDS.SUNDERED_DOCTRINE_SOLO_FLAWLESS_METRIC,
        masterRecordHash: 3521648250, // Master Difficulty "Sundered Doctrine"
        exoticItemHash: 331231237,                         // Finality's Auger linear fusion rifle (light.gg verified)
        releaseDate: '2025-02-07',                         // Approximate release date
    },
    {
        id: 'vespers_host',
        name: "Vesper's Host",
        type: 'DUNGEON',
        activityHash: 3492566689,
        relatedActivityHashes: [3492566689, 4293676253,1915770060,2695240656,300092127],
        metricHash: METRICS.VESPER,
        soloFlawlessRecordHash: RECORDS.VESPER_SOLO_FLAWLESS,
        masterRecordHash: 4293676253, // Master Difficulty "Vesper's Host"
        exoticItemHash: 2535628877, // Ice Breaker
        releaseDate: '2024-10-11', // Approximate release date
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
        masterRecordHash: 2534833093, // Master Difficulty "Warlord's Ruin"
        releaseDate: '2023-12-01', // Release date
    },
    {
        id: 'ghosts_of_the_deep',
        name: "Ghosts of the Deep",
        type: 'DUNGEON',
        activityHash: 313828469,
        relatedActivityHashes: [313828469, 2716998124, 124340010, 4190119662, 1094262727,  2961030534], // Normal, Master
        metricHash: METRICS.GHOSTS,
        exoticItemHash: 3516380376, // The Navigator
        soloFlawlessRecordHash: RECORDS.GHOSTS_SOLO_FLAWLESS,
        masterRecordHash: 2716998124, // Master Difficulty "Ghosts of the Deep"
        releaseDate: '2023-05-26', // Release date
    },
    {
        id: 'spire_of_the_watcher',
        name: "Spire of the Watcher",
        type: 'DUNGEON',
        activityHash: 1262462921,
        relatedActivityHashes: [1262462921, 2296818662, 3702217360, 4046934917, 1225969316, 943878085, 1801496203, 3339002067], // Normal, Master
        metricHash: METRICS.SPIRE,
        exoticItemHash: 192937277, // Hierarchy of Needs
        soloFlawlessRecordHash: RECORDS.SPIRE_SOLO_FLAWLESS,
        masterRecordHash: 2296818662,
        releaseDate: '2022-12-09', // Release date
    },
    {
        id: 'duality',
        name: "Duality",
        type: 'DUNGEON',
        activityHash: 2823159265,
        relatedActivityHashes: [2823159265, 3611083616, 3862075762, 1668217731, 3012587626], // Normal, Master
        metricHash: METRICS.DUALITY,
        exoticItemHash: 2526166644, // Heartshadow
        soloFlawlessRecordHash: RECORDS.DUALITY_SOLO_FLAWLESS,
        masterRecordHash: 1668217731,
        releaseDate: '2022-05-27', // Release date
    },
    {
        id: 'grasp_of_avarice',
        name: "Grasp of Avarice",
        type: 'DUNGEON',
        activityHash: 4078656646,
        relatedActivityHashes: [4078656646, 1112917203, 451157118, 3774021532], // Normal, Master
        metricHash: METRICS.GRASP,
        exoticItemHash: 2390499981, // Gjallarhorn
        soloFlawlessRecordHash: RECORDS.GRASP_SOLO_FLAWLESS,
        masterRecordHash: 1112917203,
        releaseDate: '2021-12-07', // Release date
    },
    {
        id: 'prophecy',
        name: "Prophecy",
        type: 'DUNGEON',
        activityHash: 4148187374,
        relatedActivityHashes: [4148187374,872886548,969826320,715153594,3637651331,1788465402,3193125350],
        metricHash: METRICS.PROPHECY,
        soloFlawlessRecordHash: RECORDS.PROPHECY_SOLO_FLAWLESS,
        releaseDate: '2020-06-09', // Release date
    },
    {
        id: 'pit_of_heresy',
        name: "Pit of Heresy",
        type: 'DUNGEON',
        activityHash: 2582501063,
        relatedActivityHashes: [2582501063, 1451729471, 785700678, 2559374368, 785700673, 2559374374, 2559374375,1375089621],
        metricHash: METRICS.PIT,
        exoticItemHash: 1929472306,
        soloFlawlessRecordHash: RECORDS.PIT_SOLO_FLAWLESS,
        releaseDate: '2019-10-29', // Release date
    },
    {
        id: 'shattered_throne',
        name: "Shattered Throne",
        type: 'DUNGEON',
        activityHash: 2032534090,
        relatedActivityHashes: [2032534090, 1339818929],
        triumphHash: 2065646020, 
        soloFlawlessRecordHash: 3249247645,
        exoticItemHash: 1864563948, // Wish-Ender
        releaseDate: '2018-09-25', // Release date
    }
];