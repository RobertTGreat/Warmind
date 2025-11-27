'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useDestinyProfile } from '@/hooks/useDestinyProfile';
import { useItemDefinitions } from '@/hooks/useItemDefinitions';
import { 
    useLoadoutStore, 
    LOADOUT_BUCKETS, 
    LOADOUT_ICONS, 
    LOADOUT_COLORS,
    LOADOUT_TAGS,
    DAMAGE_TYPES,
    CustomLoadout, 
    LoadoutItem,
    FashionConfig,
    ArmorModConfig,
    encodeLoadoutShareCode,
    decodeLoadoutShareCode,
    getLoadoutShareUrl,
} from '@/store/loadoutStore';
import { getBungieImage, moveItem, equipItem, insertSocketPlugFree } from '@/lib/bungie';

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
    Sparkles,
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
    CircleDot
} from 'lucide-react';

// Ability icons mapping
const ABILITY_ICONS: Record<string, React.ComponentType<any>> = {
    melee: Crosshair,
    grenade: CircleDot,
    classAbility: Shield,
    movement: Wind,
};
import { loginWithBungie } from '@/lib/bungie';

const CLASS_NAMES = ['Titan', 'Hunter', 'Warlock'];
const CLASS_ICONS: Record<number, string> = {
    0: '/class-titan.svg',
    1: '/class-hunter.svg',
    2: '/class-warlock.svg',
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
        <div className="fixed inset-0 bg-black/80 z-100 flex items-center justify-center p-4" onClick={onClose}>
            <div 
                className="bg-gray-800/20 backdrop-blur-xl border border-white/10 w-full max-w-lg rounded-lg overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <Share2 className="w-5 h-5 text-destiny-gold" />
                        <h3 className="text-lg font-bold text-white">Share Loadout</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>
                
                <div className="p-4 space-y-4">
                    {/* Loadout Preview */}
                    <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg">
                        <span className="text-2xl">{loadout.icon}</span>
                        <div>
                            <div className="font-semibold text-white">{loadout.name}</div>
                            <div className="text-xs text-slate-500">
                                {CLASS_NAMES[loadout.classType]} • {loadout.items.length} items
                            </div>
                        </div>
                    </div>
                    
                    {/* Share URL */}
                    <div>
                        <label className="text-xs uppercase font-bold text-slate-500 mb-2 block tracking-wider">
                            Share Link
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                readOnly
                                value={shareUrl}
                                className="flex-1 bg-black/40 border border-white/10 px-3 py-2 text-sm text-slate-300 rounded-lg truncate"
                            />
                            <button
                                onClick={() => handleCopy('url')}
                                className={cn(
                                    "px-4 py-2 font-medium text-sm rounded-lg transition-all flex items-center gap-2",
                                    copied === 'url' 
                                        ? "bg-green-500/20 text-green-400" 
                                        : "bg-destiny-gold/20 text-destiny-gold hover:bg-destiny-gold/30"
                                )}
                            >
                                {copied === 'url' ? <Check className="w-4 h-4" /> : <Link className="w-4 h-4" />}
                                {copied === 'url' ? 'Copied!' : 'Copy'}
                            </button>
                        </div>
                    </div>
                    
                    {/* Share Code */}
                    <div>
                        <label className="text-xs uppercase font-bold text-slate-500 mb-2 block tracking-wider">
                            Share Code
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                readOnly
                                value={shareCode}
                                className="flex-1 bg-black/40 border border-white/10 px-3 py-2 text-sm text-slate-300 font-mono rounded-lg truncate"
                            />
                            <button
                                onClick={() => handleCopy('code')}
                                className={cn(
                                    "px-4 py-2 font-medium text-sm rounded-lg transition-all flex items-center gap-2",
                                    copied === 'code' 
                                        ? "bg-green-500/20 text-green-400" 
                                        : "bg-white/10 text-white hover:bg-white/20"
                                )}
                            >
                                {copied === 'code' ? <Check className="w-4 h-4" /> : <ClipboardCopy className="w-4 h-4" />}
                                {copied === 'code' ? 'Copied!' : 'Copy'}
                            </button>
                        </div>
                        <p className="text-xs text-slate-600 mt-2">
                            Share this code with others to let them import your loadout
                        </p>
                    </div>
                </div>
            </div>
        </div>
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
        <div className="fixed inset-0 bg-black/80 z-100 flex items-center justify-center p-4" onClick={onClose}>
            <div 
                className="bg-gray-800/20 backdrop-blur-xl border border-white/10 w-full max-w-lg rounded-lg overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <Download className="w-5 h-5 text-destiny-gold" />
                        <h3 className="text-lg font-bold text-white">Import Loadout</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>
                
                <div className="p-4 space-y-4">
                    {/* Import Code Input */}
                    <div>
                        <label className="text-xs uppercase font-bold text-slate-500 mb-2 block tracking-wider">
                            Paste Share Code or Link
                        </label>
                        <textarea
                            value={importCode}
                            onChange={(e) => handleCodeChange(e.target.value)}
                            placeholder="Paste a loadout share code or URL here..."
                            className="w-full bg-black/40 border border-white/10 px-3 py-2 text-sm text-white font-mono rounded-lg h-24 resize-none focus:outline-none focus:border-destiny-gold/50"
                        />
                        {error && (
                            <p className="text-xs text-red-400 mt-1">{error}</p>
                        )}
                    </div>
                    
                    {/* Preview */}
                    {preview && (
                        <div className="p-4 bg-black/30 rounded-lg border border-white/10">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-2xl">{preview.icon}</span>
                                <div>
                                    <div className="font-semibold text-white">{preview.name}</div>
                                    <div className="text-xs text-slate-500 flex items-center gap-2">
                                        <Image src={CLASS_ICONS[preview.classType]} width={12} height={12} alt="" />
                                        {CLASS_NAMES[preview.classType]} • {preview.items.length} items
                                    </div>
                                </div>
                            </div>
                            
                            {preview.description && (
                                <p className="text-sm text-slate-400 mb-3">{preview.description}</p>
                            )}
                            
                            {preview.tags && preview.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {preview.tags.map((tag) => (
                                        <span key={tag} className="px-2 py-0.5 bg-white/10 text-xs text-slate-400 rounded">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                <div className="flex justify-end gap-3 p-4 border-t border-white/10">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={!preview}
                        className="px-6 py-2 bg-destiny-gold text-slate-900 font-bold text-sm uppercase tracking-wider hover:bg-white transition-colors rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download className="w-4 h-4" />
                        Import Loadout
                    </button>
                </div>
            </div>
        </div>
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
    
    // Gather all items from the bucket
    const allItems = useMemo(() => {
        const charItems = Object.values(profile?.characterInventories?.data || {}).flatMap((c: any) => c.items);
        const equipItems = Object.values(profile?.characterEquipment?.data || {}).flatMap((c: any) => c.items);
        const vaultItems = profile?.profileInventory?.data?.items || [];
        
        return [...charItems, ...equipItems, ...vaultItems];
    }, [profile]);
    
    const itemHashes = useMemo(() => allItems.map((i: any) => i.itemHash), [allItems]);
    const { definitions, isLoading } = useItemDefinitions(itemHashes);
    
    // Filter items by bucket and class
    const filteredItems = useMemo(() => {
        return allItems.filter((item: any) => {
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
    }, [allItems, definitions, bucketHash, classType, searchQuery]);
    
    const handleSelect = (item: any) => {
        const def = definitions[item.itemHash];
        onSelect({
            itemHash: item.itemHash,
            itemInstanceId: item.itemInstanceId,
            bucketHash: def?.inventory?.bucketTypeHash || bucketHash,
        });
    };
    
    return (
        <div className="fixed inset-0 bg-black/80 z-110 flex items-center justify-center p-4" onClick={onClose}>
            <div 
                className="bg-gray-800/20 backdrop-blur-xl border border-white/10 w-full max-w-4xl max-h-[80vh] flex flex-col rounded-lg overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h3 className="text-lg font-bold text-white">Select Item</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>
                
                {/* Search */}
                <div className="p-4 border-b border-white/10">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search items..."
                            className="w-full bg-black/40 border border-white/10 py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-destiny-gold/50 rounded-lg"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>
                
                {/* Items Grid */}
                <div className="flex-1 overflow-y-auto p-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-destiny-gold animate-spin" />
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            No items found
                        </div>
                    ) : (
                        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 gap-y-7">
                            {filteredItems.map((item: any, idx: number) => (
                                <button
                                    key={`${item.itemInstanceId || item.itemHash}-${idx}`}
                                    onClick={() => handleSelect(item)}
                                    className="w-16 h-16 hover:scale-105 transition-transform"
                                >
                                    <DestinyItemCard
                                        itemHash={item.itemHash}
                                        itemInstanceId={item.itemInstanceId}
                                        instanceData={profile?.itemComponents?.instances?.data?.[item.itemInstanceId]}
                                        socketsData={profile?.itemComponents?.sockets?.data?.[item.itemInstanceId]}
                                        className="w-full h-full"
                                        size="small"
                                        ownerId="picker"
                                    />
                                </button>
                            ))}
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
                    "rounded-lg bg-black/40 border border-dashed border-white/10 flex items-center justify-center",
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
                "rounded-lg overflow-hidden border border-white/10 relative",
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

// Helper to get stat name from hash
function getStatName(statHash: number): string {
    const STAT_NAMES: Record<number, string> = {
        2996146975: 'Mobility',
        392767087: 'Resilience',
        1943323491: 'Recovery',
        1735777505: 'Discipline',
        144602215: 'Intellect',
        4244567218: 'Strength',
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

interface LoadoutCardProps {
    loadout: CustomLoadout;
    profile: any;
    membershipInfo: any;
    activeCharacterId: string;
    onEdit: () => void;
    onShare: () => void;
}

function LoadoutCard({ loadout, profile, membershipInfo, activeCharacterId, onEdit, onShare }: LoadoutCardProps) {
    const { deleteLoadout, duplicateLoadout } = useLoadoutStore();
    const [isEquipping, setIsEquipping] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    
    const itemHashes = useMemo(() => loadout.items.map((i) => i.itemHash), [loadout.items]);
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
    
    // Group items by category
    const weaponItems = loadout.items.filter((i) => 
        [BUCKETS.KINETIC_WEAPON, BUCKETS.ENERGY_WEAPON, BUCKETS.POWER_WEAPON].includes(i.bucketHash)
    );
    const armorItems = loadout.items.filter((i) =>
        [BUCKETS.HELMET, BUCKETS.GAUNTLETS, BUCKETS.CHEST_ARMOR, BUCKETS.LEG_ARMOR, BUCKETS.CLASS_ARMOR].includes(i.bucketHash)
    );
    
    // Subclass data
    const subclassConfig = loadout.subclassConfig;
    const damageType = subclassConfig?.damageType;
    const aspects = subclassConfig?.aspects || [];
    const fragments = subclassConfig?.fragments || [];
    
    // Split fragments between aspects (3 each)
    const aspect1Fragments = fragments.slice(0, 3);
    const aspect2Fragments = fragments.slice(3, 6);
    
    return (
        <div 
            className="bg-gray-800/20 border border-white/5 overflow-hidden hover:border-white/20 transition-all"
            style={{ borderLeftColor: loadout.color, borderLeftWidth: '3px' }}
        >
            {/* Header */}
            <div className="flex items-center gap-3 p-4">
                <span className="text-2xl">{loadout.icon}</span>
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white truncate">{loadout.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Image src={CLASS_ICONS[loadout.classType]} width={12} height={12} alt="" />
                        <span>{CLASS_NAMES[loadout.classType]}</span>
                        <span>•</span>
                        <span>{loadout.items.length} items</span>
                        {loadout.importedFrom && (
                            <>
                                <span>•</span>
                                <Import className="w-3 h-3" />
                            </>
                        )}
                    </div>
                </div>
                
                {/* More Menu */}
                <div className="relative">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                    
                    {showMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                            <div className="absolute right-0 top-full mt-1 z-50 bg-gray-800/20 backdrop-blur-xl border border-white/10 shadow-xl py-1 min-w-[140px]">
                                <button
                                    onClick={() => { onShare(); setShowMenu(false); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white"
                                >
                                    <Share2 className="w-4 h-4" />
                                    Share
                                </button>
                                <button
                                    onClick={handleDuplicate}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white"
                                >
                                    <Copy className="w-4 h-4" />
                                    Duplicate
                                </button>
                                <button
                                    onClick={() => { onEdit(); setShowMenu(false); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white"
                                >
                                    <Edit3 className="w-4 h-4" />
                                    Edit
                                </button>
                                <div className="border-t border-white/10 my-1" />
                                <button
                                    onClick={() => { handleDelete(); setShowMenu(false); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
            
            {/* Tags */}
            {loadout.tags && loadout.tags.length > 0 && (
                <div className="px-4 pb-2 flex flex-wrap gap-1">
                    {loadout.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="px-2 py-0.5 bg-white/5 text-[10px] text-slate-400 rounded uppercase tracking-wider">
                            {tag}
                        </span>
                    ))}
                    {loadout.tags.length > 3 && (
                        <span className="px-2 py-0.5 text-[10px] text-slate-500">
                            +{loadout.tags.length - 3}
                        </span>
                    )}
                </div>
            )}
            
            {/* Items Preview - New Layout */}
            <div className="p-4 space-y-3">
                {/* Weapons Row */}
                <div>
                    <div className="text-[10px] uppercase font-bold text-slate-600 mb-1.5 tracking-wider">Weapons</div>
                    <div className="flex gap-1.5">
                        {[BUCKETS.KINETIC_WEAPON, BUCKETS.ENERGY_WEAPON, BUCKETS.POWER_WEAPON].map((bucket) => {
                            const item = weaponItems.find(i => i.bucketHash === bucket);
                            const instanceId = item?.itemInstanceId || '';
                            const instanceData = profile?.itemComponents?.instances?.data?.[instanceId];
                            const socketsData = profile?.itemComponents?.sockets?.data?.[instanceId];
                            const reusablePlugs = profile?.itemComponents?.reusablePlugs?.data?.[instanceId]?.plugs;
                            const statsData = profile?.itemComponents?.stats?.data?.[instanceId]?.stats;
                            const hasOverrides = item?.socketOverrides && Object.keys(item.socketOverrides).length > 0;
                            
                            return (
                                <div key={bucket} className={cn(
                                    "w-11 h-11 bg-black/30 border border-white/5 rounded relative",
                                    hasOverrides && "ring-1 ring-destiny-gold/40"
                                )}>
                                    {item && (
                                        <>
                                            <DestinyItemCard
                                                itemHash={item.itemHash}
                                                itemInstanceId={item.itemInstanceId}
                                                instanceData={instanceData ? { ...instanceData, stats: statsData } : undefined}
                                                socketsData={socketsData}
                                                reusablePlugs={reusablePlugs}
                                                className="w-full h-full"
                                                size="small"
                                                hidePower
                                            />
                                            {hasOverrides && (
                                                <div className="absolute -top-0.5 -left-0.5 w-2.5 h-2.5 bg-destiny-gold rounded-full" title="Custom perks" />
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
                
                {/* Armor Row */}
                <div>
                    <div className="text-[10px] uppercase font-bold text-slate-600 mb-1.5 tracking-wider">Armor</div>
                    <div className="flex gap-1.5">
                        {[BUCKETS.HELMET, BUCKETS.GAUNTLETS, BUCKETS.CHEST_ARMOR, BUCKETS.LEG_ARMOR, BUCKETS.CLASS_ARMOR].map((bucket) => {
                            const item = armorItems.find(i => i.bucketHash === bucket);
                            const instanceId = item?.itemInstanceId || '';
                            const instanceData = profile?.itemComponents?.instances?.data?.[instanceId];
                            const socketsData = profile?.itemComponents?.sockets?.data?.[instanceId];
                            const reusablePlugs = profile?.itemComponents?.reusablePlugs?.data?.[instanceId]?.plugs;
                            const statsData = profile?.itemComponents?.stats?.data?.[instanceId]?.stats;
                            const hasOverrides = item?.socketOverrides && Object.keys(item.socketOverrides).length > 0;
                            
                            return (
                                <div key={bucket} className={cn(
                                    "w-11 h-11 bg-black/30 border border-white/5 rounded relative",
                                    hasOverrides && "ring-1 ring-destiny-gold/40"
                                )}>
                                    {item && (
                                        <>
                                            <DestinyItemCard
                                                itemHash={item.itemHash}
                                                itemInstanceId={item.itemInstanceId}
                                                instanceData={instanceData ? { ...instanceData, stats: statsData } : undefined}
                                                socketsData={socketsData}
                                                reusablePlugs={reusablePlugs}
                                                className="w-full h-full"
                                                size="small"
                                                hidePower
                                            />
                                            {hasOverrides && (
                                                <div className="absolute -top-0.5 -left-0.5 w-2.5 h-2.5 bg-destiny-gold rounded-full" title="Custom mods" />
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
                
                {/* Subclass Section */}
                {(subclassConfig || true) && (
                    <div className="border-t border-white/5 pt-3 mt-3">
                        {/* Super */}
                        <div className="flex items-center gap-3 mb-3">
                            <div>
                                <div className="text-[10px] uppercase font-bold text-slate-600 mb-1 tracking-wider">Super</div>
                                <SubclassSlot 
                                    plugHash={subclassConfig?.super?.plugHash} 
                                    label="Super" 
                                    size="medium"
                                    damageType={damageType}
                                />
                            </div>
                            {damageType && (
                                <div className="flex items-center gap-1.5 text-xs" style={{ color: DAMAGE_TYPES[damageType]?.color }}>
                                    {DAMAGE_TYPES[damageType]?.apiIcon && (
                                        <Image 
                                            src={DAMAGE_TYPES[damageType].apiIcon!} 
                                            width={14} 
                                            height={14} 
                                            alt="" 
                                        />
                                    )}
                                    <span className="font-medium">{DAMAGE_TYPES[damageType]?.name}</span>
                                </div>
                            )}
                        </div>
                        
                        {/* Aspect 1 + Fragments */}
                        <div className="flex items-center gap-2 mb-2">
                            <SubclassSlot 
                                plugHash={aspects[0]?.plugHash} 
                                label="Aspect 1" 
                                size="medium"
                                damageType={damageType}
                            />
                            <div className="h-px w-2 bg-white/10" />
                            <FragmentRow fragments={aspect1Fragments} damageType={damageType} />
                        </div>
                        
                        {/* Aspect 2 + Fragments */}
                        <div className="flex items-center gap-2">
                            <SubclassSlot 
                                plugHash={aspects[1]?.plugHash} 
                                label="Aspect 2" 
                                size="medium"
                                damageType={damageType}
                            />
                            <div className="h-px w-2 bg-white/10" />
                            <FragmentRow fragments={aspect2Fragments} damageType={damageType} />
                        </div>
                    </div>
                )}
                
                {loadout.items.length === 0 && !subclassConfig && (
                    <div className="text-sm text-slate-600 italic py-2">No items assigned</div>
                )}
            </div>
            
            {/* Actions */}
            <div className="flex border-t border-white/5">
                <button
                    onClick={handleEquip}
                    disabled={isEquipping || loadout.items.length === 0}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-destiny-gold hover:bg-linear-to-r from-destiny-gold/20 to-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isEquipping ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Play className="w-4 h-4" />
                    )}
                    Equip
                </button>
            </div>
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
        5: 2453351420, // Prismatic
    },
    // Hunter (classType 1)
    1: {
        2: 2328211300, // Arc - Arcstrider
        3: 2240888816, // Solar - Gunslinger
        4: 2453866490, // Void - Nightstalker
        6: 873720784,  // Stasis - Revenant
        7: 3785442599, // Strand - Threadrunner
        5: 2375107888, // Prismatic
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

interface SubclassPickerProps {
    slotType: 'super' | 'aspect' | 'fragment' | 'melee' | 'grenade' | 'classAbility' | 'movement';
    slotIndex?: number;
    classType: number;
    damageType?: number;
    profile: any;
    onSelect: (plugHash: number, name?: string, icon?: string, fragmentSlots?: number) => void;
    onClose: () => void;
    selectedFragments?: number[]; // Already selected fragment hashes to exclude
    selectedAspects?: number[]; // Already selected aspect hashes to exclude
}

function SubclassPicker({ slotType, slotIndex, classType, damageType, profile, onSelect, onClose, selectedFragments = [], selectedAspects = [] }: SubclassPickerProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [allPlugHashes, setAllPlugHashes] = useState<number[]>([]);
    
    // Get the expected subclass hash for this class and damage type
    const expectedSubclassHash = damageType ? SUBCLASS_HASHES[classType]?.[damageType] : null;
    
    // First, fetch the subclass definition to get plug set hashes
    const { definitions: subclassDefs, isLoading: subclassDefsLoading } = useItemDefinitions(
        expectedSubclassHash ? [expectedSubclassHash] : []
    );
    const subclassDef = expectedSubclassHash ? subclassDefs[expectedSubclassHash] : null;
    
    // Extract all plug set hashes from the subclass definition
    const plugSetHashes = useMemo(() => {
        if (!subclassDef?.sockets?.socketEntries) return [];
        
        const hashes: number[] = [];
        subclassDef.sockets.socketEntries.forEach((entry: any) => {
            if (entry.reusablePlugSetHash) {
                hashes.push(entry.reusablePlugSetHash);
            }
            if (entry.randomizedPlugSetHash) {
                hashes.push(entry.randomizedPlugSetHash);
            }
        });
        return [...new Set(hashes)];
    }, [subclassDef]);
    
    // Fetch plug set definitions
    const [plugSets, setPlugSets] = useState<Record<number, any>>({});
    const [plugSetsLoading, setPlugSetsLoading] = useState(false);
    
    useEffect(() => {
        if (plugSetHashes.length === 0) return;
        
        const fetchPlugSets = async () => {
            setPlugSetsLoading(true);
            const results: Record<number, any> = {};
            
            // Fetch each plug set definition
            for (const hash of plugSetHashes) {
                try {
                    const response = await fetch(`https://www.bungie.net/Platform/Destiny2/Manifest/DestinyPlugSetDefinition/${hash}/`, {
                        headers: { 'X-API-Key': process.env.NEXT_PUBLIC_BUNGIE_API_KEY || '' }
                    });
                    const data = await response.json();
                    if (data.Response) {
                        results[hash] = data.Response;
                    }
                } catch (e) {
                    console.warn(`Failed to fetch plug set ${hash}:`, e);
                }
            }
            
            setPlugSets(results);
            setPlugSetsLoading(false);
        };
        
        fetchPlugSets();
    }, [plugSetHashes]);
    
    // Extract all plug item hashes from the plug sets
    useEffect(() => {
        if (Object.keys(plugSets).length === 0) return;
        
        const hashes = new Set<number>();
        
        Object.values(plugSets).forEach((plugSet: any) => {
            if (plugSet?.reusablePlugItems) {
                plugSet.reusablePlugItems.forEach((item: any) => {
                    if (item.plugItemHash) {
                        hashes.add(item.plugItemHash);
                    }
                });
            }
        });
        
        setAllPlugHashes(Array.from(hashes));
    }, [plugSets]);
    
    // Fetch all plug definitions
    const { definitions: plugDefs, isLoading: plugDefsLoading } = useItemDefinitions(allPlugHashes);
    
    // Find the subclass instance for socket index mapping
    const subclassInstanceData = useMemo(() => {
        if (!profile || !damageType) return { subclassInstanceId: null, socketsData: null, reusablePlugs: null };
        
        const characters = profile.characters?.data || {};
        const characterEquipment = profile.characterEquipment?.data || {};
        const characterInventories = profile.characterInventories?.data || {};
        
        let subclassInstanceId: string | null = null;
        
        // Look through all characters of the matching class type
        Object.entries(characters).forEach(([charId, char]: [string, any]) => {
            if (char?.classType !== classType) return;
            
            const equippedItems = characterEquipment[charId]?.items || [];
            const inventoryItems = characterInventories[charId]?.items || [];
            const allCharItems = [...equippedItems, ...inventoryItems];
            
            allCharItems.forEach((item: any) => {
                if (item.bucketHash !== BUCKETS.SUBCLASS) return;
                if (expectedSubclassHash && item.itemHash === expectedSubclassHash) {
                    subclassInstanceId = item.itemInstanceId;
                }
            });
        });
        
        const socketsData = subclassInstanceId ? profile.itemComponents?.sockets?.data?.[subclassInstanceId] : null;
        const reusablePlugs = subclassInstanceId ? profile.itemComponents?.reusablePlugs?.data?.[subclassInstanceId]?.plugs : null;
        
        return { subclassInstanceId, socketsData, reusablePlugs };
    }, [profile, classType, damageType, expectedSubclassHash]);
    
    // Build socket index mapping from subclass definition
    const socketIndexMap = useMemo(() => {
        if (!subclassDef?.sockets?.socketEntries) return new Map<number, number>();
        
        const map = new Map<number, number>();
        
        subclassDef.sockets.socketEntries.forEach((entry: any, idx: number) => {
            // Map plug set hash to socket index
            if (entry.reusablePlugSetHash) {
                const plugSet = plugSets[entry.reusablePlugSetHash];
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
    }, [subclassDef, plugSets]);
    
    // Helper to categorize plugs
    const getPlugCategory = useCallback((def: any): string => {
        const identifier = def.plug?.plugCategoryIdentifier?.toLowerCase() || '';
        const typeDisplay = def.itemTypeDisplayName?.toLowerCase() || '';
        const name = def.displayProperties?.name?.toLowerCase() || '';
        
        // Check for supers (usually contains "supers" in identifier or itemType)
        if (identifier.includes('supers') || typeDisplay === 'super') {
            return 'super';
        }
        
        // Check for aspects
        if (identifier.includes('aspects') || typeDisplay === 'aspect') {
            return 'aspect';
        }
        
        // Check for fragments (for Prismatic, these are "Facet of X")
        if (identifier.includes('fragments') || typeDisplay === 'fragment' || name.startsWith('facet of')) {
            return 'fragment';
        }
        
        // Check for grenades
        if (identifier.includes('grenade') || typeDisplay.includes('grenade')) {
            return 'grenade';
        }
        
        // Check for melee abilities
        if (identifier.includes('melee') || typeDisplay.includes('melee')) {
            return 'melee';
        }
        
        // Check for class abilities (rift, barricade, dodge)
        if (identifier.includes('class_abilities') || 
            typeDisplay.includes('class ability') ||
            name.includes('rift') || name.includes('barricade') || name.includes('dodge')) {
            return 'classAbility';
        }
        
        // Check for movement abilities (jump, glide, lift)
        if (identifier.includes('movement') || identifier.includes('jump') ||
            typeDisplay.includes('jump') || typeDisplay.includes('glide') || typeDisplay.includes('lift')) {
            return 'movement';
        }
        
        return 'unknown';
    }, []);
    
    // Filter plugs based on slot type and search - now using ALL plugs from plug sets
    const filteredPlugs = useMemo(() => {
        // Use all plug hashes we fetched from the plug sets
        return allPlugHashes.filter(plugHash => {
            const def = plugDefs[plugHash];
            if (!def) return false;
            
            // Get the category of this plug
            const plugCategory = getPlugCategory(def);
            
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
    }, [allPlugHashes, plugDefs, searchQuery, slotType, getPlugCategory, socketIndexMap, selectedFragments, selectedAspects]);
    
    const isLoading = subclassDefsLoading || plugSetsLoading || plugDefsLoading;
    
    const damageColor = damageType === 5 ? '#e878e8' : (damageType ? DAMAGE_TYPES[damageType]?.color : '#888');
    
    return (
        <div className="fixed inset-0 bg-black/80 z-110 flex items-center justify-center p-4" onClick={onClose}>
            <div 
                className="bg-gray-800/20 backdrop-blur-xl border border-white/10 w-full max-w-2xl max-h-[70vh] flex flex-col overflow-hidden"
                style={{ borderColor: `${damageColor}30` }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        {damageType && DAMAGE_TYPES[damageType]?.apiIcon && (
                            <Image src={DAMAGE_TYPES[damageType].apiIcon!} width={24} height={24} alt="" />
                        )}
                        <h3 className="text-lg font-bold text-white capitalize">
                            Select {slotType} {slotIndex !== undefined ? slotIndex + 1 : ''}
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>
                
                {/* Search */}
                <div className="p-4 border-b border-white/10">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder={`Search ${slotType}s...`}
                            className="w-full bg-black/40 border border-white/10 py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-destiny-gold/50"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>
                
                {/* Options Grid */}
                <div className="flex-1 overflow-y-auto p-4">
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
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                            {filteredPlugs.map((plug) => (
                                <button
                                    key={`${plug.socketIndex}-${plug.plugHash}`}
                                    onClick={() => {
                                        onSelect(plug.plugHash, plug.def?.displayProperties?.name, plug.def?.displayProperties?.icon, plug.fragmentSlots);
                                        onClose();
                                    }}
                                    className="group flex flex-col items-center gap-2 p-2 bg-black/30 border border-white/10 hover:border-destiny-gold/50 hover:bg-black/50 transition-all relative"
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
                            ))}
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
    type: 'super' | 'aspect' | 'fragment' | 'melee' | 'grenade' | 'classAbility' | 'movement';
    index?: number;
} | null;

function LoadoutEditor({ loadout, classType, profile, onSave, onCancel }: LoadoutEditorProps) {
    const generateId = () => `loadout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const [editedLoadout, setEditedLoadout] = useState<CustomLoadout>(
        loadout || {
            id: generateId(),
            name: 'New Loadout',
            classType,
            icon: '⚔️',
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
    const [showTagPicker, setShowTagPicker] = useState(false);
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
    
    const getItemForBucket = (bucketHash: number) => {
        return editedLoadout.items.find((i) => i.bucketHash === bucketHash);
    };
    
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
    
    const setDamageType = (damageType: number) => {
        setEditedLoadout((prev) => ({
            ...prev,
            subclassConfig: {
                ...(prev.subclassConfig || { itemHash: 0 }),
                damageType,
            },
        }));
        setShowDamageTypePicker(false);
    };
    
    const handleSubclassSlotClick = (type: 'super' | 'aspect' | 'fragment' | 'melee' | 'grenade' | 'classAbility' | 'movement', index?: number) => {
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
    
    // Check if any popup is currently open
    const hasOpenPopup = pickerBucket !== null || subclassPicker !== null || showIconPicker || showColorPicker || showTagPicker || showDamageTypePicker || contextMenu !== null;
    
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
    
    return (
        <div className="fixed inset-0 bg-black/80 z-100 flex items-center justify-center p-4" onClick={handleBackdropClick}>
            <div 
                className="bg-gray-800/20 backdrop-blur-xl border border-white/10 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden rounded-lg"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h3 className="text-lg font-bold text-white">
                        {loadout ? 'Edit Loadout' : 'Create Loadout'}
                    </h3>
                    <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>
                
                {/* Name & Appearance Row */}
                <div className="p-4 border-b border-white/10 space-y-4">
                    <div className="flex items-center gap-4">
                        {/* Icon Picker */}
                        <div className="relative">
                            <button
                                onClick={() => setShowIconPicker(!showIconPicker)}
                                className="w-14 h-14 bg-black/40 border border-white/10 rounded-lg flex items-center justify-center text-2xl hover:border-white/30 transition-colors"
                                style={{ borderColor: editedLoadout.color }}
                            >
                                {editedLoadout.icon}
                            </button>
                            {showIconPicker && (
                                <div className="absolute top-full left-0 mt-2 p-2 bg-slate-900 border border-white/10 rounded-lg grid grid-cols-7 gap-1 z-50 shadow-xl">
                                    {LOADOUT_ICONS.map((icon) => (
                                        <button
                                            key={icon}
                                            onClick={() => {
                                                setEditedLoadout((prev) => ({ ...prev, icon }));
                                                setShowIconPicker(false);
                                            }}
                                            className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded text-lg"
                                        >
                                            {icon}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        {/* Name Input */}
                        <input
                            type="text"
                            value={editedLoadout.name}
                            onChange={(e) => setEditedLoadout((prev) => ({ ...prev, name: e.target.value }))}
                            className="flex-1 bg-black/40 border border-white/10 px-4 py-3 text-white text-lg font-bold focus:outline-none focus:border-destiny-gold/50 rounded-lg"
                            placeholder="Loadout Name"
                        />
                        
                        {/* Color Picker */}
                        <div className="relative">
                            <button
                                onClick={() => setShowColorPicker(!showColorPicker)}
                                className="w-10 h-10 rounded-lg border-2 border-white/20"
                                style={{ backgroundColor: editedLoadout.color }}
                            />
                            {showColorPicker && (
                                <div className="absolute top-full right-0 mt-2 p-2 bg-slate-900 border border-white/10 rounded-lg flex gap-1 z-50 shadow-xl">
                                    {LOADOUT_COLORS.map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => {
                                                setEditedLoadout((prev) => ({ ...prev, color }));
                                                setShowColorPicker(false);
                                            }}
                                            className="w-6 h-6 rounded border-2 border-white/20 hover:scale-110 transition-transform"
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Class & Tags Row */}
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Image src={CLASS_ICONS[editedLoadout.classType]} width={16} height={16} alt="" />
                            <span>{CLASS_NAMES[editedLoadout.classType]}</span>
                        </div>
                        
                        <div className="h-4 w-px bg-white/10" />
                        
                        {/* Tags */}
                        <div className="flex items-center gap-2 flex-wrap flex-1">
                            {(editedLoadout.tags || []).map((tag) => (
                                <button
                                    key={tag}
                                    onClick={() => toggleTag(tag)}
                                    className="px-2 py-0.5 bg-destiny-gold/20 text-destiny-gold text-xs rounded flex items-center gap-1 hover:bg-destiny-gold/30 transition-colors"
                                >
                                    {tag}
                                    <X className="w-3 h-3" />
                                </button>
                            ))}
                            
                            <div className="relative">
                                <button
                                    onClick={() => setShowTagPicker(!showTagPicker)}
                                    className="px-2 py-0.5 bg-white/5 text-slate-400 text-xs rounded flex items-center gap-1 hover:bg-white/10 transition-colors"
                                >
                                    <Tag className="w-3 h-3" />
                                    Add Tag
                                </button>
                                
                                {showTagPicker && (
                                    <div className="absolute top-full left-0 mt-2 p-2 bg-slate-900 border border-white/10 rounded-lg z-50 shadow-xl w-48 max-h-48 overflow-y-auto">
                                        {LOADOUT_TAGS.filter((t) => !(editedLoadout.tags || []).includes(t)).map((tag) => (
                                            <button
                                                key={tag}
                                                onClick={() => {
                                                    toggleTag(tag);
                                                    setShowTagPicker(false);
                                                }}
                                                className="w-full text-left px-2 py-1.5 text-sm text-slate-300 hover:bg-white/10 rounded"
                                            >
                                                {tag}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-6">
                            {/* Two Column Layout: Weapons Left, Armor Right */}
                            <div className="grid grid-cols-2 gap-8">
                                {/* Weapons Column (Left) */}
                                <div>
                                    <h4 className="text-xs uppercase font-bold text-slate-500 mb-3 tracking-widest">Weapons</h4>
                                    <div className="flex gap-2">
                                        {LOADOUT_BUCKETS.weapons.map((bucket) => {
                                            const item = getItemForBucket(bucket.hash);
                                            const instanceId = item?.itemInstanceId || '';
                                            const instanceData = profile?.itemComponents?.instances?.data?.[instanceId];
                                            const socketsData = profile?.itemComponents?.sockets?.data?.[instanceId];
                                            const reusablePlugs = profile?.itemComponents?.reusablePlugs?.data?.[instanceId]?.plugs;
                                            const statsData = profile?.itemComponents?.stats?.data?.[instanceId]?.stats;
                                            const hasOverrides = item?.socketOverrides && Object.keys(item.socketOverrides).length > 0;
                                            
                                            return (
                                                <div key={bucket.hash} className="relative group">
                                                    <button
                                                        onClick={() => setPickerBucket(bucket.hash)}
                                                        onContextMenu={(e) => item && handleItemContextMenu(e, item, 'weapon')}
                                                        className={cn(
                                                            "w-16 h-16 bg-black/40 border-2 border-dashed border-white/10 rounded-lg flex items-center justify-center transition-all hover:border-destiny-gold/50 hover:scale-105",
                                                            item && "border-solid border-white/20",
                                                            hasOverrides && "ring-2 ring-destiny-gold/50"
                                                        )}
                                                        title={!item ? bucket.name : 'Right-click to configure perks'}
                                                    >
                                                        {item ? (
                                                            <DestinyItemCard
                                                                itemHash={item.itemHash}
                                                                itemInstanceId={item.itemInstanceId}
                                                                instanceData={instanceData ? { ...instanceData, stats: statsData } : undefined}
                                                                socketsData={socketsData}
                                                                reusablePlugs={reusablePlugs}
                                                                className="w-full h-full"
                                                                size="medium"
                                                            />
                                                        ) : (
                                                            <span className="text-2xl opacity-50">{bucket.icon}</span>
                                                        )}
                                                    </button>
                                                    {/* Perks configured indicator */}
                                                    {hasOverrides && (
                                                        <div className="absolute -top-1 -left-1 w-4 h-4 bg-destiny-gold rounded-full flex items-center justify-center z-10" title="Perks configured">
                                                            <Settings2 className="w-2.5 h-2.5 text-slate-900" />
                                                        </div>
                                                    )}
                                                    {item && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleRemoveItem(bucket.hash); }}
                                                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                        >
                                                            <X className="w-3 h-3 text-white" />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                
                                {/* Armor Column (Right) */}
                                <div>
                                    <h4 className="text-xs uppercase font-bold text-slate-500 mb-3 tracking-widest">Armor</h4>
                                    <div className="flex gap-2">
                                        {LOADOUT_BUCKETS.armor.map((bucket) => {
                                            const item = getItemForBucket(bucket.hash);
                                            const instanceId = item?.itemInstanceId || '';
                                            const instanceData = profile?.itemComponents?.instances?.data?.[instanceId];
                                            const socketsData = profile?.itemComponents?.sockets?.data?.[instanceId];
                                            const reusablePlugs = profile?.itemComponents?.reusablePlugs?.data?.[instanceId]?.plugs;
                                            const statsData = profile?.itemComponents?.stats?.data?.[instanceId]?.stats;
                                            const hasOverrides = item?.socketOverrides && Object.keys(item.socketOverrides).length > 0;
                                            
                                            return (
                                                <div key={bucket.hash} className="relative group">
                                                    <button
                                                        onClick={() => setPickerBucket(bucket.hash)}
                                                        onContextMenu={(e) => item && handleItemContextMenu(e, item, 'armor')}
                                                        className={cn(
                                                            "w-14 h-14 bg-black/40 border-2 border-dashed border-white/10 rounded-lg flex items-center justify-center transition-all hover:border-destiny-gold/50 hover:scale-105",
                                                            item && "border-solid border-white/20",
                                                            hasOverrides && "ring-2 ring-destiny-gold/50"
                                                        )}
                                                        title={!item ? bucket.name : 'Right-click to configure mods'}
                                                    >
                                                        {item ? (
                                                            <DestinyItemCard
                                                                itemHash={item.itemHash}
                                                                itemInstanceId={item.itemInstanceId}
                                                                instanceData={instanceData ? { ...instanceData, stats: statsData } : undefined}
                                                                socketsData={socketsData}
                                                                reusablePlugs={reusablePlugs}
                                                                className="w-full h-full"
                                                                size="small"
                                                            />
                                                        ) : (
                                                            <span className="text-lg opacity-50">{bucket.icon}</span>
                                                        )}
                                                    </button>
                                                    {/* Mods configured indicator */}
                                                    {hasOverrides && (
                                                        <div className="absolute -top-1 -left-1 w-3.5 h-3.5 bg-destiny-gold rounded-full flex items-center justify-center z-10" title="Mods configured">
                                                            <Settings2 className="w-2 h-2 text-slate-900" />
                                                        </div>
                                                    )}
                                                    {item && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleRemoveItem(bucket.hash); }}
                                                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                        >
                                                            <X className="w-2.5 h-2.5 text-white" />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Subclass Section (Bottom) */}
                            <div className="border-t border-white/10 pt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-xs uppercase font-bold text-slate-500 tracking-widest">Subclass</h4>
                                    
                                    {/* Damage Type Selector - Icon Row */}
                                    <div className="flex gap-1">
                                        {[2, 3, 4, 6, 7, 5].map((dt) => (
                                            <button
                                                key={dt}
                                                onClick={() => setDamageType(dt)}
                                                className={cn(
                                                    "w-8 h-8 rounded-lg border flex items-center justify-center transition-all hover:scale-110",
                                                    damageType === dt 
                                                        ? "border-2 bg-black/60" 
                                                        : "border-white/10 bg-black/30 hover:border-white/30"
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
                                
                                <div className="space-y-4">
                                    {/* Super + Abilities Row */}
                                    <div className="flex items-center gap-3">
                                        {/* Super */}
                                        <button
                                            onClick={() => handleSubclassSlotClick('super')}
                                            className="w-14 h-14 bg-black/40 border-2 border-dashed border-white/10 rounded-lg flex items-center justify-center hover:border-destiny-gold/50 hover:scale-105 transition-all"
                                            style={{ borderColor: damageType ? `${DAMAGE_TYPES[damageType]?.color}30` : undefined }}
                                            title="Super"
                                        >
                                            {subclassConfig?.super?.plugHash ? (
                                                <SubclassSlot 
                                                    plugHash={subclassConfig.super.plugHash} 
                                                    label="Super" 
                                                    size="medium"
                                                    damageType={damageType}
                                                />
                                            ) : (
                                                <Zap className="w-6 h-6 text-slate-600" />
                                            )}
                                        </button>
                                        
                                        <div className="w-px h-10 bg-white/10" />
                                        
                                        {/* Abilities */}
                                        {(['melee', 'grenade', 'classAbility', 'movement'] as const).map((ability) => {
                                            const AbilityIcon = ABILITY_ICONS[ability] || CircleDot;
                                            const abilityConfig = subclassConfig?.abilities?.[ability];
                                            return (
                                                <button
                                                    key={ability}
                                                    onClick={() => handleSubclassSlotClick(ability)}
                                                    className="w-11 h-11 bg-black/40 border border-dashed border-white/10 rounded-lg flex items-center justify-center hover:border-destiny-gold/50 hover:scale-105 transition-all"
                                                    style={{ borderColor: damageType ? `${DAMAGE_TYPES[damageType]?.color}20` : undefined }}
                                                    title={ability.charAt(0).toUpperCase() + ability.slice(1).replace(/([A-Z])/g, ' $1')}
                                                >
                                                    {abilityConfig?.plugHash ? (
                                                        <SubclassSlot 
                                                            plugHash={abilityConfig.plugHash} 
                                                            label={ability} 
                                                            size="small"
                                                            damageType={damageType}
                                                        />
                                                    ) : (
                                                        <AbilityIcon className="w-5 h-5 text-slate-600" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    
                                    {/* Aspects Row */}
                                    <div className="flex items-start gap-4">
                                        {/* Aspect 1 */}
                                        <div className="relative group">
                                            <button
                                                onClick={() => handleSubclassSlotClick('aspect', 0)}
                                                className="w-14 h-14 bg-black/40 border-2 border-dashed border-white/10 rounded-lg flex items-center justify-center hover:border-destiny-gold/50 hover:scale-105 transition-all"
                                                style={{ borderColor: damageType ? `${DAMAGE_TYPES[damageType]?.color}30` : undefined }}
                                                title="Aspect 1"
                                            >
                                                {subclassConfig?.aspects?.[0]?.plugHash ? (
                                                    <SubclassSlot 
                                                        plugHash={subclassConfig.aspects[0].plugHash} 
                                                        label="Aspect 1" 
                                                        size="medium"
                                                        damageType={damageType}
                                                        fragmentSlots={(subclassConfig.aspects[0] as any)?.fragmentSlots}
                                                    />
                                                ) : (
                                                    <Plus className="w-5 h-5 text-slate-600" />
                                                )}
                                            </button>
                                            {subclassConfig?.aspects?.[0]?.plugHash && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveAspect(0); }}
                                                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                >
                                                    <X className="w-2.5 h-2.5 text-white" />
                                                </button>
                                            )}
                                        </div>
                                        
                                        {/* Aspect 2 */}
                                        <div className="relative group">
                                            <button
                                                onClick={() => handleSubclassSlotClick('aspect', 1)}
                                                className="w-14 h-14 bg-black/40 border-2 border-dashed border-white/10 rounded-lg flex items-center justify-center hover:border-destiny-gold/50 hover:scale-105 transition-all"
                                                style={{ borderColor: damageType ? `${DAMAGE_TYPES[damageType]?.color}30` : undefined }}
                                                title="Aspect 2"
                                            >
                                                {subclassConfig?.aspects?.[1]?.plugHash ? (
                                                    <SubclassSlot 
                                                        plugHash={subclassConfig.aspects[1].plugHash} 
                                                        label="Aspect 2" 
                                                        size="medium"
                                                        damageType={damageType}
                                                        fragmentSlots={(subclassConfig.aspects[1] as any)?.fragmentSlots}
                                                    />
                                                ) : (
                                                    <Plus className="w-5 h-5 text-slate-600" />
                                                )}
                                            </button>
                                            {subclassConfig?.aspects?.[1]?.plugHash && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveAspect(1); }}
                                                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                >
                                                    <X className="w-2.5 h-2.5 text-white" />
                                                </button>
                                            )}
                                        </div>
                                        
                                        <div className="flex-1" />
                                        
                                        {/* Fragment slot indicator */}
                                        <div className="text-right">
                                            <div className="text-[10px] uppercase font-bold text-slate-600 tracking-wider">Fragments</div>
                                            <div className="text-sm font-bold" style={{ color: damageType ? DAMAGE_TYPES[damageType]?.color : '#888' }}>
                                                {selectedFragmentHashes.length} / {totalFragmentSlots}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Fragments Row - Dynamic based on aspect slots */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {totalFragmentSlots === 0 ? (
                                            <div className="text-xs text-slate-600 italic py-2">
                                                Select aspects to unlock fragment slots
                                            </div>
                                        ) : (
                                            Array.from({ length: Math.min(totalFragmentSlots, 5) }).map((_, fragIdx) => {
                                                const fragment = subclassConfig?.fragments?.[fragIdx];
                                                const isSlotAvailable = fragIdx < totalFragmentSlots;
                                                
                                                return (
                                                    <div key={`frag-${fragIdx}`} className="relative group">
                                                        <button
                                                            onClick={() => isSlotAvailable && handleSubclassSlotClick('fragment', fragIdx)}
                                                            disabled={!isSlotAvailable}
                                                            className={cn(
                                                                "w-11 h-11 bg-black/40 border border-dashed border-white/10 rounded-lg flex items-center justify-center transition-all",
                                                                isSlotAvailable && "hover:border-destiny-gold/50 hover:scale-105",
                                                                !isSlotAvailable && "opacity-30 cursor-not-allowed"
                                                            )}
                                                            style={{ borderColor: damageType && isSlotAvailable ? `${DAMAGE_TYPES[damageType]?.color}20` : undefined }}
                                                            title={isSlotAvailable ? `Fragment ${fragIdx + 1}` : 'Locked - select more aspects'}
                                                        >
                                                            {fragment?.plugHash ? (
                                                                <SubclassSlot 
                                                                    plugHash={fragment.plugHash} 
                                                                    label={`Fragment ${fragIdx + 1}`} 
                                                                    size="small"
                                                                    damageType={damageType}
                                                                />
                                                            ) : (
                                                                <Plus className="w-4 h-4 text-slate-600" />
                                                            )}
                                                        </button>
                                                        {fragment?.plugHash && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleRemoveFragment(fragIdx); }}
                                                                className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                            >
                                                                <X className="w-2 h-2 text-white" />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                    </div>
                </div>
                
                {/* Footer */}
                <div className="flex justify-end gap-3 p-4 border-t border-white/10">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(editedLoadout)}
                        className="px-6 py-2 bg-destiny-gold text-slate-900 font-bold text-sm uppercase tracking-wider hover:bg-white transition-colors rounded-lg flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        Save Loadout
                    </button>
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
                    profile={profile}
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
        </div>
    
    );
}

// ===== Main Page =====

export default function LoadoutsPage() {
    const { profile, stats, isLoading, isLoggedIn, membershipInfo } = useDestinyProfile();
    const { loadouts, createLoadout, updateLoadout, importLoadouts } = useLoadoutStore();
    const [selectedClass, setSelectedClass] = useState<number>(0);
    const [editingLoadout, setEditingLoadout] = useState<CustomLoadout | null | 'new'>(null);
    const [sharingLoadout, setSharingLoadout] = useState<CustomLoadout | null>(null);
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [mounted, setMounted] = useState(false);
    
    const searchParams = useSearchParams();
    const router = useRouter();
    
    useEffect(() => {
        setMounted(true);
    }, []);
    
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
    }, [stats?.classType]);
    
    const filteredLoadouts = useMemo(() => {
        return loadouts.filter((l) => l.classType === selectedClass);
    }, [loadouts, selectedClass]);
    
    const activeCharacterId = stats?.characterId || '';
    
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
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <Package className="w-16 h-16 text-slate-600" />
                <div className="text-slate-400">Please login to manage loadouts</div>
                <button
                    onClick={() => loginWithBungie()}
                    className="px-6 py-2 bg-destiny-gold text-slate-900 font-bold uppercase tracking-widest hover:bg-white transition-colors rounded-lg"
                >
                    Login
                </button>
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
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white uppercase tracking-wide flex items-center gap-3">
                        <Sparkles className="w-6 h-6 text-destiny-gold" />
                        Loadouts
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Create, manage, and share custom loadouts for your Guardians
                    </p>
                </div>
                
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowImportDialog(true)}
                        className="px-4 py-2 bg-white/5 text-white font-medium text-sm hover:bg-white/10 transition-colors rounded-lg flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Import
                    </button>
                    <button
                        onClick={handleExportAll}
                        disabled={loadouts.length === 0}
                        className="px-4 py-2 bg-white/5 text-white font-medium text-sm hover:bg-white/10 transition-colors rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Upload className="w-4 h-4" />
                        Export All
                    </button>
                    <button
                        onClick={() => setEditingLoadout('new')}
                        className="px-4 py-2 bg-destiny-gold text-slate-900 font-bold text-sm uppercase tracking-wider hover:bg-white transition-colors rounded-lg flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        New Loadout
                    </button>
                </div>
            </div>
            
            {/* Class Tabs */}
            <div className="flex gap-2 mb-6">
                {[0, 1, 2].map((classType) => (
                    <button
                        key={classType}
                        onClick={() => setSelectedClass(classType)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all",
                            selectedClass === classType
                                ? "bg-destiny-gold text-slate-900"
                                : "bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white"
                        )}
                    >
                        <Image src={CLASS_ICONS[classType]} width={16} height={16} alt="" />
                        {CLASS_NAMES[classType]}
                        <span className="ml-1 text-xs opacity-70">
                            ({loadouts.filter((l) => l.classType === classType).length})
                        </span>
                    </button>
                ))}
            </div>
            
            {/* Loadouts Grid */}
            {filteredLoadouts.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-lg">
                    <Package className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-400 mb-2">No loadouts yet</h3>
                    <p className="text-sm text-slate-600 mb-4">
                        Create your first {CLASS_NAMES[selectedClass]} loadout to get started
                    </p>
                    <div className="flex items-center justify-center gap-3">
                        <button
                            onClick={() => setEditingLoadout('new')}
                            className="px-4 py-2 bg-destiny-gold text-slate-900 font-bold text-sm hover:bg-white transition-colors rounded-lg inline-flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Create Loadout
                        </button>
                        <button
                            onClick={() => setShowImportDialog(true)}
                            className="px-4 py-2 bg-slate-800 text-white font-medium text-sm hover:bg-slate-700 transition-colors rounded-lg inline-flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Import
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredLoadouts.map((loadout) => (
                        <LoadoutCard
                            key={loadout.id}
                            loadout={loadout}
                            profile={profile}
                            membershipInfo={membershipInfo}
                            activeCharacterId={activeCharacterId}
                            onEdit={() => setEditingLoadout(loadout)}
                            onShare={() => setSharingLoadout(loadout)}
                        />
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
