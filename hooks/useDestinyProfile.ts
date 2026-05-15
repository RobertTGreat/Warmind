/**
 * useDestinyProfile Hook
 * 
 * Fetches and manages the current user's Destiny profile data.
 * Implements stale-while-revalidate pattern:
 * 1. Show cached profile immediately (from IndexedDB)
 * 2. Fetch fresh data in background
 * 3. Update display when fresh data arrives
 */

import useSWR from 'swr';
import { bungieApi, endpoints, getBungieImage } from '@/lib/bungie';
import Cookies from 'js-cookie';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
    getCachedProfile,
    cacheProfile,
    isProfileFresh,
    isProfileStale,
    getProfileAgeString,
} from '@/lib/profileCache';
import type { CachedProfile } from '@/lib/db';

const fetcher = (url: string) => bungieApi.get(url).then((res) => res.data);

const CORE_PROFILE_COMPONENTS = [
  100, // profiles
  200, // characters
  202, // character progression
  204, // character activities
  205, // character equipment
  300, // item instances
  304, // item stats
  305, // item sockets
  800, // profile records
  1100, // profile string variables
] as const;

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

export function useDestinyProfile() {
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
  const cacheLoadedRef = useRef(false);

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

  const { data: userMemberships, error: userError, isLoading: userLoading } = useSWR(
    authReady && hasToken ? endpoints.getCurrentUser() : null,
    fetcher
  );

  const primaryMembership = userMemberships?.Response?.destinyMemberships?.[0];
  const membershipType = primaryMembership?.membershipType;
  const destinyMembershipId = primaryMembership?.membershipId;
  const displayName = userMemberships?.Response?.bungieNetUser?.uniqueName || 
                      primaryMembership?.bungieGlobalDisplayName;

  // Load cached profile when we have membership info
  useEffect(() => {
    if (destinyMembershipId && !cacheLoadedRef.current) {
      cacheLoadedRef.current = true;
      
      getCachedProfile(destinyMembershipId).then((cached) => {
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
  }, [destinyMembershipId]);

  const profileKey =
    membershipType && destinyMembershipId
      ? endpoints.getProfile(
          membershipType,
          destinyMembershipId,
          [...CORE_PROFILE_COMPONENTS]
        )
      : null;

  const {
    data: profileResponse,
    error: profileError,
    isLoading: profileLoading,
  } = useSWR(
    profileKey,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60_000,
      focusThrottleInterval: 120_000,
    }
  );

  // Cache the fresh profile data when it arrives
  useEffect(() => {
    if (profileResponse?.Response && destinyMembershipId && membershipType) {
      console.log('[useDestinyProfile] Caching fresh profile to IndexedDB');
      cacheProfile(
        destinyMembershipId,
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
  }, [profileResponse, destinyMembershipId, membershipType, displayName]);

  // Use fresh data if available, otherwise fall back to cached
  const profile = profileResponse?.Response || cachedProfileData;
  const isUsingCachedData = !profileResponse?.Response && !!cachedProfileData;

  // Derived State
  let stats: DestinyStats | null = null;
  
  // Root Hashes from Profile Records
  const recordCategoriesRootNodeHash = profile?.profileRecords?.data?.recordCategoriesRootNodeHash;
  const recordSealsRootNodeHash = profile?.profileRecords?.data?.recordSealsRootNodeHash;
  
  const currentSeasonHash = profile?.profile?.data?.currentSeasonHash;

  const { data: seasonDefData } = useSWR(
      currentSeasonHash ? endpoints.getSeasonDefinition(currentSeasonHash) : null,
      fetcher
  );
  const seasonDef = seasonDefData?.Response;

  const { data: seasonPassDefData } = useSWR(
      seasonDef?.seasonPassHash ? endpoints.getSeasonPassDefinition(seasonDef.seasonPassHash) : null,
      fetcher
  );
  const seasonPassDef = seasonPassDefData?.Response;

  // Track selected character (persisted in localStorage)
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selectedCharacterId');
    }
    return null;
  });

  // Build list of all characters
  let allCharacters: CharacterInfo[] = [];
  
  if (profile) {
    const characters = profile.characters?.data;
    const characterIds = profile.profile?.data?.characterIds || [];
    const characterProgressions = profile.characterProgressions?.data;
    
    // Build all characters list
    if (characters) {
      allCharacters = Object.keys(characters)
        .map(charId => {
          const char = characters[charId];
          return {
            characterId: charId,
            classType: char.classType,
            light: char.light,
            emblemPath: getBungieImage(char.emblemPath),
            emblemBackgroundPath: getBungieImage(char.emblemBackgroundPath),
            dateLastPlayed: char.dateLastPlayed,
          };
        })
        .sort((a, b) => {
          const dateA = new Date(a.dateLastPlayed).getTime();
          const dateB = new Date(b.dateLastPlayed).getTime();
          return dateB - dateA; // Most recently played first
        });
    }
    
    // Determine active character: selected > last played > first
    let activeCharacterId = characterIds[0];
    
    // Check if selected character is valid
    if (selectedCharacterId && characters?.[selectedCharacterId]) {
      activeCharacterId = selectedCharacterId;
    } else if (characters) {
      // Fall back to last played
      activeCharacterId = Object.keys(characters).sort((a, b) => {
        const dateA = new Date(characters[a].dateLastPlayed).getTime();
        const dateB = new Date(characters[b].dateLastPlayed).getTime();
        return dateB - dateA;
      })[0];
    }

    const activeChar = characters?.[activeCharacterId];
    const activeProgressions = characterProgressions?.[activeCharacterId]?.progressions;
    
    if (activeChar) {
        // Guardian Rank is in profile data usually
        const guardianRank = profile.profile?.data?.currentGuardianRank || 0;

        let seasonRank: number | undefined = undefined;
        if (activeProgressions && seasonPassDef) {
            const progressionHash = seasonPassDef.rewardProgressionHash;
            const prestigeProgressionHash = seasonPassDef.prestigeRewardProgressionHash;
            
            const userProgression = activeProgressions[progressionHash];
            const userPrestigeProgression = activeProgressions[prestigeProgressionHash];
            
            const level = userProgression?.level || 0;
            const prestigeLevel = userPrestigeProgression?.level || 0;
            seasonRank = level + prestigeLevel;
        }
        
        stats = {
            characterId: activeCharacterId,
            classType: activeChar.classType,
            light: activeChar.light,
            guardianRank,
            emblemHash: activeChar.emblemHash,
            emblemPath: getBungieImage(activeChar.emblemPath),
            emblemBackgroundPath: getBungieImage(activeChar.emblemBackgroundPath),
            title: "", // Title logic is complex (requires record hashes), skipping for now
            seasonRank, 
            characterProgressions: activeProgressions,
            currentSeasonHash
        };
    }
  }

  // Callback to select a character
  const selectCharacter = useCallback((characterId: string) => {
    setSelectedCharacterId(characterId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedCharacterId', characterId);
    }
  }, []);

  // Force refresh function
  const forceRefresh = useCallback(async () => {
    if (membershipType && destinyMembershipId) {
      const response = await bungieApi.get(
        endpoints.getProfile(
          membershipType,
          destinyMembershipId,
          [...CORE_PROFILE_COMPONENTS]
        )
      );
      if (response.data?.Response) {
        await cacheProfile(
          destinyMembershipId,
          membershipType,
          response.data.Response,
          displayName
        );
      }
    }
  }, [membershipType, destinyMembershipId, displayName]);

  return {
    profile,
    stats,
    displayName,
    recordCategoriesRootNodeHash,
    recordSealsRootNodeHash,
    isLoading: (userLoading || profileLoading) || isRefreshing,
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
  };
}
