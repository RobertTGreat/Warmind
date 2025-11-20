import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';

export type IconSize = 'small' | 'medium' | 'large';
export type SortMethod = 'power' | 'name' | 'rarity' | 'newest';

interface SettingsStore {
    iconSize: IconSize;
    sortMethod: SortMethod;
    favoriteMembers: string[];
    setIconSize: (size: IconSize) => void;
    setSortMethod: (method: SortMethod) => void;
    toggleFavoriteMember: (memberId: string) => void;
}

// Safe storage wrapper to handle QuotaExceededError
const safeLocalStorage: StateStorage = {
    getItem: (name) => {
        if (typeof window === 'undefined') return null;
        try {
            return localStorage.getItem(name);
        } catch (e) {
            return null;
        }
    },
    setItem: (name, value) => {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(name, value);
        } catch (e) {
            console.warn('LocalStorage quota exceeded or not available. Settings will not be persisted.', e);
        }
    },
    removeItem: (name) => {
        if (typeof window === 'undefined') return;
        try {
            localStorage.removeItem(name);
        } catch (e) {}
    },
};

export const useSettingsStore = create<SettingsStore>()(
    persist(
        (set) => ({
            iconSize: 'medium',
            sortMethod: 'power',
            favoriteMembers: [],
            setIconSize: (size) => set({ iconSize: size }),
            setSortMethod: (method) => set({ sortMethod: method }),
            toggleFavoriteMember: (memberId) => set((state) => {
                const isFav = state.favoriteMembers.includes(memberId);
                return {
                    favoriteMembers: isFav 
                        ? state.favoriteMembers.filter(id => id !== memberId)
                        : [...state.favoriteMembers, memberId]
                };
            }),
        }),
        {
            name: 'destiny-settings-storage',
            storage: createJSONStorage(() => safeLocalStorage),
        }
    )
);
