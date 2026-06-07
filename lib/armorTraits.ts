import { isExoticArmorItem } from "@/lib/armorSetBonus";

export function getPlugHash(plug: any): number | null {
  const plugHash = Number(plug?.hash ?? plug?.itemHash ?? plug?.plugItemHash);

  return Number.isSafeInteger(plugHash) && plugHash > 0 ? plugHash : null;
}

export function getPlugDisplayText(plug: any, key: "name" | "description"): string {
  const displayText = plug?.displayProperties?.[key];

  return typeof displayText === "string" ? displayText.replace(/\s+/g, " ").trim() : "";
}

export function getPlugTypeText(plug: any): string {
  const typeName = plug?.itemTypeDisplayName;

  return typeof typeName === "string" ? typeName.replace(/\s+/g, " ").trim() : "";
}

function getPlugCategoryText(plug: any): string {
  const categoryIdentifier = plug?.plug?.plugCategoryIdentifier ?? plug?.plugCategoryIdentifier;

  return typeof categoryIdentifier === "string"
    ? categoryIdentifier.replace(/\s+/g, " ").trim()
    : "";
}

function isIgnoredTraitPlug(plug: any): boolean {
  const name = getPlugDisplayText(plug, "name").toLowerCase();
  const typeName = getPlugTypeText(plug).toLowerCase();
  const category = getPlugCategoryText(plug).toLowerCase();

  return (
    !name ||
    (name.includes("empty") && name.includes("socket")) ||
    name === "default ornament" ||
    typeName.includes("shader") ||
    typeName.includes("ornament") ||
    typeName.includes("tracker") ||
    typeName.includes("mod") ||
    category.includes("armor_archetypes")
  );
}

export function isExoticArmorTraitPlug(plug: any): boolean {
  if (!plug?.displayProperties || isIgnoredTraitPlug(plug)) return false;

  const typeName = getPlugTypeText(plug).toLowerCase();
  const category = getPlugCategoryText(plug).toLowerCase();
  const description = getPlugDisplayText(plug, "description").toLowerCase();
  const hasUsefulDisplay = Boolean(
    getPlugDisplayText(plug, "description") || plug.displayProperties?.icon
  );

  if (!hasUsefulDisplay) return false;

  return (
    typeName.includes("intrinsic") ||
    typeName.includes("trait") ||
    category.includes("intrinsic") ||
    category.includes("exotic") ||
    description.includes("intrinsic trait")
  );
}

function addUniquePlug(plugs: any[], seenHashes: Set<number>, plug: any) {
  const plugHash = getPlugHash(plug);

  if (!plugHash || seenHashes.has(plugHash)) return;

  seenHashes.add(plugHash);
  plugs.push(plug);
}

export function getExoticArmorTraitPlugs({
  itemDefinition,
  itemType,
  detailedPerks,
  socketsData,
  plugDefinitions,
}: {
  itemDefinition: any;
  itemType: string;
  detailedPerks?: { activePlug?: any }[];
  socketsData?: any;
  plugDefinitions?: Record<number, any>;
}): any[] {
  if (!isExoticArmorItem(itemDefinition, itemType)) return [];

  const traitPlugs: any[] = [];
  const seenHashes = new Set<number>();

  for (const socket of detailedPerks ?? []) {
    if (isExoticArmorTraitPlug(socket.activePlug)) {
      addUniquePlug(traitPlugs, seenHashes, socket.activePlug);
    }
  }

  if (socketsData?.sockets && plugDefinitions) {
    for (const socket of socketsData.sockets) {
      const activePlug = socket?.plugHash ? plugDefinitions[socket.plugHash] : null;

      if (isExoticArmorTraitPlug(activePlug)) {
        addUniquePlug(traitPlugs, seenHashes, activePlug);
      }
    }
  }

  if (traitPlugs.length > 0) {
    return traitPlugs;
  }

  if (itemDefinition?.sockets?.socketEntries && plugDefinitions) {
    for (const socketEntry of itemDefinition.sockets.socketEntries) {
      const initialPlug = socketEntry?.singleInitialItemHash
        ? plugDefinitions[socketEntry.singleInitialItemHash]
        : null;

      if (isExoticArmorTraitPlug(initialPlug)) {
        addUniquePlug(traitPlugs, seenHashes, initialPlug);
      }
    }
  }

  return traitPlugs;
}
