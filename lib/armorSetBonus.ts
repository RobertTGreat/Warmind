import { PlugCategoryHashes } from "@/data/d2/generated-enums";

export type ArmorSetBonusTier = {
  requiredSetCount?: number;
  name: string;
  description: string;
  icon?: string;
  plugHash?: number;
  sandboxPerkHash?: number;
};

export type ArmorSetBonusInfo = {
  name: string;
  icon?: string;
  bonuses: ArmorSetBonusTier[];
};

const ARMOR_SET_SELECTOR_CATEGORY_IDENTIFIER =
  "core.gear_systems.event_gear.item_sets.selectors";
const ARMOR_SET_BONUS_FALLBACK_DESCRIPTION =
  "Activate a set bonus by equipping multiple pieces of this armor set.";

function compactDisplayText(text: unknown): string {
  return typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
}

export function isArmorSetBonusItem(itemDefinition: any, itemType: string): boolean {
  const typeName = itemType?.toLowerCase() || "";

  return (
    itemDefinition?.itemType === 2 ||
    typeName.includes("armor") ||
    typeName.includes("helmet") ||
    typeName.includes("gauntlets") ||
    typeName.includes("chest") ||
    typeName.includes("leg") ||
    typeName.includes("class")
  );
}

export function isExoticArmorItem(itemDefinition: any, itemType: string): boolean {
  const tierName = compactDisplayText(itemDefinition?.inventory?.tierTypeName).toLowerCase();
  const tierType = Number(itemDefinition?.inventory?.tierType);

  return isArmorSetBonusItem(itemDefinition, itemType) && (tierName === "exotic" || tierType === 6);
}

function getPlugCategoryHash(plugDefinition: any): number | null {
  const categoryHash = plugDefinition?.plug?.plugCategoryHash ?? plugDefinition?.plugCategoryHash;
  const numericCategoryHash = Number(categoryHash);

  return Number.isFinite(numericCategoryHash) ? numericCategoryHash : null;
}

function getPlugCategoryIdentifier(plugDefinition: any): string {
  return compactDisplayText(plugDefinition?.plug?.plugCategoryIdentifier).toLowerCase();
}

function isArmorArchetypePlug(plugDefinition: any): boolean {
  const categoryHash = getPlugCategoryHash(plugDefinition);
  const categoryIdentifier = getPlugCategoryIdentifier(plugDefinition);
  const typeName = compactDisplayText(plugDefinition?.itemTypeDisplayName).toLowerCase();

  return (
    categoryHash === PlugCategoryHashes.ArmorArchetypes ||
    categoryIdentifier.includes("armor_archetypes") ||
    typeName.includes("archetype")
  );
}

function isArmorSetBonusPlug(plugDefinition: any): boolean {
  if (!plugDefinition?.displayProperties || isArmorArchetypePlug(plugDefinition)) {
    return false;
  }

  const categoryHash = getPlugCategoryHash(plugDefinition);
  const categoryIdentifier = getPlugCategoryIdentifier(plugDefinition);
  const name = compactDisplayText(plugDefinition.displayProperties.name).toLowerCase();
  const description = compactDisplayText(
    plugDefinition.displayProperties.description
  ).toLowerCase();
  const isSetSelector =
    categoryHash === PlugCategoryHashes.CoreGearSystemsEventGearItemSetsSelectors ||
    categoryIdentifier === ARMOR_SET_SELECTOR_CATEGORY_IDENTIFIER;
  const mentionsSetBonus =
    name.includes("set bonus") ||
    description.includes("set bonus") ||
    description.includes("multiple pieces of this armor set");

  if (name.includes("empty") && name.includes("socket")) {
    return false;
  }

  return isSetSelector || mentionsSetBonus;
}

