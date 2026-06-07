"use client";

import { useDestinyProfileContext } from "@/components/DestinyProfileProvider";
import {
  VirtualizedItemGrid,
  type VirtualizedItem,
} from "@/components/VirtualizedItemGrid";
import { useInventoryItemDefinitionsFromTable } from "@/hooks/useInventoryItemDefinitionsFromTable";
import { BUCKETS } from "@/lib/destinyUtils";
import { ITEM_ICON_CSS_PX, type ItemIconSize } from "@/lib/itemIconImage";
import type { SortMethod } from "@/store/settingsStore";
import { useMemo } from "react";

type ProfileInventoryItem = {
  itemHash: number;
  itemInstanceId?: string;
  quantity?: number;
  bucketHash?: number;
};

type ProfileInventorySection = {
  key: string;
  label: string;
  bucketHash: number;
};

type ProfileInventoryPanelProps = {
  iconSize: ItemIconSize;
  sortMethod: SortMethod;
};

const PROFILE_INVENTORY_SECTIONS: ProfileInventorySection[] = [
  {
    key: "consumables",
    label: "Consumables",
    bucketHash: BUCKETS.CONSUMABLES,
  },
  {
    key: "modifications",
    label: "Modifications",
    bucketHash: BUCKETS.MODS,
  },
];

function compareProfileInventoryItems(
  firstItem: ProfileInventoryItem,
  secondItem: ProfileInventoryItem,
  definitions: Record<number, any>,
  sortMethod: SortMethod,
) {
  const firstDefinition = definitions[firstItem.itemHash];
  const secondDefinition = definitions[secondItem.itemHash];

  if (!firstDefinition || !secondDefinition) {
    return 0;
  }

  if (sortMethod === "name") {
    const firstName = firstDefinition.displayProperties?.name ?? "";
    const secondName = secondDefinition.displayProperties?.name ?? "";

    return firstName.localeCompare(secondName);
  }

  if (sortMethod === "rarity") {
    const firstTier = firstDefinition.inventory?.tierType ?? 0;
    const secondTier = secondDefinition.inventory?.tierType ?? 0;

    return secondTier - firstTier;
  }

  if (sortMethod === "power") {
    return (secondItem.quantity ?? 0) - (firstItem.quantity ?? 0);
  }

  return 0;
}

function ProfileInventoryGrid({
  items,
  definitions,
  iconSize,
}: {
  items: ProfileInventoryItem[];
  definitions: Record<number, any>;
  iconSize: ItemIconSize;
}) {
  const virtualizedItems = useMemo<VirtualizedItem[]>(
    () =>
      items.map((item) => ({
        ...item,
        definition: definitions[item.itemHash],
      })),
    [definitions, items],
  );
  const rowHeight = ITEM_ICON_CSS_PX[iconSize] + 32;
  const estimatedRowCount = Math.ceil(items.length / 8);
  const containerHeight = Math.min(
    420,
    Math.max(rowHeight * 2, estimatedRowCount * rowHeight),
  );

  return (
    <VirtualizedItemGrid
      items={virtualizedItems}
      iconSize={iconSize}
      ownerId="profile"
      containerHeight={containerHeight}
      overscan={160}
      gap={8}
    />
  );
}

export function ProfileInventoryPanel({
  iconSize,
  sortMethod,
}: ProfileInventoryPanelProps) {
  const { profile } = useDestinyProfileContext();

  const profileItems = useMemo<ProfileInventoryItem[]>(() => {
    return profile?.profileInventory?.data?.items ?? [];
  }, [profile]);

  const itemHashes = useMemo(() => {
    return profileItems.map((item) => item.itemHash);
  }, [profileItems]);

  const { definitions } = useInventoryItemDefinitionsFromTable(
    itemHashes,
    "card",
  );

  const inventorySections = useMemo(() => {
    return PROFILE_INVENTORY_SECTIONS.map((section) => {
      const sectionItems = profileItems
        .filter((item) => item.bucketHash === section.bucketHash)
        .sort((firstItem, secondItem) =>
          compareProfileInventoryItems(
            firstItem,
            secondItem,
            definitions,
            sortMethod,
          ),
        );

      return {
        ...section,
        items: sectionItems,
      };
    }).filter((section) => section.items.length > 0);
  }, [definitions, profileItems, sortMethod]);

  if (inventorySections.length === 0) {
    return null;
  }

  return (
    <div className="pb-10">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-300">
        Inventory
      </div>

      <div className="space-y-6">
        {inventorySections.map((section) => (
          <div key={section.key}>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              {section.label} ({section.items.length})
            </div>

            <ProfileInventoryGrid
              items={section.items}
              definitions={definitions}
              iconSize={iconSize}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
