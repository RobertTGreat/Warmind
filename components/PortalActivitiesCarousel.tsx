'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { bungieApi, endpoints, getBungieImage } from '@/lib/bungie';
import { useDestinyProfile } from '@/hooks/useDestinyProfile';
import { 
    Loader2, 
    ChevronLeft, 
    ChevronRight, 
    Circle,
    Sparkles,
    Star
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Portal Bonus Drop item hashes
const PORTAL_BONUS_DROP_HASHES = [809643949, 3956025454];
const PORTAL_BONUS_DROP_ICON = 'https://www.bungie.net/common/destiny2_content/icons/08267c5d1e8364de7c3e4f5a76c85dfa.jpg';

// localStorage cache helpers
const CACHE_PREFIX = 'warmind_portal_';
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

function getFromCache<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;
    try {
        const cached = localStorage.getItem(CACHE_PREFIX + key);
        if (!cached) return null;
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp > CACHE_DURATION) {
            localStorage.removeItem(CACHE_PREFIX + key);
            return null;
        }
        return data as T;
    } catch {
        return null;
    }
}

function setToCache(key: string, data: any): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
    } catch {
        // Storage full or unavailable
    }
}

interface RewardDrop {
    hash: number;
    icon: string;
    name: string;
    isPortalBonusDrop: boolean;
    isFocusReward: boolean;
    quantity?: number;
}

interface ActivityData {
    hash: number;
    name: string;
    activityType: string;
    description: string;
    icon: string;
    pgcrImage: string;
    isMatchmade: boolean;
    minParty: number;
    maxParty: number;
    rewards: RewardDrop[];
    recommendedLight: number;
    canJoin: boolean;
    hasPortalBonusDrop: boolean;
    bonusDropCount: number;
    focusReward: RewardDrop | null;
}

interface PortalCategory {
    id: string;
    name: string;
    activities: ActivityData[];
}

// Memory cache for current session
const memoryCache = new Map<string, any>();

async function fetchWithCache(endpoint: string, cacheKey: string): Promise<any> {
    if (memoryCache.has(cacheKey)) {
        return memoryCache.get(cacheKey);
    }
    
    const cached = getFromCache<any>(cacheKey);
    if (cached) {
        memoryCache.set(cacheKey, cached);
        return cached;
    }
    
    try {
        const res = await bungieApi.get(endpoint);
        const data = res.data?.Response;
        if (data) {
            memoryCache.set(cacheKey, data);
            setToCache(cacheKey, data);
        }
        return data;
    } catch {
        return null;
    }
}

async function fetchActivityDefinition(hash: number): Promise<any> {
    return fetchWithCache(endpoints.getActivityDefinition(hash), `activity_${hash}`);
}

async function fetchItemDefinition(hash: number): Promise<any> {
    return fetchWithCache(endpoints.getInventoryItemDefinition(hash), `item_${hash}`);
}