function getSetNameFromArmorItem(itemDefinition: any): string {
  const setDataName = compactDisplayText(itemDefinition?.setData?.questLineName);

  if (setDataName) {
    return setDataName;
  }

  return compactDisplayText(itemDefinition?.displayProperties?.name)
    .replace(
      /\b(helm|helmet|hood|mask|gauntlets|gloves|grasps|plate|chest|vest|vestment|boots|strides|legs|bond|mark|cloak)\b/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

function getDefinitionFromTable(table: Record<string, any> | undefined, hash: number | undefined) {
  if (!table || !hash) {
    return undefined;
  }

  return table[String(hash)];
}

function getArmorSetBonusFromPlug(plugDefinition: any): ArmorSetBonusInfo | null {
  if (!isArmorSetBonusPlug(plugDefinition)) {
    return null;
  }

  const rawName = compactDisplayText(plugDefinition.displayProperties?.name);
  const bonusName = rawName.toLowerCase().startsWith("set bonus")
    ? rawName
    : `Set Bonus: ${rawName || "Armor"}`;
  const description =
    compactDisplayText(plugDefinition.displayProperties?.description) ||
    ARMOR_SET_BONUS_FALLBACK_DESCRIPTION;

  return {
    name: bonusName,
    icon: plugDefinition.displayProperties?.icon,
    bonuses: [
      {
        name: rawName,
        description,
        icon: plugDefinition.displayProperties?.icon,
        plugHash: plugDefinition.hash,
      },
    ],
  };
}

function getArmorSetBonusFromSetData(itemDefinition: any): ArmorSetBonusInfo | null {
  if (!itemDefinition?.setData) {
    return null;
  }

  const setName = getSetNameFromArmorItem(itemDefinition);

  return {
    name: setName ? `Set Bonus: ${setName}` : "Armor Set Bonus",
    icon: itemDefinition.displayProperties?.icon,
    bonuses: [
      {
        name: setName,
        description: ARMOR_SET_BONUS_FALLBACK_DESCRIPTION,
        icon: itemDefinition.displayProperties?.icon,
      },
    ],
  };
}

function getArmorSetBonusFromEquipableSet({
  itemDefinition,
  equipableItemSetDefinitions,
  sandboxPerkDefinitions,
}: {
  itemDefinition: any;
  equipableItemSetDefinitions: Record<string, any> | undefined;
  sandboxPerkDefinitions: Record<string, any> | undefined;
}): ArmorSetBonusInfo | null {
  const setHash = itemDefinition?.equippingBlock?.equipableItemSetHash;
  const setDefinition = getDefinitionFromTable(equipableItemSetDefinitions, setHash);

  if (!setDefinition) {
    return null;
  }

  const setName = compactDisplayText(setDefinition.displayProperties?.name);
  const setPerks = Array.isArray(setDefinition.setPerks) ? setDefinition.setPerks : [];
  const setBonusTiers: ArmorSetBonusTier[] = setPerks
    .map((setPerk: any): ArmorSetBonusTier | null => {
      const perkDefinition = getDefinitionFromTable(
        sandboxPerkDefinitions,
        setPerk?.sandboxPerkHash
      );
      const requiredSetCount = Number(setPerk?.requiredSetCount);
      const perkName = compactDisplayText(perkDefinition?.displayProperties?.name);
      const perkDescription =
        compactDisplayText(perkDefinition?.displayProperties?.description) ||
        compactDisplayText(setDefinition.displayProperties?.description) ||
        ARMOR_SET_BONUS_FALLBACK_DESCRIPTION;

      if (!perkName && !perkDescription) {
        return null;
      }

      return {
        requiredSetCount: Number.isFinite(requiredSetCount) ? requiredSetCount : undefined,
        name: perkName,
        description: perkDescription,
        icon:
          perkDefinition?.displayProperties?.icon ||
          setDefinition.displayProperties?.icon ||
          itemDefinition.displayProperties?.icon,
        sandboxPerkHash: setPerk?.sandboxPerkHash,
      };
    })
    .filter((bonusTier: ArmorSetBonusTier | null): bonusTier is ArmorSetBonusTier =>
      Boolean(bonusTier)
    )
    .sort((firstBonus: ArmorSetBonusTier, secondBonus: ArmorSetBonusTier) => {
      return (firstBonus.requiredSetCount ?? 0) - (secondBonus.requiredSetCount ?? 0);
    });
  const preferredSetBonusTiers = setBonusTiers.filter((bonusTier: ArmorSetBonusTier) => {
    return bonusTier.requiredSetCount === 2 || bonusTier.requiredSetCount === 4;
  });
  const bonuses = preferredSetBonusTiers.length > 0 ? preferredSetBonusTiers : setBonusTiers;

  if (bonuses.length === 0) {
    return null;
  }

  return {
    name: setName ? `Set Bonus: ${setName}` : "Armor Set Bonus",
    icon:
      bonuses.find((bonusTier: ArmorSetBonusTier) => bonusTier.icon)?.icon ||
      setDefinition.displayProperties?.icon ||
      itemDefinition.displayProperties?.icon,
    bonuses,
  };
}

export function getArmorSetBonusInfo({
  itemDefinition,
  itemType,
  equipableItemSetDefinitions,
  sandboxPerkDefinitions,
  socketsData,
  plugDefinitions,
  detailedPerks,
}: {
  itemDefinition: any;
  itemType: string;
  equipableItemSetDefinitions?: Record<string, any>;
  sandboxPerkDefinitions?: Record<string, any>;
  socketsData?: any;
  plugDefinitions?: Record<number, any>;
  detailedPerks?: { activePlug?: any }[];
}): ArmorSetBonusInfo | null {
  if (!itemDefinition || !isArmorSetBonusItem(itemDefinition, itemType)) {
    return null;
  }

  if (isExoticArmorItem(itemDefinition, itemType)) {
    return null;
  }

  const structuredSetBonus = getArmorSetBonusFromEquipableSet({
    itemDefinition,
    equipableItemSetDefinitions,
    sandboxPerkDefinitions,
  });

  if (structuredSetBonus) {
    return structuredSetBonus;
  }

  const plugCandidates: any[] = [];

  if (socketsData?.sockets && plugDefinitions) {
    socketsData.sockets.forEach((socket: any) => {
      const activePlug = socket?.plugHash ? plugDefinitions[socket.plugHash] : null;

      if (activePlug) {
        plugCandidates.push(activePlug);
      }
    });
  }

  if (detailedPerks && detailedPerks.length > 0) {
    detailedPerks.forEach((socket) => {
      if (socket?.activePlug) {
        plugCandidates.push(socket.activePlug);
      }
    });
  }

  if (itemDefinition.sockets?.socketEntries && plugDefinitions) {
    itemDefinition.sockets.socketEntries.forEach((socketEntry: any) => {
      const initialPlug = socketEntry?.singleInitialItemHash
        ? plugDefinitions[socketEntry.singleInitialItemHash]
        : null;

      if (initialPlug) {
        plugCandidates.push(initialPlug);
      }
    });
  }

  for (const plugCandidate of plugCandidates) {
    const setBonus = getArmorSetBonusFromPlug(plugCandidate);

    if (setBonus) {
      return setBonus;
    }
  }

  return getArmorSetBonusFromSetData(itemDefinition);
}

export function formatArmorSetBonusRequirement(requiredSetCount: number | undefined): string {
  return requiredSetCount ? `${requiredSetCount}-Piece` : "Bonus";
}
