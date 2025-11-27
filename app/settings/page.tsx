"use client";

import dynamic from 'next/dynamic';
import { 
    useSettingsStore, 
    useSyncSettings,
    useIsPremium,
    Theme, 
    AccentColor, 
    IconSize, 
    SortMethod,
    TimeFormat,
    DateFormat,
    DefaultTab,
    FailedRunsDisplay
} from "@/store/settingsStore";
import { clearCache } from "@/lib/activityCache";
import { cn } from "@/lib/utils";
import { 
    Palette, 
    Clock, 
    Database, 
    Bell, 
    RotateCcw,
    Trash2,
    Check,
    Activity,
    Backpack,
    Cloud,
    CloudOff,
    RefreshCw,
    Crown,
    Loader2,
    AlertCircle
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

// Lazy load dropdown component
const Dropdown = dynamic(
  () => import("@/components/Dropdown").then((mod) => mod.Dropdown),
  { ssr: false }
);

// ===== Setting Components =====

function SettingSection({ 
    title, 
    icon: Icon, 
    badge,
    children 
}: { 
    title: string; 
    icon: React.ElementType;
    badge?: React.ReactNode;
    children: React.ReactNode 
}) {
    return (
        <div className="rounded-xl p-6  backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-destiny-gold/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-destiny-gold" />
                </div>
                <h2 className="text-lg font-bold text-white">{title}</h2>
                {badge}
            </div>
            <div className="space-y-4">
                {children}
            </div>
        </div>
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
    children: React.ReactNode 
}) {
    return (
        <div className={cn(
            "flex items-center justify-between gap-4 py-3 border-b border-white/5 last:border-0",
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


function ColorPicker({ 
    value, 
    onChange, 
    options 
}: { 
    value: string; 
    onChange: (value: string) => void; 
    options: { value: string; color: string; label: string }[] 
}) {
    return (
        <div className="flex gap-2">
            {options.map((opt) => (
                <button
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    title={opt.label}
                    className={cn(
                        "w-8 h-8 rounded-lg transition-all",
                        value === opt.value 
                            ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110" 
                            : "hover:scale-105"
                    )}
                    style={{ backgroundColor: opt.color }}
                >
                    {value === opt.value && (
                        <Check className="w-4 h-4 text-white mx-auto" />
                    )}
                </button>
            ))}
        </div>
    );
}

function PremiumBadge() {
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-linear-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 rounded text-xs font-medium text-amber-400">
            <Crown className="w-3 h-3" />
            Premium
        </span>
    );
}

// ===== Sync Section Component =====

function SyncSection() {
    const {
        subscriptionTier,
        syncEnabled,
        lastSyncedAt,
        isSyncing,
        syncError,
        bungieId,
        setSyncEnabled,
        syncToCloud,
        syncFromCloud,
    } = useSyncSettings();
    
    const isPremium = useIsPremium();
    
    const formatLastSync = (date: string | null) => {
        if (!date) return 'Never';
        const d = new Date(date);
        return d.toLocaleString();
    };

    const handleManualSync = async () => {
        if (!isPremium) {
            toast.error("Sync is a premium feature");
            return;
        }
        
        try {
            await syncToCloud();
            toast.success("Settings synced to cloud");
        } catch {
            toast.error("Failed to sync settings");
        }
    };

    const handlePullFromCloud = async () => {
        if (!isPremium) {
            toast.error("Sync is a premium feature");
            return;
        }
        
        try {
            await syncFromCloud();
            toast.success("Settings loaded from cloud");
        } catch {
            toast.error("Failed to load settings from cloud");
        }
    };

    return (
        <SettingSection 
            title="Cloud Sync" 
            icon={Cloud}
            badge={<PremiumBadge />}
        >
            {!isPremium ? (
                <div className="bg-linear-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <Crown className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                            <div className="font-medium text-white mb-1">Upgrade to Premium</div>
                            <p className="text-sm text-slate-400 mb-3">
                                Sync your settings across all your devices. Your preferences, favorites, and customizations will follow you everywhere.
                            </p>
                            <button className="px-4 py-2 bg-linear-to-r from-amber-500 to-yellow-500 text-black font-medium rounded-lg text-sm hover:from-amber-400 hover:to-yellow-400 transition-all">
                                Coming Soon
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <SettingRow 
                        label="Enable Sync" 
                        description="Automatically sync settings when they change"
                    >
                        <Toggle 
                            checked={syncEnabled} 
                            onChange={setSyncEnabled}
                            disabled={!bungieId}
                        />
                    </SettingRow>
                    
                    <SettingRow 
                        label="Last Synced" 
                        description={formatLastSync(lastSyncedAt)}
                    >
                        <div className="flex items-center gap-2">
                            {isSyncing ? (
                                <Loader2 className="w-4 h-4 text-destiny-gold animate-spin" />
                            ) : syncError ? (
                                <AlertCircle className="w-4 h-4 text-red-400" />
                            ) : syncEnabled ? (
                                <Cloud className="w-4 h-4 text-green-400" />
                            ) : (
                                <CloudOff className="w-4 h-4 text-slate-500" />
                            )}
                        </div>
                    </SettingRow>

                    {syncError && (
                        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                            {syncError}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={handleManualSync}
                            disabled={isSyncing || !bungieId}
                            className="flex items-center gap-2 px-4 py-2 bg-destiny-gold/10 hover:bg-destiny-gold/20 border border-destiny-gold/30 text-destiny-gold rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                            Push to Cloud
                        </button>
                        <button
                            onClick={handlePullFromCloud}
                            disabled={isSyncing || !bungieId}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-white/10 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            <Cloud className="w-4 h-4" />
                            Pull from Cloud
                        </button>
                    </div>

                    {!bungieId && (
                        <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mt-2">
                            Please log in with your Bungie account to enable cloud sync.
                        </div>
                    )}
                </>
            )}
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

    const themeOptions: { value: Theme; label: string }[] = [
        { value: 'dark', label: 'Dark' },
        { value: 'oled', label: 'OLED Black' },
        { value: 'titan', label: 'Titan' },
        { value: 'hunter', label: 'Hunter' },
        { value: 'warlock', label: 'Warlock' },
    ];

    const accentColors: { value: AccentColor; color: string; label: string }[] = [
        { value: 'gold', color: '#E3CE62', label: 'Destiny Gold' },
        { value: 'void', color: '#B185DF', label: 'Void' },
        { value: 'solar', color: '#F0631E', label: 'Solar' },
        { value: 'arc', color: '#7AECF2', label: 'Arc' },
        { value: 'strand', color: '#35D27F', label: 'Strand' },
        { value: 'stasis', color: '#4D88FF', label: 'Stasis' },
    ];

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

    const timeFormatOptions: { value: TimeFormat; label: string }[] = [
        { value: '12h', label: '12 Hour' },
        { value: '24h', label: '24 Hour' },
    ];

    const dateFormatOptions: { value: DateFormat; label: string }[] = [
        { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
        { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
        { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
    ];

    const activityTabOptions: { value: DefaultTab; label: string }[] = [
        { value: 'raids', label: 'Raids' },
        { value: 'dungeons', label: 'Dungeons' },
        { value: 'all', label: 'All Activities' },
    ];

    const failedRunsOptions: { value: FailedRunsDisplay; label: string }[] = [
        { value: 'always', label: 'Always Show' },
        { value: 'collapsed', label: 'Collapsed' },
        { value: 'hidden', label: 'Hidden' },
    ];

    const cacheDurationOptions = [
        { value: 15, label: '15 minutes' },
        { value: 30, label: '30 minutes' },
        { value: 60, label: '1 hour' },
        { value: 360, label: '6 hours' },
        { value: 1440, label: '24 hours' },
    ];

    if (!mounted) {
        return (
            <div className="max-w-4xl mx-auto py-12">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 w-32 bg-slate-800 rounded" />
                    <div className="h-64 bg-slate-800 rounded-xl" />
                    <div className="h-64 bg-slate-800 rounded-xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto pb-12">

            {/* Cloud Sync - Premium Feature (Full width) */}
            <div className="mb-6">
                <SyncSection />
            </div>

            {/* 2-Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Appearance */}
                <SettingSection title="Appearance" icon={Palette}>
                    <SettingRow label="Theme" description="Choose your preferred color scheme">
                        <Dropdown 
                            value={settings.theme} 
                            onChange={settings.setTheme}
                            options={themeOptions}
                        />
                    </SettingRow>
                    <SettingRow label="Accent Color" description="Highlight color for active elements">
                        <ColorPicker
                            value={settings.accentColor}
                            onChange={(v) => settings.setAccentColor(v as AccentColor)}
                            options={accentColors}
                        />
                    </SettingRow>
                    <SettingRow label="Compact Mode" description="Reduce spacing for more content">
                        <Toggle 
                            checked={settings.compactMode} 
                            onChange={settings.setCompactMode} 
                        />
                    </SettingRow>
                    <SettingRow label="Reduced Motion" description="Minimize animations">
                        <Toggle 
                            checked={settings.reducedMotion} 
                            onChange={settings.setReducedMotion} 
                        />
                    </SettingRow>
                </SettingSection>

                {/* Inventory & Vault */}
                <SettingSection title="Inventory & Vault" icon={Backpack}>
                    <SettingRow label="Icon Size" description="Size of item icons">
                        <Dropdown 
                            value={settings.iconSize} 
                            onChange={settings.setIconSize}
                            options={iconSizeOptions}
                        />
                    </SettingRow>
                    <SettingRow label="Default Sort" description="How items are sorted by default">
                        <Dropdown 
                            value={settings.sortMethod} 
                            onChange={settings.setSortMethod}
                            options={sortOptions}
                        />
                    </SettingRow>
                    <SettingRow label="Highlight Locked Items" description="Show indicator on locked items">
                        <Toggle 
                            checked={settings.showLockedHighlight} 
                            onChange={settings.setShowLockedHighlight} 
                        />
                    </SettingRow>
                    <SettingRow label="Group Vault by Class">
                        <Toggle 
                            checked={settings.vaultGrouping.byClass} 
                            onChange={(v) => settings.setVaultGrouping({ byClass: v })} 
                        />
                    </SettingRow>
                    <SettingRow label="Group Vault by Rarity">
                        <Toggle 
                            checked={settings.vaultGrouping.byRarity} 
                            onChange={(v) => settings.setVaultGrouping({ byRarity: v })} 
                        />
                    </SettingRow>
                </SettingSection>

                {/* Activity History */}
                <SettingSection title="Activity History" icon={Activity}>
                    <SettingRow label="Default Tab" description="Which activities to show first">
                        <Dropdown 
                            value={settings.defaultActivityTab} 
                            onChange={settings.setDefaultActivityTab}
                            options={activityTabOptions}
                        />
                    </SettingRow>
                    <SettingRow label="Hide Invalid Reports" description="Filter solo DNFs and >15 player activities">
                        <Toggle 
                            checked={settings.hideInvalidReports} 
                            onChange={settings.setHideInvalidReports} 
                        />
                    </SettingRow>
                    <SettingRow label="Failed Runs Display" description="How to show incomplete activities">
                        <Dropdown 
                            value={settings.showFailedRuns} 
                            onChange={settings.setShowFailedRuns}
                            options={failedRunsOptions}
                        />
                    </SettingRow>
                </SettingSection>

                {/* Date & Time */}
                <SettingSection title="Date & Time" icon={Clock}>
                    <SettingRow label="Time Format">
                        <Dropdown 
                            value={settings.timeFormat} 
                            onChange={settings.setTimeFormat}
                            options={timeFormatOptions}
                        />
                    </SettingRow>
                    <SettingRow label="Date Format">
                        <Dropdown 
                            value={settings.dateFormat} 
                            onChange={settings.setDateFormat}
                            options={dateFormatOptions}
                        />
                    </SettingRow>
                </SettingSection>

                {/* Data & Performance */}
                <SettingSection title="Data & Cache" icon={Database}>
                    <SettingRow label="Cache Duration" description="How long to keep activity data cached">
                        <Dropdown 
                            value={String(settings.cacheDurationMinutes)} 
                            onChange={(v) => settings.setCacheDuration(Number(v))}
                            options={cacheDurationOptions.map(o => ({ value: String(o.value), label: o.label }))}
                        />
                    </SettingRow>
                    <SettingRow label="Clear Cache" description="Remove all cached data">
                        <button
                            onClick={handleClearCache}
                            disabled={clearing}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            <Trash2 className="w-4 h-4" />
                            {clearing ? "Clearing..." : "Clear Cache"}
                        </button>
                    </SettingRow>
                </SettingSection>

                {/* Notifications */}
                <SettingSection title="Notifications" icon={Bell}>
                    <SettingRow label="Weekly Reset Reminder" description="Get notified before weekly reset">
                        <Toggle 
                            checked={settings.weeklyResetReminder} 
                            onChange={settings.setWeeklyResetReminder} 
                        />
                    </SettingRow>
                    <SettingRow label="Postmaster Warning" description="Warn when postmaster is nearly full">
                        <Toggle 
                            checked={settings.postmasterWarning} 
                            onChange={settings.setPostmasterWarning} 
                        />
                    </SettingRow>
                </SettingSection>

            </div>

            {/* Reset (Full width) */}
            <div className="mt-6 pt-4 border-t border-white/5">
                <button
                    onClick={handleResetSettings}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                >
                    <RotateCcw className="w-4 h-4" />
                    Reset All Settings to Defaults
                </button>
            </div>
        </div>
    );
}
