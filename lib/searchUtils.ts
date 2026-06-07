import { ItemCategoryHashes, StatHashes } from "@/data/d2/generated-enums";
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

/**
 * Caches an itemHash -> count map per `allInventory` array reference so that
 * `is:dupe` runs in O(n) per search instead of O(n) per item (O(n^2) total).
 */
const itemHashCountByInventory = new WeakMap<object, Map<number, number>>();

function getItemHashCountMap(allInventory: any[]): Map<number, number> {
  const cachedCounts = itemHashCountByInventory.get(allInventory);
  if (cachedCounts) {
    return cachedCounts;
  }

  const itemHashCounts = new Map<number, number>();
  for (const inventoryItem of allInventory) {
    const itemHash = inventoryItem.itemHash;
    itemHashCounts.set(itemHash, (itemHashCounts.get(itemHash) ?? 0) + 1);
  }
  itemHashCountByInventory.set(allInventory, itemHashCounts);
  return itemHashCounts;
}

export interface ParsedSearch {
  text: string;
  filters: SearchFilter[];
  hideNonMatches: boolean;
  clauses: SearchClause[];
}

export interface SearchClause {
  text: string;
  filters: SearchFilter[];
}

export interface SearchFilter {
  type:
    | "is"
    | "has"
    | "power"
    | "weaponlevel"
    | "kills"
    | "slot"
    | "tier"
    | "masterwork"
    | "perk"
    | "exactperk"
    | "mod"
    | "catalyst"
    | "set"
    | "stat"
    | "basestat"
    | "text-property";
  value: string;
  op?: ">" | "<" | "=" | ">=" | "<=" | ":";
  field?: string;
  negate?: boolean;
}

const ITEM_STATE_LOCKED = 1;
const ITEM_STATE_NEW = 2;
const ITEM_STATE_MASTERWORK = 4;
const ITEM_STATE_CRAFTED = 8;
const ITEM_STATE_DEEPSIGHT = 1024;

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
  helm: BUCKETS.HELMET,
  gauntlet: BUCKETS.GAUNTLETS,
  gauntlets: BUCKETS.GAUNTLETS,
  arms: BUCKETS.GAUNTLETS,
  chest: BUCKETS.CHEST_ARMOR,
  leg: BUCKETS.LEG_ARMOR,
  legs: BUCKETS.LEG_ARMOR,
  class: BUCKETS.CLASS_ARMOR,
  classitem: BUCKETS.CLASS_ARMOR,
};

const AMMO_TYPE_BY_KEYWORD: Record<string, number> = {
  primary: 1,
  special: 2,
  heavy: 3,
  power: 3,
};

const ITEM_CATEGORY_FILTERS: Record<string, number[]> = {
  weapon: [ItemCategoryHashes.Weapon],
  weapons: [ItemCategoryHashes.Weapon],
  armor: [ItemCategoryHashes.Armor],
  ghost: [ItemCategoryHashes.Ghost],
  ghosts: [ItemCategoryHashes.Ghost],
  ship: [ItemCategoryHashes.Ships],
  ships: [ItemCategoryHashes.Ships],
  sparrow: [ItemCategoryHashes.Sparrows],
  sparrows: [ItemCategoryHashes.Sparrows],
  engram: [ItemCategoryHashes.Engrams],
  engrams: [ItemCategoryHashes.Engrams],
  shader: [ItemCategoryHashes.Shaders],
  shaders: [ItemCategoryHashes.Shaders],
  emote: [ItemCategoryHashes.Emotes],
  emotes: [ItemCategoryHashes.Emotes],
  finisher: [ItemCategoryHashes.Finishers],
  finishers: [ItemCategoryHashes.Finishers],
  artifact: [ItemCategoryHashes.SeasonalArtifacts],
  artifacts: [ItemCategoryHashes.SeasonalArtifacts],
  subclass: [ItemCategoryHashes.Subclasses],
  subclasses: [ItemCategoryHashes.Subclasses],
  mod: [
    ItemCategoryHashes.Mods_Mod,
    ItemCategoryHashes.WeaponMods,
    ItemCategoryHashes.ArmorMods,
    ItemCategoryHashes.GhostMods,
  ],
  mods: [
    ItemCategoryHashes.Mods_Mod,
    ItemCategoryHashes.WeaponMods,
    ItemCategoryHashes.ArmorMods,
    ItemCategoryHashes.GhostMods,
  ],
  ornament: [
    ItemCategoryHashes.Mods_Ornament,
    ItemCategoryHashes.WeaponModsOrnaments,
    ItemCategoryHashes.ArmorModsOrnaments,
  ],
  ornaments: [
    ItemCategoryHashes.Mods_Ornament,
    ItemCategoryHashes.WeaponModsOrnaments,
    ItemCategoryHashes.ArmorModsOrnaments,
  ],
  collectible: [
    ItemCategoryHashes.Emblems,
    ItemCategoryHashes.Emotes,
    ItemCategoryHashes.Finishers,
    ItemCategoryHashes.Ghost,
    ItemCategoryHashes.Ships,
    ItemCategoryHashes.Sparrows,
    ItemCategoryHashes.Shaders,
  ],
};

