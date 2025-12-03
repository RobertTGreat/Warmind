'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useDestinyProfile } from "@/hooks/useDestinyProfile";
import { useItemDefinitions } from "@/hooks/useItemDefinitions";
import { Loader2, Search, Plus, X, Check, BookOpen, Star, ChevronDown, ChevronUp } from "lucide-react";
import { ItemTooltip } from "@/components/ItemTooltip";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';
import Image from 'next/image';
import { getBungieImage } from '@/lib/bungie';

// Lazy load components
const PageHeader = dynamic(
  () => import("@/components/PageHeader").then((mod) => mod.PageHeader),
  { ssr: false }
);

const DestinyItemCard = dynamic(
  () => import("@/components/DestinyItemCard").then((mod) => mod.DestinyItemCard),
  { ssr: false }
);

// Local storage for custom wishlist entries
const WISHLIST_STORAGE_KEY = 'warmind-custom-wishlist';

// Wishlist Item Component
function WishlistItemIcon({ 
  entry, 
  definitions, 
  profile, 
  allItems, 
  isItemInInventory,
  onRemove 
}: { 
  entry: WishListEntry;
  definitions: Record<number, any>;
  profile: any;
  allItems: any[];
  isItemInInventory: (hash: number) => boolean;
  onRemove: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const iconRef = useRef<HTMLDivElement>(null);

  const entryDef = definitions[entry.itemHash];
  const inInventory = isItemInInventory(entry.itemHash);

  // Get item instance data for tooltip
  const itemInstance = allItems.find((i: any) => i.itemHash === entry.itemHash);
  const instanceId = itemInstance?.itemInstanceId;
  const instanceData = profile?.itemComponents?.instances?.data?.[instanceId];
  const socketsData = profile?.itemComponents?.sockets?.data?.[instanceId];
  const statsData = profile?.itemComponents?.stats?.data?.[instanceId]?.stats;
  const reusablePlugs = profile?.itemComponents?.reusablePlugs?.data?.[instanceId]?.plugs;

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setTooltipPos({
        x: rect.left + rect.width / 2,
        y: rect.top
      });
    }
    setIsHovered(true);
  };

  return (
    <div className="relative group">
      <div
        ref={iconRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "relative w-16 h-16 border-2 transition-all cursor-pointer",
          inInventory
            ? "border-destiny-gold bg-destiny-gold/10 shadow-[0_0_10px_rgba(227,206,98,0.3)]"
            : "border-white/10 hover:border-destiny-gold/50"
        )}
      >
        {entry.itemIcon && (
          <Image
            src={getBungieImage(entry.itemIcon)}
            fill
            alt={entry.itemName}
            className="object-cover"
          />
        )}
        <button
          onClick={onRemove}
          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <X className="w-3 h-3 text-white" />
        </button>
      </div>

      {/* Tooltip */}
      {isHovered && entryDef && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed z-9999 pointer-events-none"
          style={{ 
            left: tooltipPos.x, 
            top: tooltipPos.y,
            transform: 'translate(-50%, -100%)',
            marginTop: '-8px'
          }}
        >
          <ItemTooltip
            name={entryDef.displayProperties?.name || entry.itemName}
            itemType={entryDef.itemTypeDisplayName || ''}
            rarity={entryDef.inventory?.tierTypeName || ''}
            icon={entryDef.displayProperties?.icon ? getBungieImage(entryDef.displayProperties.icon) : undefined}
            power={instanceData?.primaryStat?.value}
            itemHash={entry.itemHash}
            stats={statsData}
            socketsData={socketsData}
            itemDef={entryDef}
            fixedPosition
          />
        </div>,
        document.body
      )}
    </div>
  );
}

interface WishListEntry {
  itemHash: number;
  itemName: string;
  itemIcon: string;
  perkHashes?: number[]; // Specific roll (empty = any roll)
  statDistribution?: {
    weapons?: number;
    health?: number;
    class?: number;
    grenade?: number;
    super?: number;
    melee?: number;
  };
  notes?: string;
  tags?: string[];
}

