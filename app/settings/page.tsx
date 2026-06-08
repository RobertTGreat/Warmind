"use client";

import { useSettingsStore, type IconSize, type SortMethod } from "@/store/settingsStore";
import { clearCache } from "@/lib/activityCache";
import { cn } from "@/lib/utils";
import { PretextLineClamp } from "@/components/PretextLineClamp";
import { Dropdown } from "@/components/Dropdown";
import { 
    Database, 
    RotateCcw,
    Trash2,
    Check,
    Backpack,
    SlidersHorizontal,
    RefreshCw,
    Loader2,
    AlertCircle,
    Star,
    Plus,
    X,
    ExternalLink,
    ThumbsDown,
    ChevronRight,
    Heart,
    BookOpen,
    Trophy
} from "lucide-react";
import { useState, useEffect, useCallback, type ElementType, type ReactNode } from "react";
import { toast } from "sonner";
import { useWishListStore, PRESET_WISH_LISTS, type PresetWishList } from "@/store/wishlistStore";
import { DEFAULT_PAGE_OPTIONS, normalizeDefaultPage, type DefaultPage } from "@/lib/defaultPages";

// Fallback in case the import fails (Turbopack issue)
const PRESET_WISH_LISTS_FALLBACK: PresetWishList[] = [
    {
        id: 'voltron',
        name: 'Voltron (Default)',
        description: 'The default DIM wish list - a compilation of god rolls from top community minds.',
        url: 'https://raw.githubusercontent.com/48klocs/dim-wish-list-sources/master/voltron.txt',
        author: '48klocs & Community'
    },
    {
        id: 'choosy-voltron',
        name: 'Choosy Voltron',
        description: 'Voltron with additional opinionated trash rolls added in.',
        url: 'https://raw.githubusercontent.com/48klocs/dim-wish-list-sources/master/choosy_voltron.txt',
        author: '48klocs & Community'
    },
    {
        id: 'justanotherteam',
        name: 'Just Another Team',
        description: 'Roll recommendations from Azared, Alpharius and BeenLab.',
        url: 'https://raw.githubusercontent.com/dsf000z/JAT-wishlists-bundler/main/bundles/DIM-strict/just-another-team-mnk.txt',
        author: 'Azared, Alpharius & BeenLab'
    },
];

// Use fallback if import is undefined (Turbopack hot reload issue)
const safePresetWishLists = PRESET_WISH_LISTS ?? PRESET_WISH_LISTS_FALLBACK;

// ===== Setting Components =====

function SettingSection({ 
    title, 
    icon: Icon, 
    badge,
    children 
}: { 
    title: string; 
    icon: ElementType;
    badge?: ReactNode;
    children: ReactNode 
}) {
    return (
        <section className="h-fit border-b border-white/10 pb-8">
            <div className="mb-5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-white/10 bg-white/[0.03]">
                    <Icon className="w-5 h-5 text-destiny-gold" />
                </div>
                <h2 className="text-xl font-bold uppercase tracking-wide text-white">{title}</h2>
                {badge}
            </div>
            <div>
                {children}
            </div>
        </section>
    );
}

function SettingRow({ 
    label, 
    description, 
    disabled,
    children 
}: { 
    label: string; 
    description?: string;
    disabled?: boolean;
    children: ReactNode 
}) {
    return (
        <div className={cn(
            "flex flex-col gap-3 border-b border-white/5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between",
            disabled && "opacity-50 pointer-events-none"
        )}>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{label}</div>
                {description && (
                    <div className="text-xs text-slate-500 mt-0.5">{description}</div>
                )}
            </div>
            <div className="shrink-0">
                {children}
            </div>
        </div>
    );
}

function Toggle({ 
    checked, 
    onChange,
    disabled
}: { 
    checked: boolean; 
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <button
            onClick={() => onChange(!checked)}
            disabled={disabled}
            className={cn(
                "relative w-11 h-6 rounded-full transition-colors",
                checked ? "bg-destiny-gold" : "bg-slate-700",
                disabled && "opacity-50 cursor-not-allowed"
            )}
        >
            <div className={cn(
                "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                checked ? "left-6" : "left-1"
            )} />
        </button>
    );
}

// ===== Wish List Section Component =====

