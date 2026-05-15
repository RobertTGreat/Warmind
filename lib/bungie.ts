import axios from 'axios';

const BASE_URL = '/api/bungie';

export const bungieApi = axios.create({
  baseURL: BASE_URL,
});

// Interceptor to handle token refresh on 401
bungieApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If 401 and not already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Call internal API to refresh using httpOnly cookie
        const res = await fetch('/api/auth/refresh', { method: 'POST' });
        
        if (res.ok) {
           return bungieApi(originalRequest);
        }
      } catch (refreshError) {
         // If refresh fails, redirect to logout
         console.error('Auto-refresh failed', refreshError);
         logout();
      }
    }
    return Promise.reject(error);
  }
);

export interface BungieResponse<T> {
  Response: T;
  ErrorCode: number;
  ThrottleSeconds: number;
  ErrorStatus: string;
  Message: string;
  MessageData: Record<string, string>;
}

export const endpoints = {
  getCurrentUser: () => '/User/GetMembershipsForCurrentUser/',
  getProfile: (membershipType: number, destinyMembershipId: string, components?: number[]) => {
    const componentList = components 
      ? components.join(',') 
      : '100,102,103,104,200,201,202,203,204,205,206,300,301,302,304,305,306,307,308,309,310,700,701,800,900,901,1100';
    return `/Destiny2/${membershipType}/Profile/${destinyMembershipId}/?components=${componentList}`;
  },
  getClan: (groupId: string) => `/GroupV2/${groupId}/`,
  searchUsers: (q: string, page: number = 0) => `/User/Search/GlobalName/${page}/`,
  searchDestinyPlayer: (membershipType: number, displayName: string) => `/Destiny2/SearchDestinyPlayer/${membershipType}/${encodeURIComponent(displayName)}/`,
  getGroupsForMember: (membershipType: number, destinyMembershipId: string) =>
    `/GroupV2/User/${membershipType}/${destinyMembershipId}/0/1/`,
  getMembersOfGroup: (groupId: string) => 
    `/GroupV2/${groupId}/Members/`,
  getItemDefinition: (itemHash: number | string) => 
    `/Destiny2/Manifest/DestinyInventoryItemDefinition/${itemHash}/`,
  getSocketCategoryDefinition: (hash: number | string) =>
    `/Destiny2/Manifest/DestinySocketCategoryDefinition/${hash}/`,
  getStatDefinition: (hash: number | string) =>
    `/Destiny2/Manifest/DestinyStatDefinition/${hash}/`,
  getObjectiveDefinition: (objectiveHash: number | string) => 
    `/Destiny2/Manifest/DestinyObjectiveDefinition/${objectiveHash}/`,
  getPlugSetDefinition: (hash: number | string) =>
    `/Destiny2/Manifest/DestinyPlugSetDefinition/${hash}/`,
  getPresentationNodeDefinition: (hash: number | string) =>
    `/Destiny2/Manifest/DestinyPresentationNodeDefinition/${hash}/`,
  getRecordDefinition: (hash: number | string) =>
    `/Destiny2/Manifest/DestinyRecordDefinition/${hash}/`,
  getCollectibleDefinition: (hash: number | string) =>
    `/Destiny2/Manifest/DestinyCollectibleDefinition/${hash}/`,
  getSeasonDefinition: (hash: number | string) =>
    `/Destiny2/Manifest/DestinySeasonDefinition/${hash}/`,
  getSeasonPassDefinition: (hash: number | string) =>
    `/Destiny2/Manifest/DestinySeasonPassDefinition/${hash}/`,
  getProgressionDefinition: (hash: number | string) =>
    `/Destiny2/Manifest/DestinyProgressionDefinition/${hash}/`,
  searchDestinyEntities: (type: string, searchTerm: string, page: number = 0) =>
    `/Destiny2/Armory/Search/${type}/${searchTerm}/?page=${page}`,
  getPublicMilestones: () => '/Destiny2/Milestones/',
  getMilestoneDefinition: (hash: number | string) =>
    `/Destiny2/Manifest/DestinyMilestoneDefinition/${hash}/`,
  getEventCardDefinition: (hash: number | string) =>
    `/Destiny2/Manifest/DestinyEventCardDefinition/${hash}/`,
  getActivityDefinition: (hash: number | string) =>
    `/Destiny2/Manifest/DestinyActivityDefinition/${hash}/`,
  getActivityModeDefinition: (hash: number | string) =>
    `/Destiny2/Manifest/DestinyActivityModeDefinition/${hash}/`,
  getInventoryItemDefinition: (hash: number | string) =>
    `/Destiny2/Manifest/DestinyInventoryItemDefinition/${hash}/`,
  // Actions
  equipItem: () => `/Destiny2/Actions/Items/EquipItem/`,
  transferItem: () => `/Destiny2/Actions/Items/TransferItem/`,
  setLockState: () => `/Destiny2/Actions/Items/SetLockState/`,
  equipLoadout: () => `/Destiny2/Actions/Loadouts/EquipLoadout/`,
  insertSocketPlug: () => `/Destiny2/Actions/Items/InsertSocketPlug/`,
  insertSocketPlugFree: () => `/Destiny2/Actions/Items/InsertSocketPlugFree/`,
  
  // Activity History & Stats
  getActivityHistory: (membershipType: number, destinyMembershipId: string, characterId: string) => 
    `/Destiny2/${membershipType}/Account/${destinyMembershipId}/Character/${characterId}/Stats/Activities/`,
  getPostGameCarnageReport: (activityId: string) =>
    `/Destiny2/Stats/PostGameCarnageReport/${activityId}/`,
  getNews: (page: number = 0, count: number = 10) => 
    `/Content/SearchContentByTagAndType/news/News/en/?currentpage=${page + 1}&itemsperpage=${count}`,
  getLoadoutIconDefinition: (hash: number | string) =>
    `/Destiny2/Manifest/DestinyLoadoutIconDefinition/${hash}/`,
  getLoadoutNameDefinition: (hash: number | string) =>
    `/Destiny2/Manifest/DestinyLoadoutNameDefinition/${hash}/`,
  getLoadoutColorDefinition: (hash: number | string) =>
    `/Destiny2/Manifest/DestinyLoadoutColorDefinition/${hash}/`,
  getDestinyManifest: () => '/Destiny2/Manifest/',
  // Character Activities (component 204) - contains availableActivities
  getCharacterActivities: (membershipType: number, destinyMembershipId: string, characterId: string) =>
    `/Destiny2/${membershipType}/Profile/${destinyMembershipId}/Character/${characterId}/?components=204`,
  // Destination definition
  getDestinationDefinition: (hash: number | string) =>
    `/Destiny2/Manifest/DestinyDestinationDefinition/${hash}/`,
  // Activity Graph definition
  getActivityGraphDefinition: (hash: number | string) =>
    `/Destiny2/Manifest/DestinyActivityGraphDefinition/${hash}/`,
  // Activity Modifier definition (for bonus drops, daily focus, etc.)
  getActivityModifierDefinition: (hash: number | string) =>
    `/Destiny2/Manifest/DestinyActivityModifierDefinition/${hash}/`,
};