export default function ProgressionPage() {
  const { profile, isLoading: profileLoading } = useDestinyProfile();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [selectedRoll, setSelectedRoll] = useState<number[]>([]);
  const [selectedStats, setSelectedStats] = useState<WishListEntry['statDistribution'] | null>(null);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [expandedSockets, setExpandedSockets] = useState<Set<number>>(new Set());

  // Get all items from profile for search
  const allItems = useMemo(() => {
    if (!profile) return [];
    const items: any[] = [];
    if (profile.characterInventories?.data) {
      Object.values(profile.characterInventories.data).forEach((char: any) => items.push(...char.items));
    }
    if (profile.characterEquipment?.data) {
      Object.values(profile.characterEquipment.data).forEach((char: any) => items.push(...char.items));
    }
    if (profile.profileInventory?.data?.items) {
      items.push(...profile.profileInventory.data.items);
    }
    return items;
  }, [profile]);

  // Check if an item is in inventory/vault
  const isItemInInventory = useMemo(() => {
    const itemHashes = new Set(allItems.map((i: any) => i.itemHash));
    return (itemHash: number) => itemHashes.has(itemHash);
  }, [allItems]);

  // Get unique item hashes
  const uniqueHashes = useMemo(() => {
    return Array.from(new Set(allItems.map((i: any) => i.itemHash)));
  }, [allItems]);

  const { definitions, isLoading: defsLoading } = useItemDefinitions(uniqueHashes);

  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!searchQuery || !definitions) return [];
    
    const query = searchQuery.toLowerCase();
    return uniqueHashes
      .map(hash => definitions[hash])
      .filter(def => {
        if (!def) return false;
        const name = def.displayProperties?.name?.toLowerCase() || '';
        const type = def.itemTypeDisplayName?.toLowerCase() || '';
        return name.includes(query) || type.includes(query);
      })
      .slice(0, 50); // Limit to 50 results
  }, [searchQuery, definitions, uniqueHashes]);

  // Get selected item definition
  const selectedItemDef = selectedItem ? definitions[selectedItem] : null;

  // Get available perks organized by socket slot - from item definition, not instance
  const socketPerks = useMemo(() => {
    if (!selectedItem || !selectedItemDef) return [];
    
    if (!selectedItemDef.sockets?.socketEntries) return [];

    // Excluded socket indices and category names
    const excludedIndices = [6, 10, 11]; // Columns 7, 11, 12 (0-indexed)
    const excludedCategoryNames = ['Weapon Perks 3'];

    // Organize perks by socket index
    const socketMap: Array<{
      socketIndex: number;
      categoryName: string;
      perks: Array<{ hash: number; canInsert: boolean }>;
    }> = [];

    selectedItemDef.sockets.socketEntries.forEach((entry: any, idx: number) => {
      // Skip excluded indices (columns 7, 11, 12 are 0-indexed as 6, 10, 11)
      if (excludedIndices.includes(idx)) return;

      // Get category name from socket category
      let categoryName = `Column ${idx + 1}`;
      let weaponPerkCount = 0;
      
      if (selectedItemDef.sockets?.socketCategories) {
        const category = selectedItemDef.sockets.socketCategories.find((cat: any) => 
          cat.socketIndexes?.includes(idx)
        );
        if (category) {
          // Try to extract a meaningful name
          const catHash = category.socketCategoryHash;
          if (catHash === 4241085061) {
            // Count how many "Weapon Perks" categories we've seen so far
            weaponPerkCount = socketMap.filter(s => {
              const sCategory = selectedItemDef.sockets.socketCategories.find((c: any) => 
                c.socketIndexes?.includes(s.socketIndex)
              );
              return sCategory?.socketCategoryHash === 4241085061;
            }).length;
            categoryName = weaponPerkCount === 0 ? 'Weapon Perks' : weaponPerkCount === 1 ? 'Weapon Perks 2' : `Weapon Perks ${weaponPerkCount + 1}`;
          }
          else if (catHash === 3956125808) categoryName = 'Intrinsic';
          else if (catHash === 590099826 || catHash === 2518356196) categoryName = 'Armor Mods';
          else categoryName = category.displayProperties?.name || categoryName;
        }
      }

      // Skip excluded category names (Weapon Perks 3)
      if (excludedCategoryNames.includes(categoryName)) return;

      // Get all possible plugs from all instances of this item
      const perkHashes = new Set<number>();
      
      // Collect plugs from all instances of this item
      const itemInstances = allItems.filter((i: any) => i.itemHash === selectedItem);
      itemInstances.forEach((itemInstance: any) => {
        const reusablePlugs = profile?.itemComponents?.reusablePlugs?.data?.[itemInstance.itemInstanceId]?.plugs;
        const plugs = reusablePlugs?.[idx] || [];
        plugs.forEach((p: any) => {
          if (p.plugItemHash) {
            perkHashes.add(p.plugItemHash);
          }
        });
      });

      // Also add singleInitialItemHash if present
      if (entry.singleInitialItemHash) {
        perkHashes.add(entry.singleInitialItemHash);
      }

      const perkList = Array.from(perkHashes).map(hash => ({ hash, canInsert: true }));

      if (perkList.length > 0) {
        socketMap.push({
          socketIndex: idx,
          categoryName,
          perks: perkList,
        });
      }
    });

    return socketMap;
  }, [selectedItem, profile, allItems, selectedItemDef]);

  // Get all perk hashes for definitions
  const allPerkHashes = useMemo(() => {
    return socketPerks.flatMap(s => s.perks.map(p => p.hash));
  }, [socketPerks]);

  const { definitions: perkDefs } = useItemDefinitions(allPerkHashes);

  const toggleSocket = (socketIndex: number) => {
    setExpandedSockets(prev => {
      const next = new Set(prev);
      if (next.has(socketIndex)) {
        next.delete(socketIndex);
      } else {
        next.add(socketIndex);
      }
      return next;
    });
  };

  // Reset expanded sockets when item changes
  useEffect(() => {
    setExpandedSockets(new Set());
    setSelectedRoll([]);
  }, [selectedItem]);

  // Load wishlist entries from localStorage
  const [wishListEntries, setWishListEntries] = useState<WishListEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(WISHLIST_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Save wishlist entries to localStorage
  const saveWishList = (entries: WishListEntry[]) => {
    setWishListEntries(entries);
    if (typeof window !== 'undefined') {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(entries));
    }
  };

  const handleAddWishList = () => {
    if (!selectedItem || !selectedItemDef) {
      toast.error('Please select an item');
      return;
    }

    const newEntry: WishListEntry = {
      itemHash: selectedItem,
      itemName: selectedItemDef.displayProperties?.name || 'Unknown',
      itemIcon: selectedItemDef.displayProperties?.icon || '',
      perkHashes: selectedRoll.length > 0 ? selectedRoll : undefined,
      statDistribution: selectedStats ?? undefined,
      notes: notes.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
    };

    // Check for duplicates (same item + same perks)
    const isDuplicate = wishListEntries.some(entry => {
      if (entry.itemHash !== selectedItem) return false;
      if (entry.perkHashes?.length !== selectedRoll.length) return false;
      if (selectedRoll.length > 0) {
        return entry.perkHashes?.every(h => selectedRoll.includes(h));
      }
      return true; // Same item with no specific perks
    });

    if (isDuplicate) {
      toast.error('This roll is already in your wishlist');
      return;
    }

    saveWishList([...wishListEntries, newEntry]);
    toast.success('Added to wishlist!');
    
    // Reset form
    setSelectedItem(null);
    setSelectedRoll([]);
    setSelectedStats(null);
    setNotes('');
    setTags([]);
    setExpandedSockets(new Set());
  };

  const handleRemoveWishList = (index: number) => {
    const newEntries = wishListEntries.filter((_, i) => i !== index);
    saveWishList(newEntries);
    toast.success('Removed from wishlist');
  };

  const addTag = () => {
    if (customTag.trim() && !tags.includes(customTag.trim())) {
      setTags([...tags, customTag.trim()]);
      setCustomTag('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  if (profileLoading || defsLoading) {
    return (
      <div className="w-full h-[calc(100vh-80px)] flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-destiny-gold" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 pb-24">
      <PageHeader 
        title="Wishlister" 
        description="Search for items and add them to your wishlist with specific rolls or stat distributions."
      />

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Search & Selection */}
        <div className="space-y-6">
          <div className="bg-gray-800/20 border border-white/10 p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-destiny-gold" />
              Search Items
            </h2>
            
            {/* Search Input */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search for weapons, armor, or items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-destiny-gold/50"
              />
            </div>

            {/* Search Results */}
            {searchQuery && filteredItems.length > 0 && (
              <div className="max-h-96 overflow-y-auto space-y-2">
                {filteredItems.map((def) => (
                  <button
                    key={def.hash}
                    onClick={() => setSelectedItem(def.hash)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 bg-black/30 border border-white/10 hover:border-destiny-gold/50 transition-all text-left",
                      selectedItem === def.hash && "border-destiny-gold bg-destiny-gold/10"
                    )}
                  >
                    {def.displayProperties?.icon && (
                      <Image
                        src={getBungieImage(def.displayProperties.icon)}
                        width={40}
                        height={40}
                        alt=""
                        className="w-10 h-10"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white truncate">{def.displayProperties?.name}</div>
                      <div className="text-xs text-slate-400">{def.itemTypeDisplayName}</div>
                    </div>
                    {selectedItem === def.hash && (
                      <Check className="w-5 h-5 text-destiny-gold" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {searchQuery && filteredItems.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                No items found
              </div>
            )}
          </div>

          {/* Selected Item Details */}
          {selectedItemDef && (
            <div className="bg-gray-800/20 border border-white/10 p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-destiny-gold" />
                Selected Item
              </h2>

              <div className="flex items-center gap-4 mb-6">
                {selectedItemDef.displayProperties?.icon && (
                  <Image
                    src={getBungieImage(selectedItemDef.displayProperties.icon)}
                    width={64}
                    height={64}
                    alt=""
                    className="w-16 h-16"
                  />
                )}
                <div>
                  <div className="font-bold text-white text-lg">{selectedItemDef.displayProperties?.name}</div>
                  <div className="text-sm text-slate-400">{selectedItemDef.itemTypeDisplayName}</div>
                </div>
              </div>

              {/* Perk Selection (for weapons and armor) */}
              {(selectedItemDef.itemType === 3 || selectedItemDef.itemType === 2) && socketPerks.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-300 mb-3">
                    Select Perks/Mods (Optional)
                  </label>
                  <div className="space-y-2">
                    {socketPerks.map((socket) => {
                      const isExpanded = expandedSockets.has(socket.socketIndex);
                      const selectedInSocket = socket.perks.filter(p => selectedRoll.includes(p.hash));
                      
                      return (
                        <div
                          key={socket.socketIndex}
                          className="border border-white/10 bg-black/20"
                        >
                          <button
                            onClick={() => toggleSocket(socket.socketIndex)}
                            className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                              ) : (
                                <ChevronUp className="w-4 h-4 text-slate-400" />
                              )}
                              <span className="text-sm font-medium text-white">{socket.categoryName}</span>
                              {selectedInSocket.length > 0 && (
                                <span className="text-xs text-destiny-gold">
                                  ({selectedInSocket.length} selected)
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-500">
                              {socket.perks.length} option{socket.perks.length !== 1 ? 's' : ''}
                            </span>
                          </button>
                          
                          {isExpanded && (
                            <div className="border-t border-white/10 p-3 space-y-2 max-h-64 overflow-y-auto">
                              {socket.perks.map((perk) => {
                                const perkDef = perkDefs[perk.hash];
                                if (!perkDef) return null;
                                const isSelected = selectedRoll.includes(perk.hash);
                                
                                return (
                                  <button
                                    key={perk.hash}
                                    onClick={() => {
                                      if (isSelected) {
                                        setSelectedRoll(selectedRoll.filter(h => h !== perk.hash));
                                      } else {
                                        setSelectedRoll([...selectedRoll, perk.hash]);
                                      }
                                    }}
                                    className={cn(
                                      "w-full flex items-center gap-3 p-2 border text-left transition-all",
                                      isSelected
                                        ? "border-destiny-gold bg-destiny-gold/10"
                                        : "border-white/10 hover:border-white/30 bg-black/20"
                                    )}
                                  >
                                    {perkDef.displayProperties?.icon && (
                                      <Image
                                        src={getBungieImage(perkDef.displayProperties.icon)}
                                        width={32}
                                        height={32}
                                        alt=""
                                        className="w-8 h-8"
                                      />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium text-white">
                                        {perkDef.displayProperties?.name}
                                      </div>
                                      {perkDef.displayProperties?.description && (
                                        <div className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                                          {perkDef.displayProperties.description}
                                        </div>
                                      )}
                                    </div>
                                    {isSelected && (
                                      <Check className="w-5 h-5 text-destiny-gold shrink-0" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stat Distribution (for armor) */}
              {selectedItemDef.itemType === 2 && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Stat Distribution (Optional)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {['weapons', 'health', 'class', 'grenade', 'super', 'melee'].map((stat) => (
                      <div key={stat}>
                        <label className="block text-xs text-slate-400 mb-1 capitalize">{stat}</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={selectedStats?.[stat as keyof typeof selectedStats] || ''}
                          onChange={(e) => {
                            const value = e.target.value ? parseInt(e.target.value) : undefined;
                            setSelectedStats({
                              ...selectedStats,
                              [stat]: value,
                            });
                          }}
                          className="w-full px-3 py-2 bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-destiny-gold/50"
                          placeholder="Any"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-300 mb-2">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this wishlist entry..."
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-destiny-gold/50 resize-none"
                  rows={3}
                />
              </div>

              {/* Tags */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-300 mb-2">Tags</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-destiny-gold/20 text-destiny-gold text-xs rounded"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="hover:text-destiny-gold/70"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                    placeholder="Add tag..."
                    className="flex-1 px-3 py-2 bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-destiny-gold/50"
                  />
                  <button
                    onClick={addTag}
                    className="px-4 py-2 bg-destiny-gold/20 text-destiny-gold hover:bg-destiny-gold/30 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Add Button */}
              <button
                onClick={handleAddWishList}
                className="w-full px-4 py-3 bg-destiny-gold text-slate-900 font-bold hover:bg-white transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add to Wishlist
              </button>
            </div>
          )}
        </div>

        {/* Right: Wishlist Entries */}
        <div className="space-y-6">
          <div className="bg-gray-800/20 border border-white/10 p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-destiny-gold" />
              Your Wishlist ({wishListEntries.length})
            </h2>

            {wishListEntries.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Star className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No wishlist entries yet</p>
                <p className="text-sm mt-2">Search for items and add them to your wishlist</p>
              </div>
            ) : (
              <div className="grid grid-cols-8 gap-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                {wishListEntries.map((entry, idx) => (
                  <WishlistItemIcon
                    key={`${entry.itemHash}-${idx}`}
                    entry={entry}
                    definitions={definitions}
                    profile={profile}
                    allItems={allItems}
                    isItemInInventory={isItemInInventory}
                    onRemove={() => handleRemoveWishList(idx)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
