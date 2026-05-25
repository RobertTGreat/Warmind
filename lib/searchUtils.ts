import { BUCKETS } from "./destinyUtils";
import type { DimItemMini } from "./dimItemMini";
import {
  dimItemFilters,
  hasDisabledMod,
  hasMemento,
  hasOriginTrait,
  hasRetiredPerk,
  isArtifice,
} from "./dimItemMini";

export interface ParsedSearch {
  text: string;
  filters: SearchFilter[];
  hideNonMatches: boolean;
}

export interface SearchFilter {
  type: "is" | "power" | "slot" | "element" | "season" | "tag" | "tier" | "masterwork" | "perk" | "set";
  value: string;
  op?: ">" | "<" | "=" | ">=" | "<=" | ":";
}

const DAMAGE_TYPE_HASHES: Record<string, number> = {
  kinetic: 3373582085,
  arc: 2303181850,
  solar: 1847026933,
  void: 3454344768,
  stasis: 151347233,
  strand: 3949783978,
};

const SLOT_BUCKETS: Record<string, number> = {
  kinetic: BUCKETS.KINETIC_WEAPON,
  energy: BUCKETS.ENERGY_WEAPON,
  power: BUCKETS.POWER_WEAPON,
  helmet: BUCKETS.HELMET,
  gauntlets: BUCKETS.GAUNTLETS,
  chest: BUCKETS.CHEST_ARMOR,
  leg: BUCKETS.LEG_ARMOR,
  class: BUCKETS.CLASS_ARMOR,
};

export function parseSearchQuery(query: string): ParsedSearch {
  if (!query) return { text: "", filters: [], hideNonMatches: false };

  let rawQuery = query.trim();
  const hideNonMatches = rawQuery.startsWith("h:");

  if (hideNonMatches) {
    rawQuery = rawQuery.substring(2).trim();
  }

  const terms: string[] = [];
  const filters: SearchFilter[] = [];

  for (const part of rawQuery.split(/\s+/)) {
    const lower = part.toLowerCase();
    const numberFilter = lower.match(/^(tier|masterwork)(>=|<=|>|<|=|:)(.+)$/);

    if (lower.startsWith("power") || lower.startsWith("light")) {
      const match = lower.match(/(?:power|light)([><]=?|=)(.+)/);
      if (match) {
        filters.push({ type: "power", op: match[1] as SearchFilter["op"], value: match[2] });
        continue;
      }
    }

    if (lower.startsWith("is:")) {
      filters.push({ type: "is", value: lower.substring(3) });
      continue;
    }

    if (numberFilter) {
      let operator = numberFilter[2] as SearchFilter["op"];
      let value = numberFilter[3];
      const colonOperator = operator === ":" ? value.match(/^([><]=?|=)(.+)$/) : null;

      if (colonOperator) {
        operator = colonOperator[1] as SearchFilter["op"];
        value = colonOperator[2];
      }

      filters.push({
        type: numberFilter[1] as "tier" | "masterwork",
        op: operator,
        value,
      });
      continue;
    }

    if (lower.startsWith("perk:") || lower.startsWith("exactperk:")) {
      filters.push({ type: "perk", value: lower.split(":").slice(1).join(":") });
      continue;
    }

    if (lower.startsWith("set:")) {
      filters.push({ type: "set", value: lower.substring(4) });
      continue;
    }

    if (lower.startsWith("slot:")) {
      filters.push({ type: "slot", value: lower.substring(5) });
      continue;
    }

    terms.push(lower);
  }

  return {
    text: terms.join(" "),
    filters,
    hideNonMatches,
  };
}

export function checkItemMatch(
  item: any,
  def: any,
  parsed: ParsedSearch,
  instance?: any,
  allInventory?: any[],
  normalizedItem?: DimItemMini
): boolean {
  if (!item || !def) return false;

  if (parsed.text && !checkTextMatch(parsed.text, def, normalizedItem)) {
    return false;
  }

  for (const filter of parsed.filters) {
    switch (filter.type) {
      case "is":
        if (!checkIsFilter(filter.value, item, def, instance, allInventory, normalizedItem)) return false;
        break;
      case "power":
        if (!checkPowerFilter(filter.value, filter.op, instance)) return false;
        break;
      case "tier":
        if (!checkTierFilter(filter.value, filter.op, item, instance, normalizedItem)) return false;
        break;
      case "masterwork":
        if (!checkMasterworkFilter(filter.value, filter.op, normalizedItem)) return false;
        break;
      case "perk":
        if (!normalizedItem || !dimItemFilters.perk(filter.value)(normalizedItem)) return false;
        break;
      case "set":
        if (!checkSetFilter(filter.value, normalizedItem)) return false;
        break;
      case "slot":
        if (!checkSlotFilter(filter.value, item, def)) return false;
        break;
    }
  }

  return true;
}

function checkTextMatch(text: string, def: any, normalizedItem?: DimItemMini): boolean {
  const name = String(def.displayProperties?.name ?? "").toLowerCase();
  const type = String(def.itemTypeDisplayName ?? "").toLowerCase();
  const setName = String(normalizedItem?.setBonus?.displayProperties?.name ?? "").toLowerCase();

  return name.includes(text) || type.includes(text) || setName.includes(text);
}

