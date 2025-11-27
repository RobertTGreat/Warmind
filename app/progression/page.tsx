'use client';

import dynamic from 'next/dynamic';
import { useDestinyProfile } from "@/hooks/useDestinyProfile";
import { useItemDefinitions } from "@/hooks/useItemDefinitions";
import { Loader2, Swords, Shield, Grid3X3, Search, CheckCircle2 } from "lucide-react";
import { useState, useMemo, Fragment } from "react";
import { cn } from "@/lib/utils";

// Lazy load the heavy PageHeader
const PageHeader = dynamic(
  () => import("@/components/PageHeader").then((mod) => mod.PageHeader),
  { ssr: false }
);

// Known Hashes
const EXOTIC_CLASS_ITEM_HASHES = {
    HUNTER: 3273230820, // Relativism
    TITAN: 2773636829,  // Stoicism
    WARLOCK: 373760677  // Solipsism
};

const ERGO_SUM_HASH = 3514146698;

// Matrix Definitions
const CLASS_ITEM_PERKS = {
    COL1: [
        "Spirit of the Assassin", "Spirit of Inmost Light", "Spirit of Ophidian", "Spirit of Severance", 
        "Spirit of Hoarfrost", "Spirit of the Eternal Warrior", "Spirit of Abeyant", "Spirit of the Bear", 
        "Spirit of the Dragon", "Spirit of Galanor", "Spirit of Foetracer", "Spirit of Caliban", 
        "Spirit of Renewal", "Spirit of the Stag", "Spirit of the Filament", "Spirit of the Necrotic", 
        "Spirit of Osmiomancy", "Spirit of Apotheosis"
    ],
    COL2: [
        "Spirit of the Star-Eater", "Spirit of Synthoceps", "Spirit of Verity", "Spirit of Cyrtarachne", 
        "Spirit of Gyrfalcon", "Spirit of the Liar", "Spirit of the Wormhusk", "Spirit of the Coyote", 
        "Spirit of Scars", "Spirit of the Horn", "Spirit of Alpha Lupi", "Spirit of the Armamentarium", 
        "Spirit of Contact", "Spirit of the Claw", "Spirit of Starfire", "Spirit of Vesper", 
        "Spirit of Harmony", "Spirit of the Swarm"
    ]
};

const ERGO_SUM_PERKS = {
    FRAMES: ["Wave Sword Frame", "Caster Frame", "Vortex Frame", "Lightweight Frame", "Aggressive Frame"],
    TRAITS: [
        "Wolfpack Rounds", "Gathering Light", "Sacred Flame", "The Perfect Fifth", 
        "Arc Conductor", "Stormbringer", "Unplanned Reprieve", "Insectoid Robot Grenades"
    ]
};

const ARMOR_CLASSES = ['Titan', 'Hunter', 'Warlock'];

export default function ProgressionPage() {
    const { profile, isLoggedIn, isLoading } = useDestinyProfile();
    const [activeTab, setActiveTab] = useState<'exotic-class' | 'ergo-sum' | 'armor-sets'>('exotic-class');

    if (isLoading) {
        return (
            <div className="w-full h-[calc(100vh-80px)] flex items-center justify-center">
                <Loader2 className="w-12 h-12 animate-spin text-destiny-gold" />
            </div>
        );
    }

    if (!isLoggedIn) {
        return (
            <div className="p-10 text-center text-slate-400">
                Please login to view your progression.
            </div>
        );
    }

    return (
        <div className="min-h-screen p-4 md:p-8 pb-24">
            <PageHeader 
                title="Progression" 
                description="Track your collection of random-rolled exotics and armor sets."
            />

            {/* Tabs */}
            <div className="flex gap-4 mt-8 border-b border-white/10 pb-4 overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('exotic-class')}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-sm transition-colors whitespace-nowrap font-bold uppercase tracking-wider text-sm",
                        activeTab === 'exotic-class' ? "bg-destiny-gold text-slate-900" : " text-slate-400 hover:text-white"
                    )}
                >
                    <Shield className="w-4 h-4" />
                    Exotic Class Items
                </button>
                <button 
                    onClick={() => setActiveTab('ergo-sum')}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-sm transition-colors whitespace-nowrap font-bold uppercase tracking-wider text-sm",
                        activeTab === 'ergo-sum' ? "bg-destiny-gold text-slate-900" : " text-slate-400 hover:text-white"
                    )}
                >
                    <Swords className="w-4 h-4" />
                    Ergo Sum
                </button>
                <button 
                    onClick={() => setActiveTab('armor-sets')}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-sm transition-colors whitespace-nowrap font-bold uppercase tracking-wider text-sm",
                        activeTab === 'armor-sets' ? "bg-destiny-gold text-slate-900" : " text-slate-400 hover:text-white"
                    )}
                >
                    <Grid3X3 className="w-4 h-4" />
                    Armor Collection
                </button>
            </div>

            <div className="mt-8">
                {activeTab === 'exotic-class' && <ExoticClassItemChecker profile={profile} />}
                {activeTab === 'ergo-sum' && <ErgoSumChecker profile={profile} />}
                {activeTab === 'armor-sets' && <ArmorSetChecker profile={profile} />}
            </div>
        </div>
    );
}

