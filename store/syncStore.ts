import { create } from "zustand";
import {
  getDimApiProfile,
  postDimApiUpdates,
  type DimProfileSyncResponse,
  type DimProfileUpdate,
  type DimSyncAccount,
} from "@/lib/dimApi";

type SyncStatus = "idle" | "syncing" | "error";

type SyncStore = {
  lastSyncToken: string | null;
  lastSyncedAt: number | null;
  lastProfile: DimProfileSyncResponse | null;
  status: SyncStatus;
  errorMessage: string | null;
  syncAccount: (account: DimSyncAccount) => Promise<DimProfileSyncResponse>;
  postUpdates: (
    platformMembershipId: string,
    updates: DimProfileUpdate[],
  ) => Promise<DimProfileSyncResponse>;
  resetSyncState: () => void;
};

const initialSyncState = {
  lastSyncToken: null,
  lastSyncedAt: null,
  lastProfile: null,
  status: "idle" as SyncStatus,
  errorMessage: null,
};

export const useSyncStore = create<SyncStore>((set, get) => ({
  ...initialSyncState,

  syncAccount: async (account) => {
    set({ status: "syncing", errorMessage: null });

    try {
      const profile = await getDimApiProfile(account, get().lastSyncToken);

      set({
        lastSyncToken: profile.syncToken ?? get().lastSyncToken,
        lastSyncedAt: Date.now(),
        lastProfile: profile,
        status: "idle",
      });

      return profile;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "DIM sync failed";
      set({ status: "error", errorMessage });
      throw error;
    }
  },

  postUpdates: async (platformMembershipId, updates) => {
    set({ status: "syncing", errorMessage: null });

    try {
      const profile = await postDimApiUpdates(platformMembershipId, updates);

      set({
        lastSyncToken: profile.syncToken ?? get().lastSyncToken,
        lastSyncedAt: Date.now(),
        lastProfile: profile,
        status: "idle",
      });

      return profile;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "DIM sync update failed";
      set({ status: "error", errorMessage });
      throw error;
    }
  },

  resetSyncState: () => set(initialSyncState),
}));
