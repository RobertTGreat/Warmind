import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    StatConstraints,
    OptimizerSettings,
    OptimizerConfig,
    DEFAULT_CONSTRAINTS,
    DEFAULT_SETTINGS,
    ExoticFilter,
    ArmorStats,
    calculateSubclassBonus,
    MAX_STAT_VALUE,
} from '@/lib/armorOptimizer';

// Migration helper: Convert old stat names to new Edge of Fate names
function migrateConstraints(constraints: any): StatConstraints {
    if (!constraints) return DEFAULT_CONSTRAINTS;
    
    // If already has new stat names, return as-is
    if (constraints.weapons !== undefined) {
        return constraints;
    }
    
    // Migrate from old names to new names
    return {
        weapons: constraints.mobility ?? { min: 0, max: MAX_STAT_VALUE },
        health: constraints.resilience ?? { min: 0, max: MAX_STAT_VALUE },
        class: constraints.recovery ?? { min: 0, max: MAX_STAT_VALUE },
        grenade: constraints.discipline ?? { min: 0, max: MAX_STAT_VALUE },
        super: constraints.intellect ?? { min: 0, max: MAX_STAT_VALUE },
        melee: constraints.strength ?? { min: 0, max: MAX_STAT_VALUE },
    };
}

// Migration helper: Convert old priority stats to new names
function migratePriorityStats(stats: string[]): (keyof ArmorStats)[] {
    if (!stats || stats.length === 0) return DEFAULT_SETTINGS.priorityStats;
    
    const mapping: Record<string, keyof ArmorStats> = {
        mobility: 'weapons',
        resilience: 'health',
        recovery: 'class',
        discipline: 'grenade',
        intellect: 'super',
        strength: 'melee',
        // Also handle if already new names
        weapons: 'weapons',
        health: 'health',
        class: 'class',
        grenade: 'grenade',
        super: 'super',
        melee: 'melee',
    };
    
    return stats.map(s => mapping[s] || s as keyof ArmorStats).filter(s => 
        ['weapons', 'health', 'class', 'grenade', 'super', 'melee'].includes(s)
    );
}

interface OptimizerState {
    // Current configuration
    constraints: StatConstraints;
    settings: OptimizerSettings;
    selectedFragments: string[];
    
    // Saved configurations
    savedConfigs: OptimizerConfig[];
    
    // Actions
    setConstraint: (stat: keyof ArmorStats, value: { min: number; max: number }) => void;
    resetConstraints: () => void;
    setConstraints: (constraints: StatConstraints) => void;
    
    // Settings actions
    updateSettings: (updates: Partial<OptimizerSettings>) => void;
    resetSettings: () => void;
    
    // Exotic filter actions
    setExoticFilter: (filter: ExoticFilter) => void;
    
    // Fragment actions
    toggleFragment: (fragmentName: string) => void;
    setFragments: (fragments: string[]) => void;
    clearFragments: () => void;
    
    // Config save/load
    saveConfig: (name: string, classType: number) => void;
    loadConfig: (configId: string) => void;
    deleteConfig: (configId: string) => void;
    
    // Priority stat actions
    setPriorityStats: (stats: (keyof ArmorStats)[]) => void;
}

export const useOptimizerStore = create<OptimizerState>()(
    persist(
        (set, get) => ({
            constraints: DEFAULT_CONSTRAINTS,
            settings: DEFAULT_SETTINGS,
            selectedFragments: [],
            savedConfigs: [],
            
            setConstraint: (stat, value) => set((state) => ({
                constraints: {
                    ...state.constraints,
                    [stat]: value,
                },
            })),
            
            resetConstraints: () => set({ constraints: DEFAULT_CONSTRAINTS }),
            
            setConstraints: (constraints) => set({ constraints }),
            
            updateSettings: (updates) => set((state) => ({
                settings: {
                    ...state.settings,
                    ...updates,
                },
            })),
            
            resetSettings: () => set({ settings: DEFAULT_SETTINGS, selectedFragments: [] }),
            
            setExoticFilter: (filter) => set((state) => ({
                settings: {
                    ...state.settings,
                    exoticFilter: filter,
                },
            })),
            
            toggleFragment: (fragmentName) => set((state) => {
                const isSelected = state.selectedFragments.includes(fragmentName);
                const newFragments = isSelected
                    ? state.selectedFragments.filter(f => f !== fragmentName)
                    : [...state.selectedFragments, fragmentName];
                
                const totalBonus = calculateSubclassBonus(newFragments);
                
                return {
                    selectedFragments: newFragments,
                    settings: {
                        ...state.settings,
                        subclassConfig: newFragments.length > 0
                            ? {
                                name: 'Custom',
                                fragments: [],
                                totalBonus,
                            }
                            : null,
                    },
                };
            }),
            
            setFragments: (fragments) => set((state) => {
                const totalBonus = calculateSubclassBonus(fragments);
                return {
                    selectedFragments: fragments,
                    settings: {
                        ...state.settings,
                        subclassConfig: fragments.length > 0
                            ? {
                                name: 'Custom',
                                fragments: [],
                                totalBonus,
                            }
                            : null,
                    },
                };
            }),
            
            clearFragments: () => set((state) => ({
                selectedFragments: [],
                settings: {
                    ...state.settings,
                    subclassConfig: null,
                },
            })),
            
            saveConfig: (name, classType) => set((state) => {
                const config: OptimizerConfig = {
                    id: `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    name,
                    classType,
                    constraints: state.constraints,
                    settings: state.settings,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                
                return {
                    savedConfigs: [...state.savedConfigs, config],
                };
            }),
            
            loadConfig: (configId) => set((state) => {
                const config = state.savedConfigs.find(c => c.id === configId);
                if (!config) return state;
                
                return {
                    constraints: config.constraints,
                    settings: config.settings,
                };
            }),
            
            deleteConfig: (configId) => set((state) => ({
                savedConfigs: state.savedConfigs.filter(c => c.id !== configId),
            })),
            
            setPriorityStats: (stats) => set((state) => ({
                settings: {
                    ...state.settings,
                    priorityStats: stats,
                },
            })),
        }),
        {
            name: 'destiny-optimizer-storage',
            partialize: (state) => ({
                savedConfigs: state.savedConfigs,
                constraints: state.constraints,
                settings: state.settings,
                selectedFragments: state.selectedFragments,
            }),
            // Migrate old data on load
            onRehydrateStorage: () => (state, error) => {
                if (error) {
                    console.error('Error rehydrating optimizer store:', error);
                    return;
                }
                if (state) {
                    // Migrate constraints from old stat names
                    state.constraints = migrateConstraints(state.constraints);
                    // Migrate priority stats if present
                    if (state.settings?.priorityStats) {
                        state.settings.priorityStats = migratePriorityStats(state.settings.priorityStats as any);
                    }
                }
            },
        }
    )
);