function WishListSection() {
    const {
        wishLists,
        isLoading,
        loadingUrl,
        error,
        showWishListIndicators,
        showTrashIndicators,
        addWishList,
        removeWishList,
        toggleWishList,
        refreshWishList,
        refreshAllWishLists,
        setShowWishListIndicators,
        setShowTrashIndicators,
    } = useWishListStore();
    
    const [newUrl, setNewUrl] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [showPresets, setShowPresets] = useState(false);
    
    const handleAddWishList = useCallback(async () => {
        if (!newUrl.trim()) return;
        
        await addWishList(newUrl.trim());
        setNewUrl('');
        setShowAddForm(false);
        
        if (!useWishListStore.getState().error) {
            toast.success('Wish list added successfully');
        }
    }, [newUrl, addWishList]);
    
    const handleAddPreset = useCallback(async (url: string, name: string) => {
        await addWishList(url);
        if (!useWishListStore.getState().error) {
            toast.success(`${name} added`);
        }
    }, [addWishList]);
    
    const handleRefreshAll = useCallback(async () => {
        await refreshAllWishLists();
        toast.success('All wish lists refreshed');
    }, [refreshAllWishLists]);
    
    const totalRolls = wishLists.reduce((acc, wl) => acc + wl.rollCount, 0);
    const totalTrash = wishLists.reduce((acc, wl) => acc + wl.trashRollCount, 0);
    
    // Check which presets are already added
    const isPresetAdded = (url: string) => wishLists.some(wl => wl.url === url);
    
    return (
        <SettingSection title="Wish Lists" icon={Star}>
            <div className="mb-2 text-sm text-slate-400">
                Import community-curated weapon roll recommendations from DIM wish lists.
                Items matching wish list rolls will be highlighted in your inventory.
            </div>
            
            <SettingRow label="Show Wish List Indicators" description="Highlight god rolls with a thumbs up">
                <Toggle 
                    checked={showWishListIndicators} 
                    onChange={setShowWishListIndicators} 
                />
            </SettingRow>
            
            <SettingRow label="Show Trash Indicators" description="Mark trash rolls with a thumbs down">
                <Toggle 
                    checked={showTrashIndicators} 
                    onChange={setShowTrashIndicators} 
                />
            </SettingRow>
            
            {/* Wish List Stats */}
            {wishLists.length > 0 && (
                <div className="flex flex-wrap items-center gap-4 border-b border-white/5 py-4">
                    <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-green-400" />
                        <span className="text-sm text-slate-300">{totalRolls.toLocaleString()} wish list rolls</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <ThumbsDown className="w-4 h-4 text-red-400" />
                        <span className="text-sm text-slate-300">{totalTrash.toLocaleString()} trash rolls</span>
                    </div>
                </div>
            )}
            
            {/* Error Display */}
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}
            
            {/* Preset Wish Lists */}
            <div className={cn(
                "relative border-b border-white/5 py-4",
                showPresets && "z-30"
            )}>
                <button
                    type="button"
                    onClick={() => setShowPresets(!showPresets)}
                    aria-expanded={showPresets}
                    className={cn(
                        "flex items-center justify-between w-full text-left px-3 py-2.5",
                        "rounded-sm border border-white/10 bg-white/[0.03]",
                        "text-sm font-medium text-slate-200 transition-colors",
                        "hover:border-white/20 hover:bg-white/[0.06]"
                    )}
                >
                    <span>Community Wish Lists</span>
                    <ChevronRight
                        className={cn(
                            "w-4 h-4 text-slate-400 transition-transform",
                            showPresets && "rotate-90 text-destiny-gold"
                        )}
                    />
                </button>
                
                {showPresets && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(32rem,calc(100vh-10rem))] overflow-y-auto rounded-sm border border-white/10 bg-[#05070c]/95 shadow-2xl shadow-black/70 backdrop-blur-md custom-scrollbar">
                        {safePresetWishLists.map(preset => {
                            const isAdded = isPresetAdded(preset.url);
                            const addedList = wishLists.find(wl => wl.url === preset.url);
                            const isCurrentlyLoading = loadingUrl === preset.url;
                            
                            return (
                                <div 
                                    key={preset.id}
                                    className={cn(
                                        "border-b border-white/5 p-3 transition-colors last:border-b-0",
                                        isAdded 
                                            ? addedList?.enabled 
                                                ? "bg-destiny-gold/10 border-destiny-gold/30" 
                                                : "opacity-60"
                                            : ""
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className={cn(
                                                    "font-medium truncate",
                                                    isAdded ? "text-destiny-gold" : "text-white"
                                                )}>
                                                    {preset.name}
                                                </h4>
                                                {isCurrentlyLoading && (
                                                    <Loader2 className="w-3 h-3 text-destiny-gold animate-spin shrink-0" />
                                                )}
                                                {isAdded && addedList && (
                                                    <span className="text-[10px] text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded uppercase font-medium">
                                                        Added
                                                    </span>
                                                )}
                                            </div>
                                            <PretextLineClamp
                                                className="text-xs text-slate-500 mt-0.5 line-clamp-2"
                                                maxLines={2}
                                                text={preset.description ?? ""}
                                            />
                                            {preset.author && (
                                                <p className="text-[10px] text-slate-600 mt-1">By {preset.author}</p>
                                            )}
                                            {isAdded && addedList && (
                                                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <Star className="w-2.5 h-2.5 text-green-400" />
                                                        {addedList.rollCount.toLocaleString()}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <ThumbsDown className="w-2.5 h-2.5 text-red-400" />
                                                        {addedList.trashRollCount.toLocaleString()}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {isAdded && addedList ? (
                                                <>
                                                    <button
                                                        onClick={() => toggleWishList(addedList.id)}
                                                        className={cn(
                                                            "p-1.5 rounded-sm border transition-colors",
                                                            addedList.enabled 
                                                                ? "border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20" 
                                                                : "border-white/10 bg-[#111827] text-slate-500 hover:bg-slate-700"
                                                        )}
                                                        title={addedList.enabled ? "Disable" : "Enable"}
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            removeWishList(addedList.id);
                                                            toast.success('Wish list removed');
                                                        }}
                                                        className="p-1.5 rounded-sm border border-white/10 bg-white/[0.03] text-slate-400 transition-colors hover:border-red-500/30 hover:bg-red-500/20 hover:text-red-400"
                                                        title="Remove"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => handleAddPreset(preset.url, preset.name)}
                                                    disabled={isLoading}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-destiny-gold/30 bg-destiny-gold/10 text-destiny-gold transition-colors hover:bg-destiny-gold/20 disabled:opacity-50"
                                                    title="Add"
                                                >
                                                    {isCurrentlyLoading ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        <Plus className="w-3 h-3" />
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* User's Wish Lists */}
            <div className="border-b border-white/5 py-4">
                <h4 className="text-xs uppercase tracking-wider text-slate-500 font-medium">Your Wish Lists</h4>
                {wishLists.length === 0 ? (
                    <div className="mt-3 border border-dashed border-white/10 py-6 text-center">
                        <Star className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-sm text-slate-500 mb-3">No wish lists added yet</p>
                        <p className="text-xs text-slate-600">Add a preset above or add a custom URL below</p>
                    </div>
                ) : (
                    <div className="mt-3 overflow-hidden rounded-sm border border-white/10 bg-black/20">
                        {wishLists.map(wishList => (
                            <div 
                                key={wishList.id}
                                className={cn(
                                    "border-b border-white/5 p-3 transition-colors last:border-b-0",
                                    wishList.enabled 
                                        ? "" 
                                        : "opacity-60"
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-medium text-white truncate">{wishList.title}</h4>
                                            {loadingUrl === wishList.url && (
                                                <Loader2 className="w-3 h-3 text-destiny-gold animate-spin shrink-0" />
                                            )}
                                        </div>
                                        {wishList.description && (
                                            <PretextLineClamp
                                                className="text-xs text-slate-500 mt-0.5 line-clamp-2"
                                                maxLines={2}
                                                text={wishList.description}
                                            />
                                        )}
                                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <Star className="w-3 h-3 text-green-400" />
                                                {wishList.rollCount.toLocaleString()}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <ThumbsDown className="w-3 h-3 text-red-400" />
                                                {wishList.trashRollCount.toLocaleString()}
                                            </span>
                                            <span>
                                                Updated {new Date(wishList.lastUpdated).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={() => toggleWishList(wishList.id)}
                                            className={cn(
                                                "p-1.5 rounded-sm border transition-colors",
                                                wishList.enabled 
                                                    ? "border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20" 
                                                    : "border-white/10 bg-[#0b111a] text-slate-500 hover:bg-slate-700"
                                            )}
                                            title={wishList.enabled ? "Disable" : "Enable"}
                                        >
                                            <Check className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => refreshWishList(wishList.id)}
                                            disabled={isLoading}
                                            className="p-1.5 rounded-sm border border-white/10 bg-white/[0.03] text-slate-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                                            title="Refresh"
                                        >
                                            <RefreshCw className={cn("w-4 h-4", loadingUrl === wishList.url && "animate-spin")} />
                                        </button>
                                        <a
                                            href={wishList.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1.5 rounded-sm border border-white/10 bg-white/[0.03] text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                                            title="View Source"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                        <button
                                            onClick={() => {
                                                removeWishList(wishList.id);
                                                toast.success('Wish list removed');
                                            }}
                                            className="p-1.5 rounded-sm border border-white/10 bg-white/[0.03] text-slate-400 transition-colors hover:border-red-500/30 hover:bg-red-500/20 hover:text-red-400"
                                            title="Remove"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            {/* Add Custom Wish List */}
            <div className="pt-4">
                <h4 className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-3">Custom Wish List</h4>
                {showAddForm ? (
                    <div className="space-y-3">
                        <input
                            type="url"
                            value={newUrl}
                            onChange={(e) => setNewUrl(e.target.value)}
                            placeholder="Enter wish list URL (e.g., raw GitHub URL)"
                            className="w-full border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-destiny-gold/50"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddWishList();
                                if (e.key === 'Escape') setShowAddForm(false);
                            }}
                            autoFocus
                        />
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleAddWishList}
                                disabled={isLoading || !newUrl.trim()}
                                className="flex items-center gap-2 rounded-sm border border-destiny-gold/30 bg-destiny-gold/10 px-4 py-2 text-sm font-medium text-destiny-gold transition-colors hover:bg-destiny-gold/20 disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4" />
                                        Add
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => {
                                    setShowAddForm(false);
                                    setNewUrl('');
                                }}
                                className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="flex items-center gap-2 rounded-sm border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/10"
                        >
                            <Plus className="w-3 h-3" />
                            Add Custom URL
                        </button>
                        {wishLists.length > 0 && (
                            <button
                                onClick={handleRefreshAll}
                                disabled={isLoading}
                                className="flex items-center gap-2 px-3 py-1.5 text-slate-400 hover:text-white transition-colors text-xs disabled:opacity-50"
                            >
                                <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
                                Refresh All
                            </button>
                        )}
                    </div>
                )}
            </div>
        </SettingSection>
    );
}

// ===== Main Settings Page =====

export default function SettingsPage() {
    const settings = useSettingsStore();
    const [clearing, setClearing] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleClearCache = async () => {
        setClearing(true);
        try {
            await clearCache();
            // Also clear invalid instances from localStorage
            localStorage.removeItem('warmind_invalid_activity_instances');
            toast.success("Cache cleared successfully");
        } catch {
            toast.error("Failed to clear cache");
        } finally {
            setClearing(false);
        }
    };

    const handleResetSettings = () => {
        if (confirm("Are you sure you want to reset all settings to defaults?")) {
            settings.resetToDefaults();
            toast.success("Settings reset to defaults");
        }
    };

    const defaultPageOptions: { value: DefaultPage; label: string }[] =
        DEFAULT_PAGE_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
        }));

    const iconSizeOptions: { value: IconSize; label: string }[] = [
        { value: 'small', label: 'Small' },
        { value: 'medium', label: 'Medium' },
        { value: 'large', label: 'Large' },
    ];

    const sortOptions: { value: SortMethod; label: string }[] = [
        { value: 'power', label: 'Power Level' },
        { value: 'name', label: 'Name' },
        { value: 'rarity', label: 'Rarity' },
        { value: 'newest', label: 'Recently Acquired' },
    ];

    const cacheDurationOptions = [
        { value: '15', label: '15 minutes' },
        { value: '30', label: '30 minutes' },
        { value: '60', label: '1 hour' },
        { value: '360', label: '6 hours' },
        { value: '1440', label: '24 hours' },
    ];

    if (!mounted) {
        return (
            <div className="mx-auto max-w-[1500px] py-12">
                <div className="grid animate-pulse grid-cols-1 gap-8 xl:grid-cols-2 2xl:grid-cols-3">
                    <div className="h-64 bg-slate-800/70" />
                    <div className="h-48 bg-slate-800/70" />
                    <div className="h-48 bg-slate-800/70" />
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-[1500px] pb-16">
            <div className="grid grid-cols-1 gap-x-10 gap-y-8 xl:grid-cols-2 2xl:grid-cols-3">
                <div className="xl:col-span-2">
                    <WishListSection />
                </div>

                <SettingSection title="General" icon={SlidersHorizontal}>
                    <SettingRow label="Default Page" description="Where Warmind opens from the home route">
                        <Dropdown
                            value={normalizeDefaultPage(settings.defaultPage)}
                            onChange={(v) => settings.setDefaultPage(v as DefaultPage)}
                            options={defaultPageOptions}
                        />
                    </SettingRow>
                </SettingSection>

                <SettingSection title="Inventory & Vault" icon={Backpack}>
                    <SettingRow label="Icon Size" description="Size of item icons">
                        <Dropdown 
                            value={settings.iconSize} 
                            onChange={(v) => settings.setIconSize(v as IconSize)}
                            options={iconSizeOptions}
                        />
                    </SettingRow>
                    <SettingRow label="Default Sort" description="How items are sorted by default">
                        <Dropdown 
                            value={settings.sortMethod} 
                            onChange={(v) => settings.setSortMethod(v as SortMethod)}
                            options={sortOptions}
                        />
                    </SettingRow>
                    <SettingRow label="Group by Rarity" description="Cluster inventory and vault items by rarity before sorting">
                        <Toggle
                            checked={Boolean(settings.vaultGrouping.byRarity)}
                            onChange={(checked) => settings.setVaultGrouping({ byRarity: checked })}
                        />
                    </SettingRow>
                    <SettingRow label="Group by Ammo Type" description="Cluster weapons by Primary, Special, and Heavy ammo before sorting">
                        <Toggle
                            checked={Boolean(settings.vaultGrouping.byAmmoType)}
                            onChange={(checked) => settings.setVaultGrouping({ byAmmoType: checked })}
                        />
                    </SettingRow>
                </SettingSection>

                <SettingSection title="Collections" icon={BookOpen}>
                    <SettingRow label="Hide Acquired Collection Items" description="Only show collection items you have not acquired yet">
                        <Toggle
                            checked={settings.hideAcquiredCollectionItems}
                            onChange={settings.setHideAcquiredCollectionItems}
                        />
                    </SettingRow>
                    <SettingRow label="Hide Invisible Collection Items" description="Hide collection entries marked invisible by the game">
                        <Toggle
                            checked={settings.hideInvisibleCollectionItems}
                            onChange={settings.setHideInvisibleCollectionItems}
                        />
                    </SettingRow>
                    <SettingRow label="Group Collection Items" description="Keep collection items grouped by their presentation category">
                        <Toggle
                            checked={settings.groupCollectionItems}
                            onChange={settings.setGroupCollectionItems}
                        />
                    </SettingRow>
                </SettingSection>

                <SettingSection title="Triumphs & Titles" icon={Trophy}>
                    <SettingRow label="Hide Completed Triumphs" description="Hide completed and redeemed triumph records from triumph views">
                        <Toggle
                            checked={settings.hideCompletedTriumphs}
                            onChange={settings.setHideCompletedTriumphs}
                        />
                    </SettingRow>
                    <SettingRow label="Hide Invisible Triumphs" description="Hide records that the game marks invisible">
                        <Toggle
                            checked={settings.hideInvisibleTriumphs}
                            onChange={settings.setHideInvisibleTriumphs}
                        />
                    </SettingRow>
                    <SettingRow label="Hide Unobtainable Triumphs" description="Hide incomplete records that the profile reports as unavailable">
                        <Toggle
                            checked={settings.hideUnobtainableTriumphs}
                            onChange={settings.setHideUnobtainableTriumphs}
                        />
                    </SettingRow>
                    <SettingRow label="Group Titles" description="Group title cards by acquired and missing status">
                        <Toggle
                            checked={settings.groupTitles}
                            onChange={settings.setGroupTitles}
                        />
                    </SettingRow>
                </SettingSection>

                <SettingSection title="Data & Cache" icon={Database}>
                    <SettingRow label="Cache Duration" description="How long activity history stays fresh">
                        <Dropdown
                            value={String(settings.cacheDurationMinutes)}
                            onChange={(value) => settings.setCacheDuration(Number(value))}
                            options={cacheDurationOptions}
                        />
                    </SettingRow>
                    <SettingRow label="Clear Cache" description="Remove all cached data">
                        <button
                            onClick={handleClearCache}
                            disabled={clearing}
                            className="flex items-center gap-2 rounded-sm border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                        >
                            <Trash2 className="w-4 h-4" />
                            {clearing ? "Clearing..." : "Clear Cache"}
                        </button>
                    </SettingRow>
                </SettingSection>

                <SettingSection title="Support Warmind" icon={Heart}>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-400">
                            Warmind is free and open source. If you find it useful, consider supporting development!
                        </p>
                        <a
                            href="https://ko-fi.com/warmind"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-[#FF5E5B] px-5 py-2.5 font-medium text-white transition-all hover:bg-[#FF5E5B]/90 active:scale-[0.98]"
                        >
                            <Heart className="w-5 h-5 fill-current" />
                            <span>Support on Ko-fi</span>
                        </a>
                    </div>
                </SettingSection>

            </div>

            {/* Reset (Full width) */}
            <div className="mt-8 border-t border-white/5 pt-4">
                <button
                    onClick={handleResetSettings}
                    className="flex items-center gap-2 rounded-sm border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10"
                >
                    <RotateCcw className="w-4 h-4" />
                    Reset All Settings to Defaults
                </button>
            </div>
        </div>
    );
}
