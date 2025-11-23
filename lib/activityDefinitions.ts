
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
    VOW: 1481884437,
    KINGS_FALL: 2929188295,
    RON: 286663655,
    CROTA: 419614834,
    SALVATIONS_EDGE: 3292846252,

    // DUNGEONS
    PIT: 662466577,
    PROPHECY: 3024827974,
    GRASP: 3838728738,
    DUALITY: 166128401,
    SPIRE: 1278404531,
    GHOSTS: 2660931443,
    WARLORD: 3780576304,
    VESPER: 0 // Placeholder until API update
};

// Record Hashes (Flawless / Etc)
const RECORDS = {
    LAST_WISH_FLAWLESS: 4177910003,
    GARDEN_FLAWLESS: 1558682416,
    DSC_FLAWLESS: 3850081629,
    VOG_FLAWLESS: 3950276630,
    VOW_FLAWLESS: 2286623864,
    KINGS_FALL_FLAWLESS: 261554605,
    RON_FLAWLESS: 3056824086,
    CROTA_FLAWLESS: 2298029928,
    SALVATIONS_EDGE_FLAWLESS: 3436628258, 
};

export const ACTIVITIES: ActivityDefinition[] = [
    // --- RAIDS ---
    {
        id: 'salvations_edge',
        name: "Salvation's Edge",
        type: 'RAID',
        activityHash: 2052662744, // Standard Version
        relatedActivityHashes: [2052662744, 3376966203], // Normal, Master
        metricHash: 3292846252,
        flawlessRecordHash: 3436628258, 
        exoticItemHash: 267469843, // Euphony
    },
    {
        id: 'crotas_end',
        name: "Crota's End",
        type: 'RAID',
        activityHash: 540415767,
        relatedActivityHashes: [540415767, 1087761206], // Normal, Master
        metricHash: METRICS.CROTA,
        flawlessRecordHash: RECORDS.CROTA_FLAWLESS,
        exoticItemHash: 1959368027, // Necrochasm
    },
    {
        id: 'root_of_nightmares',
        name: "Root of Nightmares",
        type: 'RAID',
        activityHash: 1181565501,
        relatedActivityHashes: [1181565501, 3139014430], // Normal, Master
        metricHash: METRICS.RON,
        flawlessRecordHash: RECORDS.RON_FLAWLESS,
        exoticItemHash: 2817568609, // Conditional Finality
    },
    {
        id: 'kings_fall',
        name: "King's Fall",
        type: 'RAID',
        activityHash: 292102995,
        relatedActivityHashes: [292102995, 2692916568], // Normal, Master
        metricHash: METRICS.KINGS_FALL,
        flawlessRecordHash: RECORDS.KINGS_FALL_FLAWLESS,
        exoticItemHash: 2820464090, // Touch of Malice
    },
    {
        id: 'vow_of_the_disciple',
        name: "Vow of the Disciple",
        type: 'RAID',
        activityHash: 1441887206,
        relatedActivityHashes: [1441887206, 4217492330], // Normal, Master
        metricHash: METRICS.VOW,
        flawlessRecordHash: RECORDS.VOW_FLAWLESS,
        exoticItemHash: 2212933383, // Collective Obligation
    },
    {
        id: 'vault_of_glass',
        name: "Vault of Glass",
        type: 'RAID',
        activityHash: 3881495763,
        relatedActivityHashes: [3881495763, 1388536442], // Normal, Master
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
        activityHash: 2659723068,
        relatedActivityHashes: [2659723068], // No Master
        metricHash: METRICS.GARDEN,
        flawlessRecordHash: RECORDS.GARDEN_FLAWLESS,
        exoticItemHash: 3539486224, // Divinity
    },
    {
        id: 'last_wish',
        name: "Last Wish",
        type: 'RAID',
        activityHash: 212231333,
        relatedActivityHashes: [212231333], // No Master
        metricHash: METRICS.LAST_WISH,
        flawlessRecordHash: RECORDS.LAST_WISH_FLAWLESS,
        exoticItemHash: 2069224589, // One Thousand Voices
    },

    // --- DUNGEONS ---
    {
        id: 'vespers_host',
        name: "Vesper's Host",
        type: 'DUNGEON',
        activityHash: 3774021535, 
        relatedActivityHashes: [3774021535], // Add Master Hash if known
        metricHash: 0, // TBD
        exoticItemHash: 2535628877, // Ice Breaker
        soloFlawlessRecordHash: 0,
    },
    {
        id: 'warlords_ruin',
        name: "Warlord's Ruin",
        type: 'DUNGEON',
        activityHash: 245363579,
        relatedActivityHashes: [245363579, 1333015944], // Normal, Master
        metricHash: METRICS.WARLORD,
        exoticItemHash: 2978866586, // Buried Bloodline
        soloFlawlessRecordHash: 2620674022,
    },
    {
        id: 'ghosts_of_the_deep',
        name: "Ghosts of the Deep",
        type: 'DUNGEON',
        activityHash: 2012323598,
        relatedActivityHashes: [2012323598, 2740359481], // Normal, Master
        metricHash: METRICS.GHOSTS,
        exoticItemHash: 3516380376, // The Navigator
        soloFlawlessRecordHash: 3305873442,
    },
    {
        id: 'spire_of_the_watcher',
        name: "Spire of the Watcher",
        type: 'DUNGEON',
        activityHash: 3666319433,
        relatedActivityHashes: [3666319433, 166821702], // Normal, Master
        metricHash: METRICS.SPIRE,
        exoticItemHash: 192937277, // Hierarchy of Needs
        soloFlawlessRecordHash: 3708410994,
    },
    {
        id: 'duality',
        name: "Duality",
        type: 'DUNGEON',
        activityHash: 2823159265,
        relatedActivityHashes: [2823159265, 3611083616], // Normal, Master
        metricHash: METRICS.DUALITY,
        exoticItemHash: 2526166644, // Heartshadow
        soloFlawlessRecordHash: 3539526313,
    },
    {
        id: 'grasp_of_avarice',
        name: "Grasp of Avarice",
        type: 'DUNGEON',
        activityHash: 4078673071,
        relatedActivityHashes: [4078673071, 1604556526], // Normal, Master
        metricHash: METRICS.GRASP,
        exoticItemHash: 2390499981, // Gjallarhorn
        soloFlawlessRecordHash: 1579398922,
    },
    {
        id: 'prophecy',
        name: "Prophecy",
        type: 'DUNGEON',
        activityHash: 4148187374,
        relatedActivityHashes: [4148187374],
        metricHash: METRICS.PROPHECY,
        soloFlawlessRecordHash: 2674486330,
    },
    {
        id: 'pit_of_heresy',
        name: "Pit of Heresy",
        type: 'DUNGEON',
        activityHash: 1375089621,
        relatedActivityHashes: [1375089621],
        metricHash: METRICS.PIT,
        exoticItemHash: 1929472306, // Xenophage
        soloFlawlessRecordHash: 3232684501,
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