function compareNumber(value: number, target: number, op: SearchFilter["op"]): boolean {
  switch (op) {
    case ">":
      return value > target;
    case "<":
      return value < target;
    case ">=":
      return value >= target;
    case "<=":
      return value <= target;
    case "=":
    case ":":
    default:
      return value === target;
  }
}

function checkTierFilter(
  value: string,
  op: SearchFilter["op"],
  item: any,
  instance: any,
  normalizedItem?: DimItemMini
): boolean {
  const itemTier = normalizedItem?.tier ?? item?.calculatedTier ?? instance?.gearTier;
  const targetTier = Number(value);

  if (!Number.isFinite(itemTier) || !Number.isFinite(targetTier)) {
    return false;
  }

  return compareNumber(Number(itemTier), targetTier, op);
}

function checkMasterworkFilter(
  value: string,
  op: SearchFilter["op"],
  normalizedItem?: DimItemMini
): boolean {
  if (!normalizedItem) {
    return false;
  }

  const targetTier = Number(value);
  if (!Number.isFinite(targetTier)) {
    const normalizedValue = value.toLowerCase();

    return Boolean(
      normalizedItem.masterworkInfo?.stats?.some((stat) =>
        stat.name.toLowerCase().includes(normalizedValue)
      )
    );
  }

  return compareNumber(normalizedItem.masterworkInfo?.tier ?? 0, targetTier, op);
}

function checkSetFilter(value: string, normalizedItem?: DimItemMini): boolean {
  if (!normalizedItem?.setBonus) {
    return false;
  }

  const setHash = Number(value);
  if (Number.isFinite(setHash)) {
    return normalizedItem.setBonus.hash === setHash;
  }

  return String(normalizedItem.setBonus.displayProperties?.name ?? "")
    .toLowerCase()
    .includes(value.toLowerCase());
}

function checkIsFilter(
  value: string,
  item: any,
  def: any,
  instance: any,
  allInventory?: any[],
  normalizedItem?: DimItemMini
): boolean {
  if (value.startsWith("tier")) {
    return checkTierFilter(value.replace("tier", ""), ":", item, instance, normalizedItem);
  }

  if (normalizedItem) {
    switch (value) {
      case "exotic":
        return normalizedItem.isExotic;
      case "legendary":
        return normalizedItem.rarity === "Legendary";
      case "rare":
        return normalizedItem.rarity === "Rare";
      case "common":
        return normalizedItem.rarity === "Common";
      case "basic":
        return normalizedItem.rarity === "Basic";
      case "weapon":
        return Boolean(normalizedItem.bucket.inWeapons);
      case "armor":
        return Boolean(normalizedItem.bucket.inArmor);
      case "crafted":
        return Boolean(normalizedItem.crafted);
      case "masterwork":
        return normalizedItem.masterwork;
      case "locked":
        return normalizedItem.locked;
      case "artifice":
        return isArtifice(normalizedItem);
      case "origintrait":
        return hasOriginTrait(normalizedItem);
      case "adept":
        return dimItemFilters.isAdept()(normalizedItem);
      case "holofoil":
        return dimItemFilters.isHolofoil()(normalizedItem);
      case "memento":
        return hasMemento(normalizedItem);
      case "retiredperk":
        return hasRetiredPerk(normalizedItem);
      case "disabledmod":
        return hasDisabledMod(normalizedItem);
      case "setbonus":
        return Boolean(normalizedItem.setBonus);
    }
  }

  switch (value) {
    case "exotic":
      return def.inventory?.tierTypeName === "Exotic";
    case "legendary":
      return def.inventory?.tierTypeName === "Legendary";
    case "rare":
      return def.inventory?.tierTypeName === "Rare";
    case "common":
      return def.inventory?.tierTypeName === "Common";
    case "basic":
      return def.inventory?.tierTypeName === "Basic";
    case "weapon":
      return def.itemType === 3;
    case "armor":
      return def.itemType === 2;
    case "crafted":
      return (instance?.state & 8) === 8;
    case "masterwork":
      return (instance?.state & 4) === 4;
    case "locked":
      return (instance?.state & 1) === 1;
    case "kinetic":
    case "arc":
    case "solar":
    case "void":
    case "stasis":
    case "strand":
      return checkElementFilter(value, def, instance);
    case "dupe":
      if (!allInventory) return false;
      return allInventory.filter((inventoryItem) => inventoryItem.itemHash === item.itemHash).length > 1;
    default:
      return false;
  }
}

function checkPowerFilter(value: string, op: SearchFilter["op"], instance: any): boolean {
  const itemPower = Number(instance?.primaryStat?.value);
  const targetPower = Number(value);

  if (!Number.isFinite(itemPower) || !Number.isFinite(targetPower)) {
    return false;
  }

  return compareNumber(itemPower, targetPower, op);
}

function checkElementFilter(value: string, def: any, instance: any): boolean {
  const damageTypeHash = DAMAGE_TYPE_HASHES[value];
  return def.defaultDamageTypeHash === damageTypeHash || instance?.damageTypeHash === damageTypeHash;
}

function checkSlotFilter(value: string, item: any, def: any): boolean {
  const bucketHash = SLOT_BUCKETS[value];
  if (!bucketHash) return false;

  return item.bucketHash === bucketHash || def.inventory?.bucketTypeHash === bucketHash;
}
