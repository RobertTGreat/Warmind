'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useDestinyProfileContext } from '@/components/DestinyProfileProvider';
import { useItemDefinitions } from '@/hooks/useItemDefinitions';
import { useInventoryItemDefinitionsFromTable } from '@/hooks/useInventoryItemDefinitionsFromTable';
import { usePlugSetDefinitions } from '@/hooks/usePlugSetDefinitions';
import { useClarityDescriptions } from '@/hooks/useClarityDescriptions';
import { useManifestTable } from '@/hooks/useManifestTable';
import type { ClarityDescription } from '@/lib/clarityDescriptions';
import { 
    useLoadoutStore, 
    LOADOUT_BUCKETS, 
    LOADOUT_ICONS, 
    LOADOUT_COLORS,
    DAMAGE_TYPES,
    CustomLoadout, 
    LoadoutItem,
    FashionConfig,
    ArmorModConfig,
    encodeLoadoutShareCode,
    decodeLoadoutShareCode,
    getLoadoutShareUrl,
} from '@/store/loadoutStore';
import { getBungieImage, moveItem, equipItem, insertSocketPlugFree, equipLoadout } from '@/lib/bungie';

// Lazy load heavy item card component
const DestinyItemCard = dynamic(
  () => import('@/components/DestinyItemCard').then((mod) => mod.DestinyItemCard),
  { ssr: false }
);
import { BUCKETS } from '@/lib/destinyUtils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
    Plus, 
    Edit3, 
    Trash2, 
    Copy, 
    Play, 
    Save, 
    X, 
    ChevronDown, 
    Search,
    Loader2,
    Package,
    Share2,
    Download,
    Upload,
    Link,
    Check,
    Tag,
    FileText,
    Palette,
    Zap,
    Settings2,
    ExternalLink,
    ClipboardCopy,
    Import,
    MoreHorizontal,
    Crosshair,
    Shield,
    Flame,
    Wind,
    CircleDot,
    Layers,
} from 'lucide-react';

import { loginWithBungie } from '@/lib/bungie';
import { FrostedCard } from '@/components/FrostedCard';
import {
    LoadoutModal,
    LoadoutModalFooter,
    LoadoutPrimaryButton,
    LoadoutSecondaryButton,
    LoadoutGhostButton,
} from '@/components/loadouts/LoadoutModal';
import {
    LoadoutIcon,
    LoadoutIconBadge,
    BucketIcon,
    getLoadoutIconComponent,
    resolveLoadoutIconId,
} from '@/components/loadouts/loadoutIcons';
import { CLASS_NAMES, CLASS_ICONS, DEFAULT_LOADOUT_ICON } from '@/components/loadouts/constants';

// Ability icons mapping
const ABILITY_ICONS: Record<string, React.ComponentType<any>> = {
    melee: Crosshair,
    grenade: CircleDot,
    classAbility: Shield,
    movement: Wind,
};

// ===== Share Dialog =====

interface ShareDialogProps {
    loadout: CustomLoadout;
    onClose: () => void;
}

function ShareDialog({ loadout, onClose }: ShareDialogProps) {
    const [shareCode, setShareCode] = useState('');
    const [shareUrl, setShareUrl] = useState('');
    const [copied, setCopied] = useState<'code' | 'url' | null>(null);
    
    useEffect(() => {
        const code = encodeLoadoutShareCode(loadout);
        setShareCode(code);
        setShareUrl(getLoadoutShareUrl(code));
    }, [loadout]);
    
    const handleCopy = async (type: 'code' | 'url') => {
        const text = type === 'code' ? shareCode : shareUrl;
        await navigator.clipboard.writeText(text);
        setCopied(type);
        toast.success(`${type === 'code' ? 'Share code' : 'Link'} copied!`);
        setTimeout(() => setCopied(null), 2000);
    };
    
    return (
        <LoadoutModal title="Share Loadout" icon={Share2} onClose={onClose} maxWidth="sm">
            <div className="space-y-4 p-4 sm:p-5">
                <div className="flex items-center gap-3 border border-white/10 bg-white/[0.03] p-3">
                    <LoadoutIconBadge icon={loadout.icon} color={loadout.color} />
                    <div>
                        <div className="font-semibold text-white">{loadout.name}</div>
                        <div className="text-xs text-slate-500">
                            {CLASS_NAMES[loadout.classType]} · {loadout.items.length} items
                        </div>
                    </div>
                </div>
                
                <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                        Share Link
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            readOnly
                            value={shareUrl}
                            className="flex-1 truncate border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-300"
                        />
                        <button
                            onClick={() => handleCopy('url')}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all",
                                copied === 'url' 
                                    ? "bg-green-500/20 text-green-400" 
                                    : "bg-destiny-gold/20 text-destiny-gold hover:bg-destiny-gold/30"
                            )}
                        >
                            {copied === 'url' ? <Check className="w-4 h-4" /> : <Link className="w-4 h-4" />}
                            {copied === 'url' ? 'Copied' : 'Copy'}
                        </button>
                    </div>
                </div>
                
                <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                        Share Code
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            readOnly
                            value={shareCode}
                            className="flex-1 truncate border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-slate-300"
                        />
                        <button
                            onClick={() => handleCopy('code')}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all",
                                copied === 'code' 
                                    ? "bg-green-500/20 text-green-400" 
                                    : "border border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                            )}
                        >
                            {copied === 'code' ? <Check className="w-4 h-4" /> : <ClipboardCopy className="w-4 h-4" />}
                            {copied === 'code' ? 'Copied' : 'Copy'}
                        </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-600">
                        Share this code with others to let them import your loadout
                    </p>
                </div>
            </div>
        </LoadoutModal>
    );
}

// ===== Import Dialog =====

interface ImportDialogProps {
    onImport: (loadout: CustomLoadout) => void;
    onClose: () => void;
}