const WEAPON_TYPE_FILTERS: Record<string, number> = {
  handcannon: ItemCategoryHashes.HandCannon,
  handcannons: ItemCategoryHashes.HandCannon,
  autorifle: ItemCategoryHashes.AutoRifle,
  autorifles: ItemCategoryHashes.AutoRifle,
  pulserifle: ItemCategoryHashes.PulseRifle,
  pulserifles: ItemCategoryHashes.PulseRifle,
  scoutrifle: ItemCategoryHashes.ScoutRifle,
  scoutrifles: ItemCategoryHashes.ScoutRifle,
  sidearm: ItemCategoryHashes.Sidearm,
  sidearms: ItemCategoryHashes.Sidearm,
  sniper: ItemCategoryHashes.SniperRifle,
  sniperrifle: ItemCategoryHashes.SniperRifle,
  shotgun: ItemCategoryHashes.Shotgun,
  fusion: ItemCategoryHashes.FusionRifle,
  fusionrifle: ItemCategoryHashes.FusionRifle,
  grenadelauncher: ItemCategoryHashes.GrenadeLaunchers,
  gl: ItemCategoryHashes.GrenadeLaunchers,
  linearfusion: ItemCategoryHashes.LinearFusionRifles,
  linearfusionrifle: ItemCategoryHashes.LinearFusionRifles,
  rocket: ItemCategoryHashes.RocketLauncher,
  rocketlauncher: ItemCategoryHashes.RocketLauncher,
  bow: ItemCategoryHashes.Bows,
  smg: ItemCategoryHashes.SubmachineGuns,
  submachinegun: ItemCategoryHashes.SubmachineGuns,
  trace: ItemCategoryHashes.TraceRifles,
  tracerifle: ItemCategoryHashes.TraceRifles,
  sword: ItemCategoryHashes.Sword,
  machinegun: ItemCategoryHashes.MachineGun,
  glaive: ItemCategoryHashes.Glaives,
  glaives: ItemCategoryHashes.Glaives,
};

const CLASS_TYPE_BY_KEYWORD: Record<string, number> = {
  titan: 0,
  hunter: 1,
  warlock: 2,
};