// Enhanced Actions
export const moveItem = async (
    itemId: string, 
    itemHash: number, 
    fromOwnerId: string, // characterId or 'VAULT'
    toOwnerId: string,   // characterId or 'VAULT'
    membershipType: number
) => {
    // Case 1: Same location - do nothing
    if (fromOwnerId === toOwnerId) return;

    // Case 2: To Vault (Simple Transfer)
    if (toOwnerId === 'VAULT') {
        // Note: Bungie API requires characterId for vault transfers to indicate which character is performing the action (or which char it's coming from)
        // If fromOwnerId is a character, use that.
        // If fromOwnerId is unknown? We shouldn't be here.
        return transferItem(itemId, itemHash, fromOwnerId, membershipType, true);
    }

    // Case 3: From Vault to Character (Simple Transfer)
    if (fromOwnerId === 'VAULT') {
        return transferItem(itemId, itemHash, toOwnerId, membershipType, false);
    }

    // Case 4: Character A to Character B (Complex: A -> Vault -> B)
    // Step 1: A -> Vault
    await transferItem(itemId, itemHash, fromOwnerId, membershipType, true);
    // Step 2: Vault -> B
    await transferItem(itemId, itemHash, toOwnerId, membershipType, false);
};

// Action Wrappers
export const equipItem = async (itemId: string, characterId: string, membershipType: number) => {
    return bungieApi.post(endpoints.equipItem(), {
        itemId,
        characterId,
        membershipType
    });
};

