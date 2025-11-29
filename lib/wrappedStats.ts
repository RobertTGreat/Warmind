/**
 * Wrapped Stats Calculation
 * Calculates comprehensive stats for a given time period (expansion)
 */

import { Expansion, isDateInExpansion } from '@/data/d2/expansions';
import { ActivityHistoryItem } from '@/hooks/useActivityHistory';

export interface TeammateStats {
  membershipId: string;
  displayName: string;
  iconPath: string;
  activitiesPlayed: number;
  totalTimeSeconds: number;
}

export interface ActivityTypeStats {
  mode: number;
  modeName: string;
  count: number;
  totalTimeSeconds: number;
  completions: number;
  kills: number;
  deaths: number;
  assists: number;
}

export interface ClassStats {
  classHash: number;
  className: string;
  activitiesPlayed: number;
  timePlayedSeconds: number;
  kills: number;
  deaths: number;
}

export interface TimeOfDayStats {
  hour: number;
  activitiesStarted: number;
}

export interface MonthlyStats {
  month: string; // YYYY-MM
  activitiesPlayed: number;
  timePlayedSeconds: number;
}

export interface WeaponStats {
  weaponHash: number;
  kills: number;
  precisionKills: number;
  precisionRate: number;
}

export interface AbilityStats {
  superKills: number;
  grenadeKills: number;
  meleeKills: number;
  abilityKills: number;
  precisionKills: number;
}

export interface DayOfWeekStats {
  day: number; // 0 = Sunday, 6 = Saturday
  dayName: string;
  activitiesPlayed: number;
  timePlayedSeconds: number;
}

export interface FireteamStats {
  soloActivities: number;
  teamActivities: number;
  soloTimePlayed: number;
  teamTimePlayed: number;
  averageFireteamSize: number;
  fireteamSizeDistribution: { size: number; count: number }[];
}

export interface WrappedStats {
  expansion: Expansion;
  
  // Overall stats
  totalActivities: number;
  totalCompletions: number;
  totalTimePlayedSeconds: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  kdRatio: number;
  
  // Breakdowns
  activitiesByType: ActivityTypeStats[];
  topActivities: { name: string; count: number; image?: string }[];
  
  // Time analysis
  timeOfDayStats: TimeOfDayStats[];
  peakPlayHour: number;
  dayOfWeekStats: DayOfWeekStats[];
  peakPlayDay: string;
  monthlyStats: MonthlyStats[];
  mostActiveMonth: string;
  
  // Social
  topTeammates: TeammateStats[];
  totalUniqueTeammates: number;
  fireteamStats: FireteamStats;
  
  // Class breakdown
  classStats: ClassStats[];
  favoriteClass: string;
  
  // Weapons & Abilities
  topWeapons: WeaponStats[];
  abilityStats: AbilityStats;
  
  // Achievements
  longestSession: number; // in seconds
  fastestCompletion: { activityName: string; duration: number } | null;
  
  // Fun facts
  firstActivityDate: string;
  lastActivityDate: string;
  activeDays: number;
  avgSessionLength: number;
}

