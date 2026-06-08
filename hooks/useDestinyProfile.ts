/**
 * useDestinyProfile Hook
 * 
 * Fetches and manages the current user's Destiny profile data.
 * Implements stale-while-revalidate pattern:
 * 1. Show cached profile immediately (from IndexedDB)
 * 2. Fetch fresh data in background
 * 3. Update display when fresh data arrives
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bungieApi, endpoints, getBungieImage } from '@/lib/bungie';
import Cookies from 'js-cookie';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    getCachedProfile,
    cacheProfile,
    isProfileFresh,
    isProfileStale,
    getProfileAgeString,
} from '@/lib/profileCache';
import type { CachedProfile } from '@/lib/db';

const fetcher = (url: string) => bungieApi.get(url).then((res) => res.data);
const PROFILE_LOAD_LOCK_NAME = 'warmind-profile-load';
const PROFILE_CACHE_RESPONSE_MARKER = '__warmindProfileCacheHit';

async function fetchProfileWithCrossTabLock(
  profileUrl: string,
  profileCacheKey: string | null,
  options: { bypassCache?: boolean } = {}
) {
  const loadProfile = async () => {
    if (!options.bypassCache && profileCacheKey) {
      const cachedProfile = await getCachedProfile(profileCacheKey);

      if (cachedProfile && isProfileFresh(cachedProfile)) {
        return {
          Response: cachedProfile.data,
          [PROFILE_CACHE_RESPONSE_MARKER]: true,
        };
      }
    }

    return fetcher(profileUrl);
  };

  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(
      PROFILE_LOAD_LOCK_NAME,
      { mode: 'exclusive' },
      loadProfile
    );
  }

  return loadProfile();
}

export const PROFILE_COMPONENTS = {
  shell: [
    100, // profiles
    200, // characters
    202, // character progressions for season rank/header
  ],

  vault: [
    100, // profiles
    102, // profile inventory
    200, // characters
    201, // character inventories
    205, // character equipment
    300, // item instances
    304, // item stats
    305, // item sockets
    310, // reusable plugs
  ],

  inventory: [
    100, // profiles
    102, // profile inventory
    103, // profile currencies
    104, // character currencies
    200, // characters
    201, // character inventories
    205, // character equipment
    206, // character loadouts
    300, // item instances
    304, // item stats
    305, // item sockets for detail overlays
    309, // item plug objectives for normalized socket data
    310, // reusable plugs for detail overlays
  ],

  collections: [
    100, // profiles
    200, // characters
    700, // character collectibles
    800, // profile collectibles
  ],

  collectionSets: [
    100, // profiles
    200, // characters
    700, // character collectibles
    800, // profile collectibles
    900, // profile records for weapon pattern progress
    901, // character records for weapon pattern progress
  ],

  armorSets: [
    100, // profiles
    200, // characters
    205, // character equipment
    700, // character collectibles
    800, // profile collectibles
  ],

  records: [
    100,
    200,
    900,
    901,
  ],

  activity: [
    100,
    200,
    900,
    901,
    1100,
  ],

  full: [
    100, 102, 103, 104,
    200, 201, 202, 203, 204, 205, 206,
    300, 301, 302, 304, 305, 306, 307, 308, 309, 310,
    700, 701,
    800, 900, 901,
    1100,
  ],
} as const;

export function getProfileComponentsForPathname(pathname: string | null) {
  if (pathname?.startsWith('/character/loadouts')) {
    return PROFILE_COMPONENTS.inventory;
  }

  if (pathname?.startsWith('/character/optimizer')) {
    return PROFILE_COMPONENTS.vault;
  }

  if (pathname === '/character') {
    return PROFILE_COMPONENTS.inventory;
  }

  if (pathname === '/' || pathname?.startsWith('/settings')) {
    return PROFILE_COMPONENTS.shell;
  }

  if (pathname?.startsWith('/activity')) {
    return PROFILE_COMPONENTS.activity;
  }

  if (pathname?.startsWith('/collections/armor-set-bonuses')) {
    return PROFILE_COMPONENTS.armorSets;
  }

  if (pathname?.startsWith('/collections/sets')) {
    return PROFILE_COMPONENTS.collectionSets;
  }

  if (pathname?.startsWith('/collections')) {
    return PROFILE_COMPONENTS.collections;
  }

  if (pathname?.startsWith('/triumphs')) {
    return PROFILE_COMPONENTS.records;
  }

  if (pathname?.startsWith('/vendors')) {
    return PROFILE_COMPONENTS.inventory;
  }

  return PROFILE_COMPONENTS.full;
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAuthOnce() {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh", { method: "POST" })
      .then((response) => response.ok)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export interface DestinyStats {
  characterId: string;
  classType: number; // 0: Titan, 1: Hunter, 2: Warlock
  light: number; // Power Level
  guardianRank: number;
  emblemHash: number;
  emblemPath: string;
  emblemBackgroundPath: string;
  title: string; // Title if equipped
  seasonRank?: number;
  characterProgressions?: any;
  currentSeasonHash?: number;
}

export interface CharacterInfo {
  characterId: string;
  classType: number;
  light: number;
  emblemPath: string;
  emblemBackgroundPath: string;
  dateLastPlayed: string;
}

export const CLASS_NAMES: Record<number, string> = {
  0: 'Titan',
  1: 'Hunter',
  2: 'Warlock',
};

export interface ProfileCacheInfo {
  isCached: boolean;
  isFresh: boolean;
  isStale: boolean;
  lastUpdated: number | null;
  ageString: string | null;
}

export function useDestinyProfile(
  components: readonly number[] = PROFILE_COMPONENTS.full
) {
  const queryClient = useQueryClient();
  // Initialize to false to match server-side rendering and prevent hydration mismatch
  const [hasToken, setHasToken] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  
  // Cache state
  const [cachedProfileData, setCachedProfileData] = useState<any>(null);
  const [cacheInfo, setCacheInfo] = useState<ProfileCacheInfo>({
    isCached: false,
    isFresh: false,
    isStale: false,
    lastUpdated: null,
    ageString: null,
  });
  const cacheLoadedKeyRef = useRef<string | null>(null);
  const componentsKey = useMemo(
    () => [...components].sort((a, b) => a - b).join(','),
    [components]
  );

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      const membershipId = Cookies.get('bungie_membership_id');

      if (membershipId) {
        if (!cancelled) {
          setHasToken(true);
          setAuthReady(true);
        }
        return;
      }

      setIsRefreshing(true);

      const refreshed = await refreshAuthOnce().catch(() => false);

      if (!cancelled) {
        setHasToken(refreshed);
        setIsRefreshing(false);
        setAuthReady(true);
      }
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const {
    data: userMemberships,
    error: userError,
    isLoading: userLoading,
  } = useQuery({
    queryKey: ['bungie', 'currentUser'],
    queryFn: () => fetcher(endpoints.getCurrentUser()),
    enabled: authReady && hasToken,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const primaryMembership = userMemberships?.Response?.destinyMemberships?.[0];
  const membershipType = primaryMembership?.membershipType;
  const destinyMembershipId = primaryMembership?.membershipId;
  const displayName = userMemberships?.Response?.bungieNetUser?.uniqueName || 
                      primaryMembership?.bungieGlobalDisplayName;
  const profileCacheKey = destinyMembershipId
    ? `${destinyMembershipId}:${componentsKey}`
    : null;

  // Load cached profile when we have membership info
  useEffect(() => {
    if (profileCacheKey && cacheLoadedKeyRef.current !== profileCacheKey) {
      cacheLoadedKeyRef.current = profileCacheKey;
      setCachedProfileData(null);
      setCacheInfo({
        isCached: false,
        isFresh: false,
        isStale: false,
        lastUpdated: null,
        ageString: null,
      });
      
      getCachedProfile(profileCacheKey).then((cached) => {
        if (cached) {
          console.log('[useDestinyProfile] Loaded cached profile from IndexedDB');
          setCachedProfileData(cached.data);
          setCacheInfo({
            isCached: true,
            isFresh: isProfileFresh(cached),
            isStale: isProfileStale(cached),
            lastUpdated: cached.lastUpdated,
            ageString: getProfileAgeString(cached),
          });
        }
      });
    }
  }, [profileCacheKey]);

  const profileKey =
    membershipType && destinyMembershipId
      ? endpoints.getProfile(
          membershipType,
          destinyMembershipId,
          [...components]
        )
      : null;

  const {
    data: profileResponse,
    error: profileError,
    isLoading: profileLoading,
    isFetching: profileFetching,
  } = useQuery({
    queryKey: ['destinyProfile', membershipType, destinyMembershipId, componentsKey],
    queryFn: () => fetchProfileWithCrossTabLock(profileKey as string, profileCacheKey),
    enabled: Boolean(profileKey),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Cache the fresh profile data when it arrives
  useEffect(() => {
    if (
      profileResponse?.Response &&
      profileCacheKey &&
      membershipType &&
      !profileResponse?.[PROFILE_CACHE_RESPONSE_MARKER]
    ) {
      console.log('[useDestinyProfile] Caching fresh profile to IndexedDB');
      cacheProfile(
        profileCacheKey,
        membershipType,
        profileResponse.Response,
        displayName
      );
      
      // Update cache info to show fresh
      setCacheInfo({
        isCached: true,
        isFresh: true,
        isStale: false,
        lastUpdated: Date.now(),
        ageString: 'just now',
      });
    }
  }, [profileResponse, profileCacheKey, membershipType, displayName]);

  // Use fresh data if available, otherwise fall back to cached
  const profile = profileResponse?.Response || cachedProfileData;
  const isUsingCachedData = !profileResponse?.Response && !!cachedProfileData;

  const currentSeasonHash = profile?.profile?.data?.currentSeasonHash;

  const { data: seasonDefData } = useQuery({
      queryKey: ['manifestDefinition', 'DestinySeasonDefinition', currentSeasonHash],
      queryFn: () => fetcher(endpoints.getSeasonDefinition(currentSeasonHash)),
      enabled: Boolean(currentSeasonHash),
      staleTime: 24 * 60 * 60 * 1000,
      gcTime: 7 * 24 * 60 * 60 * 1000,
  });
  const seasonDef = seasonDefData?.Response;

  const { data: seasonPassDefData } = useQuery({
      queryKey: ['manifestDefinition', 'DestinySeasonPassDefinition', seasonDef?.seasonPassHash],
      queryFn: () => fetcher(endpoints.getSeasonPassDefinition(seasonDef.seasonPassHash)),
      enabled: Boolean(seasonDef?.seasonPassHash),
      staleTime: 24 * 60 * 60 * 1000,
      gcTime: 7 * 24 * 60 * 60 * 1000,
  });
  const seasonPassDef = seasonPassDefData?.Response;

  // Track selected character (persisted in localStorage)
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selectedCharacterId');
    }
    return null;
  });

  const {
    stats,
    allCharacters,
    recordCategoriesRootNodeHash,
    recordSealsRootNodeHash,
  } = useMemo(() => {
    const recordCategoriesRootNodeHash =
      profile?.profileRecords?.data?.recordCategoriesRootNodeHash;
    const recordSealsRootNodeHash =
      profile?.profileRecords?.data?.recordSealsRootNodeHash;
    const characters = profile?.characters?.data;
    const characterIds = profile?.profile?.data?.characterIds || [];
    const characterProgressions = profile?.characterProgressions?.data;

    if (!profile || !characters) {
      return {
        stats: null,
        allCharacters: [],
        recordCategoriesRootNodeHash,
        recordSealsRootNodeHash,
      };
    }

    const allCharacters = Object.keys(characters)
      .map((characterId) => {
        const character = characters[characterId];
        return {
          characterId,
          classType: character.classType,
          light: character.light,
          emblemPath: getBungieImage(character.emblemPath),
          emblemBackgroundPath: getBungieImage(character.emblemBackgroundPath),
          dateLastPlayed: character.dateLastPlayed,
        };
      })
      .sort((firstCharacter, secondCharacter) => {
        const firstDate = new Date(firstCharacter.dateLastPlayed).getTime();
        const secondDate = new Date(secondCharacter.dateLastPlayed).getTime();
        return secondDate - firstDate;
      });

    const activeCharacterId =
      selectedCharacterId && characters[selectedCharacterId]
        ? selectedCharacterId
        : allCharacters[0]?.characterId ?? characterIds[0];
    const activeCharacter = characters[activeCharacterId];
    const activeProgressions =
      characterProgressions?.[activeCharacterId]?.progressions;

    if (!activeCharacter) {
      return {
        stats: null,
        allCharacters,
        recordCategoriesRootNodeHash,
        recordSealsRootNodeHash,
      };
    }

    let seasonRank: number | undefined;
    if (activeProgressions && seasonPassDef) {
      const progressionHash = seasonPassDef.rewardProgressionHash;
      const prestigeProgressionHash = seasonPassDef.prestigeRewardProgressionHash;
      const userProgression = activeProgressions[progressionHash];
      const userPrestigeProgression = activeProgressions[prestigeProgressionHash];
      seasonRank = (userProgression?.level || 0) + (userPrestigeProgression?.level || 0);
    }

    return {
      stats: {
        characterId: activeCharacterId,
        classType: activeCharacter.classType,
        light: activeCharacter.light,
        guardianRank: profile.profile?.data?.currentGuardianRank || 0,
        emblemHash: activeCharacter.emblemHash,
        emblemPath: getBungieImage(activeCharacter.emblemPath),
        emblemBackgroundPath: getBungieImage(activeCharacter.emblemBackgroundPath),
        title: "",
        seasonRank,
        characterProgressions: activeProgressions,
        currentSeasonHash,
      },
      allCharacters,
      recordCategoriesRootNodeHash,
      recordSealsRootNodeHash,
    };
  }, [currentSeasonHash, profile, seasonPassDef, selectedCharacterId]);

  // Callback to select a character
  const selectCharacter = useCallback((characterId: string) => {
    setSelectedCharacterId(characterId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedCharacterId', characterId);
    }
  }, []);

  // Force refresh function
  const forceRefresh = useCallback(async () => {
    if (membershipType && destinyMembershipId && profileCacheKey && profileKey) {
      const response = await queryClient.fetchQuery({
        queryKey: ['destinyProfile', membershipType, destinyMembershipId, componentsKey],
        queryFn: () =>
          fetchProfileWithCrossTabLock(profileKey, profileCacheKey, {
            bypassCache: true,
          }),
        staleTime: 0,
      });

      if (response?.Response) {
        await cacheProfile(profileCacheKey, membershipType, response.Response, displayName);
      }
    }
  }, [
    componentsKey,
    destinyMembershipId,
    displayName,
    membershipType,
    profileCacheKey,
    profileKey,
    queryClient,
  ]);

  const updateItemSocketPlug = useCallback(
    (itemInstanceId: string, socketIndex: number, plugItemHash: number) => {
      const patchProfile = (currentProfile: any) => {
        const currentSockets =
          currentProfile?.itemComponents?.sockets?.data?.[itemInstanceId]?.sockets;

        if (!Array.isArray(currentSockets) || !currentSockets[socketIndex]) {
          return currentProfile;
        }

        const patchedSockets = currentSockets.map((socket: any, index: number) =>
          index === socketIndex
            ? {
                ...socket,
                plugHash: plugItemHash,
              }
            : socket
        );

        return {
          ...currentProfile,
          itemComponents: {
            ...currentProfile.itemComponents,
            sockets: {
              ...currentProfile.itemComponents.sockets,
              data: {
                ...currentProfile.itemComponents.sockets.data,
                [itemInstanceId]: {
                  ...currentProfile.itemComponents.sockets.data[itemInstanceId],
                  sockets: patchedSockets,
                },
              },
            },
          },
        };
      };

      queryClient.setQueriesData(
        { queryKey: ['destinyProfile'] },
        (currentResponse: any) => {
          if (!currentResponse?.Response) {
            return currentResponse;
          }

          return {
            ...currentResponse,
            Response: patchProfile(currentResponse.Response),
          };
        }
      );

      setCachedProfileData((currentProfile: any) => patchProfile(currentProfile));
    },
    [queryClient]
  );

  return useMemo(() => ({
    profile,
    stats,
    displayName,
    recordCategoriesRootNodeHash,
    recordSealsRootNodeHash,
    isLoading: (userLoading || (profileLoading && !cachedProfileData)) || isRefreshing,
    isFetching: profileFetching,
    isError: userError || profileError,
    isLoggedIn: hasToken && !userError,
    membershipInfo: primaryMembership ? {
        membershipType,
        membershipId: destinyMembershipId
    } : null,
    // Character selection
    allCharacters,
    selectCharacter,
    // Cache info for stale-while-revalidate UI
    cacheInfo,
    isUsingCachedData,
    forceRefresh,
    updateItemSocketPlug,
  }), [
    allCharacters,
    cacheInfo,
    cachedProfileData,
    displayName,
    forceRefresh,
    hasToken,
    isRefreshing,
    isUsingCachedData,
    primaryMembership,
    profile,
    profileError,
    profileFetching,
    profileLoading,
    recordCategoriesRootNodeHash,
    recordSealsRootNodeHash,
    selectCharacter,
    stats,
    userError,
    userLoading,
    membershipType,
    destinyMembershipId,
    updateItemSocketPlug,
  ]);
}