const STAT_HASH_BY_KEYWORD: Record<string, number> = {
  mobility: StatHashes.Weapons,
  mob: StatHashes.Weapons,
  resilience: StatHashes.Health,
  res: StatHashes.Health,
  recovery: StatHashes.Class,
  rec: StatHashes.Class,
  discipline: StatHashes.Grenade,
  dis: StatHashes.Grenade,
  intellect: StatHashes.Super,
  int: StatHashes.Super,
  strength: StatHashes.Melee,
  str: StatHashes.Melee,
  impact: StatHashes.Impact,
  range: StatHashes.Range,
  stability: StatHashes.Stability,
  handling: StatHashes.Handling,
  reload: StatHashes.ReloadSpeed,
  reloadspeed: StatHashes.ReloadSpeed,
  magazine: StatHashes.Magazine,
  mag: StatHashes.Magazine,
  blast: StatHashes.BlastRadius,
  blastradius: StatHashes.BlastRadius,
  velocity: StatHashes.Velocity,
  charge: StatHashes.ChargeTime,
  chargetime: StatHashes.ChargeTime,
  draw: StatHashes.DrawTime,
  drawtime: StatHashes.DrawTime,
  zoom: StatHashes.Zoom,
  recoil: StatHashes.RecoilDirection,
  aimassistance: StatHashes.AimAssistance,
  airborne: StatHashes.AirborneEffectiveness,
  rpm: StatHashes.RoundsPerMinute,
};

const TEXT_PROPERTY_FIELDS = new Set([
  "source",
  "season",
  "foundry",
  "year",
  "tag",
  "note",
  "memento",
  "breaker",
  "tunedstat",
  "archetype",
  "frame",
  "rpm",
]);