// Activity mode names mapping
const MODE_NAMES: Record<number, string> = {
  0: 'None',
  2: 'Story',
  3: 'Portal',
  4: 'Raid',
  5: 'AllPvP',
  6: 'Patrol',
  7: 'AllPvE',
  10: 'Control',
  12: 'Clash',
  15: 'Crimson Doubles',
  16: 'Nightfall',
  17: 'Heroic Nightfall',
  18: 'AllStrikes',
  19: 'Iron Banner',
  25: 'AllMayhem',
  31: 'Supremacy',
  32: 'Private Matches',
  37: 'Survival',
  38: 'Countdown',
  39: 'Trials of the Nine',
  40: 'Social',
  43: 'Iron Banner Control',
  44: 'Iron Banner Clash',
  45: 'Iron Banner Supremacy',
  46: 'Scored Nightfall',
  47: 'Scored Heroic Nightfall',
  48: 'Rumble',
  49: 'All Doubles',
  50: 'Doubles',
  51: 'Private Matches Clash',
  52: 'Private Matches Control',
  53: 'Private Matches Supremacy',
  54: 'Private Matches Countdown',
  55: 'Private Matches Survival',
  56: 'Private Matches Mayhem',
  57: 'Private Matches Rumble',
  58: 'Heroic Adventure',
  59: 'Showdown',
  60: 'Lockdown',
  61: 'Scorched',
  62: 'Scorched Team',
  63: 'Gambit',
  64: 'All PvE Competitive',
  65: 'Breakthrough',
  66: 'Black Armory Run',
  67: 'Salvage',
  68: 'Iron Banner Salvage',
  69: 'PvP Competitive',
  70: 'PvP Quickplay',
  71: 'Clash Quickplay',
  72: 'Clash Competitive',
  73: 'Control Quickplay',
  74: 'Control Competitive',
  75: 'Gambit Prime',
  76: 'Reckoning',
  77: 'Menagerie',
  78: 'Vex Offensive',
  79: 'Nightmare Hunt',
  80: 'Elimination',
  81: 'Momentum',
  82: 'Dungeon',
  83: 'Sundial',
  84: 'Trials of Osiris',
  85: 'Dares of Eternity',
  86: 'Offensive',
  87: 'Lost Sector',
  88: 'Rift',
  89: 'Zone Control',
  90: 'Iron Banner Rift',
  91: 'Iron Banner Zone Control',
  92: 'Relic',
};

// Class names mapping
const CLASS_NAMES: Record<number, string> = {
  671679327: 'Hunter',
  2271682572: 'Warlock',
  3655393761: 'Titan',
};

interface PGCREntry {
  player: {
    destinyUserInfo: {
      membershipId: string;
      displayName: string;
      iconPath: string;
    };
    characterClass?: string;
    classHash?: number;
  };
  values: {
    kills?: { basic: { value: number } };
    deaths?: { basic: { value: number } };
    assists?: { basic: { value: number } };
    completed?: { basic: { value: number } };
    activityDurationSeconds?: { basic: { value: number } };
  };
}

interface PGCR {
  period: string;
  entries: PGCREntry[];
  activityDetails: {
    referenceId: number;
    instanceId: string;
    mode: number;
  };
}

/**
 * Calculate comprehensive wrapped stats for an expansion period
 */