export function PortalActivitiesCarousel() {
    const { membershipInfo, stats, isLoggedIn } = useDestinyProfile();
    const [categories, setCategories] = useState<PortalCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const membershipType = membershipInfo?.membershipType;
    const destinyMembershipId = membershipInfo?.membershipId;
    const characterId = stats?.characterId;

    useEffect(() => {
        async function loadActivities() {
            if (!isLoggedIn || !membershipType || !destinyMembershipId || !characterId) {
                setLoading(false);
                return;
            }
            
            setLoading(true);
            setError(null);
            
            try {
                const [activitiesRes, milestonesRes] = await Promise.all([
                    bungieApi.get(endpoints.getCharacterActivities(membershipType, destinyMembershipId, characterId)),
                    bungieApi.get(endpoints.getPublicMilestones())
                ]);
                
                const characterActivities = activitiesRes.data?.Response?.activities;
                const publicMilestones = milestonesRes.data?.Response || {};
                
                if (!characterActivities?.data?.availableActivities) {
                    setError('No available activities found');
                    setLoading(false);
                    return;
                }

                const availableActivities = characterActivities.data.availableActivities;
                
                // Build milestone map for bonus info
                const milestoneActivityMap = new Map<number, { 
                    modifierHashes: number[], 
                    challengeObjectiveHashes: number[]
                }>();
                
                for (const [_, milestone] of Object.entries(publicMilestones) as [string, any][]) {
                    if (milestone.activities) {
                        for (const activity of milestone.activities) {
                            milestoneActivityMap.set(activity.activityHash, {
                                modifierHashes: activity.modifierHashes || [],
                                challengeObjectiveHashes: activity.challengeObjectiveHashes || []
                            });
                        }
                    }
                }

                const soloActivities: ActivityData[] = [];
                const fireteamActivities: ActivityData[] = [];
                const pinnacleActivities: ActivityData[] = [];

                // Process activities in parallel
                const activityPromises = availableActivities.map(async (activity: any) => {
                    const def = await fetchActivityDefinition(activity.activityHash);
                    if (!def?.displayProperties?.name) return null;
                    if (!def.pgcrImage || def.pgcrImage.includes('placeholder')) return null;
                    if (def.isPvP) return null;

                    // Check for Portal Bonus Drops in challenges
                    let hasPortalBonusDrop = false;
                    let bonusDropCount = 0;
                    const rewards: RewardDrop[] = [];

                    let focusReward: RewardDrop | null = null;

                    // First, get challenge rewards (Portal Bonus Drops)
                    if (def.challenges?.length > 0) {
                        const rewardHashes: { itemHash: number; quantity: number }[] = [];
                        
                        for (const challenge of def.challenges) {
                            if (challenge.dummyRewards?.length > 0) {
                                for (const reward of challenge.dummyRewards) {
                                    rewardHashes.push({ 
                                        itemHash: reward.itemHash, 
                                        quantity: reward.quantity || 1 
                                    });
                                }
                            }
                        }

                        // Fetch all reward definitions in parallel
                        const rewardDefs = await Promise.all(
                            rewardHashes.map(r => fetchItemDefinition(r.itemHash))
                        );

                        for (let i = 0; i < rewardHashes.length; i++) {
                            const itemDef = rewardDefs[i];
                            const { itemHash, quantity } = rewardHashes[i];
                            
                            if (!itemDef?.displayProperties) continue;

                            // Check if this is a Portal Bonus Drop
                            const isPortalBonusDrop = PORTAL_BONUS_DROP_HASHES.includes(itemHash) ||
                                itemDef.itemTypeDisplayName?.toLowerCase().includes('portal bonus');
                            
                            if (isPortalBonusDrop) {
                                hasPortalBonusDrop = true;
                                bonusDropCount += quantity;
                            }

                            rewards.push({
                                hash: itemHash,
                                icon: itemDef.displayProperties.icon 
                                    ? getBungieImage(itemDef.displayProperties.icon)
                                    : PORTAL_BONUS_DROP_ICON,
                                name: itemDef.displayProperties.name || 'Reward',
                                isPortalBonusDrop,
                                isFocusReward: false,
                                quantity
                            });
                        }
                    }

                    // Also check activity rewards for focus items
                    if (def.rewards?.length > 0) {
                        const focusHashes: { itemHash: number; quantity: number }[] = [];
                        
                        for (const rewardEntry of def.rewards) {
                            if (rewardEntry.rewardItems?.length > 0) {
                                for (const item of rewardEntry.rewardItems) {
                                    // Avoid duplicates from challenges
                                    if (!rewards.some(r => r.hash === item.itemHash)) {
                                        focusHashes.push({
                                            itemHash: item.itemHash,
                                            quantity: item.quantity || 1
                                        });
                                    }
                                }
                            }
                        }

                        if (focusHashes.length > 0) {
                            const focusDefs = await Promise.all(
                                focusHashes.map(r => fetchItemDefinition(r.itemHash))
                            );

                            for (let i = 0; i < focusHashes.length; i++) {
                                const itemDef = focusDefs[i];
                                const { itemHash, quantity } = focusHashes[i];
                                
                                if (!itemDef?.displayProperties) continue;
                                
                                // Skip generic engrams and materials
                                const itemType = itemDef.itemType;
                                const itemSubType = itemDef.itemSubType;
                                const isGenericMaterial = itemType === 0 || // None/Unknown
                                    itemDef.itemCategoryHashes?.includes(40) || // Materials
                                    itemDef.displayProperties?.name?.toLowerCase().includes('glimmer');
                                
                                if (isGenericMaterial) continue;
                                
                                // Check if it's a weapon or armor (the focus reward)
                                const isWeaponOrArmor = 
                                    itemType === 2 || // Armor
                                    itemType === 3 || // Weapon
                                    itemSubType > 0;
                                
                                const rewardData: RewardDrop = {
                                    hash: itemHash,
                                    icon: itemDef.displayProperties.icon
                                        ? getBungieImage(itemDef.displayProperties.icon)
                                        : '',
                                    name: itemDef.displayProperties.name || 'Reward',
                                    isPortalBonusDrop: false,
                                    isFocusReward: isWeaponOrArmor,
                                    quantity
                                };

                                if (isWeaponOrArmor && !focusReward) {
                                    focusReward = rewardData;
                                }
                                
                                rewards.push(rewardData);
                            }
                        }
                    }

                    // If no rewards found, add a generic gear placeholder only
                    if (rewards.length === 0) {
                        rewards.push({
                            hash: 1,
                            icon: 'https://www.bungie.net/common/destiny2_content/icons/f846f489c2a97afb289b357e431ecf8d.png',
                            name: 'Gear',
                            isPortalBonusDrop: false,
                            isFocusReward: false
                        });
                    }

                    // Determine activity type
                    let activityType = 'Activity';
                    const name = (def.displayProperties.name || '').toLowerCase();
                    if (name.includes('onslaught')) activityType = 'Onslaught';
                    else if (name.includes('battleground')) activityType = 'Battleground';
                    else if (name.includes('contest')) activityType = 'Contest';
                    else if (name.includes('expedition')) activityType = 'Expedition';
                    else if (name.includes('deep dive')) activityType = 'Deep Dive';
                    else if (name.includes('strike')) activityType = 'Strike';
                    else if (name.includes('nightfall')) activityType = 'Nightfall';
                    else if (name.includes('lost sector')) activityType = 'Lost Sector';
                    else if (name.includes('dungeon')) activityType = 'Dungeon';
                    else if (name.includes('raid')) activityType = 'Raid';
                    else if (name.includes('legend') || name.includes('master')) activityType = 'Legend';
                    else if (name.includes('expert')) activityType = 'Expert';

                    // Clean display name
                    let displayName = def.originalDisplayProperties?.name || def.displayProperties.name;
                    displayName = displayName.replace(/^(Legend|Expert|Master|Adept):\s*/i, '');
                    if (displayName.length > 30 && displayName.includes(':')) {
                        displayName = displayName.split(':')[0].trim();
                    }

                    // Categorize
                    const isHighDifficulty = 
                        (activity.recommendedLight || def.activityLightLevel || 0) >= 1980 || 
                        def.tier >= 3 ||
                        name.includes('legend') || 
                        name.includes('master') ||
                        name.includes('grandmaster') ||
                        name.includes('expert');
                    
                    const isSolo = 
                        def.matchmaking?.maxParty === 1 ||
                        (!def.matchmaking?.isMatchmade && def.matchmaking?.minParty === 1 && def.matchmaking?.maxParty <= 1) ||
                        name.includes('lost sector');

                    return {
                        data: {
                            hash: activity.activityHash,
                            name: displayName,
                            activityType,
                            description: def.displayProperties.description || '',
                            icon: def.displayProperties.icon ? getBungieImage(def.displayProperties.icon) : '',
                            pgcrImage: getBungieImage(def.pgcrImage),
                            isMatchmade: def.matchmaking?.isMatchmade || false,
                            minParty: def.matchmaking?.minParty || 1,
                            maxParty: def.matchmaking?.maxParty || 3,
                            rewards: rewards.slice(0, 8), // Show up to 8 rewards
                            recommendedLight: activity.recommendedLight || def.activityLightLevel || 0,
                            canJoin: activity.canJoin || false,
                            hasPortalBonusDrop,
                            bonusDropCount,
                            focusReward,
                        } as ActivityData,
                        category: isHighDifficulty ? 'pinnacle' : isSolo ? 'solo' : def.matchmaking?.isMatchmade ? 'fireteam' : null
                    };
                });

                const results = await Promise.all(activityPromises);
                
                for (const result of results) {
                    if (!result || !result.category) continue;
                    if (result.category === 'pinnacle') pinnacleActivities.push(result.data);
                    else if (result.category === 'solo') soloActivities.push(result.data);
                    else if (result.category === 'fireteam') fireteamActivities.push(result.data);
                }

                // Sort by bonus drops first
                const sortByBonus = (a: ActivityData, b: ActivityData) => {
                    if (a.hasPortalBonusDrop && !b.hasPortalBonusDrop) return -1;
                    if (!a.hasPortalBonusDrop && b.hasPortalBonusDrop) return 1;
                    return b.bonusDropCount - a.bonusDropCount;
                };

                // Filter to only activities with Portal Bonus Drops for a focused view
                const filterBonusActivities = (activities: ActivityData[]) => 
                    activities.filter(a => a.hasPortalBonusDrop);

                setCategories([
                    {
                        id: 'solo',
                        name: 'Solo Ops',
                        activities: filterBonusActivities(soloActivities).sort(sortByBonus),
                    },
                    {
                        id: 'fireteam',
                        name: 'Fireteam Ops',
                        activities: filterBonusActivities(fireteamActivities).sort(sortByBonus),
                    },
                    {
                        id: 'pinnacle',
                        name: 'Pinnacle Ops',
                        activities: filterBonusActivities(pinnacleActivities).sort(sortByBonus),
                    },
                ]);
                
            } catch (err) {
                console.error('Error loading activities:', err);
                setError('Failed to load activities');
            }
            
            setLoading(false);
        }

        loadActivities();
    }, [isLoggedIn, membershipType, destinyMembershipId, characterId]);

    if (!isLoggedIn) {
        return (
            <div className="flex flex-col gap-6">
                {[1, 2, 3].map(i => (
                    <div key={i} className="aspect-video bg-white/5 rounded-lg flex items-center justify-center">
                        <span className="text-xs text-slate-500">Login to view</span>
                    </div>
                ))}
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col gap-6">
                {[1, 2, 3].map(i => (
                    <div key={i} className="aspect-video bg-white/5 rounded-lg animate-pulse flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col gap-6">
                {[1, 2, 3].map(i => (
                    <div key={i} className="aspect-video bg-white/5 rounded-lg flex items-center justify-center">
                        <span className="text-xs text-red-400">{error}</span>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {categories.map((category) => (
                <SingleActivityCarousel key={category.id} category={category} />
            ))}
        </div>
    );
}

function SingleActivityCarousel({ category }: { category: PortalCategory }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const totalCount = category.activities.length;

    const goNext = useCallback(() => {
        if (totalCount > 0) {
            setCurrentIndex((prev) => (prev + 1) % totalCount);
        }
    }, [totalCount]);

    const goPrev = useCallback(() => {
        if (totalCount > 0) {
            setCurrentIndex((prev) => (prev - 1 + totalCount) % totalCount);
        }
    }, [totalCount]);

    // Keyboard navigation when hovered
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isHovered) return;
            
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                goNext();
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                goPrev();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isHovered, goNext, goPrev]);

    if (category.activities.length === 0) {
        return (
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                        {category.name}
                    </span>
                </div>
                <div className="aspect-video border border-dashed border-white/10 flex items-center justify-center text-xs text-slate-600">
                    No activities
                </div>
            </div>
        );
    }

    const activity = category.activities[currentIndex];

    return (
        <div 
            ref={containerRef}
            className="space-y-2"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            tabIndex={0}
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    {category.name}
                </span>
                <div className="flex items-center gap-1">
                    <button 
                        onClick={goPrev}
                        className="p-1 hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[10px] text-slate-500 min-w-[36px] text-center">
                        {currentIndex + 1}/{totalCount}
                    </span>
                    <button 
                        onClick={goNext}
                        className="p-1 hover:bg-white/10  text-slate-500 hover:text-white transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Activity Card - 16:9 aspect ratio */}
            <ActivityCard activity={activity} isHovered={isHovered} />

            {/* Dots - show up to 15, then just show count */}
            <div className="flex justify-center gap-1.5">
                {totalCount <= 15 ? (
                    category.activities.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrentIndex(idx)}
                            className={cn(
                                "transition-all rounded-full",
                                idx === currentIndex 
                                    ? "w-4 h-1.5 bg-white" 
                                    : "w-1.5 h-1.5 bg-white/30 hover:bg-white/50"
                            )}
                        />
                    ))
                ) : (
                    <span className="text-[10px] text-slate-500">
                        {currentIndex + 1} of {totalCount}
                    </span>
                )}
            </div>
        </div>
    );
}

function ActivityCard({ activity, isHovered }: { activity: ActivityData; isHovered: boolean }) {
    return (
        <div className={cn(
            "relative aspect-video overflow-hidden transition-all",
            isHovered && "ring-1 ring-white/20"
        )}>
            {/* Background Image */}
            <div 
                className="absolute inset-0 bg-cover bg-center transition-transform duration-300"
                style={{ 
                    backgroundImage: `url(${activity.pgcrImage})`,
                    transform: isHovered ? 'scale(1.02)' : 'scale(1)'
                }}
            />
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/20" />

            {/* Portal Bonus Drop Badge */}
            {activity.hasPortalBonusDrop && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 backdrop-blur-sm bg-black/40 rounded">
                    <img 
                        src={PORTAL_BONUS_DROP_ICON} 
                        alt="Portal Bonus Drop"
                        className="w-5 h-5 object-contain"
                    />
                    <span className="text-xs font-bold text-yellow-400">
                        x{activity.bonusDropCount}
                    </span>
                </div>
            )}

            {/* Keyboard hint when hovered */}
            {isHovered && (
                <div className="absolute top-3 left-3 text-[9px] text-white/50 bg-black/50 px-1.5 py-0.5 rounded">
                    ← → to navigate
                </div>
            )}

            {/* Content */}
            <div className="relative h-full flex flex-col justify-end p-4">
                {/* Activity Type */}
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                    {activity.activityType}
                </div>
                
                {/* Activity Name */}
                <h3 className="text-lg font-bold text-white leading-tight mb-3">
                    {activity.name}
                </h3>

                {/* Bottom Row */}
                <div className="flex items-end justify-between gap-3">
                    {/* Rewards - styled like in-game */}
                    <div className="flex items-center gap-2">
                        {/* Show Portal Bonus Drop with count */}
                        {activity.hasPortalBonusDrop && (
                            <div 
                                className="relative group"
                                title={`Portal Bonus Drop x${activity.bonusDropCount}`}
                            >
                                <div className="w-10 h-10 rounded overflow-hidden ring-2 ring-yellow-500/70">
                                    <img 
                                        src={PORTAL_BONUS_DROP_ICON} 
                                        alt="Portal Bonus Drop"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                {/* Bonus count badge - always show */}
                                <div className="absolute -bottom-1.5 -right-1.5 bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shadow-lg">
                                    x{activity.bonusDropCount}
                                </div>
                                <Sparkles className="absolute -top-1 -left-1 w-3.5 h-3.5 text-yellow-400" />
                            </div>
                        )}
                        
                        {/* Show Focus Reward if available */}
                        {activity.focusReward && (
                            <div 
                                className="relative group"
                                title={`Focus: ${activity.focusReward.name}`}
                            >
                                <div className="w-10 h-10 rounded overflow-hidden ring-1 ring-purple-500/50">
                                    <img 
                                        src={activity.focusReward.icon} 
                                        alt={activity.focusReward.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <Star className="absolute -top-1 -right-1 w-3 h-3 text-purple-400 fill-purple-400" />
                            </div>
                        )}
                        
                        {/* Show other non-bonus, non-focus rewards */}
                        {activity.rewards
                            .filter(r => !r.isPortalBonusDrop && !r.isFocusReward)
                            .slice(0, 3)
                            .map((reward, idx) => (
                            <div 
                                key={idx}
                                className="relative group w-8 h-8"
                                title={reward.name}
                            >
                                <div className="absolute inset-0 rounded overflow-hidden ring-1 ring-white/20">
                                    <img 
                                        src={reward.icon} 
                                        alt={reward.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                
                                {/* Quantity badge */}
                                {reward.quantity && reward.quantity > 1 && (
                                    <div className="absolute -bottom-1 -right-1 bg-white/80 text-black text-[8px] font-bold px-1 rounded">
                                        {reward.quantity}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Info */}
                    <div className="flex flex-col items-end gap-1 text-[10px] text-slate-400">
                        {activity.isMatchmade && (
                            <div className="flex items-center gap-1.5">
                                <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                                <span>Matchmaking: On</span>
                            </div>
                        )}
                        <span>Fireteam: {activity.minParty}-{activity.maxParty} Players</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