export const transferItem = async (itemId: string, itemReferenceHash: number, characterId: string, membershipType: number, transferToVault: boolean, stackSize: number = 1) => {
    return bungieApi.post(endpoints.transferItem(), {
        itemReferenceHash,
        stackSize,
        transferToVault,
        itemId,
        characterId,
        membershipType
    });
};

export const setItemLockState = async (itemId: string, characterId: string, membershipType: number, state: boolean) => {
    return bungieApi.post(endpoints.setLockState(), {
        state,
        itemId,
        characterId,
        membershipType
    });
};

export const equipLoadout = async (loadoutIndex: number, characterId: string, membershipType: number) => {
    return bungieApi.post(endpoints.equipLoadout(), {
        loadoutIndex,
        characterId,
        membershipType
    });
};

/**
 * Insert a plug into a socket (paid action - requires AdvancedWriteActions scope)
 * NOTE: For free actions like subclass abilities, use insertSocketPlugFree instead.
 */
export const insertSocketPlug = async (itemInstanceId: string, plugItemHash: number, socketIndex: number, characterId: string, membershipType: number) => {
    // NOTE: InsertSocketPlug requires the 'AdvancedWriteActions' OAuth scope.
    // This scope is restricted and requires Bungie approval for your API application.
    // Without it, this call will return 403 Forbidden.
    // See: https://github.com/Bungie-net/api/wiki/OAuth-Documentation
    try {
        const response = await bungieApi.post(endpoints.insertSocketPlug(), {
            actionToken: "",
            itemInstanceId,
            plugItemHash,
            socketIndex,
            characterId,
            membershipType
        });
        return response;
    } catch (error: any) {
        // Provide clearer error for 403 (missing AdvancedWriteActions scope)
        if (error.response?.status === 403) {
            const bungieError = error.response?.data;
            // Check if it's specifically a scope/permission issue
            if (bungieError?.ErrorCode === 2108 || bungieError?.ErrorStatus === "WebAuthRequired") {
                throw new Error("This app doesn't have permission to modify subclass abilities. The 'AdvancedWriteActions' OAuth scope is required, which must be approved by Bungie.");
            }
            throw new Error("Permission denied. Your app may not have the required 'AdvancedWriteActions' scope.");
        }
        throw error;
    }
};

/**
 * Insert a plug into a socket for FREE (no material cost).
 * This is used for subclass abilities, aspects, fragments, and other free-to-swap plugs.
 * Does NOT require the AdvancedWriteActions scope.
 * 
 * Reference: https://github.com/DestinyItemManager/DIM/blob/master/src/app/inventory/advanced-write-actions.ts
 */
export const insertSocketPlugFree = async (
    itemInstanceId: string, 
    plugItemHash: number, 
    socketIndex: number, 
    characterId: string, 
    membershipType: number,
    socketArrayType: number = 0 // DestinySocketArrayType.Default = 0
) => {
    return bungieApi.post(endpoints.insertSocketPlugFree(), {
        itemId: itemInstanceId,
        plug: {
            socketIndex,
            socketArrayType,
            plugItemHash
        },
        characterId,
        membershipType
    });
};


// Auth helper to redirect to Bungie
export const loginWithBungie = () => {
  window.location.href = '/api/auth/login';
};

export const logout = () => {
  window.location.href = '/api/auth/logout';
};

export const getBungieImage = (path: string) => {
  if (!path) return '';
  return `https://www.bungie.net${path}`;
};

export const getActivityHistory = async (membershipType: number, destinyMembershipId: string, characterId: string, mode: number, count: number = 250, page: number = 0) => {
  // mode: 4 for Raid, 82 for Dungeon
  return bungieApi.get(endpoints.getActivityHistory(membershipType, destinyMembershipId, characterId), {
    params: {
      mode,
      count,
      page
    }
  });
};

export const getPostGameCarnageReport = async (activityId: string) => {
  return bungieApi.get(endpoints.getPostGameCarnageReport(activityId));
};

export const getDestinyNews = async (page: number = 0, count: number = 10) => {
  return bungieApi.get(endpoints.getNews(page, count));
};