export function calculateWrappedStats(
  expansion: Expansion,
  activities: ActivityHistoryItem[],
  pgcrData: Map<string, PGCR>,
  userMembershipId: string,
  characterClassMap: Record<string, number> // characterId -> classHash
): WrappedStats {
  // Filter activities to only those within the expansion period
  const filteredActivities = activities.filter(activity => {
    const activityDate = new Date(activity.period);
    return isDateInExpansion(activityDate, expansion);
  });

  // Initialize stats
  let totalKills = 0;
  let totalDeaths = 0;
  let totalAssists = 0;
  let totalTimePlayedSeconds = 0;
  let totalCompletions = 0;
  
  const activityTypeMap = new Map<number, ActivityTypeStats>();
  const activityNameMap = new Map<string, { count: number; image?: string }>();
  const timeOfDayMap = new Map<number, number>();
  const monthlyMap = new Map<string, { activities: number; time: number }>();
  const teammateMap = new Map<string, TeammateStats>();
  const classStatsMap = new Map<number, ClassStats>();
  const uniqueDays = new Set<string>();

  let longestSession = 0;
  let fastestCompletion: { activityName: string; duration: number } | null = null;
  let firstActivityDate = '';
  let lastActivityDate = '';

  for (const activity of filteredActivities) {
    const activityDate = new Date(activity.period);
    const dateStr = activityDate.toISOString().split('T')[0];
    
    // Track first/last activity
    if (!firstActivityDate || dateStr < firstActivityDate) {
      firstActivityDate = dateStr;
    }
    if (!lastActivityDate || dateStr > lastActivityDate) {
      lastActivityDate = dateStr;
    }
    
    // Track unique days
    uniqueDays.add(dateStr);
    
    // Get values from activity
    const kills = activity.values.kills?.basic?.value || 0;
    const deaths = activity.values.deaths?.basic?.value || 0;
    const assists = activity.values.assists?.basic?.value || 0;
    const duration = activity.values.activityDurationSeconds?.basic?.value || 0;
    const completed = activity.values.completed?.basic?.value === 1;
    
    totalKills += kills;
    totalDeaths += deaths;
    totalAssists += assists;
    totalTimePlayedSeconds += duration;
    if (completed) totalCompletions++;
    
    // Track longest session
    if (duration > longestSession) {
      longestSession = duration;
    }
    
    // Track activity type stats
    const mode = activity.activityDetails.mode;
    const modeName = MODE_NAMES[mode] || `Mode ${mode}`;
    
    const existing = activityTypeMap.get(mode) || {
      mode,
      modeName,
      count: 0,
      totalTimeSeconds: 0,
      completions: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
    };
    
    existing.count++;
    existing.totalTimeSeconds += duration;
    if (completed) existing.completions++;
    existing.kills += kills;
    existing.deaths += deaths;
    existing.assists += assists;
    activityTypeMap.set(mode, existing);
    
    // Track time of day
    const hour = activityDate.getHours();
    timeOfDayMap.set(hour, (timeOfDayMap.get(hour) || 0) + 1);
    
    // Track monthly stats
    const monthKey = `${activityDate.getFullYear()}-${String(activityDate.getMonth() + 1).padStart(2, '0')}`;
    const monthData = monthlyMap.get(monthKey) || { activities: 0, time: 0 };
    monthData.activities++;
    monthData.time += duration;
    monthlyMap.set(monthKey, monthData);
    
    // Track class stats from characterId
    if (activity.characterId) {
      const classHash = characterClassMap[activity.characterId];
      if (classHash) {
        const className = CLASS_NAMES[classHash] || 'Unknown';
        const classStats = classStatsMap.get(classHash) || {
          classHash,
          className,
          activitiesPlayed: 0,
          timePlayedSeconds: 0,
          kills: 0,
          deaths: 0,
        };
        classStats.activitiesPlayed++;
        classStats.timePlayedSeconds += duration;
        classStats.kills += kills;
        classStats.deaths += deaths;
        classStatsMap.set(classHash, classStats);
      }
    }
    
    // Process PGCR data for teammates
    const pgcr = pgcrData.get(activity.activityDetails.instanceId);
    if (pgcr && pgcr.entries) {
      for (const entry of pgcr.entries) {
        const memberId = entry.player?.destinyUserInfo?.membershipId;
        if (memberId && memberId !== userMembershipId) {
          const existing = teammateMap.get(memberId) || {
            membershipId: memberId,
            displayName: entry.player.destinyUserInfo.displayName || 'Unknown',
            iconPath: entry.player.destinyUserInfo.iconPath || '',
            activitiesPlayed: 0,
            totalTimeSeconds: 0,
          };
          existing.activitiesPlayed++;
          existing.totalTimeSeconds += duration;
          teammateMap.set(memberId, existing);
        }
      }
      
      // Track fastest completion
      if (completed && duration > 0) {
        if (!fastestCompletion || duration < fastestCompletion.duration) {
          fastestCompletion = {
            activityName: modeName,
            duration,
          };
        }
      }
    }
  }

  // Convert maps to arrays and sort
  const activitiesByType = Array.from(activityTypeMap.values())
    .sort((a, b) => b.count - a.count);
  
  const topActivities = Array.from(activityNameMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  const timeOfDayStats: TimeOfDayStats[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    activitiesStarted: timeOfDayMap.get(hour) || 0,
  }));
  
  const peakPlayHour = timeOfDayStats.reduce((max, stat) => 
    stat.activitiesStarted > max.activitiesStarted ? stat : max
  ).hour;
  
  const monthlyStats: MonthlyStats[] = Array.from(monthlyMap.entries())
    .map(([month, data]) => ({
      month,
      activitiesPlayed: data.activities,
      timePlayedSeconds: data.time,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
  
  const mostActiveMonth = monthlyStats.length > 0
    ? monthlyStats.reduce((max, stat) => 
        stat.activitiesPlayed > max.activitiesPlayed ? stat : max
      ).month
    : '';
  
  const topTeammates = Array.from(teammateMap.values())
    .sort((a, b) => b.activitiesPlayed - a.activitiesPlayed)
    .slice(0, 10);
  
  const classStats = Array.from(classStatsMap.values())
    .sort((a, b) => b.activitiesPlayed - a.activitiesPlayed);
  
  const favoriteClass = classStats.length > 0 ? classStats[0].className : 'Unknown';

  // Build day of week stats (empty for legacy function)
  const dayOfWeekStats: DayOfWeekStats[] = [];
  const DAY_NAMES_LEGACY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (let day = 0; day < 7; day++) {
    dayOfWeekStats.push({
      day,
      dayName: DAY_NAMES_LEGACY[day],
      activitiesPlayed: 0,
      timePlayedSeconds: 0,
    });
  }

  return {
    expansion,
    totalActivities: filteredActivities.length,
    totalCompletions,
    totalTimePlayedSeconds,
    totalKills,
    totalDeaths,
    totalAssists,
    kdRatio: totalDeaths > 0 ? totalKills / totalDeaths : totalKills,
    activitiesByType,
    topActivities,
    timeOfDayStats,
    peakPlayHour,
    dayOfWeekStats,
    peakPlayDay: 'Saturday',
    monthlyStats,
    mostActiveMonth,
    topTeammates,
    totalUniqueTeammates: teammateMap.size,
    fireteamStats: {
      soloActivities: 0,
      teamActivities: 0,
      soloTimePlayed: 0,
      teamTimePlayed: 0,
      averageFireteamSize: 1,
      fireteamSizeDistribution: [],
    },
    classStats,
    favoriteClass,
    topWeapons: [],
    abilityStats: {
      superKills: 0,
      grenadeKills: 0,
      meleeKills: 0,
      abilityKills: 0,
      precisionKills: 0,
    },
    longestSession,
    fastestCompletion,
    firstActivityDate,
    lastActivityDate,
    activeDays: uniqueDays.size,
    avgSessionLength: filteredActivities.length > 0 
      ? totalTimePlayedSeconds / filteredActivities.length 
      : 0,
  };
}

/**
 * Format seconds into a human-readable duration
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Format seconds into hours (with decimal)
 */
export function formatHours(seconds: number): string {
  const hours = seconds / 3600;
  return hours.toFixed(1);
}

/**
 * Get time of day label
 */
export function getTimeOfDayLabel(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 21) return 'Evening';
  return 'Night';
}

/**
 * Get a fun title based on playtime
 */
export function getPlaytimeTitle(hours: number): string {
    if (hours < 10) return 'Cayde-6\'s Sparrow Crasher'; // Peeked the Tower, wiped on a wall
    if (hours < 50) return 'Lord Shaxx\'s Punching Bag'; // Feeds orbs to real Crucible gods
    if (hours < 100) return 'Ikora Rey\'s Bounty Puppet'; // Simulates grinding on repeat
    if (hours < 250) return 'Eris Morn\'s Wipe Queen'; // Hive worms ate the raid strat
    if (hours < 500) return 'Saint-14\'s Trials Tourist'; // Lighthouse selfies, zero solos
    if (hours < 1000) return 'Banshee-44\'s God Roll Beggar'; // "Engram me a Bxr pls daddy"
    return 'Zavala\'s Vanguard Widow(er)'; // Light > life, Ghost got the house
}

// ===== NEW FUNCTION: Calculate stats from useWrappedData =====

import type { WrappedActivity, WrappedPGCR } from '@/hooks/useWrappedData';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Calculate wrapped stats from the new data format (useWrappedData)
 */
export function calculateWrappedStatsFromData(
  expansion: Expansion,
  activities: WrappedActivity[],
  pgcrs: Map<string, WrappedPGCR>,
  membershipId: string,
  characterClassMap: Record<string, number>
): WrappedStats {
  // Initialize counters
  let totalTimePlayedSeconds = 0;
  let totalKills = 0;
  let totalDeaths = 0;
  let totalAssists = 0;
  let totalCompletions = 0;
  let longestSession = 0;

  // Maps for aggregation
  const activityTypeMap = new Map<number, ActivityTypeStats>();
  const activityReferenceCount = new Map<number, number>();
  const timeOfDayMap = new Map<number, number>();
  const dayOfWeekMap = new Map<number, { count: number; time: number }>();
  const monthlyMap = new Map<string, { count: number; time: number }>();
  const classMap = new Map<number, ClassStats>();
  const teammateMap = new Map<string, TeammateStats>();
  const uniqueDays = new Set<string>();
  
  // Weapon and ability tracking
  const weaponKillsMap = new Map<number, { kills: number; precisionKills: number }>();
  const abilityStats: AbilityStats = {
    superKills: 0,
    grenadeKills: 0,
    meleeKills: 0,
    abilityKills: 0,
    precisionKills: 0,
  };
  
  // Fireteam tracking
  let soloActivities = 0;
  let teamActivities = 0;
  let soloTimePlayed = 0;
  let teamTimePlayed = 0;
  let totalFireteamSize = 0;
  let activitiesWithFireteamData = 0;
  const fireteamSizeMap = new Map<number, number>();

  let firstActivityDate = '';
  let lastActivityDate = '';
  let fastestCompletion: { activityName: string; duration: number } | null = null;

  // Process each activity
  for (const activity of activities) {
    const activityDate = new Date(activity.period);

    // Track unique days
    const dayKey = activityDate.toISOString().split('T')[0];
    uniqueDays.add(dayKey);

    // Track first/last dates
    if (!firstActivityDate || activityDate.toISOString() < firstActivityDate) {
      firstActivityDate = activityDate.toISOString();
    }
    if (!lastActivityDate || activityDate.toISOString() > lastActivityDate) {
      lastActivityDate = activityDate.toISOString();
    }

    // Aggregate totals
    totalTimePlayedSeconds += activity.durationSeconds;
    totalKills += activity.kills;
    totalDeaths += activity.deaths;
    totalAssists += activity.assists;
    if (activity.completed) totalCompletions++;

    // Track longest session
    if (activity.durationSeconds > longestSession) {
      longestSession = activity.durationSeconds;
    }

    // Activity type breakdown
    const mode = activity.mode;
    const existing = activityTypeMap.get(mode);
    if (existing) {
      existing.count++;
      existing.totalTimeSeconds += activity.durationSeconds;
      existing.kills += activity.kills;
      existing.deaths += activity.deaths;
      existing.assists += activity.assists;
      if (activity.completed) existing.completions++;
    } else {
      activityTypeMap.set(mode, {
        mode,
        modeName: MODE_NAMES[mode] || `Mode ${mode}`,
        count: 1,
        totalTimeSeconds: activity.durationSeconds,
        completions: activity.completed ? 1 : 0,
        kills: activity.kills,
        deaths: activity.deaths,
        assists: activity.assists,
      });
    }

    // Track specific activity (by referenceId)
    activityReferenceCount.set(
      activity.referenceId,
      (activityReferenceCount.get(activity.referenceId) || 0) + 1
    );

    // Time of day analysis
    const hour = activityDate.getHours();
    timeOfDayMap.set(hour, (timeOfDayMap.get(hour) || 0) + 1);

    // Day of week analysis
    const dayOfWeek = activityDate.getDay();
    const dayData = dayOfWeekMap.get(dayOfWeek) || { count: 0, time: 0 };
    dayData.count++;
    dayData.time += activity.durationSeconds;
    dayOfWeekMap.set(dayOfWeek, dayData);

    // Monthly breakdown
    const monthKey = `${activityDate.getFullYear()}-${String(activityDate.getMonth() + 1).padStart(2, '0')}`;
    const monthData = monthlyMap.get(monthKey) || { count: 0, time: 0 };
    monthData.count++;
    monthData.time += activity.durationSeconds;
    monthlyMap.set(monthKey, monthData);

    // Class breakdown
    const classHash = characterClassMap[activity.characterId];
    if (classHash) {
      const classData = classMap.get(classHash);
      if (classData) {
        classData.activitiesPlayed++;
        classData.timePlayedSeconds += activity.durationSeconds;
        classData.kills += activity.kills;
        classData.deaths += activity.deaths;
      } else {
        classMap.set(classHash, {
          classHash,
          className: CLASS_NAMES[classHash] || 'Unknown',
          activitiesPlayed: 1,
          timePlayedSeconds: activity.durationSeconds,
          kills: activity.kills,
          deaths: activity.deaths,
        });
      }
    }

    // Process PGCR for detailed stats
    const pgcr = pgcrs.get(activity.instanceId);
    if (pgcr) {
      // Find the player's own entry for weapon/ability data
      const playerEntry = pgcr.entries.find(e => e.membershipId === membershipId);
      
      if (playerEntry) {
        // Track ability kills
        abilityStats.superKills += playerEntry.superKills || 0;
        abilityStats.grenadeKills += playerEntry.grenadeKills || 0;
        abilityStats.meleeKills += playerEntry.meleeKills || 0;
        abilityStats.abilityKills += playerEntry.abilityKills || 0;
        abilityStats.precisionKills += playerEntry.precisionKills || 0;
        
        // Track weapon kills
        if (playerEntry.weaponKills) {
          for (const weapon of playerEntry.weaponKills) {
            const existing = weaponKillsMap.get(weapon.weaponHash);
            if (existing) {
              existing.kills += weapon.kills;
              existing.precisionKills += weapon.precisionKills;
            } else {
              weaponKillsMap.set(weapon.weaponHash, {
                kills: weapon.kills,
                precisionKills: weapon.precisionKills,
              });
            }
          }
        }
      }
      
      // Count unique fireteam members (excluding the player)
      const fireteamMembers = new Set(
        pgcr.entries
          .filter(e => e.membershipId && e.membershipId !== membershipId)
          .map(e => e.membershipId)
      );
      const fireteamSize = fireteamMembers.size + 1; // +1 for self
      
      // Track fireteam stats
      if (fireteamSize === 1) {
        soloActivities++;
        soloTimePlayed += activity.durationSeconds;
      } else {
        teamActivities++;
        teamTimePlayed += activity.durationSeconds;
      }
      
      totalFireteamSize += fireteamSize;
      activitiesWithFireteamData++;
      fireteamSizeMap.set(fireteamSize, (fireteamSizeMap.get(fireteamSize) || 0) + 1);
      
      // Track teammates
      for (const entry of pgcr.entries) {
        if (entry.membershipId === membershipId) continue;
        if (!entry.membershipId) continue;

        const teammate = teammateMap.get(entry.membershipId);
        if (teammate) {
          teammate.activitiesPlayed++;
          teammate.totalTimeSeconds += entry.timePlayedSeconds;
        } else {
          teammateMap.set(entry.membershipId, {
            membershipId: entry.membershipId,
            displayName: entry.displayName,
            iconPath: entry.iconPath,
            activitiesPlayed: 1,
            totalTimeSeconds: entry.timePlayedSeconds,
          });
        }
      }
    }
  }

  // Build activity type stats array
  const activitiesByType = Array.from(activityTypeMap.values())
    .sort((a, b) => b.count - a.count);

  // Build top activities (by reference ID)
  const topActivities = Array.from(activityReferenceCount.entries())
    .map(([referenceId, count]) => ({
      name: `Activity ${referenceId}`,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Build time of day stats
  const timeOfDayStats: TimeOfDayStats[] = [];
  for (let hour = 0; hour < 24; hour++) {
    timeOfDayStats.push({
      hour,
      activitiesStarted: timeOfDayMap.get(hour) || 0,
    });
  }

  // Find peak play hour
  let peakPlayHour = 0;
  let maxActivitiesAtHour = 0;
  for (const [hour, count] of timeOfDayMap) {
    if (count > maxActivitiesAtHour) {
      maxActivitiesAtHour = count;
      peakPlayHour = hour;
    }
  }

  // Build day of week stats
  const dayOfWeekStats: DayOfWeekStats[] = [];
  let peakPlayDay = 'Saturday';
  let maxDayActivities = 0;
  for (let day = 0; day < 7; day++) {
    const data = dayOfWeekMap.get(day) || { count: 0, time: 0 };
    dayOfWeekStats.push({
      day,
      dayName: DAY_NAMES[day],
      activitiesPlayed: data.count,
      timePlayedSeconds: data.time,
    });
    if (data.count > maxDayActivities) {
      maxDayActivities = data.count;
      peakPlayDay = DAY_NAMES[day];
    }
  }

  // Build monthly stats
  const monthlyStats = Array.from(monthlyMap.entries())
    .map(([month, data]) => ({
      month,
      activitiesPlayed: data.count,
      timePlayedSeconds: data.time,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Find most active month
  const mostActiveMonth = monthlyStats.reduce(
    (max, current) => (current.activitiesPlayed > max.activitiesPlayed ? current : max),
    { month: '', activitiesPlayed: 0, timePlayedSeconds: 0 }
  ).month;

  // Build top teammates
  const topTeammates = Array.from(teammateMap.values())
    .sort((a, b) => b.activitiesPlayed - a.activitiesPlayed)
    .slice(0, 10);

  // Build class stats
  const classStats = Array.from(classMap.values())
    .sort((a, b) => b.timePlayedSeconds - a.timePlayedSeconds);

  // Determine favorite class
  const favoriteClass = classStats.length > 0 ? classStats[0].className : 'Unknown';

  // Build top weapons
  const topWeapons: WeaponStats[] = Array.from(weaponKillsMap.entries())
    .map(([weaponHash, data]) => ({
      weaponHash,
      kills: data.kills,
      precisionKills: data.precisionKills,
      precisionRate: data.kills > 0 ? data.precisionKills / data.kills : 0,
    }))
    .sort((a, b) => b.kills - a.kills)
    .slice(0, 10);

  // Build fireteam stats
  const fireteamStats: FireteamStats = {
    soloActivities,
    teamActivities,
    soloTimePlayed,
    teamTimePlayed,
    averageFireteamSize: activitiesWithFireteamData > 0 
      ? totalFireteamSize / activitiesWithFireteamData 
      : 1,
    fireteamSizeDistribution: Array.from(fireteamSizeMap.entries())
      .map(([size, count]) => ({ size, count }))
      .sort((a, b) => a.size - b.size),
  };

  return {
    expansion,
    totalActivities: activities.length,
    totalCompletions,
    totalTimePlayedSeconds,
    totalKills,
    totalDeaths,
    totalAssists,
    kdRatio: totalDeaths > 0 ? totalKills / totalDeaths : totalKills,
    activitiesByType,
    topActivities,
    timeOfDayStats,
    peakPlayHour,
    dayOfWeekStats,
    peakPlayDay,
    monthlyStats,
    mostActiveMonth,
    topTeammates,
    totalUniqueTeammates: teammateMap.size,
    fireteamStats,
    classStats,
    favoriteClass,
    topWeapons,
    abilityStats,
    longestSession,
    fastestCompletion,
    firstActivityDate,
    lastActivityDate,
    activeDays: uniqueDays.size,
    avgSessionLength: activities.length > 0 
      ? totalTimePlayedSeconds / activities.length 
      : 0,
  };
}

