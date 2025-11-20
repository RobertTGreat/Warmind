import { create } from 'zustand';

interface UIStore {
  detailsItem: any | null;
  setDetailsItem: (item: any | null) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  detailsItem: null,
  setDetailsItem: (item) => set({ detailsItem: item }),
}));