function ImportDialog({ onImport, onClose }: ImportDialogProps) {
    const [importCode, setImportCode] = useState('');
    const [preview, setPreview] = useState<Omit<CustomLoadout, 'id' | 'createdAt' | 'updatedAt'> | null>(null);
    const [error, setError] = useState('');
    
    const handleCodeChange = (code: string) => {
        setImportCode(code);
        setError('');
        setPreview(null);
        
        if (code.trim()) {
            const decoded = decodeLoadoutShareCode(code.trim());
            if (decoded) {
                setPreview(decoded);
            } else {
                setError('Invalid share code');
            }
        }
    };
    
    const handleImport = () => {
        if (!preview) return;
        
        const now = new Date().toISOString();
        const imported: CustomLoadout = {
            ...preview,
            id: `loadout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            importedFrom: importCode.slice(0, 8),
            createdAt: now,
            updatedAt: now,
        };
        
        onImport(imported);
    };
    
    return (
        <LoadoutModal
            title="Import Loadout"
            icon={Download}
            onClose={onClose}
            maxWidth="sm"
            footer={
                <LoadoutModalFooter>
                    <LoadoutSecondaryButton onClick={onClose}>Cancel</LoadoutSecondaryButton>
                    <LoadoutPrimaryButton onClick={handleImport} disabled={!preview}>
                        <Download className="w-4 h-4" />
                        Import Loadout
                    </LoadoutPrimaryButton>
                </LoadoutModalFooter>
            }
        >
            <div className="space-y-4 p-4 sm:p-5">
                <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                        Paste Share Code or Link
                    </label>
                    <textarea
                        value={importCode}
                        onChange={(e) => handleCodeChange(e.target.value)}
                        placeholder="Paste a loadout share code or URL here..."
                        className="h-24 w-full resize-none border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-white focus:border-destiny-gold/50 focus:outline-none"
                    />
                    {error && (
                        <p className="mt-1 text-xs text-red-400">{error}</p>
                    )}
                </div>
                
                {preview && (
                    <div className="border border-white/10 bg-white/[0.03] p-4">
                        <div className="mb-3 flex items-center gap-3">
                            <LoadoutIconBadge icon={preview.icon} color={preview.color} />
                            <div>
                                <div className="font-semibold text-white">{preview.name}</div>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <Image src={CLASS_ICONS[preview.classType]} width={12} height={12} alt="" />
                                    {CLASS_NAMES[preview.classType]} · {preview.items.length} items
                                </div>
                            </div>
                        </div>
                        
                        {preview.description && (
                            <p className="mb-3 text-sm text-slate-400">{preview.description}</p>
                        )}
                        
                        {preview.tags && preview.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {preview.tags.map((tag) => (
                                    <span key={tag} className="bg-white/10 px-2 py-0.5 text-xs text-slate-400">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </LoadoutModal>
    );
}

// ===== Item Picker Modal =====

interface ItemPickerProps {
    bucketHash: number;
    classType: number;
    profile: any;
    onSelect: (item: LoadoutItem) => void;
    onClose: () => void;
}

function ItemPicker({ bucketHash, classType, profile, onSelect, onClose }: ItemPickerProps) {
    const [searchQuery, setSearchQuery] = useState('');
    
    const allItems = useMemo(() => {
        const charItems = Object.values(profile?.characterInventories?.data || {}).flatMap((c: any) => c.items);
        const equipItems = Object.values(profile?.characterEquipment?.data || {}).flatMap((c: any) => c.items);
        const vaultItems = profile?.profileInventory?.data?.items || [];
        
        return [...charItems, ...equipItems, ...vaultItems];
    }, [profile]);

    const bucketItems = useMemo(() => {
        return allItems.filter((item: any) => (
            !item.bucketHash ||
            item.bucketHash === bucketHash ||
            item.bucketHash === BUCKETS.VAULT
        ));
    }, [allItems, bucketHash]);
    
    const itemHashes = useMemo(() => bucketItems.map((item: any) => item.itemHash), [bucketItems]);
    const { definitions, isLoading } = useInventoryItemDefinitionsFromTable(itemHashes, 'card');
    
    // Filter items by bucket and class
    const filteredItems = useMemo(() => {
        return bucketItems.filter((item: any) => {
            const def = definitions[item.itemHash];
            if (!def) return false;
            
            // Check bucket - either direct bucket match or definition bucket
            const itemBucket = item.bucketHash || def.inventory?.bucketTypeHash;
            const defBucket = def.inventory?.bucketTypeHash;
            
            // For vault items, check definition bucket
            const matchesBucket = itemBucket === bucketHash || defBucket === bucketHash;
            if (!matchesBucket) return false;
            
            // Check class type
            if (def.classType !== undefined && def.classType !== 3 && def.classType !== classType) {
                return false;
            }
            
            // Search filter
            if (searchQuery) {
                const name = def.displayProperties?.name?.toLowerCase() || '';
                if (!name.includes(searchQuery.toLowerCase())) return false;
            }
            
            return true;
        });
    }, [bucketItems, definitions, bucketHash, classType, searchQuery]);
    
    const handleSelect = (item: any) => {
        const def = definitions[item.itemHash];
        onSelect({
            itemHash: item.itemHash,
            itemInstanceId: item.itemInstanceId,
            bucketHash: def?.inventory?.bucketTypeHash || bucketHash,
        });
    };
    
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-[2px]" onClick={onClose}>
            <div 
                className="flex max-h-[76vh] w-full max-w-3xl flex-col overflow-hidden border-l-[3px] border-l-destiny-gold bg-[#090d13]/98 shadow-2xl shadow-black/70"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
                    <h3 className="font-condensed text-base font-bold uppercase tracking-wide text-white">Select Item</h3>
                    <button type="button" onClick={onClose} className="p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                
                <div className="border-b border-white/5 p-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search items..."
                            className="w-full border border-white/10 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-600 focus:border-destiny-gold/50 focus:outline-none"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>
                
                {/* Items Grid */}
                <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-destiny-gold animate-spin" />
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            No items found
                        </div>
                    ) : (
                        <div className="grid grid-cols-6 gap-2 gap-y-7 sm:grid-cols-8 md:grid-cols-9">
                            {filteredItems.map((item: any, idx: number) => {
                                const instanceId = item.itemInstanceId;
                                const instanceData = profile?.itemComponents?.instances?.data?.[instanceId];
                                const statsData = profile?.itemComponents?.stats?.data?.[instanceId]?.stats;
                                
                                return (
                                    <button
                                        key={`${instanceId || item.itemHash}-${idx}`}
                                        onClick={() => handleSelect(item)}
                                        className="w-16 h-16 hover:scale-105 transition-transform"
                                    >
                                        <DestinyItemCard
                                            itemHash={item.itemHash}
                                            itemInstanceId={instanceId}
                                            instanceData={instanceData ? { ...instanceData, stats: statsData } : undefined}
                                            socketsData={profile?.itemComponents?.sockets?.data?.[instanceId]}
                                            className="w-full h-full"
                                            size="small"
                                            ownerId="picker"
                                        />
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ===== Subclass Slot Component with Tooltip =====

interface SubclassSlotProps {
    plugHash?: number;
    label: string;
    size?: 'small' | 'medium';
    damageType?: number;
    showTooltip?: boolean;
    disabled?: boolean;
    fragmentSlots?: number; // For aspects, shows how many fragment slots it provides
}

function SubclassSlot({ plugHash, label, size = 'small', damageType, showTooltip = true, disabled = false, fragmentSlots }: SubclassSlotProps) {
    const { definitions } = useItemDefinitions(plugHash ? [plugHash] : []);
    const def = plugHash ? definitions[plugHash] : null;
    const [isHovered, setIsHovered] = useState(false);
    
    const sizeClass = size === 'small' ? 'w-8 h-8' : 'w-10 h-10';
    const damageColor = damageType ? DAMAGE_TYPES[damageType]?.color : '#666';
    
    // Get fragment slot count from aspect definition (energyCapacity)
    const aspectFragmentSlots = useMemo(() => {
        if (fragmentSlots !== undefined) return fragmentSlots;
        if (!def) return null;
        // Aspects have an energyCapacity in their plug definition that indicates fragment slots
        const capacity = def.plug?.energyCapacity?.capacityValue;
        return capacity !== undefined ? capacity : null;
    }, [def, fragmentSlots]);
    
    if (!plugHash || !def) {
        return (
            <div 
                className={cn(
                    sizeClass, 
                    "border border-dashed border-white/10 flex items-center justify-center",
                    disabled && "opacity-30 cursor-not-allowed"
                )}
                title={label}
            >
                <span className="text-[10px] text-slate-600">+</span>
            </div>
        );
    }
    
    return (
        <div 
            className={cn(
                sizeClass, 
                "overflow-hidden border border-white/10 relative",
                disabled && "opacity-30"
            )}
            style={{ borderColor: `${damageColor}40` }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {def.displayProperties?.icon && (
                <Image
                    src={getBungieImage(def.displayProperties.icon)}
                    alt={def.displayProperties?.name || ''}
                    fill
                    className="object-cover"
                />
            )}
            
            {/* Fragment slot indicator for aspects */}
            {aspectFragmentSlots !== null && aspectFragmentSlots > 0 && (
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-black/80 border border-white/20 rounded-full flex items-center justify-center text-[9px] font-bold text-destiny-gold">
                    {aspectFragmentSlots}
                </div>
            )}
            
            {/* Tooltip */}
            {showTooltip && isHovered && def && (
                <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none">
                    <div className="bg-slate-900/95 backdrop-blur-sm border border-white/20 rounded-lg p-3 shadow-xl min-w-[200px] max-w-[280px]">
                        {/* Name */}
                        <div className="font-bold text-white text-sm mb-1 flex items-center gap-2">
                            {def.displayProperties?.name}
                            {aspectFragmentSlots !== null && aspectFragmentSlots > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-destiny-gold/20 text-destiny-gold rounded">
                                    {aspectFragmentSlots} fragment{aspectFragmentSlots !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                        
                        {/* Type */}
                        {def.itemTypeDisplayName && (
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
                                {def.itemTypeDisplayName}
                            </div>
                        )}
                        
                        {/* Description */}
                        {def.displayProperties?.description && (
                            <div className="text-xs text-slate-300 leading-relaxed">
                                {def.displayProperties.description}
                            </div>
                        )}
                        
                        {/* Stat bonuses for fragments */}
                        {def.investmentStats && def.investmentStats.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-white/10">
                                <div className="flex flex-wrap gap-2">
                                    {def.investmentStats.map((stat: any, idx: number) => {
                                        const statValue = stat.value;
                                        if (statValue === 0) return null;
                                        const statName = getStatName(stat.statTypeHash);
                                        return (
                                            <span 
                                                key={idx}
                                                className={cn(
                                                    "text-[10px] px-1.5 py-0.5 rounded",
                                                    statValue > 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                                )}
                                            >
                                                {statValue > 0 ? '+' : ''}{statValue} {statName}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        
                        {/* Arrow */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-slate-900/95" />
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper to get stat name from hash (Edge of Fate / Armor 3.0 names)
function getStatName(statHash: number): string {
    const STAT_NAMES: Record<number, string> = {
        2996146975: 'Weapons',   // Was Mobility
        392767087: 'Health',     // Was Resilience
        1943323491: 'Class',     // Was Recovery
        1735777505: 'Grenade',   // Was Discipline
        144602215: 'Super',      // Was Intellect
        4244567218: 'Melee',     // Was Strength
    };
    return STAT_NAMES[statHash] || 'Stat';
}

// ===== Fragment Row Component =====

interface FragmentRowProps {
    fragments: Array<{ plugHash: number }>;
    maxFragments?: number;
    damageType?: number;
}

function FragmentRow({ fragments, maxFragments = 3, damageType }: FragmentRowProps) {
    const slots = Array.from({ length: maxFragments });
    
    return (
        <div className="flex gap-1">
            {slots.map((_, idx) => (
                <SubclassSlot
                    key={idx}
                    plugHash={fragments[idx]?.plugHash}
                    label={`Fragment ${idx + 1}`}
                    size="small"
                    damageType={damageType}
                />
            ))}
        </div>
    );
}

// ===== Loadout Card =====

type LoadoutSourceFilter = 'all' | 'site' | 'ingame';
type LoadoutSortMode = 'updated' | 'name' | 'source';

const LOADOUT_FILTER_STORAGE_KEY = 'warmind-loadout-source-filter';
const LOADOUT_SORT_STORAGE_KEY = 'warmind-loadout-sort-mode';
const LOADOUT_EDITOR_MODS_VIEW_STORAGE_KEY = 'warmind-loadout-editor-mods-view';
const LOADOUT_SOURCE_FILTERS = ['all', 'site', 'ingame'] as const;
const LOADOUT_SORT_MODES = ['updated', 'name', 'source'] as const;
const ARMOR_MOD_SOCKET_CATEGORY_HASHES = new Set([
    590099826,  // Armor Mods
    2518356196, // Armor Cosmetics
    3154740035, // General Mods
]);

function isLoadoutSourceFilter(value: string | null): value is LoadoutSourceFilter {
    return LOADOUT_SOURCE_FILTERS.includes(value as LoadoutSourceFilter);
}

function isLoadoutSortMode(value: string | null): value is LoadoutSortMode {
    return LOADOUT_SORT_MODES.includes(value as LoadoutSortMode);
}

function getReusablePlugItems(reusablePlugEntry: any): any[] {
    if (Array.isArray(reusablePlugEntry)) return reusablePlugEntry;
    if (Array.isArray(reusablePlugEntry?.plugs)) return reusablePlugEntry.plugs;
    return [];
}

type DisplayedLoadoutEntry =
    | {
        source: 'site';
        id: string;
        loadout: CustomLoadout;
        sortName: string;
        updatedAt: string;
      }
    | {
        source: 'ingame';
        id: string;
        loadout: any;
        index: number;
        sortName: string;
      };

function isNonEmptyInGameLoadout(loadout: any) {
    const loadoutItems = Array.isArray(loadout?.items) ? loadout.items : [];
    
    return loadoutItems.some((loadoutItem: any) => {
        const itemInstanceId = String(loadoutItem?.itemInstanceId ?? '');
        
        return itemInstanceId.length > 0 && itemInstanceId !== '0';
    });
}

function normalizeLoadoutSearchText(values: unknown[]) {
    return values
        .flatMap((value) => {
            if (Array.isArray(value)) return value;
            return [value];
        })
        .filter((value) => value !== undefined && value !== null && value !== '')
        .join(' ')
        .toLowerCase();
}

function getDefinitionByHash(definitions: Record<number, any> | undefined, hash: number | undefined) {
    if (!definitions || !Number.isSafeInteger(hash)) return undefined;
    return definitions[hash!] || definitions[String(hash!) as unknown as number];
}

function collectDefinitionSearchValues(
    definition: any,
    itemDefinitions: Record<number, any>,
    sandboxPerkDefinitions: Record<string, any> | Record<number, any> | undefined
) {
    if (!definition) return [];
    
    const perkHashes = (definition.perks || [])
        .map((perk: any) => Number(perk?.perkHash))
        .filter(Number.isSafeInteger);
    const socketPlugHashes = (definition.sockets?.socketEntries || [])
        .flatMap((socketEntry: any) => [
            socketEntry?.singleInitialItemHash,
            ...(socketEntry?.reusablePlugItems || []).map((plugItem: any) => plugItem?.plugItemHash),
        ])
        .map((plugHash: any) => Number(plugHash))
        .filter(Number.isSafeInteger);
    
    return [
        definition.hash,
        definition.displayProperties?.name,
        definition.displayProperties?.description,
        definition.flavorText,
        definition.itemTypeDisplayName,
        definition.inventory?.tierTypeName,
        definition.plug?.plugCategoryIdentifier,
        definition.traitIds,
        definition.itemCategoryHashes,
        definition.defaultDamageTypeHash,
        ...perkHashes.flatMap((perkHash: number) => {
            const perkDefinition = getDefinitionByHash(sandboxPerkDefinitions as Record<number, any>, perkHash);
            return [
                perkHash,
                perkDefinition?.displayProperties?.name,
                perkDefinition?.displayProperties?.description,
            ];
        }),
        ...socketPlugHashes.flatMap((plugHash: number) => {
            const plugDefinition = getDefinitionByHash(itemDefinitions, plugHash);
            return [
                plugHash,
                plugDefinition?.displayProperties?.name,
                plugDefinition?.displayProperties?.description,
                plugDefinition?.itemTypeDisplayName,
            ];
        }),
    ];
}

function collectSiteLoadoutDefinitionHashes(loadout: CustomLoadout) {
    const hashes = new Set<number>();
    
    loadout.items.forEach((item) => {
        hashes.add(item.itemHash);
        Object.values(item.socketOverrides || {}).forEach((plugHash) => hashes.add(plugHash));
    });
    loadout.armorMods?.forEach((armorMod) => {
        armorMod.mods.forEach((mod) => hashes.add(mod.plugHash));
    });
    loadout.fashion?.forEach((fashion) => {
        if (fashion.shaderHash) hashes.add(fashion.shaderHash);
        if (fashion.ornamentHash) hashes.add(fashion.ornamentHash);
    });
    
    const subclassConfig = loadout.subclassConfig;
    if (subclassConfig) {
        hashes.add(subclassConfig.itemHash);
        if (subclassConfig.super?.plugHash) hashes.add(subclassConfig.super.plugHash);
        Object.values(subclassConfig.abilities || {}).forEach((ability) => {
            if (ability?.plugHash) hashes.add(ability.plugHash);
        });
        subclassConfig.aspects?.forEach((aspect) => hashes.add(aspect.plugHash));
        subclassConfig.fragments?.forEach((fragment) => hashes.add(fragment.plugHash));
    }
    
    return Array.from(hashes).filter(Number.isSafeInteger);
}

function collectInGameLoadoutDefinitionHashes(loadout: any, itemByInstanceId: Map<string, any>) {
    const hashes = new Set<number>();
    const loadoutItems = Array.isArray(loadout?.items) ? loadout.items : [];
    
    loadoutItems.forEach((loadoutItem: any) => {
        const itemInstanceId = String(loadoutItem?.itemInstanceId ?? '');
        const inventoryItem = itemInstanceId && itemInstanceId !== '0'
            ? itemByInstanceId.get(itemInstanceId)
            : undefined;
        const itemHash = Number(inventoryItem?.itemHash || loadoutItem?.itemHash);
        
        if (Number.isSafeInteger(itemHash)) hashes.add(itemHash);
        (loadoutItem?.plugItemHashes || []).forEach((plugHash: any) => {
            const numericPlugHash = Number(plugHash);
            if (Number.isSafeInteger(numericPlugHash)) hashes.add(numericPlugHash);
        });
    });
    
    return Array.from(hashes);
}

function getSiteLoadoutSearchText(
    loadout: CustomLoadout,
    itemDefinitions: Record<number, any>,
    sandboxPerkDefinitions: Record<string, any> | Record<number, any> | undefined
) {
    const definitionHashes = collectSiteLoadoutDefinitionHashes(loadout);
    
    return normalizeLoadoutSearchText([
        'in-site',
        CLASS_NAMES[loadout.classType],
        loadout.name,
        loadout.description,
        loadout.notes,
        loadout.tags,
        loadout.importedFrom,
        ...definitionHashes.flatMap((hash) => collectDefinitionSearchValues(
            getDefinitionByHash(itemDefinitions, hash),
            itemDefinitions,
            sandboxPerkDefinitions
        )),
        loadout.subclassConfig?.super?.name,
        Object.values(loadout.subclassConfig?.abilities || {}).map((ability) => ability?.name),
        loadout.subclassConfig?.aspects?.map((aspect) => aspect.name),
        loadout.subclassConfig?.fragments?.map((fragment) => fragment.name),
    ]);
}

function getInGameLoadoutSearchText({
    loadout,
    index,
    activeCharacterId,
    classType,
    itemByInstanceId,
    itemDefinitions,
    loadoutNameDefinitions,
    sandboxPerkDefinitions,
}: {
    loadout: any;
    index: number;
    activeCharacterId: string;
    classType: number;
    itemByInstanceId: Map<string, any>;
    itemDefinitions: Record<number, any>;
    loadoutNameDefinitions: Record<string, any> | Record<number, any> | undefined;
    sandboxPerkDefinitions: Record<string, any> | Record<number, any> | undefined;
}) {
    const loadoutNameDefinition = getDefinitionByHash(loadoutNameDefinitions as Record<number, any>, Number(loadout.nameHash));
    const definitionHashes = collectInGameLoadoutDefinitionHashes(loadout, itemByInstanceId);
    
    return normalizeLoadoutSearchText([
        'in-game',
        CLASS_NAMES[classType],
        loadoutNameDefinition?.name,
        `in-game loadout ${index + 1}`,
        `slot ${index + 1}`,
        `bungie:${activeCharacterId}:${index}`,
        ...definitionHashes.flatMap((hash) => collectDefinitionSearchValues(
            getDefinitionByHash(itemDefinitions, hash),
            itemDefinitions,
            sandboxPerkDefinitions
        )),
    ]);
}

function matchesLoadoutSearch(searchText: string, searchQuery: string) {
    const searchTerms = searchQuery
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
    
    if (searchTerms.length === 0) return true;
    
    return searchTerms.every((searchTerm) => searchText.includes(searchTerm));
}

interface LoadoutCardProps {
    loadout: CustomLoadout;
    profile: any;
    membershipInfo: any;
    activeCharacterId: string;
    onEdit: () => void;
    onShare: () => void;
}

interface InGameLoadoutCardProps {
    loadout: any;
    index: number;
    classType: number;
    activeCharacterId: string;
    membershipInfo: any;
    profile: any;
}

interface InGameLoadoutItemTileProps {
    definition: any;
    item: any;
    profile: any;
    ownerId: string;
    sizeClassName?: string;
    isUnavailable?: boolean;
}

function InGameLoadoutItemTile({ definition, item, profile, ownerId, sizeClassName = 'h-12 w-12', isUnavailable = false }: InGameLoadoutItemTileProps) {
    const itemInstanceId = item?.itemInstanceId ? String(item.itemInstanceId) : undefined;
    const instanceData = itemInstanceId ? profile?.itemComponents?.instances?.data?.[itemInstanceId] : undefined;
    const statsData = itemInstanceId ? profile?.itemComponents?.stats?.data?.[itemInstanceId]?.stats : undefined;
    const instanceDataWithStats = instanceData
        ? {
            ...instanceData,
            stats: statsData,
        }
        : undefined;
    const socketsData = itemInstanceId ? profile?.itemComponents?.sockets?.data?.[itemInstanceId] : undefined;
    const reusablePlugs = itemInstanceId ? profile?.itemComponents?.reusablePlugs?.data?.[itemInstanceId]?.plugs : undefined;
    
    return (
        <div
            className={cn(
                sizeClassName,
                "relative shrink-0 overflow-visible",
                isUnavailable && "ring-1 ring-red-500/60"
            )}
            title={isUnavailable ? `${definition.displayProperties?.name || 'Item'} is no longer in inventory` : definition.displayProperties?.name}
        >
            <DestinyItemCard
                itemHash={definition.hash}
                definition={definition}
                definitionIsPartial
                instanceData={instanceDataWithStats}
                socketsData={socketsData}
                reusablePlugs={reusablePlugs}
                itemInstanceId={itemInstanceId}
                ownerId={ownerId}
                quantity={item?.quantity}
                className="h-full w-full"
                size="small"
                minimal
                deferDetails
            />
            {isUnavailable && (
                <>
                    <div className="pointer-events-none absolute inset-0 bg-red-950/55 mix-blend-multiply" aria-hidden="true" />
                    <div className="pointer-events-none absolute inset-0 bg-red-500/20 ring-1 ring-inset ring-red-400/50" aria-hidden="true" />
                    <div className="pointer-events-none absolute right-0 top-0 h-2 w-2 bg-red-500" aria-hidden="true" />
                </>
            )}
        </div>
    );
}

interface InGameLoadoutPlugTileProps {
    definition: any;
    clarityDescription?: ClarityDescription;
    perkDefinitions?: any[];
    sizeClassName?: string;
}

function InGameLoadoutPlugTile({ definition, clarityDescription, perkDefinitions = [], sizeClassName = 'h-[30px] w-[30px]' }: InGameLoadoutPlugTileProps) {
    const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
    const icon = definition.displayProperties?.icon;
    const name = definition.displayProperties?.name || String(definition.hash);
    const description = definition.displayProperties?.description;
    const perkDescriptions = perkDefinitions
        .map((perkDefinition) => ({
            name: perkDefinition?.displayProperties?.name,
            description: perkDefinition?.displayProperties?.description,
        }))
        .filter((perkDefinition) => perkDefinition.name || perkDefinition.description);
    const typeName = definition.itemTypeDisplayName || definition.plug?.plugCategoryIdentifier || 'Subclass Plug';
    
    return (
        <div
                className={cn(sizeClassName, "relative shrink-0 overflow-hidden border border-white/10 bg-transparent")}
            title={name}
            onMouseEnter={(event) => setTooltipPosition({ x: event.clientX, y: event.clientY })}
            onMouseLeave={() => setTooltipPosition(null)}
        >
            {icon ? (
                <Image
                    src={getBungieImage(icon)}
                    alt={name}
                    fill
                    sizes="32px"
                    className="object-cover"
                />
            ) : (
                <div className="flex h-full w-full items-center justify-center text-[9px] text-slate-600">?</div>
            )}
            {tooltipPosition && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed z-[9999] w-96 max-w-[min(24rem,calc(100vw-2rem))] pointer-events-none"
                    style={{
                        left: Math.min(tooltipPosition.x + 14, window.innerWidth - 400),
                        top: Math.min(tooltipPosition.y + 14, window.innerHeight - 360),
                    }}
                >
                    <div className="max-h-[min(28rem,calc(100vh-2rem))] overflow-y-auto border border-white/20 bg-[#0f0f0f]/95 p-3 shadow-2xl shadow-black/50 backdrop-blur-md custom-scrollbar">
                        <div className="flex items-start gap-2">
                            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/20 bg-black/40">
                                {icon ? (
                                    <Image src={getBungieImage(icon)} alt="" fill sizes="32px" className="object-cover" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-500">?</div>
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="break-words text-sm font-bold leading-tight text-destiny-gold">
                                    {name}
                                </p>
                                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    {typeName}
                                </p>
                            </div>
                        </div>
                        
                        {description && (
                            <p className="mt-2 break-words text-xs leading-relaxed text-slate-300">
                                {description}
                            </p>
                        )}
                        
                        {!description && perkDescriptions.length > 0 && (
                            <div className="mt-3 space-y-2 border-t border-white/10 pt-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                    Details
                                </p>
                                {perkDescriptions.map((perkDefinition, perkIndex) => (
                                    <div key={`${definition.hash}-perk-${perkIndex}`} className="text-xs leading-relaxed text-slate-300">
                                        {perkDefinition.name && perkDefinition.name !== name && (
                                            <p className="font-semibold text-slate-100">{perkDefinition.name}</p>
                                        )}
                                        {perkDefinition.description && (
                                            <p className="break-words">{perkDefinition.description}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {clarityDescription && (
                            <div className="mt-3 border-t border-white/10 pt-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
                                    Clarity
                                </p>
                                <div className="mt-1 space-y-2 text-xs leading-relaxed text-slate-200">
                                    {clarityDescription.lines.map((line, lineIndex) => (
                                        line ? (
                                            <p key={`${clarityDescription.hash}-${lineIndex}`} className="break-words">
                                                {line}
                                            </p>
                                        ) : (
                                            <div key={`${clarityDescription.hash}-${lineIndex}`} className="h-1" aria-hidden="true" />
                                        )
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

interface SelectorHintTileProps {
    label: string;
    description?: string;
    sizeClassName: string;
    children: ReactNode;
    disabled?: boolean;
}

function SelectorHintTile({ label, description, sizeClassName, children, disabled = false }: SelectorHintTileProps) {
    const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
    
    return (
        <span
            className={cn(
                sizeClassName,
                "relative flex shrink-0 items-center justify-center border border-white/10 bg-transparent text-slate-600",
                !disabled && "transition-colors group-hover:border-destiny-gold/50 group-hover:text-slate-300",
                disabled && "cursor-not-allowed opacity-35"
            )}
            onMouseEnter={(event) => setTooltipPosition({ x: event.clientX, y: event.clientY })}
            onMouseLeave={() => setTooltipPosition(null)}
        >
            {children}
            {tooltipPosition && typeof document !== 'undefined' && createPortal(
                <div
                    className="pointer-events-none fixed z-[9999] w-56 border border-white/15 bg-[#0f0f0f]/95 p-2 shadow-2xl shadow-black/50 backdrop-blur-md"
                    style={{
                        left: Math.min(tooltipPosition.x + 14, window.innerWidth - 240),
                        top: Math.min(tooltipPosition.y + 14, window.innerHeight - 140),
                    }}
                >
                    <p className="text-xs font-bold uppercase tracking-wide text-destiny-gold">{label}</p>
                    {description && (
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{description}</p>
                    )}
                </div>,
                document.body
            )}
        </span>
    );
}

function InGameLoadoutCard({ loadout, index, classType, activeCharacterId, membershipInfo, profile }: InGameLoadoutCardProps) {
    const { createLoadout, loadouts } = useLoadoutStore();
    const [isEquipping, setIsEquipping] = useState(false);
    const { table: loadoutNameDefinitions } = useManifestTable<any>("DestinyLoadoutNameDefinition");
    const { table: loadoutIconDefinitions } = useManifestTable<any>("DestinyLoadoutIconDefinition");
    const { table: sandboxPerkDefinitions } = useManifestTable<any>("DestinySandboxPerkDefinition");
    const linkedInGameLoadoutId = `bungie:${activeCharacterId}:${index}`;
    const linkedSiteLoadout = loadouts.find((siteLoadout) => siteLoadout.inGameId === linkedInGameLoadoutId);
    const loadoutNameDefinition = loadoutNameDefinitions?.[loadout.nameHash] || loadoutNameDefinitions?.[String(loadout.nameHash)];
    const loadoutIconDefinition = loadoutIconDefinitions?.[loadout.iconHash] || loadoutIconDefinitions?.[String(loadout.iconHash)];
    const loadoutTitle = loadoutNameDefinition?.name || `In-game Loadout ${index + 1}`;
    const loadoutIconPath = loadoutIconDefinition?.iconImagePath;
    const { resolvedItems, definitionHashes } = useMemo(() => {
        if (!loadout.items || !profile) {
            return { resolvedItems: [], definitionHashes: [] };
        }
        
        const itemByInstanceId = new Map<string, any>();
        const profileItems = [
            ...Object.values(profile.characterInventories?.data || {}).flatMap((characterInventory: any) => characterInventory.items),
            ...Object.values(profile.characterEquipment?.data || {}).flatMap((characterEquipment: any) => characterEquipment.items),
            ...(profile.profileInventory?.data?.items || []),
        ];
        
        profileItems.forEach((item: any) => {
            if (item.itemInstanceId) {
                itemByInstanceId.set(String(item.itemInstanceId), item);
            }
        });
        
        const hashes = new Set<number>();
        const items = loadout.items.map((loadoutItem: any) => {
            const inventoryItem = loadoutItem.itemInstanceId && String(loadoutItem.itemInstanceId) !== '0'
                ? itemByInstanceId.get(String(loadoutItem.itemInstanceId))
                : null;
            const itemHash = inventoryItem?.itemHash || loadoutItem.itemHash;
            const plugItemHashes = loadoutItem.plugItemHashes || [];
            
            if (itemHash) {
                hashes.add(itemHash);
            }
            plugItemHashes.forEach((plugHash: number) => hashes.add(plugHash));
            
            return {
                itemHash,
                bucketHash: inventoryItem?.bucketHash,
                itemInstanceId: inventoryItem?.itemInstanceId || loadoutItem.itemInstanceId,
                quantity: inventoryItem?.quantity || loadoutItem.quantity,
                plugItemHashes,
            };
        }).filter((item: any) => item.itemHash);
        
        return {
            resolvedItems: items,
            definitionHashes: Array.from(hashes),
        };
    }, [loadout.items, profile]);
    
    const { definitions, isLoading: isLoadingDefinitions } = useItemDefinitions(definitionHashes);
    
    const { weapons, armor, subclassItem, subclassDefinition, subclassPlugGroups } = useMemo(() => {
        const weaponDefinitions: any[] = [];
        const armorDefinitions: any[] = [];
        let activeSubclassItem: any = null;
        let activeSubclassDefinition: any = null;
        const plugGroups = {
            super: [] as any[],
            abilities: [] as any[],
            aspects: [] as any[],
            fragments: [] as any[],
        };
        
        resolvedItems.forEach((item: any) => {
            const definition = definitions[item.itemHash];
            if (!definition) return;
            
            if (definition.itemType === 3) {
                weaponDefinitions.push(definition);
                return;
            }
            
            if (definition.itemType === 2) {
                armorDefinitions.push(definition);
                return;
            }
            
            if (definition.inventory?.bucketTypeHash === BUCKETS.SUBCLASS) {
                activeSubclassItem = item;
                activeSubclassDefinition = definition;
                item.plugItemHashes.forEach((plugHash: number) => {
                    const plugDefinition = definitions[plugHash];
                    if (!plugDefinition?.displayProperties?.name) return;
                    
                    const category = plugDefinition.plug?.plugCategoryIdentifier || '';
                    const typeName = plugDefinition.itemTypeDisplayName || '';
                    
                    if (category.includes('fragments') || typeName.includes('Fragment')) {
                        plugGroups.fragments.push(plugDefinition);
                    } else if (category.includes('aspects') || typeName.includes('Aspect')) {
                        plugGroups.aspects.push(plugDefinition);
                    } else if (category.includes('supers') || typeName.includes('Super')) {
                        plugGroups.super.push(plugDefinition);
                    } else if (
                        category.includes('class_abilities') ||
                        category.includes('movement') ||
                        category.includes('melee') ||
                        category.includes('grenades')
                    ) {
                        plugGroups.abilities.push(plugDefinition);
                    }
                });
            }
        });
        
        const weaponOrder = [BUCKETS.KINETIC_WEAPON, BUCKETS.ENERGY_WEAPON, BUCKETS.POWER_WEAPON];
        const armorOrder = [BUCKETS.HELMET, BUCKETS.GAUNTLETS, BUCKETS.CHEST_ARMOR, BUCKETS.LEG_ARMOR, BUCKETS.CLASS_ARMOR];
        const abilityOrder = ['class_abilities', 'movement', 'melee', 'grenades'];
        
        weaponDefinitions.sort((firstItem, secondItem) => (
            weaponOrder.indexOf(firstItem.inventory?.bucketTypeHash) - weaponOrder.indexOf(secondItem.inventory?.bucketTypeHash)
        ));
        armorDefinitions.sort((firstItem, secondItem) => (
            armorOrder.indexOf(firstItem.inventory?.bucketTypeHash) - armorOrder.indexOf(secondItem.inventory?.bucketTypeHash)
        ));
        plugGroups.abilities.sort((firstItem, secondItem) => {
            const firstCategory = firstItem.plug?.plugCategoryIdentifier || '';
            const secondCategory = secondItem.plug?.plugCategoryIdentifier || '';
            return abilityOrder.findIndex((category) => firstCategory.includes(category)) -
                abilityOrder.findIndex((category) => secondCategory.includes(category));
        });
        
        return {
            weapons: weaponDefinitions,
            armor: armorDefinitions,
            subclassItem: activeSubclassItem,
            subclassDefinition: activeSubclassDefinition,
            subclassPlugGroups: plugGroups,
        };
    }, [definitions, resolvedItems]);
    
    const plugDefinitions = useMemo(() => [
        ...subclassPlugGroups.super,
        ...subclassPlugGroups.abilities,
        ...subclassPlugGroups.aspects,
        ...subclassPlugGroups.fragments,
    ], [subclassPlugGroups]);
    const plugDefinitionHashes = useMemo(
        () => plugDefinitions.flatMap((definition) => [
            definition.hash,
            ...(definition.perks || []).map((perk: any) => perk?.perkHash),
        ]).filter((hash) => Number.isSafeInteger(hash)),
        [plugDefinitions]
    );
    const { descriptions: clarityDescriptions } = useClarityDescriptions(plugDefinitionHashes);
    
    const renderItemIcon = (item: any, definition: any, sizeClassName = 'h-12 w-12') => {
        const tileItem = item || { itemHash: definition.hash };
        
        return (
        <InGameLoadoutItemTile
            key={`${tileItem.itemInstanceId || tileItem.itemHash}-${definition.hash}`}
            definition={definition}
            item={tileItem}
            profile={profile}
            ownerId={activeCharacterId}
            sizeClassName={sizeClassName}
        />
        );
    };
    
    const renderPlugIcon = (definition: any, sizeClassName = 'h-[30px] w-[30px]') => {
        const perkHashes = (definition.perks || [])
            .map((perk: any) => perk?.perkHash)
            .filter((perkHash: number) => Number.isSafeInteger(perkHash));
        const perkDefinitions = perkHashes
            .map((perkHash: number) => sandboxPerkDefinitions?.[perkHash] || sandboxPerkDefinitions?.[String(perkHash)])
            .filter(Boolean);
        const clarityDescription = clarityDescriptions[definition.hash] || perkHashes
            .map((perkHash: number) => clarityDescriptions[perkHash])
            .find(Boolean);
        
        return (
            <InGameLoadoutPlugTile
                key={definition.hash}
                definition={definition}
                clarityDescription={clarityDescription}
                perkDefinitions={perkDefinitions}
                sizeClassName={sizeClassName}
            />
        );
    };
    
    const renderEmptySlot = (key: string, sizeClassName = 'h-12 w-12') => (
        <div key={key} className={cn(sizeClassName, "shrink-0 border border-white/5 bg-transparent")} />
    );
    const renderLoadoutIcon = (sizeClassName = 'h-12 w-12') => (
        <div className={cn(sizeClassName, "relative shrink-0 overflow-hidden border border-white/10 bg-black/35")}>
            {loadoutIconPath ? (
                <Image
                    src={getBungieImage(loadoutIconPath)}
                    alt=""
                    fill
                    sizes="48px"
                    className="object-cover opacity-85"
                />
            ) : (
                <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500">
                    L{index + 1}
                </span>
            )}
        </div>
    );
    const hasVisibleLoadoutContent = weapons.length > 0 ||
        armor.length > 0 ||
        subclassPlugGroups.super.length > 0 ||
        subclassPlugGroups.abilities.length > 0 ||
        subclassPlugGroups.aspects.length > 0 ||
        subclassPlugGroups.fragments.length > 0;
    
    const createPlugConfig = (definition: any) => ({
        plugHash: definition.hash,
        name: definition.displayProperties?.name,
        icon: definition.displayProperties?.icon,
    });
    const getAbilityPlug = (categoryIdentifier: string) => {
        return subclassPlugGroups.abilities.find((definition) => (
            definition.plug?.plugCategoryIdentifier || ''
        ).includes(categoryIdentifier));
    };
    const handleEquipInGameLoadout = async () => {
        if (!membershipInfo || !activeCharacterId || isEquipping) return;
        
        setIsEquipping(true);
        toast.loading(`Equipping ${loadoutTitle}...`, { id: 'equip-ingame-loadout' });
        
        try {
            await equipLoadout(index, activeCharacterId, membershipInfo.membershipType);
            toast.success(`${loadoutTitle} equipped`, { id: 'equip-ingame-loadout' });
        } catch (error) {
            console.error('Failed to equip in-game loadout:', error);
            toast.error('Failed to equip in-game loadout', { id: 'equip-ingame-loadout' });
        } finally {
            setIsEquipping(false);
        }
    };
    const saveInGameLoadoutAsSiteLoadout = (initialTags: string[] = []) => {
        const savedItems = resolvedItems
            .map((item: any) => {
                const definition = definitions[item.itemHash];
                const bucketHash = item.bucketHash || definition?.inventory?.bucketTypeHash;
                
                if (!bucketHash || bucketHash === BUCKETS.SUBCLASS) return null;
                
                return {
                    itemHash: item.itemHash,
                    itemInstanceId: item.itemInstanceId,
                    bucketHash,
                };
            })
            .filter(Boolean) as LoadoutItem[];
        const subclassConfig = subclassDefinition ? {
            itemHash: subclassDefinition.hash,
            itemInstanceId: subclassItem?.itemInstanceId,
            damageType: getDamageTypeFromHashOrEnum(subclassDefinition.defaultDamageTypeHash),
            super: subclassPlugGroups.super[0] ? createPlugConfig(subclassPlugGroups.super[0]) : undefined,
            abilities: {
                classAbility: getAbilityPlug('class_abilities') ? createPlugConfig(getAbilityPlug('class_abilities')) : undefined,
                movement: getAbilityPlug('movement') ? createPlugConfig(getAbilityPlug('movement')) : undefined,
                melee: getAbilityPlug('melee') ? createPlugConfig(getAbilityPlug('melee')) : undefined,
                grenade: getAbilityPlug('grenades') ? createPlugConfig(getAbilityPlug('grenades')) : undefined,
            },
            aspects: subclassPlugGroups.aspects.map(createPlugConfig),
            fragments: subclassPlugGroups.fragments.map(createPlugConfig),
        } : undefined;
        
        return createLoadout({
            name: loadoutTitle,
            description: `Saved from in-game loadout slot ${index + 1}.`,
            classType,
            icon: DEFAULT_LOADOUT_ICON,
            color: '#38bdf8',
            items: savedItems,
            subclassConfig,
            tags: initialTags,
            inGameId: linkedInGameLoadoutId,
        });
    };
    const handleSaveInGameLoadout = () => {
        if (linkedSiteLoadout) {
            toast.info(`${loadoutTitle} is already saved in-site`);
            return;
        }
        
        saveInGameLoadoutAsSiteLoadout();
        toast.success(`Saved ${loadoutTitle} in-site`);
    };
    const armorSlots = Array.from({ length: 5 }, (_, slotIndex) => (
        armor[slotIndex]
            ? renderItemIcon(resolvedItems.find((item: any) => item.itemHash === armor[slotIndex].hash), armor[slotIndex])
            : renderEmptySlot(`armor-${slotIndex}`)
    ));
    const weaponSlots = Array.from({ length: 3 }, (_, slotIndex) => (
        weapons[slotIndex]
            ? renderItemIcon(resolvedItems.find((item: any) => item.itemHash === weapons[slotIndex].hash), weapons[slotIndex])
            : renderEmptySlot(`weapon-${slotIndex}`)
    ));
    const abilitySlots = [
        ...subclassPlugGroups.abilities.slice(0, 4),
    ];
    const superSlot = subclassPlugGroups.super[0];
    const aspectSlots = subclassPlugGroups.aspects.slice(0, 2);
    const fragmentSlots = subclassPlugGroups.fragments.slice(0, 6);
    const bottomRowFragments = fragmentSlots.slice(0, 4);
    const upperRowFragments = fragmentSlots.slice(4, 5);
    
    if (!isLoadingDefinitions && !hasVisibleLoadoutContent) {
        return null;
    }
    
    return (
        <div className="w-full max-w-full border-l-[3px] border-l-sky-400">
            <FrostedCard hover className="overflow-hidden p-0">
                <div className="group/header flex items-center justify-between gap-3 border-b border-white/5 px-3 py-2">
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <div className="truncate text-xs font-bold uppercase tracking-wide text-white">
                            {loadoutTitle}
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        <button
                            type="button"
                            onClick={handleEquipInGameLoadout}
                            disabled={isEquipping}
                            className="inline-flex h-7 w-7 items-center justify-center text-destiny-gold transition-colors hover:bg-destiny-gold/10 disabled:cursor-not-allowed disabled:opacity-50"
                            title={`Equip ${loadoutTitle}`}
                            aria-label={`Equip ${loadoutTitle}`}
                        >
                            {isEquipping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveInGameLoadout}
                            disabled={Boolean(linkedSiteLoadout)}
                            className="inline-flex h-7 w-7 items-center justify-center text-sky-300 transition-colors hover:bg-sky-400/10 disabled:cursor-not-allowed disabled:text-slate-500"
                            title={linkedSiteLoadout ? `${loadoutTitle} already saved` : `Save ${loadoutTitle} in-site`}
                            aria-label={linkedSiteLoadout ? `${loadoutTitle} already saved` : `Save ${loadoutTitle} in-site`}
                        >
                            {linkedSiteLoadout ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                        </button>
                    </div>
                </div>
                <div className="flex min-h-[116px] gap-3 p-4">
                    <div className="flex shrink-0 items-start gap-2">
                        <div className="flex flex-col gap-1">
                            {renderLoadoutIcon()}
                            {superSlot
                                ? renderPlugIcon(superSlot, 'h-12 w-12')
                                : renderEmptySlot('super', 'h-12 w-12')}
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                            {Array.from({ length: 4 }, (_, slotIndex) => (
                                abilitySlots[slotIndex]
                                    ? renderPlugIcon(abilitySlots[slotIndex], 'h-[30px] w-[30px]')
                                    : renderEmptySlot(`ability-${slotIndex}`, 'h-[30px] w-[30px]')
                            ))}
                            {aspectSlots.map((aspect) => renderPlugIcon(aspect, 'h-[30px] w-[30px]'))}
                            {Array.from({ length: Math.max(0, 2 - aspectSlots.length) }, (_, slotIndex) => (
                                renderEmptySlot(`aspect-${slotIndex}`, 'h-[30px] w-[30px]')
                            ))}
                            <div className="h-[30px] w-[30px]" aria-hidden="true" />
                            {upperRowFragments[0]
                                ? renderPlugIcon(upperRowFragments[0], 'h-[30px] w-[30px]')
                                : <div className="h-[30px] w-[30px]" aria-hidden="true" />}
                            {bottomRowFragments.map((fragment) => renderPlugIcon(fragment, 'h-[30px] w-[30px]'))}
                        </div>
                    </div>
                    <div className="grid min-w-0 flex-1 grid-cols-[repeat(5,3rem)] content-start gap-1 overflow-hidden">
                        {armorSlots}
                        {weaponSlots}
                    </div>
                </div>
            </FrostedCard>
        </div>
    );
}

function LoadoutCard({ loadout, profile, membershipInfo, activeCharacterId, onEdit, onShare }: LoadoutCardProps) {
    const { addTag, deleteLoadout, duplicateLoadout } = useLoadoutStore();
    const [isEquipping, setIsEquipping] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
    const [tagInputValue, setTagInputValue] = useState('');
    const tagInputRef = useRef<HTMLInputElement>(null);
    
    useEffect(() => {
        if (isTagPickerOpen) {
            tagInputRef.current?.focus();
        }
    }, [isTagPickerOpen]);
    
    const { table: loadoutIconDefinitions } = useManifestTable<any>("DestinyLoadoutIconDefinition");
    const { table: sandboxPerkDefinitions } = useManifestTable<any>("DestinySandboxPerkDefinition");
    const linkedInGameLoadout = useMemo(() => {
        const [source, characterId, indexText] = loadout.inGameId?.split(':') || [];
        const loadoutIndex = Number(indexText);
        
        if (source !== 'bungie' || !characterId || !Number.isSafeInteger(loadoutIndex)) {
            return null;
        }
        
        return profile?.characterLoadouts?.data?.[characterId]?.loadouts?.[loadoutIndex] ?? null;
    }, [loadout.inGameId, profile]);
    const linkedLoadoutIconDefinition = linkedInGameLoadout
        ? loadoutIconDefinitions?.[linkedInGameLoadout.iconHash] || loadoutIconDefinitions?.[String(linkedInGameLoadout.iconHash)]
        : null;
    const profileItemByInstanceId = useMemo(() => {
        const itemByInstanceId = new Map<string, any>();
        const profileItems = [
            ...Object.values(profile?.characterInventories?.data || {}).flatMap((characterInventory: any) => characterInventory.items),
            ...Object.values(profile?.characterEquipment?.data || {}).flatMap((characterEquipment: any) => characterEquipment.items),
            ...(profile?.profileInventory?.data?.items || []),
        ];
        
        profileItems.forEach((item: any) => {
            if (item.itemInstanceId) {
                itemByInstanceId.set(String(item.itemInstanceId), item);
            }
        });
        
        return itemByInstanceId;
    }, [profile]);
    const ownedItemInstanceIds = useMemo(() => new Set(profileItemByInstanceId.keys()), [profileItemByInstanceId]);
    const itemHashes = useMemo(() => {
        const definitionHashes = new Set(collectSiteLoadoutDefinitionHashes(loadout));
        
        if (linkedInGameLoadout) {
            collectInGameLoadoutDefinitionHashes(linkedInGameLoadout, profileItemByInstanceId).forEach((hash) => {
                definitionHashes.add(hash);
            });
        }
        
        return Array.from(definitionHashes);
    }, [linkedInGameLoadout, loadout, profileItemByInstanceId]);
    const { definitions } = useItemDefinitions(itemHashes);
    
    const handleEquip = async () => {
        if (!membershipInfo || !activeCharacterId || isEquipping) return;
        
        setIsEquipping(true);
        toast.loading('Equipping loadout...', { id: 'equip-loadout' });
        
        try {
            // Collect all items to find their current locations
            const allItems = [
                ...Object.entries(profile?.characterInventories?.data || {}).flatMap(([charId, data]: [string, any]) => 
                    data.items.map((i: any) => ({ ...i, ownerId: charId }))
                ),
                ...Object.entries(profile?.characterEquipment?.data || {}).flatMap(([charId, data]: [string, any]) =>
                    data.items.map((i: any) => ({ ...i, ownerId: charId, isEquipped: true }))
                ),
                ...(profile?.profileInventory?.data?.items || []).map((i: any) => ({ ...i, ownerId: 'VAULT' })),
            ];
            
            // Step 1: Transfer and equip each item (weapons, armor)
            for (const item of loadout.items) {
                if (!item.itemInstanceId) continue;
                
                const currentItem = allItems.find((i: any) => i.itemInstanceId === item.itemInstanceId);
                if (!currentItem) continue;
                
                // If not on active character, transfer it
                if (currentItem.ownerId !== activeCharacterId) {
                    await moveItem(
                        item.itemInstanceId,
                        item.itemHash,
                        currentItem.ownerId,
                        activeCharacterId,
                        membershipInfo.membershipType
                    );
                    await new Promise((r) => setTimeout(r, 200));
                }
                
                // Equip the item
                await equipItem(item.itemInstanceId, activeCharacterId, membershipInfo.membershipType);
                await new Promise((r) => setTimeout(r, 200));
                
                // Step 2: Apply socket overrides (perks/mods) if configured
                if (item.socketOverrides && Object.keys(item.socketOverrides).length > 0) {
                    for (const [socketIndexStr, plugHash] of Object.entries(item.socketOverrides)) {
                        const socketIndex = parseInt(socketIndexStr);
                        try {
                            await insertSocketPlugFree(
                                item.itemInstanceId,
                                plugHash as number,
                                socketIndex,
                                activeCharacterId,
                                membershipInfo.membershipType
                            );
                            await new Promise((r) => setTimeout(r, 150));
                        } catch (plugErr) {
                            console.warn(`Failed to insert plug ${plugHash} into socket ${socketIndex}:`, plugErr);
                            // Continue with other plugs even if one fails
                        }
                    }
                }
            }
            
            // Step 3: Equip subclass and configure abilities if specified
            if (loadout.subclassConfig?.damageType) {
                const subclassHash = SUBCLASS_HASHES[loadout.classType]?.[loadout.subclassConfig.damageType];
                
                if (subclassHash) {
                    // Find the subclass in character inventory/equipment
                    const subclassItem = allItems.find((i: any) => 
                        i.itemHash === subclassHash && 
                        (i.ownerId === activeCharacterId || i.bucketHash === BUCKETS.SUBCLASS)
                    );
                    
                    if (subclassItem?.itemInstanceId) {
                        // Equip subclass (they're always on the character)
                        try {
                            await equipItem(subclassItem.itemInstanceId, activeCharacterId, membershipInfo.membershipType);
                            await new Promise((r) => setTimeout(r, 300));
                            
                            // Apply subclass configuration (super, abilities, aspects, fragments)
                            const socketsData = profile?.itemComponents?.sockets?.data?.[subclassItem.itemInstanceId];
                            const reusablePlugs = profile?.itemComponents?.reusablePlugs?.data?.[subclassItem.itemInstanceId]?.plugs;
                            
                            // Helper to find socket index for a plug category
                            const findSocketForPlug = (plugHash: number): number => {
                                if (!reusablePlugs) return -1;
                                for (const [socketIdx, plugs] of Object.entries(reusablePlugs)) {
                                    if ((plugs as any[]).some((p: any) => p.plugItemHash === plugHash)) {
                                        return parseInt(socketIdx);
                                    }
                                }
                                // Fallback: check current sockets
                                if (socketsData?.sockets) {
                                    for (let i = 0; i < socketsData.sockets.length; i++) {
                                        if (socketsData.sockets[i].plugHash === plugHash) {
                                            return i;
                                        }
                                    }
                                }
                                return -1;
                            };
                            
                            // Apply super
                            if (loadout.subclassConfig.super?.plugHash) {
                                const socketIdx = findSocketForPlug(loadout.subclassConfig.super.plugHash);
                                if (socketIdx >= 0) {
                                    try {
                                        await insertSocketPlugFree(
                                            subclassItem.itemInstanceId,
                                            loadout.subclassConfig.super.plugHash,
                                            socketIdx,
                                            activeCharacterId,
                                            membershipInfo.membershipType
                                        );
                                        await new Promise((r) => setTimeout(r, 100));
                                    } catch (e) { console.warn('Failed to set super:', e); }
                                }
                            }
                            
                            // Apply abilities (melee, grenade, class ability, movement)
                            const abilities = loadout.subclassConfig.abilities;
                            if (abilities) {
                                for (const [abilityType, abilityConfig] of Object.entries(abilities)) {
                                    if (abilityConfig?.plugHash) {
                                        const socketIdx = findSocketForPlug(abilityConfig.plugHash);
                                        if (socketIdx >= 0) {
                                            try {
                                                await insertSocketPlugFree(
                                                    subclassItem.itemInstanceId,
                                                    abilityConfig.plugHash,
                                                    socketIdx,
                                                    activeCharacterId,
                                                    membershipInfo.membershipType
                                                );
                                                await new Promise((r) => setTimeout(r, 100));
                                            } catch (e) { console.warn(`Failed to set ${abilityType}:`, e); }
                                        }
                                    }
                                }
                            }
                            
                            // Apply aspects
                            if (loadout.subclassConfig.aspects) {
                                for (const aspect of loadout.subclassConfig.aspects) {
                                    if (aspect?.plugHash) {
                                        const socketIdx = findSocketForPlug(aspect.plugHash);
                                        if (socketIdx >= 0) {
                                            try {
                                                await insertSocketPlugFree(
                                                    subclassItem.itemInstanceId,
                                                    aspect.plugHash,
                                                    socketIdx,
                                                    activeCharacterId,
                                                    membershipInfo.membershipType
                                                );
                                                await new Promise((r) => setTimeout(r, 100));
                                            } catch (e) { console.warn('Failed to set aspect:', e); }
                                        }
                                    }
                                }
                            }
                            
                            // Apply fragments
                            if (loadout.subclassConfig.fragments) {
                                for (const fragment of loadout.subclassConfig.fragments) {
                                    if (fragment?.plugHash) {
                                        const socketIdx = findSocketForPlug(fragment.plugHash);
                                        if (socketIdx >= 0) {
                                            try {
                                                await insertSocketPlugFree(
                                                    subclassItem.itemInstanceId,
                                                    fragment.plugHash,
                                                    socketIdx,
                                                    activeCharacterId,
                                                    membershipInfo.membershipType
                                                );
                                                await new Promise((r) => setTimeout(r, 100));
                                            } catch (e) { console.warn('Failed to set fragment:', e); }
                                        }
                                    }
                                }
                            }
                        } catch (subclassErr) {
                            console.warn('Failed to configure subclass:', subclassErr);
                        }
                    }
                }
            }
            
            toast.success(`${loadout.name} equipped!`, { id: 'equip-loadout' });
        } catch (err) {
            console.error('Failed to equip loadout:', err);
            toast.error('Failed to equip loadout', { id: 'equip-loadout' });
        } finally {
            setIsEquipping(false);
        }
    };
    
    const handleDelete = () => {
        if (confirm(`Delete "${loadout.name}"?`)) {
            deleteLoadout(loadout.id);
            toast.success('Loadout deleted');
        }
    };
    
    const handleDuplicate = () => {
        duplicateLoadout(loadout.id);
        toast.success('Loadout duplicated');
        setShowMenu(false);
    };
    
    const linkedInGameItemsByBucket = useMemo(() => {
        const itemByBucket = new Map<number, LoadoutItem & { isUnavailable?: boolean }>();
        
        if (!linkedInGameLoadout?.items) return itemByBucket;
        
        linkedInGameLoadout.items.forEach((linkedLoadoutItem: any) => {
            const linkedItemInstanceId = String(linkedLoadoutItem?.itemInstanceId ?? '');
            const inventoryItem = linkedItemInstanceId && linkedItemInstanceId !== '0'
                ? profileItemByInstanceId.get(linkedItemInstanceId)
                : undefined;
            const itemHash = Number(inventoryItem?.itemHash || linkedLoadoutItem?.itemHash);
            const definition = getDefinitionByHash(definitions, itemHash);
            const bucketHash = inventoryItem?.bucketHash || definition?.inventory?.bucketTypeHash;
            
            if (!Number.isSafeInteger(itemHash) || !bucketHash || bucketHash === BUCKETS.SUBCLASS) return;
            
            itemByBucket.set(bucketHash, {
                itemHash,
                itemInstanceId: inventoryItem?.itemInstanceId || (linkedItemInstanceId && linkedItemInstanceId !== '0' ? linkedItemInstanceId : undefined),
                bucketHash,
                isUnavailable: !inventoryItem,
            });
        });
        
        return itemByBucket;
    }, [definitions, linkedInGameLoadout, profileItemByInstanceId]);
    const visualLoadoutItems = useMemo(() => {
        const itemByBucket = new Map<number, LoadoutItem & { isUnavailable?: boolean }>();
        
        loadout.items.forEach((item) => {
            itemByBucket.set(item.bucketHash, item);
        });
        linkedInGameItemsByBucket.forEach((linkedItem, bucketHash) => {
            if (!itemByBucket.has(bucketHash)) {
                itemByBucket.set(bucketHash, linkedItem);
            }
        });
        
        return Array.from(itemByBucket.values());
    }, [linkedInGameItemsByBucket, loadout.items]);
    
    const weaponItems = useMemo(() => {
        const weaponBucketOrder = [BUCKETS.KINETIC_WEAPON, BUCKETS.ENERGY_WEAPON, BUCKETS.POWER_WEAPON];
        return visualLoadoutItems
            .filter((item) => weaponBucketOrder.includes(item.bucketHash))
            .sort((firstItem, secondItem) => (
                weaponBucketOrder.indexOf(firstItem.bucketHash) - weaponBucketOrder.indexOf(secondItem.bucketHash)
            ));
    }, [visualLoadoutItems]);
    const armorItems = useMemo(() => {
        const armorBucketOrder = [BUCKETS.HELMET, BUCKETS.GAUNTLETS, BUCKETS.CHEST_ARMOR, BUCKETS.LEG_ARMOR, BUCKETS.CLASS_ARMOR];
        return visualLoadoutItems
            .filter((item) => armorBucketOrder.includes(item.bucketHash))
            .sort((firstItem, secondItem) => (
                armorBucketOrder.indexOf(firstItem.bucketHash) - armorBucketOrder.indexOf(secondItem.bucketHash)
            ));
    }, [visualLoadoutItems]);
    const siteSubclassPlugGroups = useMemo(() => {
        const subclassConfig = loadout.subclassConfig;
        const createDefinitionFromConfig = (plugConfig: any) => {
            if (!plugConfig?.plugHash) return null;
            
            return definitions[plugConfig.plugHash] || {
                hash: plugConfig.plugHash,
                displayProperties: {
                    name: plugConfig.name || String(plugConfig.plugHash),
                    icon: plugConfig.icon,
                    description: plugConfig.description || '',
                },
            };
        };
        const abilityConfigs = subclassConfig?.abilities || {};
        
        return {
            super: [createDefinitionFromConfig(subclassConfig?.super)].filter(Boolean) as any[],
            abilities: [
                createDefinitionFromConfig(abilityConfigs.classAbility),
                createDefinitionFromConfig(abilityConfigs.movement),
                createDefinitionFromConfig(abilityConfigs.melee),
                createDefinitionFromConfig(abilityConfigs.grenade),
            ].filter(Boolean) as any[],
            aspects: (subclassConfig?.aspects || []).map(createDefinitionFromConfig).filter(Boolean) as any[],
            fragments: (subclassConfig?.fragments || []).map(createDefinitionFromConfig).filter(Boolean) as any[],
        };
    }, [definitions, loadout.subclassConfig]);
    const sitePlugDefinitions = useMemo(() => [
        ...siteSubclassPlugGroups.super,
        ...siteSubclassPlugGroups.abilities,
        ...siteSubclassPlugGroups.aspects,
        ...siteSubclassPlugGroups.fragments,
    ], [siteSubclassPlugGroups]);
    const sitePlugDefinitionHashes = useMemo(
        () => sitePlugDefinitions.flatMap((definition) => [
            definition.hash,
            ...(definition.perks || []).map((perk: any) => perk?.perkHash),
        ]).filter((hash) => Number.isSafeInteger(hash)),
        [sitePlugDefinitions]
    );
    const { descriptions: clarityDescriptions } = useClarityDescriptions(sitePlugDefinitionHashes);
    
    const renderEmptySlot = (key: string, sizeClassName = 'h-12 w-12') => (
        <div key={key} className={cn(sizeClassName, "shrink-0 border border-white/5 bg-transparent")} />
    );
    const renderSiteLoadoutIcon = () => {
        const iconPath = linkedLoadoutIconDefinition?.iconImagePath;
        
        if (iconPath) {
            return (
                <div className="relative h-12 w-12 shrink-0 overflow-hidden border border-white/10 bg-black/35">
                    <Image
                        src={getBungieImage(iconPath)}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover opacity-85"
                    />
                </div>
            );
        }
        
        return <LoadoutIconBadge icon={loadout.icon} color={loadout.color} className="h-12 w-12" />;
    };
    const renderItemIcon = (item: (LoadoutItem & { isUnavailable?: boolean }) | undefined, sizeClassName = 'h-12 w-12') => {
        if (!item) return null;
        
        const definition = definitions[item.itemHash];
        if (!definition) return renderEmptySlot(`item-${item.bucketHash}`);
        const isUnavailable = Boolean(item.isUnavailable) ||
            (Boolean(item.itemInstanceId) && !ownedItemInstanceIds.has(String(item.itemInstanceId)));
        
        return (
            <InGameLoadoutItemTile
                key={`${item.itemInstanceId || item.itemHash}-${item.bucketHash}`}
                definition={definition}
                item={item}
                profile={profile}
                ownerId={activeCharacterId}
                sizeClassName={sizeClassName}
                isUnavailable={isUnavailable}
            />
        );
    };
    const renderPlugIcon = (definition: any, sizeClassName = 'h-[30px] w-[30px]') => {
        const perkHashes = (definition.perks || [])
            .map((perk: any) => perk?.perkHash)
            .filter((perkHash: number) => Number.isSafeInteger(perkHash));
        const perkDefinitions = perkHashes
            .map((perkHash: number) => sandboxPerkDefinitions?.[perkHash] || sandboxPerkDefinitions?.[String(perkHash)])
            .filter(Boolean);
        const clarityDescription = clarityDescriptions[definition.hash] || perkHashes
            .map((perkHash: number) => clarityDescriptions[perkHash])
            .find(Boolean);
        
        return (
            <InGameLoadoutPlugTile
                key={definition.hash}
                definition={definition}
                clarityDescription={clarityDescription}
                perkDefinitions={perkDefinitions}
                sizeClassName={sizeClassName}
            />
        );
    };
    const armorSlots = Array.from({ length: 5 }, (_, slotIndex) => (
        armorItems[slotIndex]
            ? renderItemIcon(armorItems[slotIndex])
            : renderEmptySlot(`armor-${slotIndex}`)
    ));
    const weaponSlots = Array.from({ length: 3 }, (_, slotIndex) => (
        weaponItems[slotIndex]
            ? renderItemIcon(weaponItems[slotIndex])
            : renderEmptySlot(`weapon-${slotIndex}`)
    ));
    const abilitySlots = siteSubclassPlugGroups.abilities.slice(0, 4);
    const superSlot = siteSubclassPlugGroups.super[0];
    const aspectSlots = siteSubclassPlugGroups.aspects.slice(0, 2);
    const fragmentSlots = siteSubclassPlugGroups.fragments.slice(0, 6);
    const bottomRowFragments = fragmentSlots.slice(0, 4);
    const upperRowFragments = fragmentSlots.slice(4, 5);
    const loadoutTags = loadout.tags || [];
    
    const handleAddTagToSiteLoadout = (tag: string) => {
        const normalizedTag = tag.trim();
        if (!normalizedTag) return;
        
        const hasExistingTag = loadoutTags.some((existingTag) => existingTag.toLowerCase() === normalizedTag.toLowerCase());
        if (hasExistingTag) {
            setTagInputValue('');
            setIsTagPickerOpen(false);
            toast.info(`${normalizedTag} is already on ${loadout.name}`);
            return;
        }
        
        addTag(loadout.id, normalizedTag);
        setTagInputValue('');
        setIsTagPickerOpen(false);
        toast.success(`Added ${normalizedTag} tag`);
    };
    
    return (
        <div style={{ borderLeftColor: loadout.color }} className="w-full max-w-full border-l-[3px]">
            <FrostedCard hover className="overflow-hidden p-0">
                <div className="group/header flex items-center justify-between gap-3 border-b border-white/5 px-3 py-2">
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <div className="truncate text-xs font-bold uppercase tracking-wide text-white">
                            {loadout.name}
                        </div>
                        {loadoutTags.slice(0, 3).map((tag) => (
                            <span key={tag} className="shrink-0 bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                                {tag}
                            </span>
                        ))}
                        {isTagPickerOpen && (
                            <form
                                className="shrink-0"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    handleAddTagToSiteLoadout(tagInputValue);
                                }}
                            >
                                <input
                                    ref={tagInputRef}
                                    type="text"
                                    value={tagInputValue}
                                    onChange={(event) => setTagInputValue(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Escape') {
                                            setTagInputValue('');
                                            setIsTagPickerOpen(false);
                                        }
                                    }}
                                    onBlur={() => {
                                        if (!tagInputValue.trim()) {
                                            setIsTagPickerOpen(false);
                                        }
                                    }}
                                    placeholder="Tag"
                                    className="h-5 w-20 border border-white/10 bg-slate-900 px-1.5 text-[10px] font-semibold text-white placeholder:text-slate-600 focus:border-destiny-gold/50 focus:outline-none"
                                />
                            </form>
                        )}
                        <button
                            type="button"
                            onClick={() => setIsTagPickerOpen((isOpen) => !isOpen)}
                            className={cn(
                                "inline-flex h-5 w-5 shrink-0 items-center justify-center text-slate-500 opacity-0 transition hover:bg-white/5 hover:text-white focus:opacity-100 group-hover/header:opacity-100",
                                isTagPickerOpen && "opacity-100 text-white"
                            )}
                            title="Add tag"
                            aria-label="Add tag"
                            aria-expanded={isTagPickerOpen}
                        >
                            <Plus className="h-3 w-3" />
                        </button>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        <button
                            type="button"
                            onClick={handleEquip}
                            disabled={isEquipping || (loadout.items.length === 0 && !loadout.subclassConfig)}
                            className="inline-flex h-7 w-7 items-center justify-center text-destiny-gold transition-colors hover:bg-destiny-gold/10 disabled:cursor-not-allowed disabled:opacity-50"
                            title={`Equip ${loadout.name}`}
                            aria-label={`Equip ${loadout.name}`}
                        >
                            {isEquipping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                        </button>
                        <button
                            type="button"
                            onClick={onEdit}
                            className="inline-flex h-7 w-7 items-center justify-center text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                            title={`Edit ${loadout.name}`}
                            aria-label={`Edit ${loadout.name}`}
                        >
                            <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={onShare}
                            className="inline-flex h-7 w-7 items-center justify-center text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                            title={`Share ${loadout.name}`}
                            aria-label={`Share ${loadout.name}`}
                        >
                            <Share2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={handleDelete}
                            className="inline-flex h-7 w-7 items-center justify-center text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                            title={`Delete ${loadout.name}`}
                            aria-label={`Delete ${loadout.name}`}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
                <div className="flex min-h-[116px] gap-3 p-4">
                    <div className="flex shrink-0 items-start gap-2">
                        <div className="flex flex-col gap-1">
                            {renderSiteLoadoutIcon()}
                            {superSlot
                                ? renderPlugIcon(superSlot, 'h-12 w-12')
                                : renderEmptySlot('super', 'h-12 w-12')}
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                            {Array.from({ length: 4 }, (_, slotIndex) => (
                                abilitySlots[slotIndex]
                                    ? renderPlugIcon(abilitySlots[slotIndex], 'h-[30px] w-[30px]')
                                    : renderEmptySlot(`ability-${slotIndex}`, 'h-[30px] w-[30px]')
                            ))}
                            {aspectSlots.map((aspect) => renderPlugIcon(aspect, 'h-[30px] w-[30px]'))}
                            {Array.from({ length: Math.max(0, 2 - aspectSlots.length) }, (_, slotIndex) => (
                                renderEmptySlot(`aspect-${slotIndex}`, 'h-[30px] w-[30px]')
                            ))}
                            <div className="h-[30px] w-[30px]" aria-hidden="true" />
                            {upperRowFragments[0]
                                ? renderPlugIcon(upperRowFragments[0], 'h-[30px] w-[30px]')
                                : <div className="h-[30px] w-[30px]" aria-hidden="true" />}
                            {bottomRowFragments.map((fragment) => renderPlugIcon(fragment, 'h-[30px] w-[30px]'))}
                        </div>
                    </div>
                    <div className="grid min-w-0 flex-1 grid-cols-[repeat(5,3rem)] content-start gap-1 overflow-hidden">
                        {armorSlots}
                        {weaponSlots}
                    </div>
                </div>
            </FrostedCard>
        </div>
    );
}

// ===== Subclass Picker Modal =====

// Damage type to subclass hash mapping per class
// This maps damage types to the subclass item hashes for each class
const SUBCLASS_HASHES: Record<number, Record<number, number>> = {
    // Titan (classType 0)
    0: {
        2: 2932390016, // Arc - Striker
        3: 2550323932, // Solar - Sunbreaker  
        4: 2842471112, // Void - Sentinel
        6: 613647804,  // Stasis - Behemoth
        7: 242419885,  // Strand - Berserker
        5: 1616346845, // Prismatic
    },
    // Hunter (classType 1)
    1: {
        2: 2328211300, // Arc - Arcstrider
        3: 2240888816, // Solar - Gunslinger
        4: 2453866490, // Void - Nightstalker
        6: 873720784,  // Stasis - Revenant
        7: 3785442599, // Strand - Threadrunner
        5: 4282591831, // Prismatic
    },
    // Warlock (classType 2) 
    2: {
        2: 3168620479, // Arc - Stormcaller
        3: 3941205951, // Solar - Dawnblade
        4: 2849050827, // Void - Voidwalker
        6: 3291545503, // Stasis - Shadebinder
        7: 4204413574, // Strand - Broodweaver
        5: 3893112950, // Prismatic
    },
};

type SubclassSlotType = 'super' | 'aspect' | 'fragment' | 'melee' | 'grenade' | 'classAbility' | 'movement';

const DAMAGE_TYPE_BY_HASH: Record<number, number> = {
    3373582085: 1, // Kinetic
    2303181850: 2, // Arc
    1847026933: 3, // Solar
    3454344768: 4, // Void
    2817963223: 5, // Prismatic
    151347233: 6, // Stasis
    3949783978: 7, // Strand
};

function getDamageTypeFromHashOrEnum(damageType?: number) {
    if (!damageType) return undefined;
    return DAMAGE_TYPES[damageType] ? damageType : DAMAGE_TYPE_BY_HASH[damageType];
}

function normalizeLoadoutSubclassDamageType(loadout: CustomLoadout) {
    if (!loadout.subclassConfig?.damageType) return loadout;
    
    const normalizedDamageType = getDamageTypeFromHashOrEnum(loadout.subclassConfig.damageType);
    if (!normalizedDamageType || normalizedDamageType === loadout.subclassConfig.damageType) return loadout;
    
    return {
        ...loadout,
        subclassConfig: {
            ...loadout.subclassConfig,
            damageType: normalizedDamageType,
        },
    };
}

function getSubclassHash(classType: number, damageType?: number) {
    return damageType ? SUBCLASS_HASHES[classType]?.[damageType] : null;
}

function collectSubclassPlugSetHashes(subclassDefinition: any) {
    if (!subclassDefinition?.sockets?.socketEntries) return [];

    const plugSetHashes: number[] = [];
    subclassDefinition.sockets.socketEntries.forEach((socketEntry: any) => {
        if (socketEntry.reusablePlugSetHash) {
            plugSetHashes.push(socketEntry.reusablePlugSetHash);
        }
        if (socketEntry.randomizedPlugSetHash) {
            plugSetHashes.push(socketEntry.randomizedPlugSetHash);
        }
    });

    return [...new Set(plugSetHashes)];
}

function collectSubclassPlugHashes(plugSetDefinitions: Record<number, any>) {
    const plugHashes = new Set<number>();

    Object.values(plugSetDefinitions).forEach((plugSetDefinition: any) => {
        plugSetDefinition?.reusablePlugItems?.forEach((plugItem: any) => {
            if (plugItem.plugItemHash) {
                plugHashes.add(plugItem.plugItemHash);
            }
        });
    });

    return Array.from(plugHashes);
}

function getSubclassPlugCategory(definition: any): SubclassSlotType | 'unknown' {
    const identifier = definition.plug?.plugCategoryIdentifier?.toLowerCase() || '';
    const typeDisplay = definition.itemTypeDisplayName?.toLowerCase() || '';
    const name = definition.displayProperties?.name?.toLowerCase() || '';
    
    if (identifier.includes('supers') || typeDisplay === 'super') {
        return 'super';
    }
    
    if (identifier.includes('aspects') || typeDisplay === 'aspect') {
        return 'aspect';
    }
    
    if (identifier.includes('fragments') || typeDisplay === 'fragment' || name.startsWith('facet of')) {
        return 'fragment';
    }
    
    if (identifier.includes('grenade') || typeDisplay.includes('grenade')) {
        return 'grenade';
    }
    
    if (identifier.includes('melee') || typeDisplay.includes('melee')) {
        return 'melee';
    }
    
    if (
        identifier.includes('class_abilities') ||
        typeDisplay.includes('class ability') ||
        name.includes('rift') ||
        name.includes('barricade') ||
        name.includes('dodge')
    ) {
        return 'classAbility';
    }
    
    if (
        identifier.includes('movement') ||
        identifier.includes('jump') ||
        typeDisplay.includes('jump') ||
        typeDisplay.includes('glide') ||
        typeDisplay.includes('lift')
    ) {
        return 'movement';
    }
    
    return 'unknown';
}

function useSubclassOptionDefinitions(classType: number, damageType?: number) {
    const expectedSubclassHash = getSubclassHash(classType, damageType);
    const subclassHashes = useMemo(
        () => (expectedSubclassHash ? [expectedSubclassHash] : []),
        [expectedSubclassHash]
    );
    const { definitions: subclassDefs, isLoading: subclassDefsLoading } = useInventoryItemDefinitionsFromTable(
        subclassHashes,
        'full'
    );
    const subclassDef = expectedSubclassHash ? subclassDefs[expectedSubclassHash] : null;
    const plugSetHashes = useMemo(() => collectSubclassPlugSetHashes(subclassDef), [subclassDef]);
    const { plugSetDefinitions, isLoading: plugSetsLoading } = usePlugSetDefinitions(plugSetHashes);
    const allPlugHashes = useMemo(
        () => collectSubclassPlugHashes(plugSetDefinitions),
        [plugSetDefinitions]
    );
    const { definitions: plugDefs, isLoading: plugDefsLoading } = useInventoryItemDefinitionsFromTable(
        allPlugHashes,
        'full'
    );

    return {
        expectedSubclassHash,
        subclassDef,
        plugSetDefinitions,
        allPlugHashes,
        plugDefs,
        isLoading: subclassDefsLoading || plugSetsLoading || plugDefsLoading,
    };
}

// ===== Subclass Picker Item with Tooltip =====

interface SubclassPickerItemProps {
    plug: {
        plugHash: number;
        socketIndex: number;
        isEquipped: boolean;
        def: any;
        fragmentSlots?: number;
    };
    slotType: string;
    damageColor: string;
    onSelect: () => void;
    clarityDescription?: ClarityDescription;
    perkDefinitions?: any[];
}

function SubclassPickerItem({ plug, slotType, damageColor, onSelect, clarityDescription, perkDefinitions = [] }: SubclassPickerItemProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const perkDescriptions = perkDefinitions
        .map((perkDefinition) => ({
            name: perkDefinition?.displayProperties?.name,
            description: perkDefinition?.displayProperties?.description,
        }))
        .filter((perkDefinition) => perkDefinition.name || perkDefinition.description);
    
    const handleMouseEnter = () => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setTooltipPos({
                x: rect.left + rect.width / 2,
                y: rect.top
            });
        }
        setIsHovered(true);
    };
    
    return (
        <>
            <button
                ref={buttonRef}
                onClick={onSelect}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setIsHovered(false)}
                className="group relative flex flex-col items-center gap-2 border border-white/10 bg-transparent p-2 transition-all hover:border-destiny-gold/50"
                style={{ borderColor: `${damageColor}20` }}
            >
                <div className="w-12 h-12 rounded overflow-hidden border border-white/10 relative">
                    {plug.def?.displayProperties?.icon ? (
                        <Image
                            src={getBungieImage(plug.def.displayProperties.icon)}
                            width={48}
                            height={48}
                            alt=""
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-black/50 flex items-center justify-center">
                            <Zap className="w-6 h-6 text-slate-600" />
                        </div>
                    )}
                    {/* Fragment slot indicator for aspects */}
                    {slotType === 'aspect' && plug.fragmentSlots !== undefined && plug.fragmentSlots > 0 && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-black/90 border border-destiny-gold/50 rounded-full flex items-center justify-center text-[10px] font-bold text-destiny-gold">
                            {plug.fragmentSlots}
                        </div>
                    )}
                </div>
                <span className="text-[10px] text-slate-400 text-center leading-tight line-clamp-2 group-hover:text-white transition-colors">
                    {plug.def?.displayProperties?.name || 'Unknown'}
                </span>
                {/* Stat bonuses preview for fragments */}
                {slotType === 'fragment' && plug.def?.investmentStats && plug.def.investmentStats.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 justify-center">
                        {plug.def.investmentStats.slice(0, 2).map((stat: any, idx: number) => {
                            if (stat.value === 0) return null;
                            return (
                                <span 
                                    key={idx}
                                    className={cn(
                                        "text-[8px] px-1 rounded",
                                        stat.value > 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                    )}
                                >
                                    {stat.value > 0 ? '+' : ''}{stat.value}
                                </span>
                            );
                        })}
                    </div>
                )}
            </button>
            
            {/* Hover Tooltip - Rendered via Portal */}
            {isHovered && plug.def && typeof document !== 'undefined' && createPortal(
                <div 
                    className="fixed z-9999 pointer-events-none"
                    style={{ 
                        left: tooltipPos.x, 
                        top: tooltipPos.y,
                        transform: 'translate(-50%, -100%)',
                        marginTop: '-8px'
                    }}
                >
                    <div className="bg-gray-800/20 backdrop-blur-xl border border-white/20 p-3 shadow-2xl min-w-[220px] max-w-2">
                        {/* Name */}
                        <div className="font-bold text-white text-sm mb-1 flex items-center gap-2">
                            {plug.def.displayProperties?.name}
                            {slotType === 'aspect' && plug.fragmentSlots !== undefined && plug.fragmentSlots > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-destiny-gold/20 text-destiny-gold rounded">
                                    {plug.fragmentSlots} fragment{plug.fragmentSlots !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                        
                        {/* Type */}
                        {plug.def.itemTypeDisplayName && (
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
                                {plug.def.itemTypeDisplayName}
                            </div>
                        )}
                        
                        {/* Description */}
                        {plug.def.displayProperties?.description && (
                            <div className="text-xs text-slate-300 leading-relaxed">
                                {plug.def.displayProperties.description}
                            </div>
                        )}
                        
                        {!plug.def.displayProperties?.description && perkDescriptions.length > 0 && (
                            <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
                                <div className="text-[10px] uppercase tracking-wider text-slate-500">
                                    Details
                                </div>
                                {perkDescriptions.map((perkDefinition, perkIndex) => (
                                    <div key={`${plug.plugHash}-perk-${perkIndex}`} className="text-xs leading-relaxed text-slate-300">
                                        {perkDefinition.name && perkDefinition.name !== plug.def.displayProperties?.name && (
                                            <div className="font-semibold text-slate-100">{perkDefinition.name}</div>
                                        )}
                                        {perkDefinition.description && (
                                            <div>{perkDefinition.description}</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {clarityDescription && (
                            <div className="mt-2 border-t border-white/10 pt-2">
                                <div className="text-[10px] uppercase tracking-wider text-cyan-200">
                                    Clarity
                                </div>
                                <div className="mt-1 space-y-2 text-xs leading-relaxed text-slate-200">
                                    {clarityDescription.lines.map((line, lineIndex) => (
                                        line ? (
                                            <p key={`${clarityDescription.hash}-${lineIndex}`} className="break-words">
                                                {line}
                                            </p>
                                        ) : (
                                            <div key={`${clarityDescription.hash}-${lineIndex}`} className="h-1" aria-hidden="true" />
                                        )
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {/* Stat bonuses */}
                        {plug.def.investmentStats && plug.def.investmentStats.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-white/10">
                                <div className="flex flex-wrap gap-2">
                                    {plug.def.investmentStats.map((stat: any, idx: number) => {
                                        const statValue = stat.value;
                                        if (statValue === 0) return null;
                                        const statName = getStatName(stat.statTypeHash);
                                        return (
                                            <span 
                                                key={idx}
                                                className={cn(
                                                    "text-[10px] px-1.5 py-0.5 rounded",
                                                    statValue > 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                                )}
                                            >
                                                {statValue > 0 ? '+' : ''}{statValue} {statName}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        
                        {/* Arrow */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-slate-900/95" />
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}

interface SubclassPickerProps {
    slotType: SubclassSlotType;
    slotIndex?: number;
    classType: number;
    damageType?: number;
    onSelect: (plugHash: number, name?: string, icon?: string, fragmentSlots?: number) => void;
    onClose: () => void;
    selectedFragments?: number[]; // Already selected fragment hashes to exclude
    selectedAspects?: number[]; // Already selected aspect hashes to exclude
}

function SubclassPicker({ slotType, slotIndex, classType, damageType, onSelect, onClose, selectedFragments = [], selectedAspects = [] }: SubclassPickerProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const { table: pickerSandboxPerkDefinitions } = useManifestTable<any>("DestinySandboxPerkDefinition");
    const {
        subclassDef,
        plugSetDefinitions,
        allPlugHashes,
        plugDefs,
        isLoading,
    } = useSubclassOptionDefinitions(classType, damageType);
    
    // Build socket index mapping from subclass definition
    const socketIndexMap = useMemo(() => {
        if (!subclassDef?.sockets?.socketEntries) return new Map<number, number>();
        
        const map = new Map<number, number>();
        
        subclassDef.sockets.socketEntries.forEach((entry: any, idx: number) => {
            // Map plug set hash to socket index
            if (entry.reusablePlugSetHash) {
                const plugSet = plugSetDefinitions[entry.reusablePlugSetHash];
                if (plugSet?.reusablePlugItems) {
                    plugSet.reusablePlugItems.forEach((item: any) => {
                        if (item.plugItemHash && !map.has(item.plugItemHash)) {
                            map.set(item.plugItemHash, idx);
                        }
                    });
                }
            }
        });
        
        return map;
    }, [subclassDef, plugSetDefinitions]);
    
    // Filter plugs based on slot type and search - now using ALL plugs from plug sets
    const filteredPlugs = useMemo(() => {
        // Use all plug hashes we fetched from the plug sets
        return allPlugHashes.filter(plugHash => {
            const def = plugDefs[plugHash];
            if (!def) return false;
            
            // Get the category of this plug
            const plugCategory = getSubclassPlugCategory(def);
            
            // Filter by slot type
            if (plugCategory !== slotType) return false;
            
            // Filter out already-selected fragments (no duplicates)
            if (slotType === 'fragment' && selectedFragments.includes(plugHash)) {
                return false;
            }
            
            // Filter out already-selected aspects (no duplicates)
            if (slotType === 'aspect' && selectedAspects.includes(plugHash)) {
                return false;
            }
            
            // Filter by search
            if (searchQuery) {
                const name = def.displayProperties?.name?.toLowerCase() || '';
                if (!name.includes(searchQuery.toLowerCase())) return false;
            }
            
            return true;
        }).map(plugHash => ({
            plugHash,
            socketIndex: socketIndexMap.get(plugHash) ?? -1,
            isEquipped: false,
            def: plugDefs[plugHash],
            fragmentSlots: plugDefs[plugHash]?.plug?.energyCapacity?.capacityValue,
        }));
    }, [allPlugHashes, plugDefs, searchQuery, slotType, socketIndexMap, selectedFragments, selectedAspects]);
    const pickerPlugPerkHashes = useMemo(() => (
        filteredPlugs.flatMap((plug) => (
            (plug.def?.perks || [])
                .map((perk: any) => perk?.perkHash)
                .filter((perkHash: number) => Number.isSafeInteger(perkHash))
        ))
    ), [filteredPlugs]);
    const { descriptions: pickerClarityDescriptions } = useClarityDescriptions([
        ...filteredPlugs.map((plug) => plug.plugHash),
        ...pickerPlugPerkHashes,
    ]);
    
    const damageColor = damageType === 5 ? '#e878e8' : (damageType ? DAMAGE_TYPES[damageType]?.color : '#888');
    
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]" onClick={onClose}>
            <div 
                className="flex max-h-[72vh] w-full max-w-2xl flex-col overflow-hidden border-l-[3px] bg-[#090d13]/98 shadow-2xl shadow-black/70"
                style={{ borderLeftColor: damageColor }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
                    <div className="flex items-center gap-3">
                        {damageType && DAMAGE_TYPES[damageType]?.apiIcon && (
                            <Image src={DAMAGE_TYPES[damageType].apiIcon!} width={20} height={20} alt="" />
                        )}
                        <h3 className="font-condensed text-base font-bold uppercase tracking-wide text-white">
                            Select {slotType} {slotIndex !== undefined ? slotIndex + 1 : ''}
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                
                {/* Search */}
                <div className="border-b border-white/5 p-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            placeholder={`Search ${slotType}s...`}
                            className="w-full border border-white/10 bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-slate-600 focus:border-destiny-gold/50 focus:outline-none"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>
                
                {/* Options Grid */}
                <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
                    {!damageType ? (
                        <div className="text-center py-8 text-slate-500">
                            <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="text-sm">
                                Select a damage type first
                            </p>
                            <p className="text-xs mt-2 text-slate-600">
                                Choose Arc, Solar, Void, Stasis, Strand, or Prismatic to see available options.
                            </p>
                        </div>
                    ) : isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-destiny-gold animate-spin" />
                        </div>
                    ) : filteredPlugs.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                            <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" style={{ color: damageColor }} />
                            <p className="text-sm">
                                No {slotType} options available for {DAMAGE_TYPES[damageType]?.name || 'this element'}.
                            </p>
                            <p className="text-xs mt-2 text-slate-600">
                                Make sure you have this subclass unlocked in-game.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6">
                            {filteredPlugs.map((plug) => {
                                const perkHashes = (plug.def?.perks || [])
                                    .map((perk: any) => perk?.perkHash)
                                    .filter((perkHash: number) => Number.isSafeInteger(perkHash));
                                const perkDefinitions = perkHashes
                                    .map((perkHash: number) => pickerSandboxPerkDefinitions?.[perkHash] || pickerSandboxPerkDefinitions?.[String(perkHash)])
                                    .filter(Boolean);
                                const clarityDescription = pickerClarityDescriptions[plug.plugHash] || perkHashes
                                    .map((perkHash: number) => pickerClarityDescriptions[perkHash])
                                    .find(Boolean);
                                
                                return (
                                    <SubclassPickerItem
                                        key={`${plug.socketIndex}-${plug.plugHash}`}
                                        plug={plug}
                                        slotType={slotType}
                                        damageColor={damageColor}
                                        clarityDescription={clarityDescription}
                                        perkDefinitions={perkDefinitions}
                                        onSelect={() => {
                                            onSelect(plug.plugHash, plug.def?.displayProperties?.name, plug.def?.displayProperties?.icon, plug.fragmentSlots);
                                            onClose();
                                        }}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ===== Perk/Mod Context Menu =====

interface ContextMenuProps {
    x: number;
    y: number;
    item: LoadoutItem;
    type: 'weapon' | 'armor';
    profile: any;
    onClose: () => void;
    onSelectPerk?: (socketIndex: number, plugHash: number) => void;
}

function ItemContextMenu({ x, y, item, type, profile, onClose, onSelectPerk }: ContextMenuProps) {
    const { definitions } = useItemDefinitions([item.itemHash]);
    const def = definitions[item.itemHash];
    const socketsData = profile?.itemComponents?.sockets?.data?.[item.itemInstanceId || ''];
    const reusablePlugs = profile?.itemComponents?.reusablePlugs?.data?.[item.itemInstanceId || '']?.plugs;
    
    // Get socket hashes for plug definitions
    const plugHashes = useMemo(() => {
        const hashes: number[] = [];
        if (socketsData?.sockets) {
            socketsData.sockets.forEach((socket: any) => {
                if (socket.plugHash) hashes.push(socket.plugHash);
            });
        }
        if (reusablePlugs) {
            Object.values(reusablePlugs).forEach((plugs: any) => {
                plugs.forEach((p: any) => {
                    if (p.plugItemHash) hashes.push(p.plugItemHash);
                });
            });
        }
        return hashes;
    }, [socketsData, reusablePlugs]);
    
    const { definitions: plugDefs } = useItemDefinitions(plugHashes);
    
    // Filter to relevant socket categories
    const relevantSockets = useMemo(() => {
        if (!socketsData?.sockets || !def?.sockets?.socketCategories) return [];
        
        const result: Array<{
            index: number;
            currentPlug: any;
            availablePlugs: any[];
            categoryName: string;
        }> = [];
        
        def.sockets.socketCategories.forEach((category: any) => {
            // For weapons: perks (cat hash 4241085061) and intrinsics
            // For armor: mods (cat hash 590099826, 2518356196)
            const isWeaponPerk = type === 'weapon' && (
                category.socketCategoryHash === 4241085061 || // Weapon Perks
                category.socketCategoryHash === 3956125808    // Intrinsics
            );
            const isArmorMod = type === 'armor' && (
                category.socketCategoryHash === 590099826 ||  // Armor Mods
                category.socketCategoryHash === 2518356196 || // Armor Cosmetics
                category.socketCategoryHash === 3154740035    // General Mods
            );
            
            if (isWeaponPerk || isArmorMod) {
                category.socketIndexes?.forEach((socketIndex: number) => {
                    const socket = socketsData.sockets[socketIndex];
                    if (!socket) return;
                    
                    const currentPlugDef = socket.plugHash ? plugDefs[socket.plugHash] : null;
                    const availablePlugs = reusablePlugs?.[socketIndex]?.map((p: any) => ({
                        plugHash: p.plugItemHash,
                        def: plugDefs[p.plugItemHash],
                        canInsert: p.canInsert,
                        enabled: p.enabled,
                    })).filter((p: any) => p.def) || [];
                    
                    if (currentPlugDef || availablePlugs.length > 0) {
                        result.push({
                            index: socketIndex,
                            currentPlug: currentPlugDef ? { plugHash: socket.plugHash, def: currentPlugDef } : null,
                            availablePlugs,
                            categoryName: type === 'weapon' ? 'Perks' : 'Mods',
                        });
                    }
                });
            }
        });
        
        // Limit armor mods to first 6 columns
        if (type === 'armor') {
            return result.slice(0, 6);
        }
        
        return result;
    }, [socketsData, def, plugDefs, reusablePlugs, type]);
    
    // Adjust position to stay in viewport
    const menuStyle = useMemo(() => {
        const menuWidth = 500;
        const menuHeight = 320;
        let left = x;
        let top = y;
        
        if (typeof window !== 'undefined') {
            if (x + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 10;
            if (y + menuHeight > window.innerHeight) top = window.innerHeight - menuHeight - 10;
            if (left < 10) left = 10;
            if (top < 10) top = 10;
        }
        
        return { left, top };
    }, [x, y]);
    
    return (
        <>
            <div className="fixed inset-0 z-200" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
            <div 
                className="fixed z-201 bg-gray-800/20 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden"
                style={{ left: menuStyle.left, top: menuStyle.top, width: 500, maxHeight: 320 }}
            >
                {/* Header */}
                <div className="flex items-center gap-3 p-3 border-b border-white/10">
                    {def?.displayProperties?.icon && (
                        <Image 
                            src={getBungieImage(def.displayProperties.icon)} 
                            width={40} 
                            height={40} 
                            alt="" 
                        />
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white truncate">
                            {def?.displayProperties?.name || 'Unknown Item'}
                        </div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider">
                            {type === 'weapon' ? 'Configure Perks' : 'Configure Mods'}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 transition-colors">
                        <X className="w-4 h-4 text-slate-400" />
                    </button>
                </div>
                
                {/* Sockets in Columns */}
                <div className="overflow-y-auto max-h-[240px] p-4">
                    {relevantSockets.length === 0 ? (
                        <div className="text-center py-6 text-slate-500 text-sm">
                            No configurable {type === 'weapon' ? 'perks' : 'mods'} available
                        </div>
                    ) : (
                        <div className="flex gap-4">
                            {relevantSockets.map((socket, idx) => (
                                <div key={socket.index} className="flex-1 min-w-0">
                                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">
                                        Column {idx + 1}
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {socket.availablePlugs.length > 0 ? (
                                            socket.availablePlugs.map((plug: any) => (
                                                <button
                                                    key={plug.plugHash}
                                                    onClick={() => {
                                                        onSelectPerk?.(socket.index, plug.plugHash);
                                                        onClose();
                                                    }}
                                                    disabled={!plug.canInsert}
                                                    className={cn(
                                                        "flex items-center gap-2 p-1.5 border transition-all",
                                                        socket.currentPlug?.plugHash === plug.plugHash
                                                            ? "border-destiny-gold bg-destiny-gold/10"
                                                            : "border-white/10 hover:border-white/30 bg-black/30 hover:bg-black/50",
                                                        !plug.canInsert && "opacity-40 cursor-not-allowed"
                                                    )}
                                                >
                                                    <div className="w-10 h-10 shrink-0">
                                                        {plug.def?.displayProperties?.icon && (
                                                            <Image
                                                                src={getBungieImage(plug.def.displayProperties.icon)}
                                                                width={40}
                                                                height={40}
                                                                alt=""
                                                                className="w-full h-full object-cover"
                                                            />
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-slate-300 truncate">
                                                        {plug.def?.displayProperties?.name}
                                                    </span>
                                                </button>
                                            ))
                                        ) : socket.currentPlug ? (
                                            <div className="flex items-center gap-2 p-1.5 border border-destiny-gold/30 bg-destiny-gold/5">
                                                <div className="w-10 h-10 shrink-0">
                                                    {socket.currentPlug.def?.displayProperties?.icon && (
                                                        <Image
                                                            src={getBungieImage(socket.currentPlug.def.displayProperties.icon)}
                                                            width={40}
                                                            height={40}
                                                            alt=""
                                                            className="w-full h-full object-cover"
                                                        />
                                                    )}
                                                </div>
                                                <span className="text-xs text-slate-300 truncate">
                                                    {socket.currentPlug.def?.displayProperties?.name}
                                                </span>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

// ===== Loadout Editor =====

interface LoadoutEditorProps {
    loadout: CustomLoadout | null;
    classType: number;
    profile: any;
    onSave: (loadout: CustomLoadout) => void;
    onCancel: () => void;
}

type SubclassSlotPicker = {
    type: SubclassSlotType;
    index?: number;
} | null;

function LoadoutEditor({ loadout, classType, profile, onSave, onCancel }: LoadoutEditorProps) {
    const generateId = () => `loadout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const [editedLoadout, setEditedLoadout] = useState<CustomLoadout>(
        loadout ? normalizeLoadoutSubclassDamageType(loadout) : {
            id: generateId(),
            name: 'New Loadout',
            classType,
            icon: DEFAULT_LOADOUT_ICON,
            color: '#e3ce62',
            items: [],
            tags: [],
            subclassConfig: undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }
    );
    
    const [pickerBucket, setPickerBucket] = useState<number | null>(null);
    const [subclassPicker, setSubclassPicker] = useState<SubclassSlotPicker>(null);
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [iconSearchQuery, setIconSearchQuery] = useState('');
    const [showTagPicker, setShowTagPicker] = useState(false);
    const [isModsViewOpen, setIsModsViewOpen] = useState(() => (
        typeof window !== 'undefined' && window.localStorage.getItem(LOADOUT_EDITOR_MODS_VIEW_STORAGE_KEY) === 'true'
    ));
    const [activeArmorModPicker, setActiveArmorModPicker] = useState<{
        bucketHash: number;
        socketIndex: number;
    } | null>(null);
    const [editorTagInputValue, setEditorTagInputValue] = useState('');
    const [showDamageTypePicker, setShowDamageTypePicker] = useState(false);
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        item: LoadoutItem;
        type: 'weapon' | 'armor';
    } | null>(null);
    
    const handleItemSelect = (item: LoadoutItem) => {
        setEditedLoadout((prev) => {
            const existingIdx = prev.items.findIndex((i) => i.bucketHash === item.bucketHash);
            const newItems = existingIdx >= 0
                ? prev.items.map((i, idx) => (idx === existingIdx ? item : i))
                : [...prev.items, item];
            return { ...prev, items: newItems };
        });
        setPickerBucket(null);
    };
    
    const handleRemoveItem = (bucketHash: number) => {
        setEditedLoadout((prev) => ({
            ...prev,
            items: prev.items.filter((i) => i.bucketHash !== bucketHash),
        }));
    };
    
    useEffect(() => {
        window.localStorage.setItem(LOADOUT_EDITOR_MODS_VIEW_STORAGE_KEY, String(isModsViewOpen));
    }, [isModsViewOpen]);
    
    const getItemForBucket = (bucketHash: number) => {
        return editedLoadout.items.find((i) => i.bucketHash === bucketHash);
    };
    
    const selectedEditorArmorItems = useMemo(() => (
        LOADOUT_BUCKETS.armor
            .map((bucket) => ({
                bucket,
                item: editedLoadout.items.find((loadoutItem) => loadoutItem.bucketHash === bucket.hash),
            }))
            .filter((entry): entry is { bucket: typeof LOADOUT_BUCKETS.armor[number]; item: LoadoutItem } => Boolean(entry.item))
    ), [editedLoadout.items]);
    const selectedEditorArmorItemHashes = useMemo(
        () => selectedEditorArmorItems.map(({ item }) => item.itemHash),
        [selectedEditorArmorItems]
    );
    const { definitions: editorArmorItemDefinitions } = useItemDefinitions(selectedEditorArmorItemHashes);
    const editorArmorModPlugHashes = useMemo(() => {
        const plugHashes = new Set<number>();
        
        selectedEditorArmorItems.forEach(({ item }) => {
            const itemInstanceId = item.itemInstanceId || '';
            const socketsData = profile?.itemComponents?.sockets?.data?.[itemInstanceId];
            const reusablePlugs = profile?.itemComponents?.reusablePlugs?.data?.[itemInstanceId]?.plugs;
            
            socketsData?.sockets?.forEach((socket: any, socketIndex: number) => {
                const overridePlugHash = item.socketOverrides?.[socketIndex];
                if (socket.plugHash) plugHashes.add(socket.plugHash);
                if (overridePlugHash) plugHashes.add(overridePlugHash);
            });
            
            Object.values(reusablePlugs || {}).forEach((plugEntry: any) => {
                getReusablePlugItems(plugEntry).forEach((plug: any) => {
                    if (plug.plugItemHash) {
                        plugHashes.add(plug.plugItemHash);
                    }
                });
            });
        });
        
        return Array.from(plugHashes);
    }, [profile, selectedEditorArmorItems]);
    const { definitions: editorArmorModPlugDefinitions } = useItemDefinitions(editorArmorModPlugHashes);
    const editorArmorModRows = useMemo(() => (
        selectedEditorArmorItems.map(({ bucket, item }) => {
            const itemInstanceId = item.itemInstanceId || '';
            const itemDefinition = editorArmorItemDefinitions[item.itemHash];
            const socketsData = profile?.itemComponents?.sockets?.data?.[itemInstanceId];
            const reusablePlugs = profile?.itemComponents?.reusablePlugs?.data?.[itemInstanceId]?.plugs;
            const modSockets: Array<{
                socketIndex: number;
                currentPlugHash?: number;
                currentPlugDefinition?: any;
                availablePlugs: Array<{ plugHash: number; definition: any; canInsert?: boolean; enabled?: boolean }>;
            }> = [];
            
            itemDefinition?.sockets?.socketCategories?.forEach((category: any) => {
                if (!ARMOR_MOD_SOCKET_CATEGORY_HASHES.has(category.socketCategoryHash)) return;
                
                category.socketIndexes?.forEach((socketIndex: number) => {
                    const socket = socketsData?.sockets?.[socketIndex];
                    const overridePlugHash = item.socketOverrides?.[socketIndex];
                    const currentPlugHash = overridePlugHash || socket?.plugHash;
                    const reusableAvailablePlugs = getReusablePlugItems(reusablePlugs?.[socketIndex] || reusablePlugs?.[String(socketIndex)])
                        .map((plug: any) => ({
                            plugHash: plug.plugItemHash,
                            definition: editorArmorModPlugDefinitions[plug.plugItemHash],
                            canInsert: plug.canInsert,
                            enabled: plug.enabled,
                        }))
                        .filter((plug: any) => plug.definition);
                    const availablePlugs = currentPlugHash &&
                        editorArmorModPlugDefinitions[currentPlugHash] &&
                        !reusableAvailablePlugs.some((plug: any) => plug.plugHash === currentPlugHash)
                        ? [
                            {
                                plugHash: currentPlugHash,
                                definition: editorArmorModPlugDefinitions[currentPlugHash],
                                canInsert: true,
                                enabled: true,
                            },
                            ...reusableAvailablePlugs,
                        ]
                        : reusableAvailablePlugs;
                    
                    if (!currentPlugHash && availablePlugs.length === 0) return;
                    
                    modSockets.push({
                        socketIndex,
                        currentPlugHash,
                        currentPlugDefinition: currentPlugHash ? editorArmorModPlugDefinitions[currentPlugHash] : undefined,
                        availablePlugs,
                    });
                });
            });
            
            return {
                bucket,
                item,
                definition: itemDefinition,
                modSockets: modSockets.slice(0, 6),
            };
        })
    ), [editorArmorItemDefinitions, editorArmorModPlugDefinitions, profile, selectedEditorArmorItems]);
    
    const toggleTag = (tag: string) => {
        setEditedLoadout((prev) => {
            const tags = prev.tags || [];
            if (tags.includes(tag)) {
                return { ...prev, tags: tags.filter((t) => t !== tag) };
            } else {
                return { ...prev, tags: [...tags, tag] };
            }
        });
    };
    const addTypedEditorTag = () => {
        const normalizedTag = editorTagInputValue.trim();
        if (!normalizedTag) return;
        
        setEditedLoadout((prev) => {
            const tags = prev.tags || [];
            const hasExistingTag = tags.some((tag) => tag.toLowerCase() === normalizedTag.toLowerCase());
            
            if (hasExistingTag) return prev;
            
            return { ...prev, tags: [...tags, normalizedTag] };
        });
        setEditorTagInputValue('');
        setShowTagPicker(false);
    };
    
    const setDamageType = (damageType: number) => {
        setEditedLoadout((prev) => {
            const currentSubclassConfig = prev.subclassConfig || { itemHash: 0 };
            const isChangingDamageType = currentSubclassConfig.damageType !== damageType;

            return {
                ...prev,
                subclassConfig: {
                    ...currentSubclassConfig,
                    damageType,
                    ...(isChangingDamageType
                        ? {
                            super: undefined,
                            abilities: undefined,
                            aspects: undefined,
                            fragments: undefined,
                        }
                        : {}),
                },
            };
        });
        setShowDamageTypePicker(false);
    };
    
    const handleSubclassSlotClick = (type: SubclassSlotType, index?: number) => {
        setSubclassPicker({ type, index });
    };
    
    const handleSubclassSelect = (plugHash: number, name?: string, icon?: string, fragmentSlots?: number) => {
        if (!subclassPicker) return;
        
        const { type, index } = subclassPicker;
        
        setEditedLoadout((prev) => {
            const currentConfig = prev.subclassConfig || { itemHash: 0 };
            
            if (type === 'super') {
                return {
                    ...prev,
                    subclassConfig: {
                        ...currentConfig,
                        super: { plugHash, name, icon },
                    },
                };
            } else if (type === 'aspect' && index !== undefined) {
                const aspects = [...(currentConfig.aspects || [])];
                // Store fragment slots in the aspect object for tracking
                aspects[index] = { plugHash, name, icon, fragmentSlots };
                
                // When changing aspects, we may need to trim fragments if total slots decrease
                const newTotalSlots = aspects.reduce((sum, a) => sum + ((a as any)?.fragmentSlots || 0), 0);
                const currentFragments = currentConfig.fragments || [];
                // Filter out undefined entries and trim to new total
                const trimmedFragments = currentFragments.filter(f => f?.plugHash).slice(0, newTotalSlots);
                
                return {
                    ...prev,
                    subclassConfig: {
                        ...currentConfig,
                        aspects,
                        fragments: trimmedFragments,
                    },
                };
            } else if (type === 'fragment' && index !== undefined) {
                const fragments = [...(currentConfig.fragments || [])];
                fragments[index] = { plugHash, name, icon };
                return {
                    ...prev,
                    subclassConfig: {
                        ...currentConfig,
                        fragments,
                    },
                };
            } else if (['melee', 'grenade', 'classAbility', 'movement'].includes(type)) {
                return {
                    ...prev,
                    subclassConfig: {
                        ...currentConfig,
                        abilities: {
                            ...(currentConfig.abilities || {}),
                            [type]: { plugHash, name, icon },
                        },
                    },
                };
            }
            
            return prev;
        });
        
        setSubclassPicker(null);
    };
    
    // Helper to remove a fragment
    const handleRemoveFragment = (index: number) => {
        setEditedLoadout((prev) => {
            const currentConfig = prev.subclassConfig || { itemHash: 0 };
            const fragments = [...(currentConfig.fragments || [])];
            fragments[index] = undefined as any; // Clear this slot
            return {
                ...prev,
                subclassConfig: {
                    ...currentConfig,
                    fragments: fragments.filter(f => f?.plugHash), // Remove empty slots
                },
            };
        });
    };
    
    // Helper to remove an aspect
    const handleRemoveAspect = (index: number) => {
        setEditedLoadout((prev) => {
            const currentConfig = prev.subclassConfig || { itemHash: 0 };
            const aspects = [...(currentConfig.aspects || [])];
            aspects[index] = undefined as any;
            
            // Recalculate fragment slots and trim fragments
            const newTotalSlots = aspects.reduce((sum, a) => sum + ((a as any)?.fragmentSlots || 0), 0);
            const trimmedFragments = (currentConfig.fragments || []).filter(f => f?.plugHash).slice(0, newTotalSlots);
            
            return {
                ...prev,
                subclassConfig: {
                    ...currentConfig,
                    aspects: aspects.filter(a => a?.plugHash),
                    fragments: trimmedFragments,
                },
            };
        });
    };
    
    const damageType = editedLoadout.subclassConfig?.damageType;
    const subclassConfig = editedLoadout.subclassConfig;
    const { allPlugHashes: availableSubclassPlugHashes } = useSubclassOptionDefinitions(
        editedLoadout.classType,
        damageType
    );
    
    useEffect(() => {
        if (!damageType || !subclassConfig || availableSubclassPlugHashes.length === 0) return;
        
        const selectedSubclassPlugHashes = [
            subclassConfig.super?.plugHash,
            ...Object.values(subclassConfig.abilities || {}).map((ability) => ability?.plugHash),
            ...(subclassConfig.aspects || []).map((aspect) => aspect?.plugHash),
            ...(subclassConfig.fragments || []).map((fragment) => fragment?.plugHash),
        ].filter((plugHash): plugHash is number => typeof plugHash === 'number');
        
        if (selectedSubclassPlugHashes.length === 0) return;
        
        const availableSubclassPlugHashSet = new Set(availableSubclassPlugHashes);
        const hasUnavailableSelectedPlug = selectedSubclassPlugHashes.some(
            (plugHash) => !availableSubclassPlugHashSet.has(plugHash)
        );
        
        if (!hasUnavailableSelectedPlug) return;
        
        setEditedLoadout((prev) => {
            const currentSubclassConfig = prev.subclassConfig;
            if (!currentSubclassConfig || currentSubclassConfig.damageType !== damageType) return prev;
            
            return {
                ...prev,
                subclassConfig: {
                    ...currentSubclassConfig,
                    super: undefined,
                    abilities: undefined,
                    aspects: undefined,
                    fragments: undefined,
                },
            };
        });
    }, [availableSubclassPlugHashes, damageType, subclassConfig]);
    
    // Calculate total available fragment slots from selected aspects
    const totalFragmentSlots = useMemo(() => {
        if (!subclassConfig?.aspects) return 0;
        return subclassConfig.aspects.reduce((sum, aspect) => {
            return sum + ((aspect as any)?.fragmentSlots || 0);
        }, 0);
    }, [subclassConfig?.aspects]);
    
    // Get already selected fragment hashes (for duplicate prevention)
    const selectedFragmentHashes = useMemo(() => {
        if (!subclassConfig?.fragments) return [];
        return subclassConfig.fragments
            .filter(f => f?.plugHash)
            .map(f => f.plugHash);
    }, [subclassConfig?.fragments]);
    
    // Get already selected aspect hashes (for duplicate prevention)
    const selectedAspectHashes = useMemo(() => {
        if (!subclassConfig?.aspects) return [];
        return subclassConfig.aspects
            .filter(a => a?.plugHash)
            .map(a => a.plugHash);
    }, [subclassConfig?.aspects]);
    
    const editorSubclassPlugConfigs = useMemo(() => {
        const abilityConfigs = subclassConfig?.abilities || {};
        
        return [
            subclassConfig?.super,
            abilityConfigs.classAbility,
            abilityConfigs.movement,
            abilityConfigs.melee,
            abilityConfigs.grenade,
            ...(subclassConfig?.aspects || []),
            ...(subclassConfig?.fragments || []),
        ].filter((plugConfig): plugConfig is { plugHash: number; name?: string; icon?: string; description?: string; fragmentSlots?: number } => (
            typeof plugConfig?.plugHash === 'number'
        ));
    }, [subclassConfig]);
    const editorSubclassPlugHashes = useMemo(
        () => Array.from(new Set(editorSubclassPlugConfigs.map((plugConfig) => plugConfig.plugHash))),
        [editorSubclassPlugConfigs]
    );
    const { definitions: editorSubclassPlugDefinitions } = useItemDefinitions(editorSubclassPlugHashes);
    const { table: editorSandboxPerkDefinitions } = useManifestTable<any>("DestinySandboxPerkDefinition");
    const editorSubclassPerkHashes = useMemo(() => (
        editorSubclassPlugConfigs.flatMap((plugConfig) => {
            const definition = editorSubclassPlugDefinitions[plugConfig.plugHash];
            return (definition?.perks || [])
                .map((perk: any) => perk?.perkHash)
                .filter((perkHash: number) => Number.isSafeInteger(perkHash));
        })
    ), [editorSubclassPlugConfigs, editorSubclassPlugDefinitions]);
    const { descriptions: editorClarityDescriptions } = useClarityDescriptions([
        ...editorSubclassPlugHashes,
        ...editorSubclassPerkHashes,
    ]);
    
    // Check if any popup is currently open
    const hasOpenPopup = pickerBucket !== null || subclassPicker !== null || showIconPicker || showColorPicker || showTagPicker || showDamageTypePicker || activeArmorModPicker !== null || contextMenu !== null;
    
    const handleBackdropClick = () => {
        // Don't close the editor if a popup is open
        if (hasOpenPopup) return;
        onCancel();
    };
    
    const handleItemContextMenu = (e: React.MouseEvent, item: LoadoutItem, type: 'weapon' | 'armor') => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, item, type });
    };
    
    const handlePerkSelect = (socketIndex: number, plugHash: number) => {
        if (!contextMenu) return;
        setEditedLoadout((prev) => ({
            ...prev,
            items: prev.items.map((item) => {
                if (item.bucketHash !== contextMenu.item.bucketHash) return item;
                return {
                    ...item,
                    socketOverrides: {
                        ...(item.socketOverrides || {}),
                        [socketIndex]: plugHash,
                    },
                };
            }),
        }));
    };
    
    const handleArmorModSelect = (bucketHash: number, socketIndex: number, plugHash: number) => {
        setEditedLoadout((prev) => ({
            ...prev,
            items: prev.items.map((item) => {
                if (item.bucketHash !== bucketHash) return item;
                
                return {
                    ...item,
                    socketOverrides: {
                        ...(item.socketOverrides || {}),
                        [socketIndex]: plugHash,
                    },
                };
            }),
            armorMods: [
                ...(prev.armorMods || []).filter((armorMod) => armorMod.bucketHash !== bucketHash),
                {
                    bucketHash,
                    mods: [
                        ...((prev.armorMods || []).find((armorMod) => armorMod.bucketHash === bucketHash)?.mods || [])
                            .filter((mod) => mod.socketIndex !== socketIndex),
                        { socketIndex, plugHash },
                    ],
                },
            ],
        }));
        setActiveArmorModPicker(null);
    };
    
    const handleArmorModReset = (bucketHash: number, socketIndex: number) => {
        setEditedLoadout((prev) => ({
            ...prev,
            items: prev.items.map((item) => {
                if (item.bucketHash !== bucketHash || !item.socketOverrides?.[socketIndex]) return item;
                
                const { [socketIndex]: _removedPlugHash, ...remainingSocketOverrides } = item.socketOverrides;
                
                return {
                    ...item,
                    socketOverrides: Object.keys(remainingSocketOverrides).length > 0 ? remainingSocketOverrides : undefined,
                };
            }),
            armorMods: (prev.armorMods || [])
                .map((armorMod) => {
                    if (armorMod.bucketHash !== bucketHash) return armorMod;
                    
                    return {
                        ...armorMod,
                        mods: armorMod.mods.filter((mod) => mod.socketIndex !== socketIndex),
                    };
                })
                .filter((armorMod) => armorMod.mods.length > 0),
        }));
        setActiveArmorModPicker(null);
    };
    
    const filteredLoadoutIcons = useMemo(() => {
        const normalizedIconSearch = iconSearchQuery.trim().toLowerCase();
        
        if (!normalizedIconSearch) return LOADOUT_ICONS;
        
        return LOADOUT_ICONS.filter((iconId) => iconId.toLowerCase().includes(normalizedIconSearch));
    }, [iconSearchQuery]);
    
    const getEditorPlugDefinition = (plugConfig?: { plugHash: number; name?: string; icon?: string; description?: string }) => {
        if (!plugConfig?.plugHash) return null;
        
        return editorSubclassPlugDefinitions[plugConfig.plugHash] || {
            hash: plugConfig.plugHash,
            displayProperties: {
                name: plugConfig.name || String(plugConfig.plugHash),
                icon: plugConfig.icon,
                description: plugConfig.description || '',
            },
        };
    };
    
    const renderEditorPlugTile = (
        plugConfig: { plugHash: number; name?: string; icon?: string; description?: string } | undefined,
        sizeClassName: string
    ) => {
        const definition = getEditorPlugDefinition(plugConfig);
        if (!definition) return null;
        
        const perkHashes = (definition.perks || [])
            .map((perk: any) => perk?.perkHash)
            .filter((perkHash: number) => Number.isSafeInteger(perkHash));
        const perkDefinitions = perkHashes
            .map((perkHash: number) => editorSandboxPerkDefinitions?.[perkHash] || editorSandboxPerkDefinitions?.[String(perkHash)])
            .filter(Boolean);
        const clarityDescription = editorClarityDescriptions[definition.hash] || perkHashes
            .map((perkHash: number) => editorClarityDescriptions[perkHash])
            .find(Boolean);
        
        return (
            <InGameLoadoutPlugTile
                definition={definition}
                clarityDescription={clarityDescription}
                perkDefinitions={perkDefinitions}
                sizeClassName={sizeClassName}
            />
        );
    };
    
    const renderEditorSubclassSelector = ({
        slotType,
        label,
        plugConfig,
        sizeClassName,
        emptyIcon,
        index,
        disabled = false,
        onRemove,
        hint,
    }: {
        slotType: SubclassSlotType;
        label: string;
        plugConfig?: { plugHash: number; name?: string; icon?: string; description?: string; fragmentSlots?: number };
        sizeClassName: string;
        emptyIcon: ReactNode;
        index?: number;
        disabled?: boolean;
        onRemove?: () => void;
        hint?: string;
    }) => (
        <div className="group relative">
            <button
                type="button"
                onClick={() => !disabled && handleSubclassSlotClick(slotType, index)}
                disabled={disabled}
                className={cn(
                    sizeClassName,
                    "flex items-center justify-center transition-all",
                    disabled ? "cursor-not-allowed opacity-35" : "hover:scale-105"
                )}
                title={label}
            >
                {plugConfig?.plugHash ? (
                    renderEditorPlugTile(plugConfig, sizeClassName)
                ) : (
                    <SelectorHintTile
                        label={label}
                        description={hint || `Select ${label.toLowerCase()} for this loadout.`}
                        sizeClassName="h-full w-full"
                        disabled={disabled}
                    >
                        {emptyIcon}
                    </SelectorHintTile>
                )}
            </button>
            {plugConfig?.plugHash && onRemove && (
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onRemove();
                    }}
                    className="absolute -right-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label={`Remove ${label}`}
                    title={`Remove ${label}`}
                >
                    <X className="h-2.5 w-2.5 text-white" />
                </button>
            )}
        </div>
    );
    
    const renderEditorItemSelector = (
        bucket: { hash: number; name: string; icon: string },
        itemType: 'weapon' | 'armor',
        sizeClassName: string
    ) => {
        const item = getItemForBucket(bucket.hash);
        const instanceId = item?.itemInstanceId || '';
        const instanceData = profile?.itemComponents?.instances?.data?.[instanceId];
        const socketsData = profile?.itemComponents?.sockets?.data?.[instanceId];
        const reusablePlugs = profile?.itemComponents?.reusablePlugs?.data?.[instanceId]?.plugs;
        const statsData = profile?.itemComponents?.stats?.data?.[instanceId]?.stats;
        const hasOverrides = item?.socketOverrides && Object.keys(item.socketOverrides).length > 0;
        
        return (
            <div key={bucket.hash} className="group relative">
                <button
                    type="button"
                    onClick={() => setPickerBucket(bucket.hash)}
                    onContextMenu={(event) => item && handleItemContextMenu(event, item, itemType)}
                    className={cn(
                        sizeClassName,
                        "flex items-center justify-center transition-all hover:scale-105",
                        item
                            ? "border-0 bg-transparent"
                            : "border border-white/10 bg-transparent hover:border-destiny-gold/50",
                        hasOverrides && "ring-2 ring-destiny-gold/50"
                    )}
                    title={!item ? bucket.name : `Right-click to configure ${itemType === 'weapon' ? 'perks' : 'mods'}`}
                >
                    {item ? (
                        <DestinyItemCard
                            itemHash={item.itemHash}
                            itemInstanceId={item.itemInstanceId}
                            instanceData={instanceData ? { ...instanceData, stats: statsData } : undefined}
                            socketsData={socketsData}
                            reusablePlugs={reusablePlugs}
                            className="h-full w-full"
                            size={itemType === 'weapon' ? 'medium' : 'small'}
                        />
                    ) : (
                        <SelectorHintTile
                            label={bucket.name}
                            description={`Select ${itemType === 'weapon' ? 'a' : ''} ${bucket.name.toLowerCase()} for this loadout.`}
                            sizeClassName="h-full w-full"
                        >
                            <BucketIcon icon={bucket.icon} className={itemType === 'armor' ? 'opacity-50' : undefined} />
                        </SelectorHintTile>
                    )}
                </button>
                {hasOverrides && (
                    <div className="absolute -left-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-destiny-gold" title={itemType === 'weapon' ? 'Perks configured' : 'Mods configured'}>
                        <Settings2 className="h-2.5 w-2.5 text-slate-900" />
                    </div>
                )}
                {item && (
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            handleRemoveItem(bucket.hash);
                        }}
                        className={cn(
                            "absolute -right-1 -top-1 z-10 flex items-center justify-center rounded-full bg-red-500 opacity-0 transition-opacity group-hover:opacity-100",
                            itemType === 'weapon' ? "h-5 w-5" : "h-4 w-4"
                        )}
                        title={`Remove ${bucket.name}`}
                        aria-label={`Remove ${bucket.name}`}
                    >
                        <X className={cn("text-white", itemType === 'weapon' ? "h-3 w-3" : "h-2.5 w-2.5")} />
                    </button>
                )}
            </div>
        );
    };
    
    return (
        <>
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm"
            onClick={handleBackdropClick}
        >
            <div
                className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden border-l-[3px] bg-[#090d13]/95 shadow-2xl shadow-black/70"
                style={{ borderLeftColor: editedLoadout.color }}
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
                    <div className="relative shrink-0">
                        <button
                            type="button"
                            onClick={() => {
                                setShowIconPicker((isOpen) => !isOpen);
                                setShowColorPicker(false);
                            }}
                            className="flex h-12 w-12 items-center justify-center border border-white/10 bg-black/30 transition-colors hover:border-white/30"
                            style={{ borderColor: `${editedLoadout.color}66`, color: editedLoadout.color }}
                            title="Choose icon and color"
                            aria-label="Choose icon and color"
                            aria-expanded={showIconPicker}
                        >
                            <LoadoutIcon icon={editedLoadout.icon} color={editedLoadout.color} size="lg" />
                        </button>
                        {showIconPicker && (
                            <div className="absolute left-0 top-full z-50 mt-2 w-72 border border-white/10 bg-[#0b0f14]/98 p-3 shadow-2xl shadow-black/70">
                                <div className="relative mb-3">
                                    <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                                    <input
                                        type="text"
                                        value={iconSearchQuery}
                                        onChange={(event) => setIconSearchQuery(event.target.value)}
                                        placeholder="Search icons..."
                                        className="w-full border border-white/10 bg-slate-900 py-1.5 pl-7 pr-2 text-xs text-white placeholder:text-slate-600 focus:border-destiny-gold/50 focus:outline-none"
                                        autoFocus
                                    />
                                </div>
                                <div className="mb-3 grid max-h-36 grid-cols-7 gap-1 overflow-y-auto pr-1 custom-scrollbar">
                                    {filteredLoadoutIcons.map((iconId) => {
                                        const IconComponent = getLoadoutIconComponent(iconId);
                                        const isSelected = resolveLoadoutIconId(editedLoadout.icon) === iconId;
                                        
                                        return (
                                            <button
                                                key={iconId}
                                                type="button"
                                                onClick={() => setEditedLoadout((prev) => ({ ...prev, icon: iconId }))}
                                                className={cn(
                                                    "flex h-8 w-8 items-center justify-center text-slate-300 transition-colors hover:bg-white/10 hover:text-white",
                                                    isSelected && "bg-destiny-gold/15 text-destiny-gold"
                                                )}
                                                title={iconId}
                                                aria-label={`Use ${iconId} icon`}
                                            >
                                                <IconComponent className="h-4 w-4" />
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="border-t border-white/10 pt-3">
                                    <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                        Color
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {LOADOUT_COLORS.map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setEditedLoadout((prev) => ({ ...prev, color }))}
                                                className={cn(
                                                    "h-6 w-6 border transition-transform hover:scale-110",
                                                    editedLoadout.color === color ? "border-white" : "border-white/20"
                                                )}
                                                style={{ backgroundColor: color }}
                                                aria-label={`Use ${color} color`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <input
                        type="text"
                        value={editedLoadout.name}
                        onChange={(event) => setEditedLoadout((prev) => ({ ...prev, name: event.target.value }))}
                        className="min-w-0 flex-1 bg-transparent text-lg font-bold uppercase tracking-wide text-white outline-none placeholder:text-slate-600 focus:text-destiny-gold"
                        placeholder="Loadout Name"
                    />
                    
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsModsViewOpen((isOpen) => !isOpen)}
                            className={cn(
                                "inline-flex h-8 w-8 items-center justify-center transition-colors hover:bg-white/5 hover:text-white",
                                isModsViewOpen ? "text-destiny-gold" : "text-slate-400"
                            )}
                            title={isModsViewOpen ? "Hide mod rows" : "Show mod rows"}
                            aria-label={isModsViewOpen ? "Hide mod rows" : "Show mod rows"}
                            aria-pressed={isModsViewOpen}
                        >
                            <Settings2 className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => onSave(editedLoadout)}
                            className="inline-flex h-8 w-8 items-center justify-center text-destiny-gold transition-colors hover:bg-destiny-gold/10 hover:text-white"
                            title="Save loadout"
                            aria-label="Save loadout"
                        >
                            <Save className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="inline-flex h-8 w-8 items-center justify-center text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                            title="Close"
                            aria-label="Close"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>
                
                <div className="border-b border-white/5 px-4 py-2">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                            <Image src={CLASS_ICONS[editedLoadout.classType]} width={14} height={14} alt="" />
                            <span>{CLASS_NAMES[editedLoadout.classType]}</span>
                        </div>
                        {(editedLoadout.tags || []).map((tag) => (
                            <button
                                key={tag}
                                type="button"
                                onClick={() => toggleTag(tag)}
                                className="flex items-center gap-1 bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                            >
                                {tag}
                                <X className="h-3 w-3" />
                            </button>
                        ))}
                        <div className="relative">
                            {showTagPicker ? (
                                <form
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        addTypedEditorTag();
                                    }}
                                >
                                    <input
                                        type="text"
                                        value={editorTagInputValue}
                                        onChange={(event) => setEditorTagInputValue(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Escape') {
                                                setEditorTagInputValue('');
                                                setShowTagPicker(false);
                                            }
                                        }}
                                        placeholder="Tag"
                                        className="h-5 w-24 border border-white/10 bg-slate-900 px-1.5 text-[10px] font-semibold text-white placeholder:text-slate-600 focus:border-destiny-gold/50 focus:outline-none"
                                        autoFocus
                                    />
                                </form>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setShowTagPicker(true)}
                                    className="inline-flex h-5 w-5 items-center justify-center text-slate-500 transition-colors hover:bg-white/5 hover:text-white"
                                    title="Add tag"
                                    aria-label="Add tag"
                                >
                                    <Plus className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
                {/* Content */}
                <div className="p-4 sm:p-5">
                    <div className="space-y-5">
                            {isModsViewOpen ? (
                                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[5rem_minmax(0,1fr)]">
                                    <div>
                                        <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Weapons</h4>
                                        <div className="flex flex-row gap-2 lg:flex-col">
                                            {LOADOUT_BUCKETS.weapons.map((bucket) => renderEditorItemSelector(bucket, 'weapon', 'h-16 w-16'))}
                                        </div>
                                    </div>
                                    
                                    <div className="min-w-0">
                                        <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Armor - Mods</h4>
                                        <div className="space-y-2">
                                            {LOADOUT_BUCKETS.armor.map((bucket) => {
                                                const armorRow = editorArmorModRows.find((row) => row.bucket.hash === bucket.hash);
                                                
                                                return (
                                                    <div key={bucket.hash} className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] items-start gap-3 border-b border-white/5 pb-2 last:border-b-0">
                                                        <div>{renderEditorItemSelector(bucket, 'armor', 'h-14 w-14')}</div>
                                                        <div className="min-w-0 pt-0.5">
                                                            <div className="mb-1 truncate text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                                                {armorRow?.definition?.displayProperties?.name || bucket.name}
                                                            </div>
                                                            {!armorRow ? (
                                                                <div className="text-xs text-slate-600">Select armor to reveal mods.</div>
                                                            ) : armorRow.modSockets.length === 0 ? (
                                                                <div className="text-xs text-slate-600">No configurable mods found.</div>
                                                            ) : (
                                                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                                    {armorRow.modSockets.map((socket) => {
                                                                        const selectedPlugHash = armorRow.item.socketOverrides?.[socket.socketIndex] || socket.currentPlugHash;
                                                                        const isPickerOpen = activeArmorModPicker?.bucketHash === armorRow.item.bucketHash &&
                                                                            activeArmorModPicker.socketIndex === socket.socketIndex;
                                                                        
                                                                        return (
                                                                            <div key={`${armorRow.bucket.hash}-${socket.socketIndex}`} className="relative flex min-w-0 items-center gap-1.5">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setActiveArmorModPicker((currentPicker) => (
                                                                                        currentPicker?.bucketHash === armorRow.item.bucketHash && currentPicker.socketIndex === socket.socketIndex
                                                                                            ? null
                                                                                            : { bucketHash: armorRow.item.bucketHash, socketIndex: socket.socketIndex }
                                                                                    ))}
                                                                                    className={cn(
                                                                                        "relative h-8 w-8 shrink-0 overflow-hidden border bg-transparent transition-colors hover:border-white/30",
                                                                                        armorRow.item.socketOverrides?.[socket.socketIndex]
                                                                                            ? "border-destiny-gold"
                                                                                            : "border-white/10"
                                                                                    )}
                                                                                    title={socket.currentPlugDefinition?.displayProperties?.name || `Socket ${socket.socketIndex + 1}`}
                                                                                    aria-label={`Select mod for socket ${socket.socketIndex + 1}`}
                                                                                    aria-expanded={isPickerOpen}
                                                                                >
                                                                                    {socket.currentPlugDefinition?.displayProperties?.icon ? (
                                                                                        <Image
                                                                                            src={getBungieImage(socket.currentPlugDefinition.displayProperties.icon)}
                                                                                            alt={socket.currentPlugDefinition.displayProperties?.name || ''}
                                                                                            fill
                                                                                            sizes="32px"
                                                                                            className="object-cover"
                                                                                        />
                                                                                    ) : (
                                                                                        <Settings2 className="m-1.5 h-5 w-5 text-slate-600" />
                                                                                    )}
                                                                                </button>
                                                                                {armorRow.item.socketOverrides?.[socket.socketIndex] && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleArmorModReset(armorRow.item.bucketHash, socket.socketIndex)}
                                                                                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-white/10 text-slate-500 transition-colors hover:border-red-400/40 hover:text-red-300"
                                                                                        title="Reset this mod socket"
                                                                                        aria-label="Reset this mod socket"
                                                                                    >
                                                                                        <X className="h-3.5 w-3.5" />
                                                                                    </button>
                                                                                )}
                                                                                {isPickerOpen && (
                                                                                    <>
                                                                                        <div className="fixed inset-0 z-[120]" onClick={() => setActiveArmorModPicker(null)} />
                                                                                        <div className="absolute left-0 top-full z-[121] mt-2 w-72 border border-white/10 bg-[#0b0f14]/98 p-2 shadow-2xl shadow-black/70 backdrop-blur-xl">
                                                                                            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                                                                                Socket {socket.socketIndex + 1}
                                                                                            </div>
                                                                                            <div className="grid max-h-56 grid-cols-6 gap-1 overflow-y-auto custom-scrollbar">
                                                                                                {socket.availablePlugs.map((plug) => {
                                                                                                    const isSelectedPlug = selectedPlugHash === plug.plugHash;
                                                                                                    const isDisabled = plug.canInsert === false || plug.enabled === false;
                                                                                                    
                                                                                                    return (
                                                                                                        <button
                                                                                                            key={`${socket.socketIndex}-${plug.plugHash}`}
                                                                                                            type="button"
                                                                                                            onClick={() => !isDisabled && handleArmorModSelect(armorRow.item.bucketHash, socket.socketIndex, plug.plugHash)}
                                                                                                            disabled={isDisabled}
                                                                                                            className={cn(
                                                                                                                "relative h-9 w-9 overflow-hidden border transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                                                                                                                isSelectedPlug
                                                                                                                    ? "border-destiny-gold"
                                                                                                                    : "border-white/10 hover:border-white/30"
                                                                                                            )}
                                                                                                            title={plug.definition.displayProperties?.name || `Mod ${plug.plugHash}`}
                                                                                                        >
                                                                                                            {plug.definition.displayProperties?.icon ? (
                                                                                                                <Image
                                                                                                                    src={getBungieImage(plug.definition.displayProperties.icon)}
                                                                                                                    alt={plug.definition.displayProperties?.name || ''}
                                                                                                                    fill
                                                                                                                    sizes="36px"
                                                                                                                    className="object-cover"
                                                                                                                />
                                                                                                            ) : (
                                                                                                                <Settings2 className="m-2 h-5 w-5 text-slate-600" />
                                                                                                            )}
                                                                                                        </button>
                                                                                                    );
                                                                                                })}
                                                                                            </div>
                                                                                        </div>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                                    <div>
                                        <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Weapons</h4>
                                        <div className="flex gap-2">
                                            {LOADOUT_BUCKETS.weapons.map((bucket) => renderEditorItemSelector(bucket, 'weapon', 'h-16 w-16'))}
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Armor</h4>
                                        <div className="flex gap-2">
                                            {LOADOUT_BUCKETS.armor.map((bucket) => renderEditorItemSelector(bucket, 'armor', 'h-14 w-14'))}
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {/* Subclass Section (Bottom) */}
                            <div className="border-t border-white/5 pt-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-xs uppercase font-bold text-slate-500 tracking-widest">Subclass</h4>
                                    
                                    {/* Damage Type Selector - Icon Row */}
                                    <div className="flex gap-1">
                                        {[2, 3, 4, 6, 7, 5].map((dt) => (
                                            <button
                                                key={dt}
                                                onClick={() => setDamageType(dt)}
                                                className={cn(
                                                    "w-8 h-8 border flex items-center justify-center transition-all hover:scale-110",
                                                    damageType === dt 
                                                        ? "border-2 bg-transparent" 
                                                        : "border-white/10 bg-transparent hover:border-white/30"
                                                )}
                                                style={{ 
                                                    borderColor: damageType === dt ? (dt === 5 ? '#e878e8' : DAMAGE_TYPES[dt]?.color) : undefined,
                                                    boxShadow: damageType === dt ? `0 0 10px ${dt === 5 ? '#e878e8' : DAMAGE_TYPES[dt]?.color}40` : undefined
                                                }}
                                                title={DAMAGE_TYPES[dt]?.name}
                                            >
                                                {dt === 5 ? (
                                                    <span className="text-sm font-bold" style={{ color: '#e878e8' }}>P</span>
                                                ) : DAMAGE_TYPES[dt]?.apiIcon ? (
                                                    <Image 
                                                        src={DAMAGE_TYPES[dt].apiIcon!} 
                                                        width={18} 
                                                        height={18} 
                                                        alt={DAMAGE_TYPES[dt]?.name || ''} 
                                                    />
                                                ) : (
                                                    <span className="text-[10px] font-bold" style={{ color: DAMAGE_TYPES[dt]?.color }}>
                                                        {DAMAGE_TYPES[dt]?.name?.charAt(0)}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                <div className="flex flex-wrap items-start gap-5">
                                    <div className="flex items-start gap-3">
                                        {renderEditorSubclassSelector({
                                            slotType: 'super',
                                            label: 'Super',
                                            plugConfig: subclassConfig?.super,
                                            sizeClassName: 'h-14 w-14',
                                            emptyIcon: <Zap className="h-6 w-6" />,
                                            hint: damageType ? `Select a ${DAMAGE_TYPES[damageType]?.name || 'subclass'} super.` : 'Select an element before choosing a super.',
                                        })}
                                        
                                        <div className="h-14 w-px bg-white/10" />
                                        
                                        <div className="grid grid-cols-4 gap-1">
                                            {([
                                                ['classAbility', 'Class Ability'],
                                                ['movement', 'Movement'],
                                                ['melee', 'Melee'],
                                                ['grenade', 'Grenade'],
                                            ] as const).map(([ability, label]) => {
                                                const AbilityIcon = ABILITY_ICONS[ability] || CircleDot;
                                                const abilityConfig = subclassConfig?.abilities?.[ability];
                                                
                                                return (
                                                    <div key={ability}>
                                                        {renderEditorSubclassSelector({
                                                            slotType: ability,
                                                            label,
                                                            plugConfig: abilityConfig,
                                                            sizeClassName: 'h-10 w-10',
                                                            emptyIcon: <AbilityIcon className="h-5 w-5" />,
                                                            hint: damageType ? `Select ${label.toLowerCase()} for this subclass.` : 'Select an element before choosing abilities.',
                                                        })}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    
                                    <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">
                                        <div className="flex items-start gap-1.5">
                                            {[0, 1].map((aspectIndex) => (
                                                <div key={`aspect-${aspectIndex}`}>
                                                    {renderEditorSubclassSelector({
                                                        slotType: 'aspect',
                                                        label: `Aspect ${aspectIndex + 1}`,
                                                        plugConfig: subclassConfig?.aspects?.[aspectIndex],
                                                        sizeClassName: 'h-14 w-14',
                                                        emptyIcon: <Plus className="h-5 w-5" />,
                                                        index: aspectIndex,
                                                        onRemove: subclassConfig?.aspects?.[aspectIndex]?.plugHash
                                                            ? () => handleRemoveAspect(aspectIndex)
                                                            : undefined,
                                                        hint: damageType ? 'Select an aspect to unlock fragment slots.' : 'Select an element before choosing aspects.',
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                        
                                        <div className="flex min-w-0 flex-wrap items-start gap-1.5">
                                            {totalFragmentSlots === 0 ? (
                                                <SelectorHintTile
                                                    label="Fragments Locked"
                                                    description="Select aspects to unlock fragment slots."
                                                    sizeClassName="h-10 min-w-40 px-3"
                                                    disabled
                                                >
                                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                                                        Select aspects for fragments
                                                    </span>
                                                </SelectorHintTile>
                                            ) : (
                                                Array.from({ length: Math.min(totalFragmentSlots, 5) }).map((_, fragmentIndex) => (
                                                    <div key={`fragment-${fragmentIndex}`}>
                                                        {renderEditorSubclassSelector({
                                                            slotType: 'fragment',
                                                            label: `Fragment ${fragmentIndex + 1}`,
                                                            plugConfig: subclassConfig?.fragments?.[fragmentIndex],
                                                            sizeClassName: 'h-10 w-10',
                                                            emptyIcon: <Plus className="h-4 w-4" />,
                                                            index: fragmentIndex,
                                                            onRemove: subclassConfig?.fragments?.[fragmentIndex]?.plugHash
                                                                ? () => handleRemoveFragment(fragmentIndex)
                                                                : undefined,
                                                            hint: `Select fragment ${fragmentIndex + 1}.`,
                                                        })}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        
                                        <div className="ml-auto text-right">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Fragments</div>
                                            <div className="text-sm font-bold" style={{ color: damageType ? DAMAGE_TYPES[damageType]?.color : '#888' }}>
                                                {selectedFragmentHashes.length} / {totalFragmentSlots}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                    </div>
                </div>
                </div>
            </div>
        </div>
            
            {/* Item Picker */}
            {pickerBucket !== null && (
                <ItemPicker
                    bucketHash={pickerBucket}
                    classType={editedLoadout.classType}
                    profile={profile}
                    onSelect={handleItemSelect}
                    onClose={() => setPickerBucket(null)}
                />
            )}
            
            {/* Subclass Picker */}
            {subclassPicker && (
                <SubclassPicker
                    slotType={subclassPicker.type}
                    slotIndex={subclassPicker.index}
                    classType={editedLoadout.classType}
                    damageType={damageType}
                    onSelect={handleSubclassSelect}
                    onClose={() => setSubclassPicker(null)}
                    selectedFragments={selectedFragmentHashes}
                    selectedAspects={selectedAspectHashes}
                />
            )}
            
            {/* Context Menu for Perks/Mods */}
            {contextMenu && (
                <ItemContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    item={contextMenu.item}
                    type={contextMenu.type}
                    profile={profile}
                    onClose={() => setContextMenu(null)}
                    onSelectPerk={handlePerkSelect}
                />
            )}
        </>
    
    );
}

// ===== Main Page =====

export default function LoadoutsPage() {
    const { profile, stats, isLoading, isLoggedIn, membershipInfo, allCharacters } = useDestinyProfileContext();
    const { loadouts, createLoadout, updateLoadout, importLoadouts } = useLoadoutStore();
    const [selectedClass, setSelectedClass] = useState<number>(0);
    const [selectedCharacterId, setSelectedCharacterId] = useState<string>('');
    const [editingLoadout, setEditingLoadout] = useState<CustomLoadout | null | 'new'>(null);
    const [sharingLoadout, setSharingLoadout] = useState<CustomLoadout | null>(null);
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [showLoadoutSettings, setShowLoadoutSettings] = useState(false);
    const [loadoutSourceFilter, setLoadoutSourceFilter] = useState<LoadoutSourceFilter>('all');
    const [loadoutSortMode, setLoadoutSortMode] = useState<LoadoutSortMode>('updated');
    const [loadoutSearchQuery, setLoadoutSearchQuery] = useState('');
    const [isLoadoutSearchOpen, setIsLoadoutSearchOpen] = useState(false);
    const loadoutSearchInputRef = useRef<HTMLInputElement>(null);
    const [mounted, setMounted] = useState(false);
    
    const searchParams = useSearchParams();
    const router = useRouter();
    
    useEffect(() => {
        const savedSourceFilter = window.localStorage.getItem(LOADOUT_FILTER_STORAGE_KEY);
        const savedSortMode = window.localStorage.getItem(LOADOUT_SORT_STORAGE_KEY);
        
        if (isLoadoutSourceFilter(savedSourceFilter)) {
            setLoadoutSourceFilter(savedSourceFilter);
        }
        if (isLoadoutSortMode(savedSortMode)) {
            setLoadoutSortMode(savedSortMode);
        }
        
        setMounted(true);
    }, []);
    
    useEffect(() => {
        if (!mounted) return;
        
        window.localStorage.setItem(LOADOUT_FILTER_STORAGE_KEY, loadoutSourceFilter);
    }, [loadoutSourceFilter, mounted]);
    
    useEffect(() => {
        if (!mounted) return;
        
        window.localStorage.setItem(LOADOUT_SORT_STORAGE_KEY, loadoutSortMode);
    }, [loadoutSortMode, mounted]);
    
    useEffect(() => {
        if (isLoadoutSearchOpen) {
            loadoutSearchInputRef.current?.focus();
        }
    }, [isLoadoutSearchOpen]);
    
    // Handle URL-based import
    useEffect(() => {
        if (!mounted) return;
        
        const importCode = searchParams.get('import');
        if (importCode) {
            const decoded = decodeLoadoutShareCode(importCode);
            if (decoded) {
                // Show import dialog with pre-filled code
                setShowImportDialog(true);
            }
            // Clear the URL parameter
            router.replace('/character/loadouts');
        }
    }, [mounted, searchParams, router]);
    
    useEffect(() => {
        if (stats?.classType !== undefined) {
            setSelectedClass(stats.classType);
        }
        if (stats?.characterId) {
            setSelectedCharacterId(stats.characterId);
        }
    }, [stats?.characterId, stats?.classType]);
    
    useEffect(() => {
        if (allCharacters.length === 0 || selectedCharacterId) return;
        
        setSelectedCharacterId(allCharacters[0].characterId);
        setSelectedClass(allCharacters[0].classType);
    }, [allCharacters, selectedCharacterId]);
    
    const siteLoadoutsForSelectedCharacter = useMemo(() => {
        return loadouts.filter((l) => l.classType === selectedClass);
    }, [loadouts, selectedClass]);
    
    const loadoutCharacterFilters = useMemo(() => {
        if (allCharacters.length > 0) {
            return allCharacters;
        }
        
        return stats ? [{
            characterId: stats.characterId,
            classType: stats.classType,
            light: stats.light,
            emblemPath: stats.emblemPath,
            emblemBackgroundPath: stats.emblemBackgroundPath,
            dateLastPlayed: '',
        }] : [];
    }, [allCharacters, stats]);
    
    const selectedLoadoutCharacter = useMemo(() => {
        return (
            loadoutCharacterFilters.find((character) => character.characterId === selectedCharacterId) ||
            loadoutCharacterFilters.find((character) => character.classType === selectedClass)
        );
    }, [loadoutCharacterFilters, selectedCharacterId, selectedClass]);
    
    const selectedCharacterInGameLoadouts = useMemo(() => {
        if (!selectedLoadoutCharacter?.characterId) return [];
        
        const inGameLoadouts = profile?.characterLoadouts?.data?.[selectedLoadoutCharacter.characterId]?.loadouts ?? [];
        return inGameLoadouts.filter(isNonEmptyInGameLoadout);
    }, [profile, selectedLoadoutCharacter?.characterId]);
    
    const profileItemByInstanceId = useMemo(() => {
        const itemByInstanceId = new Map<string, any>();
        const profileItems = [
            ...Object.values(profile?.characterInventories?.data || {}).flatMap((characterInventory: any) => characterInventory.items),
            ...Object.values(profile?.characterEquipment?.data || {}).flatMap((characterEquipment: any) => characterEquipment.items),
            ...(profile?.profileInventory?.data?.items || []),
        ];
        
        profileItems.forEach((item: any) => {
            if (item.itemInstanceId) {
                itemByInstanceId.set(String(item.itemInstanceId), item);
            }
        });
        
        return itemByInstanceId;
    }, [profile]);
    
    const sourceFilteredLoadoutEntries = useMemo<DisplayedLoadoutEntry[]>(() => {
        const siteEntries: DisplayedLoadoutEntry[] = siteLoadoutsForSelectedCharacter.map((loadout) => ({
            source: 'site',
            id: `site-${loadout.id}`,
            loadout,
            sortName: loadout.name,
            updatedAt: loadout.updatedAt,
        }));
        const inGameEntries: DisplayedLoadoutEntry[] = selectedCharacterInGameLoadouts.map((loadout: any, index: number) => ({
            source: 'ingame',
            id: `ingame-${selectedLoadoutCharacter?.characterId}-${index}`,
            loadout,
            index,
            sortName: `In-game Loadout ${index + 1}`,
        }));
        
        return [...siteEntries, ...inGameEntries].filter((entry) => (
            loadoutSourceFilter === 'all' || entry.source === loadoutSourceFilter
        ));
    }, [
        loadoutSourceFilter,
        selectedCharacterInGameLoadouts,
        selectedLoadoutCharacter?.characterId,
        siteLoadoutsForSelectedCharacter,
    ]);
    
    const loadoutSearchDefinitionHashes = useMemo(() => {
        const hashes = new Set<number>();
        
        sourceFilteredLoadoutEntries.forEach((entry) => {
            if (entry.source === 'site') {
                collectSiteLoadoutDefinitionHashes(entry.loadout).forEach((hash) => hashes.add(hash));
                return;
            }
            
            collectInGameLoadoutDefinitionHashes(entry.loadout, profileItemByInstanceId).forEach((hash) => hashes.add(hash));
        });
        
        return Array.from(hashes);
    }, [profileItemByInstanceId, sourceFilteredLoadoutEntries]);
    const { definitions: loadoutSearchDefinitions } = useItemDefinitions(loadoutSearchDefinitionHashes);
    const { table: loadoutNameDefinitionsForSearch } = useManifestTable<any>("DestinyLoadoutNameDefinition");
    const { table: sandboxPerkDefinitionsForSearch } = useManifestTable<any>("DestinySandboxPerkDefinition");
    
    const displayedLoadoutEntries = useMemo<DisplayedLoadoutEntry[]>(() => {
        const normalizedSearchQuery = loadoutSearchQuery.trim();
        const searchFilteredEntries = normalizedSearchQuery
            ? sourceFilteredLoadoutEntries.filter((entry) => {
                const searchText = entry.source === 'site'
                    ? getSiteLoadoutSearchText(
                        entry.loadout,
                        loadoutSearchDefinitions,
                        sandboxPerkDefinitionsForSearch
                    )
                    : getInGameLoadoutSearchText({
                        loadout: entry.loadout,
                        index: entry.index,
                        activeCharacterId: selectedLoadoutCharacter?.characterId || '',
                        classType: selectedLoadoutCharacter?.classType ?? selectedClass,
                        itemByInstanceId: profileItemByInstanceId,
                        itemDefinitions: loadoutSearchDefinitions,
                        loadoutNameDefinitions: loadoutNameDefinitionsForSearch,
                        sandboxPerkDefinitions: sandboxPerkDefinitionsForSearch,
                    });
                
                return matchesLoadoutSearch(searchText, normalizedSearchQuery);
            })
            : sourceFilteredLoadoutEntries;
        
        return [...searchFilteredEntries].sort((firstEntry, secondEntry) => {
            if (loadoutSortMode === 'name') {
                return firstEntry.sortName.localeCompare(secondEntry.sortName);
            }
            if (loadoutSortMode === 'source') {
                return firstEntry.source.localeCompare(secondEntry.source) || firstEntry.sortName.localeCompare(secondEntry.sortName);
            }
            
            const firstTime = firstEntry.source === 'site' ? new Date(firstEntry.updatedAt).getTime() : 0;
            const secondTime = secondEntry.source === 'site' ? new Date(secondEntry.updatedAt).getTime() : 0;
            return secondTime - firstTime;
        });
    }, [
        loadouts,
        loadoutSortMode,
        loadoutSearchDefinitions,
        loadoutSearchQuery,
        loadoutNameDefinitionsForSearch,
        profileItemByInstanceId,
        sandboxPerkDefinitionsForSearch,
        selectedClass,
        selectedLoadoutCharacter?.characterId,
        selectedLoadoutCharacter?.classType,
        sourceFilteredLoadoutEntries,
    ]);
    
    const activeCharacterId = selectedLoadoutCharacter?.characterId || stats?.characterId || '';
    
    const handleSaveLoadout = (loadout: CustomLoadout) => {
        const exists = loadouts.some((l) => l.id === loadout.id);
        
        if (exists) {
            updateLoadout(loadout.id, loadout);
        } else {
            createLoadout({
                name: loadout.name,
                description: loadout.description,
                notes: loadout.notes,
                classType: loadout.classType,
                icon: loadout.icon,
                color: loadout.color,
                items: loadout.items,
                mods: loadout.mods,
                armorMods: loadout.armorMods,
                fashion: loadout.fashion,
                subclass: loadout.subclass,
                subclassConfig: loadout.subclassConfig,
                tags: loadout.tags,
                inGameId: loadout.inGameId,
            });
        }
        
        setEditingLoadout(null);
        toast.success('Loadout saved');
    };
    
    const handleImport = (loadout: CustomLoadout) => {
        importLoadouts([loadout]);
        setShowImportDialog(false);
        toast.success(`Imported "${loadout.name}"`);
        
        // Switch to the imported loadout's class
        setSelectedClass(loadout.classType);
        const matchingCharacter = loadoutCharacterFilters.find((character) => character.classType === loadout.classType);
        if (matchingCharacter) {
            setSelectedCharacterId(matchingCharacter.characterId);
        }
    };
    
    const handleExportAll = () => {
        const data = JSON.stringify(loadouts, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `warmind-loadouts-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Loadouts exported');
    };
    
    if (!mounted) return null;
    
    if (!isLoggedIn) {
        return (
            <div className="flex h-[60vh] flex-col items-center justify-center space-y-4">
                <Layers className="h-16 w-16 text-slate-600" />
                <div className="text-slate-400">Please login to manage loadouts</div>
                <LoadoutPrimaryButton onClick={() => loginWithBungie()}>
                    Login
                </LoadoutPrimaryButton>
            </div>
        );
    }
    
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="w-8 h-8 text-destiny-gold animate-spin" />
            </div>
        );
    }
    
    return (
        <div className="mx-auto w-full max-w-[96rem]">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div className="min-h-16 flex-1 overflow-hidden">
                    <div className="flex min-h-16 flex-wrap items-stretch gap-2 p-2">
                        {loadoutCharacterFilters.map((character) => {
                            const isSelected = selectedLoadoutCharacter?.characterId === character.characterId;
                            const classLoadoutCount = loadouts.filter((loadout) => loadout.classType === character.classType).length;
                            const inGameLoadoutCount = (profile?.characterLoadouts?.data?.[character.characterId]?.loadouts ?? [])
                                .filter(isNonEmptyInGameLoadout)
                                .length;
                            
                            return (
                                <button
                                    key={character.characterId}
                                    type="button"
                                    onClick={() => {
                                        setSelectedCharacterId(character.characterId);
                                        setSelectedClass(character.classType);
                                    }}
                                    className={cn(
                                        "group relative min-h-12 min-w-36 overflow-hidden px-3 py-2 text-left transition-colors",
                                        isSelected
                                            ? "text-destiny-gold"
                                            : "text-slate-300 hover:text-white"
                                    )}
                                    title={`${CLASS_NAMES[character.classType]} loadouts`}
                                >
                                    {character.emblemBackgroundPath && (
                                        <Image
                                            src={character.emblemBackgroundPath}
                                            alt=""
                                            fill
                                            sizes="160px"
                                            className="object-cover opacity-35 transition-opacity group-hover:opacity-45"
                                        />
                                    )}
                                    <span className="absolute inset-0 bg-black/60" />
                                    <span
                                        className={cn(
                                            "absolute inset-y-2 left-0 w-0.5 transition-colors",
                                            isSelected ? "bg-destiny-gold" : "bg-transparent"
                                        )}
                                    />
                                    <span className="relative flex flex-col leading-none">
                                        <span className="text-sm font-bold uppercase tracking-wide drop-shadow-md">
                                            {CLASS_NAMES[character.classType]}
                                        </span>
                                        <span className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">
                                            {classLoadoutCount + inGameLoadoutCount} loadout{classLoadoutCount + inGameLoadoutCount === 1 ? '' : 's'}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
                
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <div className="flex h-8 items-center border border-white/10 p-0.5" aria-label="Loadout source filter">
                        {([
                            ['ingame', 'Game'],
                            ['all', 'All'],
                            ['site', 'Local'],
                        ] as const).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setLoadoutSourceFilter(value)}
                                className={cn(
                                    "h-6 px-3 text-[10px] font-bold uppercase tracking-wider transition-colors",
                                    loadoutSourceFilter === value
                                        ? "bg-destiny-gold/15 text-destiny-gold"
                                        : "text-slate-500 hover:text-white"
                                )}
                                aria-pressed={loadoutSourceFilter === value}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setIsLoadoutSearchOpen((isOpen) => !isOpen)}
                            className={cn(
                                "inline-flex h-8 w-8 items-center justify-center transition-colors",
                                isLoadoutSearchOpen || loadoutSearchQuery
                                    ? "bg-white/10 text-destiny-gold"
                                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                            )}
                            title="Search loadouts"
                            aria-label="Search loadouts"
                            aria-expanded={isLoadoutSearchOpen}
                        >
                            <Search className="h-5 w-5" />
                        </button>
                        
                        {isLoadoutSearchOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsLoadoutSearchOpen(false)} />
                                <div className="absolute right-0 top-full z-50 mt-3 w-[min(24rem,calc(100vw-2rem))] border border-white/10 bg-[#0b0f14]/95 p-3 shadow-2xl shadow-black/70 backdrop-blur-xl">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                        <input
                                            ref={loadoutSearchInputRef}
                                            type="text"
                                            value={loadoutSearchQuery}
                                            onChange={(event) => setLoadoutSearchQuery(event.target.value)}
                                            placeholder="Search loadouts, items, tags, perks..."
                                            className="w-full border border-white/10 bg-black/45 py-2.5 pl-9 pr-9 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-destiny-gold/60"
                                        />
                                        {loadoutSearchQuery && (
                                            <button
                                                type="button"
                                                onClick={() => setLoadoutSearchQuery('')}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 transition-colors hover:text-white"
                                                title="Clear search"
                                                aria-label="Clear search"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                        
                        {loadoutSearchQuery && !isLoadoutSearchOpen && (
                            <button
                                type="button"
                                onClick={() => setLoadoutSearchQuery('')}
                                className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-900 text-slate-500 transition-colors hover:text-white"
                                title="Clear search"
                                aria-label="Clear search"
                            >
                                <X className="h-2.5 w-2.5" />
                            </button>
                        )}
                    </div>
                </div>
                
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setShowImportDialog(true)}
                        className="inline-flex h-8 w-8 items-center justify-center text-slate-400 transition-colors hover:text-white"
                        title="Import loadouts"
                        aria-label="Import loadouts"
                    >
                        <Download className="h-5 w-5" />
                    </button>
                    <button
                        type="button"
                        onClick={handleExportAll}
                        disabled={loadouts.length === 0}
                        className="inline-flex h-8 w-8 items-center justify-center text-slate-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                        title="Export all loadouts"
                        aria-label="Export all loadouts"
                    >
                        <Upload className="h-5 w-5" />
                    </button>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setShowLoadoutSettings((isOpen) => !isOpen)}
                            className={cn(
                                "inline-flex h-8 w-8 items-center justify-center text-slate-400 transition-colors hover:text-white",
                                showLoadoutSettings && "text-destiny-gold"
                            )}
                            title="Loadout sort"
                            aria-label="Loadout sort"
                            aria-expanded={showLoadoutSettings}
                        >
                            <Settings2 className="h-5 w-5" />
                        </button>
                        
                        {showLoadoutSettings && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowLoadoutSettings(false)} />
                                <div className="absolute right-0 top-full z-50 mt-3 w-64 border border-white/10 bg-[#0b0f14]/95 p-3 shadow-2xl shadow-black/70 backdrop-blur-xl">
                                    <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                        Loadout Settings
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                            Sort
                                        </div>
                                        {([
                                            ['updated', 'Recently updated'],
                                            ['name', 'Name'],
                                            ['source', 'Source'],
                                        ] as const).map(([value, label]) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => setLoadoutSortMode(value)}
                                                className={cn(
                                                    "flex w-full items-center justify-between px-2 py-1.5 text-sm transition-colors",
                                                    loadoutSortMode === value
                                                        ? "bg-destiny-gold/10 text-destiny-gold"
                                                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                                                )}
                                            >
                                                {label}
                                                {loadoutSortMode === value && <Check className="h-3.5 w-3.5" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => setEditingLoadout('new')}
                        className="inline-flex h-8 w-8 items-center justify-center text-destiny-gold transition-colors hover:text-white"
                        title="New loadout"
                        aria-label="New loadout"
                    >
                        <Plus className="h-5 w-5" />
                    </button>
                </div>
            </div>
            
            {/* Loadouts Grid */}
            {displayedLoadoutEntries.length === 0 ? (
                <FrostedCard className="py-16 text-center">
                    <Layers className="mx-auto mb-4 h-12 w-12 text-slate-600" />
                    <h3 className="mb-2 text-lg font-medium text-slate-400">
                        {loadoutSearchQuery.trim() ? 'No matching loadouts' : 'No loadouts yet'}
                    </h3>
                    <p className="mb-4 text-sm text-slate-600">
                        {loadoutSearchQuery.trim()
                            ? `No loadouts match "${loadoutSearchQuery.trim()}".`
                            : `No ${loadoutSourceFilter === 'all' ? '' : `${loadoutSourceFilter === 'site' ? 'in-site' : 'in-game'} `}loadouts found for ${CLASS_NAMES[selectedClass]}.`}
                    </p>
                    <div className="flex items-center justify-center gap-3">
                        <LoadoutPrimaryButton onClick={() => setEditingLoadout('new')}>
                            <Plus className="w-4 h-4" />
                            Create Loadout
                        </LoadoutPrimaryButton>
                        <LoadoutGhostButton onClick={() => setShowImportDialog(true)}>
                            <Download className="w-4 h-4" />
                            Import
                        </LoadoutGhostButton>
                    </div>
                </FrostedCard>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,31rem),1fr))] gap-4">
                    {displayedLoadoutEntries.map((entry) => (
                        entry.source === 'site' ? (
                            <LoadoutCard
                                key={entry.id}
                                loadout={entry.loadout}
                                profile={profile}
                                membershipInfo={membershipInfo}
                                activeCharacterId={activeCharacterId}
                                onEdit={() => setEditingLoadout(entry.loadout)}
                                onShare={() => setSharingLoadout(entry.loadout)}
                            />
                        ) : (
                            <InGameLoadoutCard
                                key={entry.id}
                                loadout={entry.loadout}
                                index={entry.index}
                                classType={selectedLoadoutCharacter?.classType ?? selectedClass}
                                activeCharacterId={activeCharacterId}
                                membershipInfo={membershipInfo}
                                profile={profile}
                            />
                        )
                    ))}
                </div>
            )}
            
            {/* Editor Modal */}
            {editingLoadout && (
                <LoadoutEditor
                    loadout={editingLoadout === 'new' ? null : editingLoadout}
                    classType={selectedClass}
                    profile={profile}
                    onSave={handleSaveLoadout}
                    onCancel={() => setEditingLoadout(null)}
                />
            )}
            
            {/* Share Dialog */}
            {sharingLoadout && (
                <ShareDialog
                    loadout={sharingLoadout}
                    onClose={() => setSharingLoadout(null)}
                />
            )}
            
            {/* Import Dialog */}
            {showImportDialog && (
                <ImportDialog
                    onImport={handleImport}
                    onClose={() => setShowImportDialog(false)}
                />
            )}
        </div>
    );
}
