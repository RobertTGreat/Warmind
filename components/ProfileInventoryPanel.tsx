"use client";

import { ItemTile, type ItemTileModel } from "@/components/ItemTile";
import { useDestinyProfileContext } from "@/components/DestinyProfileProvider";
import { useInventoryItemDefinitionsFromTable } from "@/hooks/useInventoryItemDefinitionsFromTable";
import { getBungieImage } from "@/lib/bungie";
import { BUCKETS } from "@/lib/destinyUtils";
import { ITEM_ICON_CSS_PX, type ItemIconSize } from "@/lib/itemIconImage";
import { cn } from "@/lib/utils";
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

function getRarityClassName(definition: any) {
  switch (definition?.inventory?.tierTypeName) {
    case "Exotic":
      return "border-yellow-500";
    case "Legendary":
      return "border-purple-500";
    case "Rare":
      return "border-blue-500";
    case "Common":
      return "border-green-500";
    default:
      return "border-white/20";
  }
}

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

function buildProfileInventoryTile(
  item: ProfileInventoryItem,
  definition: any,
): ItemTileModel {
  const iconPath = definition?.displayProperties?.icon;
  const watermarkPath =
    definition?.iconWatermark ?? definition?.iconWatermarkShelved;

  return {
    itemHash: item.itemHash,
    itemInstanceId: item.itemInstanceId,
    name: definition?.displayProperties?.name ?? `Item ${item.itemHash}`,
    iconSrc: iconPath ? getBungieImage(iconPath) : null,
    watermarkSrc: watermarkPath ? getBungieImage(watermarkPath) : null,
    quantity: item.itemInstanceId ? undefined : item.quantity,
    rarityClassName: getRarityClassName(definition),
  };
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
  const tileWidthClassName = {
    small: "w-12",
    medium: "w-14",
    large: "w-16",
  }[iconSize];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, itemIndex) => {
        const definition = definitions[item.itemHash];
        const tile = buildProfileInventoryTile(item, definition);

        return (
          <ItemTile
            key={`${item.itemHash}-${item.itemInstanceId ?? "profile"}-${itemIndex}`}
            item={tile}
            sizePx={ITEM_ICON_CSS_PX[iconSize]}
            className={cn("shrink-0", tileWidthClassName)}
            fetchPriority={itemIndex < 24 ? "auto" : "low"}
          />
        );
      })}
    </div>
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
