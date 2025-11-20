import useSWR from 'swr';
import { bungieApi, endpoints, getBungieImage } from '@/lib/bungie';
import Cookies from 'js-cookie';
import { useState, useEffect } from 'react';

const fetcher = (url: string) => bungieApi.get(url).then((res) => res.data);

export interface DestinyStats {
  characterId: string;
  classType: number; // 0: Titan, 1: Hunter, 2: Warlock
  light: number; // Power Level
  guardianRank: number;
  emblemPath: string;
  emblemBackgroundPath: string;
  title: string; // Title if equipped
  seasonRank?: number;
  characterProgressions?: any;
  currentSeasonHash?: number;
}

export function useDestinyProfile() {
  // Initialize to false to match server-side rendering and prevent hydration mismatch
  const [hasToken, setHasToken] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const { data: profileResponse, error: profileError, isLoading: profileLoading } = useSWR(
    membershipType && destinyMembershipId ? endpoints.getProfile(membershipType, destinyMembershipId) : null,
    fetcher
  );

  const profile = profileResponse?.Response;

  // Derived State
  let stats: DestinyStats | null = null;
  
  // Root Hashes from Profile Records
  const recordCategoriesRootNodeHash = profile?.profileRecords?.data?.recordCategoriesRootNodeHash;
  const recordSealsRootNodeHash = profile?.profileRecords?.data?.recordSealsRootNodeHash;
  const currentSeasonHash = profile?.profile?.data?.currentSeasonHash;

  if (profile) {
    const characters = profile.characters?.data;
    const characterIds = profile.profile?.data?.characterIds || [];
    const characterProgressions = profile.characterProgressions?.data;
    
    // Find last played character
    let activeCharacterId = characterIds[0];
    if (characters) {
        activeCharacterId = Object.keys(characters).sort((a, b) => {
            const dateA = new Date(characters[a].dateLastPlayed).getTime();
            const dateB = new Date(characters[b].dateLastPlayed).getTime();
            return dateB - dateA; // Descending
        })[0];
    }

    const activeChar = characters?.[activeCharacterId];
    const activeProgressions = characterProgressions?.[activeCharacterId]?.progressions;
    
    if (activeChar) {
        // Guardian Rank is in profile data usually
        const guardianRank = profile.profile?.data?.currentGuardianRank || 0;
        
        stats = {
            characterId: activeCharacterId,
            classType: activeChar.classType,
            light: activeChar.light,
            guardianRank,
            emblemPath: getBungieImage(activeChar.emblemPath),
            emblemBackgroundPath: getBungieImage(activeChar.emblemBackgroundPath),
            title: "", // Title logic is complex (requires record hashes), skipping for now
            seasonRank: undefined, // Will be populated by SeasonPassTrack
            characterProgressions: activeProgressions,
            currentSeasonHash
        };
    }
  }

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
    } : null
  };
}
