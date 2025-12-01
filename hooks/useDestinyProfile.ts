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

  // Check for token on mount (client-side only)
  useEffect(() => {
    const token = Cookies.get('bungie_access_token');
    if (token) {
      setHasToken(true);
    }
  }, []);

  // On mount, if no token, try silent refresh (in case we have a valid refresh token in httpOnly cookie)
  useEffect(() => {
      // Only try refresh if we've already checked for the token and didn't find one
      // We use a slight timeout or check to ensure we don't run this immediately if cookie reading was just delayed
      const token = Cookies.get('bungie_access_token');
      
      if (!token && !isRefreshing) {
          setIsRefreshing(true);
          fetch('/api/auth/refresh', { method: 'POST' })
            .then(async (res) => {
                if (res.ok) {
                    const data = await res.json();
                    if (data.access_token) {
                        Cookies.set('bungie_access_token', data.access_token);
                        setHasToken(true);
                    }
                }
            })
            .catch(() => {
                // Silent fail - user is truly logged out
            })
            .finally(() => setIsRefreshing(false));
      }
  }, []); // Run once on mount

  const { data: userMemberships, error: userError, isLoading: userLoading } = useSWR(
    hasToken ? endpoints.getCurrentUser() : null,
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

  const { data: profileResponse, error: profileError, isLoading: profileLoading } = useSWR(
    membershipType && destinyMembershipId ? endpoints.getProfile(membershipType, destinyMembershipId) : null,
    fetcher,
    {
      // Keep stale data while revalidating
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 30000, // 30 seconds
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
  
  // Fallback: Hardcode Season 27 Hash (Season of the Heresy/Current) if 0 or missing
  const currentSeasonHash = profile?.profile?.data?.currentSeasonHash || 2956006050; // Fallback to Season 27 (Revenant)

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
      const response = await bungieApi.get(endpoints.getProfile(membershipType, destinyMembershipId));
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
