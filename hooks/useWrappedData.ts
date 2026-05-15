import { useState, useEffect, useCallback, useRef } from 'react';
import { useDestinyProfileContext } from '@/components/DestinyProfileProvider';
import { getActivityHistory } from '@/lib/bungie';
import { Expansion, isDateInExpansion } from '@/data/d2/expansions';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

// ===== Types =====

export interface WrappedActivity {
  cacheKey: string;
  membershipId: string;
  expansionId: string;
  instanceId: string;
  period: string;
  mode: number;
  referenceId: number;
  characterId: string;
  kills: number;
  deaths: number;
  assists: number;
  completed: boolean;
  durationSeconds: number;
}

export interface WeaponKillData {
  weaponHash: number;
  kills: number;
  precisionKills: number;
}

export interface WrappedPGCREntry {
  membershipId: string;
  displayName: string;
  iconPath: string;
  characterClass: string;
  classHash: number;
  emblemHash: number;
  kills: number;
  deaths: number;
  assists: number;
  completed: boolean;
  timePlayedSeconds: number;
  // Extended stats
  precisionKills: number;
  superKills: number;
  grenadeKills: number;
  meleeKills: number;
  abilityKills: number;
  weaponKills: WeaponKillData[];
}

export interface WrappedPGCR {
  instanceId: string;
  period: string;
  entries: WrappedPGCREntry[];
  activityDetails: {
    referenceId: number;
    mode: number;
  };
}

// ===== IndexedDB Schema =====

interface WrappedDB extends DBSchema {
  activities: {
    key: string;
    value: WrappedActivity;
    indexes: {
      'by-membership': string;
      'by-expansion': string;
      'by-period': string;
      'by-mode': number;
    };
  };
  pgcrs: {
    key: string;
    value: WrappedPGCR;
  };
  meta: {
    key: string;
    value: {
      lastFetched: string;
      membershipId: string;
      expansionId: string;
    };
  };
}

const DB_NAME = 'warmind-wrapped';
const DB_VERSION = 3; // Bumped for membership-scoped activity cache

async function getDB(): Promise<IDBPDatabase<WrappedDB>> {
  return openDB<WrappedDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Delete old stores if upgrading
      if (oldVersion < 3) {
        if (db.objectStoreNames.contains('activities')) {
          db.deleteObjectStore('activities');
        }
        if (db.objectStoreNames.contains('pgcrs')) {
          db.deleteObjectStore('pgcrs');
        }
        if (db.objectStoreNames.contains('meta')) {
          db.deleteObjectStore('meta');
        }
      }
      
      // Activities store
      if (!db.objectStoreNames.contains('activities')) {
        const activityStore = db.createObjectStore('activities', { keyPath: 'cacheKey' });
        activityStore.createIndex('by-membership', 'membershipId');
        activityStore.createIndex('by-expansion', 'expansionId');
        activityStore.createIndex('by-period', 'period');
        activityStore.createIndex('by-mode', 'mode');
      }
      // PGCRs store
      if (!db.objectStoreNames.contains('pgcrs')) {
        db.createObjectStore('pgcrs', { keyPath: 'instanceId' });
      }
      // Meta store
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta');
      }
    },
  });
}

// ===== PGCR Fetching with Concurrency =====

const PGCR_BATCH_SIZE = 50;

function transformPGCR(instanceId: string, pgcr: any): WrappedPGCR {
  return {
    instanceId,
    period: pgcr.period,
    entries: pgcr.entries.map((entry: any) => {
      const weaponKills: WeaponKillData[] = [];
      const extended = entry.extended;

      if (extended?.weapons) {
        for (const weapon of extended.weapons) {
          weaponKills.push({
            weaponHash: weapon.referenceId,
            kills: weapon.values?.uniqueWeaponKills?.basic?.value || 0,
            precisionKills: weapon.values?.uniqueWeaponPrecisionKills?.basic?.value || 0,
          });
        }
      }

      return {
        membershipId: entry.player?.destinyUserInfo?.membershipId || '',
        displayName: entry.player?.destinyUserInfo?.displayName ||
                     entry.player?.destinyUserInfo?.bungieGlobalDisplayName || 'Unknown',
        iconPath: entry.player?.destinyUserInfo?.iconPath || '',
        characterClass: entry.player?.characterClass || '',
        classHash: entry.player?.classHash || 0,
        emblemHash: entry.player?.emblemHash || 0,
        kills: entry.values?.kills?.basic?.value || 0,
        deaths: entry.values?.deaths?.basic?.value || 0,
        assists: entry.values?.assists?.basic?.value || 0,
        completed: entry.values?.completed?.basic?.value === 1,
        timePlayedSeconds: entry.values?.timePlayedSeconds?.basic?.value ||
                           entry.values?.activityDurationSeconds?.basic?.value || 0,
        precisionKills: extended?.values?.precisionKills?.basic?.value || 0,
        superKills: extended?.values?.weaponKillsSuper?.basic?.value || 0,
        grenadeKills: extended?.values?.weaponKillsGrenade?.basic?.value || 0,
        meleeKills: extended?.values?.weaponKillsMelee?.basic?.value || 0,
        abilityKills: extended?.values?.weaponKillsAbility?.basic?.value || 0,
        weaponKills,
      };
    }),
    activityDetails: {
      referenceId: pgcr.activityDetails?.referenceId || 0,
      mode: pgcr.activityDetails?.mode || 0,
    },
  };
}