export function parseSearchQuery(query: string): ParsedSearch {
  if (!query) {
    return { text: "", filters: [], hideNonMatches: false, clauses: [] };
  }

  let rawQuery = query.replace(/\/\*[\s\S]*?\*\//g, " ").trim();
  const hideNonMatches = rawQuery.startsWith("h:");

  if (hideNonMatches) {
    rawQuery = rawQuery.substring(2).trim();
  }

  const clauses = splitSearchClauses(rawQuery).map(parseSearchClause);
  const primaryClause = clauses[0] ?? { text: "", filters: [] };

  return {
    text: primaryClause.text,
    filters: primaryClause.filters,
    hideNonMatches,
    clauses,
  };
}

function splitSearchClauses(query: string): string[][] {
  const tokens = tokenizeSearchQuery(query);
  const clauses: string[][] = [[]];
  let depth = 0;

  for (const token of tokens) {
    if (token === "(") {
      depth += 1;
      continue;
    }

    if (token === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth === 0 && token.toLowerCase() === "or") {
      clauses.push([]);
      continue;
    }

    clauses[clauses.length - 1].push(token);
  }

  return clauses.filter((clause) => clause.length > 0);
}

function tokenizeSearchQuery(query: string): string[] {
  return (
    query
      .replace(/\(/g, " ( ")
      .replace(/\)/g, " ) ")
      .match(/"[^"]*"|`[^`]*`|\S+/g) ?? []
  );
}

function parseSearchClause(parts: string[]): SearchClause {
  const terms: string[] = [];
  const filters: SearchFilter[] = [];
  let negateNext = false;

  for (const part of parts) {
    let token = cleanSearchToken(part);
    let negate = false;
    let notColonAlias = false;
    const lowerToken = token.toLowerCase();

    if (lowerToken === "and") {
      continue;
    }

    if (lowerToken === "not") {
      negateNext = true;
      continue;
    }

    if (token.startsWith("-")) {
      negate = true;
      token = token.substring(1);
    }

    if (token.toLowerCase().startsWith("not:")) {
      negate = true;
      notColonAlias = true;
      token = token.substring(4);
    }

    if (negateNext) {
      negate = true;
      negateNext = false;
    }

    const filter =
      parseSearchFilter(token, negate) ??
      (notColonAlias && token ? { type: "is", value: token.toLowerCase(), negate } : null);

    if (filter) {
      filters.push(filter);
    } else if (token) {
      terms.push(token.toLowerCase());
    }
  }

  return { text: terms.join(" "), filters };
}

function cleanSearchToken(token: string): string {
  const trimmedToken = token.trim();

  if (
    (trimmedToken.startsWith('"') && trimmedToken.endsWith('"')) ||
    (trimmedToken.startsWith("`") && trimmedToken.endsWith("`"))
  ) {
    return trimmedToken.slice(1, -1);
  }

  return trimmedToken;
}

function parseSearchFilter(token: string, negate: boolean): SearchFilter | null {
  const lower = token.toLowerCase();
  const powerMatch = lower.match(/^(?:power|light):?([><]=?|=)(.+)$/);
  const weaponLevelMatch = lower.match(/^(?:weaponlevel|level):?([><]=?|=)(.+)$/);
  const killsMatch = lower.match(/^(?:kills|killtracker):?([><]=?|=)(.+)$/);
  const numberFilter = lower.match(/^(tier|masterwork)(>=|<=|>|<|=|:)(.+)$/);

  if (powerMatch) {
    return {
      type: "power",
      op: powerMatch[1] as SearchFilter["op"],
      value: powerMatch[2],
      negate,
    };
  }

  if (lower.startsWith("is:")) {
    return { type: "is", value: lower.substring(3), negate };
  }

  if (lower === "powerfloor" || lower === "softcap" || lower === "powerfulcap" || lower === "pinnaclecap") {
    return { type: "is", value: lower, negate };
  }

  if (lower.startsWith("has:")) {
    return {
      type: "has",
      value: cleanSearchToken(token.split(":").slice(1).join(":")),
      negate,
    };
  }

  if (!lower.includes(":") && (ITEM_CATEGORY_FILTERS[lower] || SLOT_BUCKETS[lower])) {
    return { type: "is", value: lower, negate };
  }

  if (weaponLevelMatch) {
    return {
      type: "weaponlevel",
      op: weaponLevelMatch[1] as SearchFilter["op"],
      value: weaponLevelMatch[2],
      negate,
    };
  }

  if (killsMatch) {
    return {
      type: "kills",
      op: killsMatch[1] as SearchFilter["op"],
      value: killsMatch[2],
      negate,
    };
  }

  if (numberFilter) {
    let operator = numberFilter[2] as SearchFilter["op"];
    let value = numberFilter[3];
    const colonOperator =
      operator === ":" ? value.match(/^([><]=?|=)(.+)$/) : null;

    if (colonOperator) {
      operator = colonOperator[1] as SearchFilter["op"];
      value = colonOperator[2];
    }

    return {
      type: numberFilter[1] as "tier" | "masterwork",
      op: operator,
      value,
      negate,
    };
  }

  if (
    lower.startsWith("perk:") ||
    lower.startsWith("perkname:")
  ) {
    return {
      type: "perk",
      value: cleanSearchToken(token.split(":").slice(1).join(":")),
      negate,
    };
  }

  if (lower.startsWith("exactperk:")) {
    return {
      type: "exactperk",
      value: cleanSearchToken(token.split(":").slice(1).join(":")),
      negate,
    };
  }

  if (lower.startsWith("mod:")) {
    return {
      type: "mod",
      value: cleanSearchToken(token.split(":").slice(1).join(":")),
      negate,
    };
  }

  if (lower.startsWith("catalyst:")) {
    return {
      type: "catalyst",
      value: cleanSearchToken(token.split(":").slice(1).join(":")),
      negate,
    };
  }

  if (lower.startsWith("deepsight:")) {
    return { type: "is", value: "deepsight", negate };
  }

  if (lower.startsWith("memento:")) {
    return {
      type: "has",
      value: "memento",
      negate,
    };
  }

  if (lower.startsWith("set:")) {
    return { type: "set", value: cleanSearchToken(token.substring(4)), negate };
  }

  if (lower.startsWith("slot:")) {
    return { type: "slot", value: lower.substring(5), negate };
  }

  if (lower.startsWith("stat:") || lower.startsWith("basestat:")) {
    const [field = "total", operator = ":", value = ""] = token
      .split(":")
      .slice(1);
    const parsedOperator = operator.match(/^([><]=?|=)(.+)$/);

    return {
      type: lower.startsWith("basestat:") ? "basestat" : "stat",
      field: field.toLowerCase(),
      op: parsedOperator ? (parsedOperator[1] as SearchFilter["op"]) : ":",
      value: parsedOperator ? parsedOperator[2] : value,
      negate,
    };
  }

  const propertyMatch = lower.match(/^([a-z]+):(.+)$/);
  if (propertyMatch && TEXT_PROPERTY_FIELDS.has(propertyMatch[1])) {
    return {
      type: "text-property",
      field: propertyMatch[1],
      value: cleanSearchToken(token.split(":").slice(1).join(":")),
      negate,
    };
  }

  return null;
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

  const clauses =
    parsed.clauses.length > 0
      ? parsed.clauses
      : [{ text: parsed.text, filters: parsed.filters }];

  return clauses.some((clause) =>
    checkSearchClause(clause, item, def, instance, allInventory, normalizedItem)
  );
}

function checkSearchClause(
  clause: SearchClause,
  item: any,
  def: any,
  instance?: any,
  allInventory?: any[],
  normalizedItem?: DimItemMini
): boolean {
  if (clause.text && !checkTextMatch(clause.text, def, normalizedItem)) {
    return false;
  }

  for (const filter of clause.filters) {
    const isMatch = checkSearchFilter(
      filter,
      item,
      def,
      instance,
      allInventory,
      normalizedItem
    );

    if (filter.negate ? isMatch : !isMatch) {
      return false;
    }
  }

  return true;
}

function checkSearchFilter(
  filter: SearchFilter,
  item: any,
  def: any,
  instance?: any,
  allInventory?: any[],
  normalizedItem?: DimItemMini
): boolean {
  switch (filter.type) {
    case "is":
      return checkIsFilter(
        filter.value,
        item,
        def,
        instance,
        allInventory,
        normalizedItem
      );
    case "has":
      return checkHasFilter(filter.value, def, normalizedItem);
    case "power":
      return checkPowerFilter(filter.value, filter.op, instance);
    case "weaponlevel":
      return checkWeaponLevelFilter(filter.value, filter.op, instance);
    case "kills":
      return checkKillsFilter(filter.value, filter.op, item, instance);
    case "tier":
      return checkTierFilter(filter.value, filter.op, item, instance, normalizedItem);
    case "masterwork":
      return checkMasterworkFilter(filter.value, filter.op, normalizedItem);
    case "perk":
      return Boolean(normalizedItem && dimItemFilters.perk(filter.value)(normalizedItem));
    case "exactperk":
      return checkExactPerkFilter(filter.value, normalizedItem);
    case "mod":
      return checkSocketTextFilter(filter.value, normalizedItem, "mod");
    case "catalyst":
      return checkSocketTextFilter(filter.value, normalizedItem, "catalyst");
    case "set":
      return checkSetFilter(filter.value, normalizedItem);
    case "slot":
      return checkSlotFilter(filter.value, item, def);
    case "stat":
    case "basestat":
      return checkStatFilter(filter, normalizedItem);
    case "text-property":
      return checkTextPropertyFilter(filter, def, normalizedItem);
  }
}

function checkTextMatch(text: string, def: any, normalizedItem?: DimItemMini): boolean {
  const terms = text
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  if (terms.length === 0) {
    return true;
  }

  const searchableText = [
    def.displayProperties?.name,
    def.displayProperties?.description,
    def.itemTypeDisplayName,
    def.itemTypeAndTierDisplayName,
    def.inventory?.tierTypeName,
    normalizedItem?.setBonus?.displayProperties?.name,
    normalizedItem?.setBonus?.displayProperties?.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return terms.every((term) => {
    return (
      searchableText.includes(term) ||
      Boolean(normalizedItem && dimItemFilters.perk(term)(normalizedItem))
    );
  });
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

  if (DAMAGE_TYPE_HASHES[value]) {
    return checkElementFilter(value, def, instance);
  }

  if (WEAPON_TYPE_FILTERS[value]) {
    return checkItemCategoryHashes(def, [WEAPON_TYPE_FILTERS[value]]);
  }

  if (CLASS_TYPE_BY_KEYWORD[value] !== undefined) {
    return checkClassFilter(value, def);
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
      case "primary":
      case "special":
      case "heavy":
        return checkAmmoTypeFilter(value, def);
      case "weapon":
        return Boolean(normalizedItem.bucket.inWeapons);
      case "armor":
        return Boolean(normalizedItem.bucket.inArmor);
      case "crafted":
        return Boolean(normalizedItem.crafted);
      case "patternunlocked":
        return Boolean(def?.crafting?.recipeItemHash || def?.crafting?.outputItemHash);
      case "craftable":
        return Boolean(def?.crafting?.outputItemHash || def?.crafting?.recipeItemHash);
      case "deepsight":
        return Boolean(getItemState(item, instance) & ITEM_STATE_DEEPSIGHT);
      case "masterwork":
        return normalizedItem.masterwork;
      case "locked":
        return normalizedItem.locked;
      case "new":
        return Boolean(getItemState(item, instance) & ITEM_STATE_NEW);
      case "tagged":
      case "wishlist":
      case "inloadout":
      case "powerful":
      case "pinnacle":
      case "statlower":
      case "infusionfodder":
        return false;
      case "haspower":
        return Number.isFinite(Number(instance?.primaryStat?.value));
      case "infusable":
        return Boolean(def?.equippingBlock?.uniqueLabelHash || def?.inventory?.tierType >= 5);
      case "equipped":
        return Boolean(item.__isEquipped);
      case "artifice":
        return isArtifice(normalizedItem);
      case "armorintrinsic":
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
    case "primary":
    case "special":
    case "heavy":
      return checkAmmoTypeFilter(value, def);
    case "weapon":
      return def.itemType === 3 || checkItemCategoryHashes(def, [ItemCategoryHashes.Weapon]);
    case "armor":
      return def.itemType === 2 || checkItemCategoryHashes(def, [ItemCategoryHashes.Armor]);
    case "crafted":
      return Boolean(getItemState(item, instance) & ITEM_STATE_CRAFTED);
    case "patternunlocked":
      return Boolean(def?.crafting?.recipeItemHash || def?.crafting?.outputItemHash);
    case "craftable":
      return Boolean(def?.crafting?.outputItemHash || def?.crafting?.recipeItemHash);
    case "deepsight":
      return Boolean(getItemState(item, instance) & ITEM_STATE_DEEPSIGHT);
    case "masterwork":
      return Boolean(getItemState(item, instance) & ITEM_STATE_MASTERWORK);
    case "locked":
      return Boolean(getItemState(item, instance) & ITEM_STATE_LOCKED);
    case "new":
      return Boolean(getItemState(item, instance) & ITEM_STATE_NEW);
    case "haspower":
      return Number.isFinite(Number(instance?.primaryStat?.value));
    case "infusable":
      return Boolean(def?.equippingBlock?.uniqueLabelHash || def?.inventory?.tierType >= 5);
    case "equipped":
      return Boolean(item.__isEquipped);
    case "dupe":
      if (!allInventory) return false;
      return (getItemHashCountMap(allInventory).get(item.itemHash) ?? 0) > 1;
    default:
      if (ITEM_CATEGORY_FILTERS[value]) {
        return checkItemCategoryFilter(value, def, normalizedItem);
      }

      if (SLOT_BUCKETS[value]) {
        return checkSlotFilter(value, item, def);
      }

      return false;
  }
}

function getItemState(item: any, instance: any): number {
  return Number(item?.state ?? instance?.state ?? 0);
}

function checkPowerFilter(value: string, op: SearchFilter["op"], instance: any): boolean {
  const itemPower = Number(instance?.primaryStat?.value);
  const targetPower = Number(value);

  if (!Number.isFinite(itemPower) || !Number.isFinite(targetPower)) {
    return false;
  }

  return compareNumber(itemPower, targetPower, op);
}

function checkWeaponLevelFilter(
  value: string,
  op: SearchFilter["op"],
  instance: any,
): boolean {
  const weaponLevel = Number(
    instance?.crafting?.level ??
      instance?.craftedLevel ??
      instance?.weaponLevel ??
      instance?.level,
  );
  const targetLevel = Number(value);

  if (!Number.isFinite(weaponLevel) || !Number.isFinite(targetLevel)) {
    return false;
  }

  return compareNumber(weaponLevel, targetLevel, op);
}

function checkKillsFilter(
  value: string,
  op: SearchFilter["op"],
  item: any,
  instance: any,
): boolean {
  const killCount = Number(
    instance?.killTrackerValue ??
      instance?.kills ??
      item?.killTrackerValue ??
      item?.kills,
  );
  const targetKills = Number(value);

  if (!Number.isFinite(killCount) || !Number.isFinite(targetKills)) {
    return false;
  }

  return compareNumber(killCount, targetKills, op);
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

function checkAmmoTypeFilter(value: string, def: any): boolean {
  const targetAmmoType = AMMO_TYPE_BY_KEYWORD[value];
  if (!targetAmmoType) return false;

  return def.equippingBlock?.ammoType === targetAmmoType;
}

function checkItemCategoryFilter(
  value: string,
  def: any,
  normalizedItem?: DimItemMini
): boolean {
  const categoryHashes = ITEM_CATEGORY_FILTERS[value];
  if (!categoryHashes) return false;

  return (
    normalizedItem?.itemCategoryHashes.some((categoryHash) =>
      categoryHashes.includes(categoryHash)
    ) ?? checkItemCategoryHashes(def, categoryHashes)
  );
}

function checkItemCategoryHashes(def: any, categoryHashes: number[]): boolean {
  const itemCategoryHashes = def.itemCategoryHashes ?? [];

  return categoryHashes.some((categoryHash) => itemCategoryHashes.includes(categoryHash));
}

function checkClassFilter(value: string, def: any): boolean {
  const classType = CLASS_TYPE_BY_KEYWORD[value];
  if (classType === undefined) return false;

  return (
    def.classType === classType ||
    checkItemCategoryHashes(def, [
      value === "titan"
        ? ItemCategoryHashes.Titan
        : value === "hunter"
          ? ItemCategoryHashes.Hunter
          : ItemCategoryHashes.Warlock,
    ])
  );
}

function checkStatFilter(filter: SearchFilter, normalizedItem?: DimItemMini): boolean {
  if (!normalizedItem?.stats?.length) {
    return false;
  }

  const targetValue = Number(filter.value);
  if (!Number.isFinite(targetValue)) {
    return false;
  }

  const statValues = normalizedItem.stats.map((stat) =>
    filter.type === "basestat" ? stat.base : stat.value
  );
  const field = filter.field ?? "total";
  let itemValue: number | undefined;

  if (field === "total") {
    itemValue = statValues.reduce((total, value) => total + value, 0);
  } else if (field === "highest") {
    itemValue = [...statValues].sort((first, second) => second - first)[0];
  } else if (field === "secondhighest") {
    itemValue = [...statValues].sort((first, second) => second - first)[1];
  } else if (field === "highest&secondhighest") {
    const [highest = 0, secondHighest = 0] = [...statValues].sort(
      (first, second) => second - first
    );
    itemValue = Math.min(highest, secondHighest);
  } else if (field.includes("+") || field.includes("&")) {
    const separator = field.includes("+") ? "+" : "&";
    const fields = field.split(separator).map((part) => part.trim()).filter(Boolean);
    const values = fields.flatMap((fieldName) => {
      const statHash = STAT_HASH_BY_KEYWORD[fieldName] ?? Number(fieldName);
      const statValue = normalizedItem.stats?.find((stat) => stat.statHash === statHash)?.[
        filter.type === "basestat" ? "base" : "value"
      ];
      return Number.isFinite(statValue) ? [Number(statValue)] : [];
    });

    if (values.length !== fields.length) {
      return false;
    }

    const total = values.reduce((sum, value) => sum + value, 0);
    itemValue = separator === "&" ? total / values.length : total;
  } else {
    const statHash = STAT_HASH_BY_KEYWORD[field] ?? Number(field);
    itemValue = normalizedItem.stats.find((stat) => stat.statHash === statHash)?.[
      filter.type === "basestat" ? "base" : "value"
    ];
  }

  if (!Number.isFinite(itemValue)) {
    return false;
  }

  return compareNumber(Number(itemValue), targetValue, filter.op);
}

function plugTextMatches(plugDef: any, query: string, exactName: boolean): boolean {
  const normalizedQuery = query.toLowerCase();
  const name = String(plugDef?.displayProperties?.name ?? "").toLowerCase();
  const description = String(
    plugDef?.displayProperties?.description ?? "",
  ).toLowerCase();

  return exactName
    ? name === normalizedQuery
    : name.includes(normalizedQuery) || description.includes(normalizedQuery);
}

function checkExactPerkFilter(value: string, normalizedItem?: DimItemMini): boolean {
  if (!normalizedItem?.sockets) return false;

  return normalizedItem.sockets.allSockets.some((socket) => {
    if (!socket.isPerk) return false;
    return Boolean(socket.plugged && plugTextMatches(socket.plugged.plugDef, value, true));
  });
}

function checkSocketTextFilter(
  value: string,
  normalizedItem: DimItemMini | undefined,
  socketType: "mod" | "catalyst",
): boolean {
  if (!normalizedItem?.sockets) return false;

  const normalizedValue = value.toLowerCase();
  return normalizedItem.sockets.allSockets.some((socket) => {
    const socketMatchesType =
      socketType === "mod"
        ? socket.isMod
        : socket.plugOptions.some((plug) =>
            String(plug.plugDef?.plug?.plugCategoryIdentifier ?? "")
              .toLowerCase()
              .includes("catalyst"),
          );

    if (!socketMatchesType) return false;

    return socket.plugOptions.some((plug) => {
      return plugTextMatches(plug.plugDef, normalizedValue, false);
    });
  });
}

function checkHasFilter(
  value: string,
  def: any,
  normalizedItem?: DimItemMini,
): boolean {
  const normalizedValue = value.toLowerCase();

  switch (normalizedValue) {
    case "memento":
      return Boolean(normalizedItem && hasMemento(normalizedItem));
    case "origintrait":
    case "origin":
      return Boolean(normalizedItem && hasOriginTrait(normalizedItem));
    case "artifice":
      return Boolean(normalizedItem && isArtifice(normalizedItem));
    case "catalyst":
      return checkSocketTextFilter("", normalizedItem, "catalyst");
    case "mod":
      return checkSocketTextFilter("", normalizedItem, "mod");
    case "power":
      return Boolean(def.equippable);
    default:
      return Boolean(
        normalizedItem &&
          (dimItemFilters.perk(value)(normalizedItem) ||
            checkSocketTextFilter(value, normalizedItem, "mod") ||
            checkSocketTextFilter(value, normalizedItem, "catalyst")),
      );
  }
}

function checkTextPropertyFilter(
  filter: SearchFilter,
  def: any,
  normalizedItem?: DimItemMini
): boolean {
  const value = filter.value.toLowerCase();
  const searchableFields = [
    def.displaySource,
    def.sourceData?.sourceString,
    def.collectible?.sourceString,
    def.inventory?.tierTypeName,
    def.itemTypeDisplayName,
    def.itemTypeAndTierDisplayName,
    def.manufacturer,
    def.seasonHash,
    def.season,
    normalizedItem?.setBonus?.displayProperties?.name,
    normalizedItem?.masterworkInfo?.stats?.map((stat) => stat.name).join(" "),
  ];

  if (filter.field === "breaker") {
    searchableFields.push(
      ...(def.itemCategoryHashes ?? []).map((categoryHash: number) => String(categoryHash))
    );
  }

  return searchableFields
    .filter(Boolean)
    .some((fieldValue) => String(fieldValue).toLowerCase().includes(value));
}
