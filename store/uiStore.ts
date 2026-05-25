import { create } from 'zustand';

interface UIStore {
  detailsItem: any | null;
  setDetailsItem: (item: any | null) => void;
  characterSearchQuery: string;
  setCharacterSearchQuery: (query: string) => void;
  characterSearchVisible: boolean;
  setCharacterSearchVisible: (isVisible: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  detailsItem: null,
  setDetailsItem: (item) => set({ detailsItem: item }),
  characterSearchQuery: '',
  setCharacterSearchQuery: (characterSearchQuery) => set({ characterSearchQuery }),
  characterSearchVisible: false,
  setCharacterSearchVisible: (characterSearchVisible) => set({ characterSearchVisible }),
}));