async function fetchPGCRBatch(
  ids: string[],
  signal?: AbortSignal
): Promise<Record<string, any | null>> {
  const response = await fetch('/api/pgcr/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch PGCR batch: ${response.status}`);
  }

  const data = await response.json();
  return data.reports ?? {};
}

// ===== Main Hook =====

interface UseWrappedDataOptions {
  expansion: Expansion;
  enabled?: boolean;
}

interface UseWrappedDataResult {
  activities: WrappedActivity[];
  pgcrs: Map<string, WrappedPGCR>;
  isLoading: boolean;
  progress: {
    phase: 'idle' | 'fetching-activities' | 'fetching-pgcrs' | 'complete';
    current: number;
    total: number;
    message: string;
  };
  error: string | null;
  refetch: () => void;
  cancel: () => void;
}

export function useWrappedData({ expansion, enabled = true }: UseWrappedDataOptions): UseWrappedDataResult {
  const { profile } = useDestinyProfileContext();
  const [activities, setActivities] = useState<WrappedActivity[]>([]);
  const [pgcrs, setPgcrs] = useState<Map<string, WrappedPGCR>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<UseWrappedDataResult['progress']>({
    phase: 'idle',
    current: 0,
    total: 0,
    message: '',
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const membershipType = profile?.profile?.data?.userInfo?.membershipType;
  const membershipId = profile?.profile?.data?.userInfo?.membershipId;
  const characterIds = profile?.characters?.data ? Object.keys(profile.characters.data) : [];

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!membershipType || !membershipId || characterIds.length === 0 || !enabled) {
      return;
    }

    // Cancel any existing request
    cancel();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsLoading(true);
    setError(null);
    setProgress({ phase: 'fetching-activities', current: 0, total: 0, message: 'Fetching activity history...' });

    try {
      const db = await getDB();
      
      // Check if we have cached data for this expansion
      const meta = await db.get('meta', `wrapped-${membershipId}-${expansion.id}`);
      const cacheValid = meta && 
        new Date(meta.lastFetched).getTime() > Date.now() - 1000 * 60 * 60; // 1 hour cache

      let allActivities: WrappedActivity[] = [];

      if (cacheValid) {
        setProgress({ phase: 'fetching-activities', current: 50, total: 100, message: 'Loading cached data...' });
        const cachedActivities = await db.getAllFromIndex(
          'activities',
          'by-membership',
          membershipId
        );
        allActivities = cachedActivities.filter(a => {
          const activityDate = new Date(a.period);
          return a.expansionId === expansion.id && isDateInExpansion(activityDate, expansion);
        });
      } else {
        // Fetch fresh data - Mode 0 = All activities
        const expansionStart = new Date(expansion.releaseDate);
        const expansionEnd = new Date(expansion.endDate);

        for (let charIndex = 0; charIndex < characterIds.length; charIndex++) {
          if (signal.aborted) throw new Error('Download cancelled');
          
          const charId = characterIds[charIndex];
          let page = 0;
          let hasMore = true;
          let reachedExpansionStart = false;

          setProgress({
            phase: 'fetching-activities',
            current: charIndex,
            total: characterIds.length,
            message: `Fetching activities for character ${charIndex + 1}/${characterIds.length}...`,
          });

          while (hasMore && !reachedExpansionStart) {
            if (signal.aborted) throw new Error('Download cancelled');
            
            try {
              const res = await getActivityHistory(membershipType, membershipId, charId, 0, 250, page);
              const fetchedActivities = res.data.Response?.activities || [];

              if (fetchedActivities.length === 0) {
                hasMore = false;
                continue;
              }

              for (const activity of fetchedActivities) {
                const activityDate = new Date(activity.period);

                if (activityDate < expansionStart) {
                  reachedExpansionStart = true;
                  break;
                }

                if (activityDate <= expansionEnd) {
                  const instanceId = activity.activityDetails.instanceId;
                  const wrappedActivity: WrappedActivity = {
                    cacheKey: `${membershipId}:${instanceId}`,
                    membershipId,
                    expansionId: expansion.id,
                    instanceId,
                    period: activity.period,
                    mode: activity.activityDetails.mode,
                    referenceId: activity.activityDetails.referenceId,
                    characterId: charId,
                    kills: activity.values?.kills?.basic?.value || 0,
                    deaths: activity.values?.deaths?.basic?.value || 0,
                    assists: activity.values?.assists?.basic?.value || 0,
                    completed: activity.values?.completed?.basic?.value === 1,
                    durationSeconds: activity.values?.activityDurationSeconds?.basic?.value || 0,
                  };
                  
                  allActivities.push(wrappedActivity);
                  await db.put('activities', wrappedActivity);
                }
              }

              page++;
              if (page > 50) hasMore = false;
            } catch (e) {
              console.error(`Failed to fetch activities page ${page} for char ${charId}:`, e);
              hasMore = false;
            }
          }
        }

        await db.put('meta', {
          lastFetched: new Date().toISOString(),
          membershipId,
          expansionId: expansion.id,
        }, `wrapped-${membershipId}-${expansion.id}`);
      }

      // Deduplicate
      const uniqueActivities = Array.from(
        new Map(allActivities.map(a => [a.instanceId, a])).values()
      );

      setActivities(uniqueActivities);

      // Fetch PGCRs - limit to 1000 for performance
      const activitiesToFetch = uniqueActivities.slice(0, 1000);
      const pgcrMap = new Map<string, WrappedPGCR>();

      // Check which PGCRs we already have cached
      setProgress({
        phase: 'fetching-pgcrs',
        current: 0,
        total: activitiesToFetch.length,
        message: 'Checking cached data...',
      });

      const uncachedIds: string[] = [];
      for (const activity of activitiesToFetch) {
        const cached = await db.get('pgcrs', activity.instanceId);
        if (cached) {
          pgcrMap.set(activity.instanceId, cached);
        } else {
          uncachedIds.push(activity.instanceId);
        }
      }

      const cachedCount = pgcrMap.size;
      const totalToFetch = uncachedIds.length;

      // If all PGCRs are cached, skip download phase entirely
      if (totalToFetch === 0) {
        setProgress({
          phase: 'fetching-pgcrs',
          current: cachedCount,
          total: activitiesToFetch.length,
          message: `All ${cachedCount} reports loaded from cache!`,
        });
      } else {
        setProgress({
          phase: 'fetching-pgcrs',
          current: cachedCount,
          total: activitiesToFetch.length,
          message: `${cachedCount} cached, fetching ${totalToFetch} new reports...`,
        });

        for (let index = 0; index < uncachedIds.length; index += PGCR_BATCH_SIZE) {
          if (signal.aborted) throw new Error('Download cancelled');

          const batch = uncachedIds.slice(index, index + PGCR_BATCH_SIZE);
          const reports = await fetchPGCRBatch(batch, signal);

          for (const [instanceId, rawReport] of Object.entries(reports)) {
            if (!rawReport?.Response?.entries) continue;

            const pgcr = transformPGCR(instanceId, rawReport.Response);
            pgcrMap.set(instanceId, pgcr);
            await db.put('pgcrs', pgcr);
          }

          const completedCount = Math.min(index + PGCR_BATCH_SIZE, uncachedIds.length);
          setProgress({
            phase: 'fetching-pgcrs',
            current: cachedCount + completedCount,
            total: activitiesToFetch.length,
            message: `Fetching detailed reports (${cachedCount + completedCount}/${activitiesToFetch.length})...`,
          });
        }
      }

      setPgcrs(pgcrMap);
      setProgress({
        phase: 'complete',
        current: activitiesToFetch.length,
        total: activitiesToFetch.length,
        message: 'Complete!',
      });

    } catch (err) {
      if (err instanceof Error && err.message === 'Download cancelled') {
        setProgress({ phase: 'idle', current: 0, total: 0, message: '' });
      } else {
        console.error('Error fetching wrapped data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      }
    } finally {
      setIsLoading(false);
    }
  }, [membershipType, membershipId, characterIds.join(','), expansion.id, enabled, cancel]);

  // Auto-fetch when dependencies change
  useEffect(() => {
    if (enabled && membershipId && characterIds.length > 0) {
      fetchData();
    }
    
    return () => cancel();
  }, [enabled, membershipId, characterIds.length, expansion.id]);

  return {
    activities,
    pgcrs,
    isLoading,
    progress,
    error,
    refetch: fetchData,
    cancel,
  };
}

// ===== Helper to clear wrapped cache =====

export async function clearWrappedCache(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear('activities');
    await db.clear('pgcrs');
    await db.clear('meta');
  } catch (e) {
    console.error('Failed to clear wrapped cache:', e);
  }
}