// --- Components ---

function ExoticClassItemChecker({ profile }: { profile: any }) {
    const allItems = useAllItems(profile);
    
    const titanItems = allItems.filter((item: any) => item.itemHash === EXOTIC_CLASS_ITEM_HASHES.TITAN);
    const hunterItems = allItems.filter((item: any) => item.itemHash === EXOTIC_CLASS_ITEM_HASHES.HUNTER);
    const warlockItems = allItems.filter((item: any) => item.itemHash === EXOTIC_CLASS_ITEM_HASHES.WARLOCK);

    return (
        <div className="space-y-12">
            {titanItems.length > 0 && (
                <ExoticMatrix 
                    title="Stoicism (Titan)" 
                    items={titanItems} 
                    col1Perks={CLASS_ITEM_PERKS.COL1}
                    col2Perks={CLASS_ITEM_PERKS.COL2}
                />
            )}
            {hunterItems.length > 0 && (
                <ExoticMatrix 
                    title="Relativism (Hunter)" 
                    items={hunterItems} 
                    col1Perks={CLASS_ITEM_PERKS.COL1}
                    col2Perks={CLASS_ITEM_PERKS.COL2}
                />
            )}
            {warlockItems.length > 0 && (
                <ExoticMatrix 
                    title="Solipsism (Warlock)" 
                    items={warlockItems} 
                    col1Perks={CLASS_ITEM_PERKS.COL1}
                    col2Perks={CLASS_ITEM_PERKS.COL2}
                />
            )}
            
            {titanItems.length === 0 && hunterItems.length === 0 && warlockItems.length === 0 && (
                 <div className="text-center py-12 text-slate-500">
                     No Exotic Class Items found.
                 </div>
            )}
        </div>
    );
}

function ErgoSumChecker({ profile }: { profile: any }) {
    const allItems = useAllItems(profile);
    const swords = allItems.filter((item: any) => String(item.itemHash) === String(ERGO_SUM_HASH));

    return (
        <div className="space-y-6">
             <ExoticMatrix 
                title="Ergo Sum Collection" 
                items={swords} 
                col1Perks={ERGO_SUM_PERKS.FRAMES}
                col2Perks={ERGO_SUM_PERKS.TRAITS}
                isErgoSum
             />
        </div>
    );
}

