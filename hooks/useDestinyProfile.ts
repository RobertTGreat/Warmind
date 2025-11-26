import useSWR from 'swr';
import { bungieApi, endpoints, getBungieImage } from '@/lib/bungie';
import Cookies from 'js-cookie';
import { useState, useEffect, useCallback } from 'react';

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
  
  // Fallback: Hardcode Season 27 Hash (Season of the Heresy/Current) if 0 or missing
  // 2956006050 is Season 27 (Revenant / Act I usually, let's try to get it right or fallback to profile)
  // Actually, let's use a known good logic. If profile.profile.data.currentSeasonHash is 0, it might be due to API lag or unset.
  // We can try to fetch the latest season from a public endpoint or just hardcode a fallback for "Current".
  // But let's stick to what the profile says first.
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
  };
}
