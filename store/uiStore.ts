import { create } from 'zustand';

interface UIStore {
  detailsItem: any | null;
  setDetailsItem: (item: any | null) => void;
  fullDetailsItem: any | null;
  setFullDetailsItem: (item: any | null) => void;
  headerSearchQuery: string;
  setHeaderSearchQuery: (query: string) => void;
  headerSearchVisible: boolean;
  setHeaderSearchVisible: (isVisible: boolean) => void;
  headerSearchPlaceholder: string;
  setHeaderSearchPlaceholder: (placeholder: string) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  detailsItem: null,
  setDetailsItem: (item) => set({ detailsItem: item }),
  fullDetailsItem: null,
  setFullDetailsItem: (item) => set({ fullDetailsItem: item }),
  headerSearchQuery: '',
  setHeaderSearchQuery: (headerSearchQuery) => set({ headerSearchQuery }),
  headerSearchVisible: false,
  setHeaderSearchVisible: (headerSearchVisible) => set({ headerSearchVisible }),
  headerSearchPlaceholder: 'Search',
  setHeaderSearchPlaceholder: (headerSearchPlaceholder) => set({ headerSearchPlaceholder }),
}));