function ArmorSetChecker({ profile }: { profile: any }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set(ARMOR_CLASSES));
    const allItems = useAllItems(profile);
    const socketsData = profile?.itemComponents?.sockets?.data;
    
    // Armor Buckets
    const ARMOR_BUCKETS = [3448274439, 3551918588, 14239492, 20886954, 1585787867];
    const ARCHETYPE_HASH = 778194869; // ArmorArchetypes plug category hash
    
    // Edge of Fate sets (and onwards) - case-insensitive matching for filtering
    const EDGE_OF_FATE_SETS = ['smoke jumper', 'bushido', 'aion adapter', 'aion renewal', 'aion', 'edge of fate', 'tusked allegiance', 'iron forerunner'];
    
    // Known set names to always show (will be populated from discovered sets)
    const KNOWN_SET_NAMES = new Set<string>();
    
    // Known archetypes with their hashes
    const ARCHETYPE_HASHES: Record<number, string> = {
        4227065942: 'Paragon',      // Paragon archetype
        3349393475: 'Brawler',      // Brawler archetype
        549468645: 'Bulwark',       // Bulwark archetype
        1807652646: 'Gunner',       // Gunner archetype
        2937665788: 'Grenadier',    // Grenadier archetype
        2230428468: 'Specialist',   // Specialist archetype
    };
    
    // Edge of Fate set hashes (from setData.hash in item definitions)
    // These will be populated from discovered items
    const SET_HASHES = new Set<number>();
    
    const ARCHETYPES = Object.values(ARCHETYPE_HASHES);
    const SLOTS = ['Helmet', 'Arms', 'Chest', 'Legs', 'Class'];

    // 1. Filter for Armor items
    const armorItems = useMemo(() => {
        return allItems.filter((item: any) => item.bucketHash && ARMOR_BUCKETS.includes(item.bucketHash));
    }, [allItems]);

    // 2. Get definitions
    const uniqueHashes = useMemo(() => {
        return Array.from(new Set(armorItems.map(i => i.itemHash)));
    }, [armorItems]);
    
    const { definitions: itemDefs, isLoading } = useItemDefinitions(uniqueHashes);

    // 3. Extract plug hashes for archetypes
    const plugHashes = useMemo(() => {
        const hashes = new Set<number>();
        armorItems.forEach(item => {
            const sockets = socketsData?.[item.itemInstanceId]?.sockets;
            if (sockets) {
                sockets.forEach((s: any) => {
                    if (s.plugHash) hashes.add(s.plugHash);
                });
            }
            // Also check item definition for default archetype
            const def = itemDefs?.[item.itemHash];
            if (def?.sockets?.socketEntries) {
                def.sockets.socketEntries.forEach((entry: any) => {
                    if (entry.socketCategoryHash === ARCHETYPE_HASH && entry.singleInitialItemHash) {
                        hashes.add(entry.singleInitialItemHash);
                    }
                });
            }
        });
        return Array.from(hashes);
    }, [armorItems, socketsData, itemDefs]);

    const { definitions: plugDefs } = useItemDefinitions(plugHashes);

    // 4. Process sets with archetypes - Structure: { ClassName: { SetName: { Slot: { Archetype: boolean } } } }
    const setsData = useMemo(() => {
        if (isLoading || !itemDefs) return null;

        const data: Record<string, Record<string, Record<string, Record<string, boolean>>>> = {
            'Titan': {},
            'Hunter': {},
            'Warlock': {}
        };

        // Helper function to extract set name from item definition
        const extractSetName = (def: any): string | null => {
            if (!def || !def.itemTypeDisplayName?.includes('Armor')) return null;
            
            let setName = def.displayProperties.name;
            const slotKeywords = [
                'Helmet', 'Helm', 'Mask', 'Hood', 'Cover', 'Visor', 'Casque', 'Cowl',
                'Gauntlets', 'Gloves', 'Grips', 'Grasps', 'Vambraces', 'Sleeves',
                'Plate', 'Vest', 'Robes', 'Tunic', 'Cuirass', 'Harness', 'Jacket',
                'Greaves', 'Boots', 'Strides', 'Trousers', 'Steps',
                'Mark', 'Cloak', 'Bond'
            ];

            setName = setName.replace(/\s(Chest|Leg)\sArmor$/i, "").trim();
            if (slotKeywords.some(k => setName.endsWith(k))) {
                setName = setName.replace(new RegExp(`\\s(${slotKeywords.join('|')})$`), "").trim();
            }

            // Normalize the set name (handle variations like "AION" vs "Aion")
            const normalizedName = setName.replace(/AION/gi, 'Aion');
            
            // Filter to only Edge of Fate sets - more flexible matching
            const setNameLower = normalizedName.toLowerCase();
            const matchingSet = EDGE_OF_FATE_SETS.find(set => {
                const setLower = set.toLowerCase();
                // Check if set name contains the search term OR search term contains set name
                return setNameLower.includes(setLower) || setLower.includes(setNameLower.split(' ')[0]);
            });
            
            if (matchingSet) {
                // Return normalized name, but prefer the canonical form from EDGE_OF_FATE_SETS
                // Map common variations to canonical names
                if (setNameLower.includes('techsec')) return 'Techsec';
                if (setNameLower.includes('aion adapter')) return 'Aion Adapter';
                if (setNameLower.includes('aion renewal')) return 'Aion Renewal';
                if (setNameLower.includes('smoke jumper')) return 'Smoke Jumper';
                if (setNameLower.includes('bushido')) return 'Bushido';
                if (setNameLower.includes('last discipline')) return 'Last Discipline';
                if (setNameLower.includes('disaster corps')) return 'Disaster Corps';
                if (setNameLower.includes('lustrous')) return 'Lustrous';
                if (setNameLower.includes('collective psyche')) return 'Collective Psyche';
                if (setNameLower.includes('wayward psyche')) return 'Wayward Psyche';
                if (setNameLower.includes('twofold crown')) return 'Twofold Crown';
                return normalizedName;
            }
            
            return null;
        };

        // First pass: Discover all set names from items
        const allDiscoveredSets = new Set<string>();

        armorItems.forEach(item => {
            const def = itemDefs[item.itemHash];
            const setName = extractSetName(def);
            if (setName) {
                allDiscoveredSets.add(setName);
            }
        });

        // Pre-populate all known Edge of Fate sets (canonical names)
        const canonicalSetNames = [
            'Smoke Jumper',
            'Bushido',
            'Aion Adapter',
            'Aion Renewal',
            'Techsec',
            'Last Discipline',
            'Disaster Corps',
            'Lustrous',
            'Collective Psyche',
            'Wayward Psyche',
            'Twofold Crown'
        ];
        
        canonicalSetNames.forEach(setName => {
            allDiscoveredSets.add(setName);
        });

        // Initialize all discovered sets for ALL classes (even if player doesn't have items for that class)
        ARMOR_CLASSES.forEach(cls => {
            allDiscoveredSets.forEach(setName => {
                if (!data[cls][setName]) {
                    data[cls][setName] = {
                        Helmet: {}, Arms: {}, Chest: {}, Legs: {}, Class: {}
                    };
                }
            });
        });

        // Second pass: Populate with actual item data
        armorItems.forEach(item => {
            const def = itemDefs[item.itemHash];
            const setName = extractSetName(def);
            if (!setName) return;

            // Determine Class
            const cls = def.classType === 0 ? 'Titan' : def.classType === 1 ? 'Hunter' : 'Warlock';
            
            // Determine Slot
            let slot = '';
            if (def.itemTypeDisplayName.includes('Helmet')) slot = 'Helmet';
            else if (def.itemTypeDisplayName.includes('Gauntlets')) slot = 'Arms';
            else if (def.itemTypeDisplayName.includes('Chest')) slot = 'Chest';
            else if (def.itemTypeDisplayName.includes('Leg')) slot = 'Legs';
            else if (def.itemTypeDisplayName.includes('Class') || def.itemTypeDisplayName.includes('Cloak') || def.itemTypeDisplayName.includes('Mark') || def.itemTypeDisplayName.includes('Bond')) slot = 'Class';
            
            if (!slot) return;

            // Get Archetype by hash
            let archetypeName: string | null = null;
            const sockets = socketsData?.[item.itemInstanceId]?.sockets;
            if (sockets && plugDefs) {
                for (const socket of sockets) {
                    if (socket?.plugHash) {
                        // Check if this plug hash matches a known archetype
                        if (ARCHETYPE_HASHES[socket.plugHash]) {
                            archetypeName = ARCHETYPE_HASHES[socket.plugHash];
                            break;
                        }
                        // Also check by category and name (for Bushido and other archetypes)
                        const plug = plugDefs[socket.plugHash];
                        if (plug) {
                            const categoryHash = plug.plug?.plugCategoryHash || plug.plugCategoryHash;
                            if (categoryHash === ARCHETYPE_HASH) {
                                const plugName = plug.displayProperties?.name || '';
                                // Check if it's a known archetype by name
                                if (ARCHETYPES.includes(plugName)) {
                                    archetypeName = plugName;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            
            // Fallback: Check item definition for default archetype
            if (!archetypeName && def.sockets?.socketEntries && plugDefs) {
                for (const entry of def.sockets.socketEntries) {
                    if (entry.socketCategoryHash === ARCHETYPE_HASH && entry.singleInitialItemHash) {
                        if (ARCHETYPE_HASHES[entry.singleInitialItemHash]) {
                            archetypeName = ARCHETYPE_HASHES[entry.singleInitialItemHash];
                            break;
                        }
                        // Also check by name
                        const archetypeDef = plugDefs[entry.singleInitialItemHash];
                        if (archetypeDef && ARCHETYPES.includes(archetypeDef.displayProperties?.name || '')) {
                            archetypeName = archetypeDef.displayProperties?.name || null;
                            break;
                        }
                    }
                }
            }

            // Only include known archetypes
            if (!archetypeName) return;
            
            // Track set hash if available
            if (def.setData?.hash) {
                SET_HASHES.add(def.setData.hash);
            }
            
            // Ensure structure exists
            if (!data[cls][setName]) {
                data[cls][setName] = {
                    Helmet: {}, Arms: {}, Chest: {}, Legs: {}, Class: {}
                };
            }
            
            if (!data[cls][setName][slot]) {
                data[cls][setName][slot] = {};
            }
            
            data[cls][setName][slot][archetypeName] = true;
        });

        return data;
    }, [armorItems, itemDefs, socketsData, plugDefs, isLoading]);

    const filteredSets = useMemo(() => {
        if (!setsData) return null;
        const result: typeof setsData = {};

        ARMOR_CLASSES.forEach(cls => {
            if (!selectedClasses.has(cls)) {
                result[cls] = {};
                return;
            }
            result[cls] = {};
            const classSets = setsData[cls];
            Object.keys(classSets).sort().forEach(setName => {
                if (setName.toLowerCase().includes(searchTerm.toLowerCase())) {
                    result[cls][setName] = classSets[setName];
                }
            });
        });

        return result;
    }, [setsData, searchTerm, selectedClasses]);

    const toggleClass = (cls: string) => {
        setSelectedClasses(prev => {
            const next = new Set(prev);
            if (next.has(cls)) {
                next.delete(cls);
            } else {
                next.add(cls);
            }
            return next;
        });
    };

    if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-destiny-gold" /></div>;

    return (
        <div className="space-y-8">
            {/* Search Bar with Class Toggles */}
            <div className="flex items-center gap-4 max-w-4xl mx-auto mb-8">
                {/* Class Toggle Buttons */}
                <div className="flex gap-2 shrink-0">
                    {ARMOR_CLASSES.map(cls => (
                        <button
                            key={cls}
                            onClick={() => toggleClass(cls)}
                            className={cn(
                                "px-4 py-2 rounded-sm border transition-colors font-bold uppercase tracking-wider text-sm",
                                selectedClasses.has(cls)
                                    ? "bg-destiny-gold/20 text-destiny-gold border-destiny-gold/40"
                                    : "bg-white/5 text-slate-400 border-white/10 hover:border-white/20"
                            )}
                        >
                            {cls}
                        </button>
                    ))}
                </div>
                
                {/* Search Bar */}
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-white/10 rounded-sm leading-5 text-slate-300 placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-destiny-gold focus:border-destiny-gold sm:text-sm transition-colors"
                        placeholder="Search armor sets..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Matrix Grids for Each Set */}
            {ARMOR_CLASSES.map(cls => {
                if (!selectedClasses.has(cls)) return null;
                const sets = filteredSets?.[cls];
                if (!sets || Object.keys(sets).length === 0) return null;

                return Object.entries(sets).map(([setName, setData]) => (
                    <ArmorSetMatrix 
                        key={`${cls}-${setName}`}
                        className={cls}
                        setName={setName}
                        setData={setData}
                        archetypes={ARCHETYPES}
                        slots={SLOTS}
                    />
                ));
            })}

            {(!filteredSets || Object.values(filteredSets).every(s => Object.keys(s).length === 0)) && (
                <div className="text-center py-12 text-slate-500">
                    No armor sets found matching your search.
                </div>
            )}
        </div>
    );
}

// Matrix component for displaying set + archetype grid
function ArmorSetMatrix({ 
    className, 
    setName, 
    setData, 
    archetypes, 
    slots 
}: { 
    className: string;
    setName: string;
    setData: Record<string, Record<string, boolean>>;
    archetypes: string[];
    slots: string[];
}) {
    return (
        <div className="p-6 rounded ">
            <div className="flex items-center gap-3 mb-6">
                <h3 className="text-xl font-bold text-white">{setName}</h3>
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-xs font-mono text-slate-500 uppercase">{className}</span>
            </div>

            <div className="overflow-x-auto pb-2">
                <div className="inline-block min-w-full">
                    <div className="grid gap-1" style={{ 
                        gridTemplateColumns: `auto repeat(${archetypes.length}, minmax(60px, 1fr))` 
                    }}>
                        {/* Header Row */}
                        <div className="sticky left-0 z-10 p-2 bg-gray-900/80 backdrop-blur-sm rounded-l-sm border border-white/5"></div>
                        {archetypes.map(archetype => (
                            <div 
                                key={archetype} 
                                className="text-xs font-bold text-slate-400 text-center py-2 flex items-center justify-center whitespace-nowrap border border-white/5 bg-gray-900/80 backdrop-blur-sm"
                            >
                                {archetype}
                            </div>
                        ))}

                        {/* Rows for each slot */}
                        {slots.map(slot => (
                            <Fragment key={slot}>
                                <div className="sticky left-0 z-10 text-right pr-4 py-2 pl-2 text-xs font-bold text-slate-300 flex items-center justify-end whitespace-nowrap bg-gray-900/80 backdrop-blur-sm rounded-l-sm border-y border-l border-white/5">
                                    {slot === 'Class' ? 'Class' : slot}
                                </div>
                                {archetypes.map((archetype, i) => {
                                    const isCollected = setData[slot]?.[archetype] === true;
                                    const isLast = i === archetypes.length - 1;
                                    return (
                                        <div 
                                            key={`${slot}-${archetype}`} 
                                            className={cn(
                                                "flex items-center justify-center p-2 border-y border-white/5 transition-colors relative group",
                                                isCollected ? "bg-green-500/10 hover:bg-green-500/20" : "hover:bg-white/5",
                                                isLast && "rounded-r-sm border-r"
                                            )}
                                            title={`${slot} - ${archetype}`}
                                        >
                                            {isCollected ? (
                                                <div className="relative">
                                                    <div className="absolute inset-0 bg-green-500 blur-md opacity-20" />
                                                    <CheckCircle2 className="w-5 h-5 text-green-500 relative z-10" />
                                                </div>
                                            ) : (
                                                <div className="w-1.5 h-1.5 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors" />
                                            )}
                                        </div>
                                    );
                                })}
                            </Fragment>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- Generic Matrix Component ---

function ExoticMatrix({ title, items, col1Perks, col2Perks, isErgoSum = false }: { title: string, items: any[], col1Perks: string[], col2Perks: string[], isErgoSum?: boolean }) {
    const { profile } = useDestinyProfile();
    const socketsData = profile?.itemComponents?.sockets?.data;
    const [plugHashes, setPlugHashes] = useState<Set<number>>(new Set());

    // Extract plugs from items
    useMemo(() => {
        if (!socketsData) return;
        const newHashes = new Set<number>();
        items.forEach(item => {
            const sockets = socketsData[item.itemInstanceId]?.sockets;
            if (sockets) {
                sockets.forEach((s: any) => {
                    if (s.isEnabled && s.plugHash) newHashes.add(s.plugHash);
                });
            }
        });
        setPlugHashes(newHashes);
    }, [items, socketsData]);

    const { definitions, isLoading } = useItemDefinitions(Array.from(plugHashes));

    // Build Matrix Data
    const { collectedSet, collectedCount, totalCount } = useMemo(() => {
        const empty = { collectedSet: new Set<string>(), collectedCount: 0, totalCount: col1Perks.length * col2Perks.length };
        if (isLoading || !definitions) return empty;
        
        const collectedSet = new Set<string>();

        items.forEach(item => {
            const sockets = socketsData?.[item.itemInstanceId]?.sockets;
            if (!sockets) return;

            const plugNames = sockets
                .map((s: any) => definitions[s.plugHash]?.displayProperties?.name)
                .filter(Boolean);

            // Find matches
            const p1 = col1Perks.find(p => plugNames.includes(p) || plugNames.some((n: string) => n?.includes(p)));
            const p2 = col2Perks.find(p => plugNames.includes(p) || plugNames.some((n: string) => n?.includes(p)));

            if (p1 && p2) {
                collectedSet.add(`${p1}|${p2}`);
            }
        });

        return {
            collectedSet,
            collectedCount: collectedSet.size,
            totalCount: empty.totalCount
        };
    }, [items, definitions, col1Perks, col2Perks, socketsData, isLoading]);

    if (isLoading) return <div className="animate-pulse text-slate-500">Loading matrix...</div>;

    return (
        <div className="p-6 rounded overflow-hidden border border-white/10">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    {isErgoSum ? <Swords className="w-5 h-5 text-destiny-gold" /> : <Shield className="w-5 h-5 text-purple-400" />}
                    {title}
                </h3>
                <div className="text-sm font-mono">
                    <span className={cn("font-bold", collectedCount === totalCount ? "text-green-500" : "text-white")}>
                        {collectedCount}
                    </span>
                    <span className="text-slate-500"> / {totalCount}</span>
                </div>
            </div>

            <div className="overflow-x-auto pb-2">
                <div className="inline-block min-w-full">
                    <div className="grid gap-1" style={{ 
                        gridTemplateColumns: `auto repeat(${col2Perks.length}, minmax(40px, 1fr))` 
                    }}>
                        {/* Header Row */}
                        <div className="sticky left-0 z-10 p-2"></div>
                        {col2Perks.map((col, i) => (
                            <div key={col} className="text-[10px] font-bold text-slate-400 text-center -rotate-45 h-32 flex items-end justify-center pb-2 whitespace-nowrap transform origin-bottom-left translate-x-6">
                                {col.replace("Spirit of ", "").replace(" Frame", "")}
                            </div>
                        ))}

                        {/* Rows */}
                        {col1Perks.map(row => (
                            <Fragment key={row}>
                                <div className="sticky left-0 z-10 text-right pr-4 py-2 text-xs font-bold text-slate-300 flex items-center justify-end whitespace-nowrap bg-gray-900/80 backdrop-blur-sm rounded-l-sm border-y border-l border-white/5">
                                    {row.replace("Spirit of ", "").replace(" Frame", "")}
                                </div>
                                {col2Perks.map((col, i) => {
                                    const isCollected = collectedSet.has(`${row}|${col}`);
                                    const isLast = i === col2Perks.length - 1;
                                    return (
                                        <div 
                                            key={`${row}-${col}`} 
                                            className={cn(
                                                "flex items-center justify-center p-2 border-y border-white/5 transition-colors relative group",
                                                isCollected ? "bg-green-500/5 hover:bg-green-500/10" : "hover:bg-white/5",
                                                isLast && "rounded-r-sm border-r"
                                            )}
                                            title={`${row} + ${col}`}
                                        >
                                            {isCollected ? (
                                                <div className="relative">
                                                    <div className="absolute inset-0 bg-green-500 blur-md opacity-20" />
                                                    <CheckCircle2 className="w-5 h-5 text-green-500 relative z-10" />
                                                </div>
                                            ) : (
                                                <div className="w-1.5 h-1.5 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors" />
                                            )}
                                        </div>
                                    );
                                })}
                            </Fragment>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function useAllItems(profile: any) {
    return useMemo(() => {
        if (!profile) return [];
        const items: any[] = [];
        
        if (profile.characterInventories?.data) {
            Object.values(profile.characterInventories.data).forEach((char: any) => items.push(...char.items));
        }
        if (profile.characterEquipment?.data) {
            Object.values(profile.characterEquipment.data).forEach((char: any) => items.push(...char.items));
        }
        if (profile.profileInventory?.data?.items) {
            items.push(...profile.profileInventory.data.items);
        }
        return items;
    }, [profile]);
}
