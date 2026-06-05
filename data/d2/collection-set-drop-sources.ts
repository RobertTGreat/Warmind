export type ArmorDropSlot =
  | "helmet"
  | "arms"
  | "chest"
  | "legs"
  | "class item";

export type DropSourceLabel = {
  shortLabel: string;
  label: string;
};

export type CollectionSetDropSource = {
  setName: string;
  itemNames?: string[];
  armorSlot?: ArmorDropSlot;
  allItems?: boolean;
  encounters: DropSourceLabel[];
};

const ANY = { shortLabel: "Any", label: "Any encounter" };
const QUEST = { shortLabel: "Quest", label: "Quest reward" };
const EPIC_RAID = { shortLabel: "Epic", label: "Epic Raid" };

const DESERT_FIRST = { shortLabel: "1", label: "1st: Agraios, Inherent" };
const DESERT_SECOND = { shortLabel: "2", label: "2nd: Iatros, Inward-Turned" };
const DESERT_THIRD = { shortLabel: "3", label: "3rd: Epoptes, Lord of Quanta" };
const DESERT_FINAL = { shortLabel: "F", label: "Final: Koregos, the Worldline" };

const SALVATION_FIRST = { shortLabel: "1", label: "1st: Substratum" };
const SALVATION_SECOND = { shortLabel: "2", label: "2nd: Herald of Finality" };
const SALVATION_THIRD = { shortLabel: "3", label: "3rd: Repository" };
const SALVATION_FOURTH = { shortLabel: "4", label: "4th: Verity" };
const SALVATION_FINAL = { shortLabel: "F", label: "Final: The Witness" };

const ROOT_FIRST = { shortLabel: "1", label: "1st: Survive the Onslaught" };
const ROOT_SECOND = { shortLabel: "2", label: "2nd: Enter the Root" };
const ROOT_THIRD = { shortLabel: "3", label: "3rd: Zo'aurc" };
const ROOT_FINAL = { shortLabel: "F", label: "Final: Nezarec" };

const KINGS_FIRST = { shortLabel: "1", label: "1st: Totems" };
const KINGS_SECOND = { shortLabel: "2", label: "2nd: Warpriest" };
const KINGS_THIRD = { shortLabel: "3", label: "3rd: Golgoroth" };
const KINGS_FOURTH = { shortLabel: "4", label: "4th: Daughters of Oryx" };
const KINGS_FINAL = { shortLabel: "F", label: "Final: Oryx" };

const CROTAS_FIRST = { shortLabel: "1", label: "1st: Enter the Abyss" };
const CROTAS_SECOND = { shortLabel: "2", label: "2nd: Cross the Bridge" };
const CROTAS_THIRD = { shortLabel: "3", label: "3rd: Ir Yut, the Deathsinger" };
const CROTAS_FINAL = { shortLabel: "F", label: "Final: Crota, Son of Oryx" };

const VOW_FIRST = { shortLabel: "1", label: "1st: Acquisition" };
const VOW_SECOND = { shortLabel: "2", label: "2nd: The Caretaker" };
const VOW_THIRD = { shortLabel: "3", label: "3rd: The Upended" };
const VOW_FINAL = { shortLabel: "F", label: "Final: Rhulk" };

const VAULT_FIRST = { shortLabel: "1", label: "1st: Conflux" };
const VAULT_SECOND = { shortLabel: "2", label: "2nd: Oracle" };
const VAULT_THIRD = { shortLabel: "3", label: "3rd: Templar" };
const VAULT_FOURTH = { shortLabel: "4", label: "4th: Gatekeeper" };
const VAULT_FINAL = { shortLabel: "F", label: "Final: Atheon" };

const DSC_FIRST = { shortLabel: "1", label: "1st: Crypt Security" };
const DSC_SECOND = { shortLabel: "2", label: "2nd: Atraks-1" };
const DSC_THIRD = { shortLabel: "3", label: "3rd: Rapture" };
const DSC_FINAL = { shortLabel: "F", label: "Final: The Abomination" };

const GARDEN_FIRST = { shortLabel: "1", label: "1st: Evade" };
const GARDEN_SECOND = { shortLabel: "2", label: "2nd: Summon" };
const GARDEN_THIRD = { shortLabel: "3", label: "3rd: Consecrated Mind" };
const GARDEN_FINAL = { shortLabel: "F", label: "Final: Sanctified Mind" };
const LAST_WISH_FINAL = { shortLabel: "F", label: "Final: Riven" };

const DUALITY_FIRST = { shortLabel: "1", label: "First" };
const DUALITY_SECOND = { shortLabel: "2", label: "Second" };
const DUALITY_FINAL = { shortLabel: "F", label: "Final" };

const SPIRE_FIRST = { shortLabel: "1", label: "First Encounter" };
const SPIRE_SECOND = { shortLabel: "2", label: "Second" };
const SPIRE_FINAL = { shortLabel: "F", label: "Final" };

const GHOSTS_FIRST = { shortLabel: "1", label: "Hive Ritual" };
const GHOSTS_SECOND = {
  shortLabel: "2",
  label: "Ecthar, the Shield of Ruin",
};
const GHOSTS_FINAL = { shortLabel: "F", label: "Simmumah, Ur-Nir (final)" };

const VESPERS_FIRST = { shortLabel: "1", label: "First" };
const VESPERS_SECOND = { shortLabel: "2", label: "Second" };
const VESPERS_FINAL = { shortLabel: "F", label: "Final" };

const SUNDERED_FIRST = { shortLabel: "1", label: "Solve the Riddle (First)" };
const SUNDERED_SECOND = {
  shortLabel: "2",
  label: "Zoetic, Lockset (Second)",
};
const SUNDERED_FINAL = { shortLabel: "F", label: "Kerrev, the Erased (Final)" };

const EQUILIBRIUM_FIRST = { shortLabel: "1", label: "First Encounter" };
const EQUILIBRIUM_SECOND = { shortLabel: "2", label: "Second Encounter" };
const EQUILIBRIUM_FINAL = { shortLabel: "F", label: "Final Boss" };

const WARLORD_FIRST = { shortLabel: "1", label: "First" };
const WARLORD_SECOND = { shortLabel: "2", label: "Second" };
const WARLORD_FINAL = { shortLabel: "F", label: "Final" };

const GRASP_FIRST = { shortLabel: "1", label: "First" };
const GRASP_SECOND = { shortLabel: "2", label: "Second" };
const GRASP_FINAL = { shortLabel: "F", label: "Final" };

const PROPHECY_FIRST = { shortLabel: "1", label: "Phalanx Echo" };
const PROPHECY_SECOND = { shortLabel: "2", label: "The Cube Room" };
const PROPHECY_FINAL = { shortLabel: "F", label: "Kell Echo (final)" };

const PRESAGE_COMPLETION = {
  shortLabel: "Mission",
  label: "Full Mission (Legends difficulty recommended)",
};
const VOX_COMPLETION = { shortLabel: "Mission", label: "Full Mission" };
const SERAPH_COMPLETION = {
  shortLabel: "Mission",
  label: "Full Mission (multiple sections)",
};
const STARCROSSED_COMPLETION = { shortLabel: "Mission", label: "Full Mission" };
const AVALON_COMPLETION = { shortLabel: "Mission", label: "Full Mission" };

export const COLLECTION_SET_DROP_SOURCES: CollectionSetDropSource[] = [
  {
    setName: "The Desert Perpetual",
    itemNames: [
      "Antedate",
      "Lance Ephemeral",
      "Intercalary",
    ],
    encounters: [DESERT_FIRST, DESERT_FINAL],
  },
  {
    setName: "The Desert Perpetual",
    itemNames: ["Finite Maybe", "The When and Where"],
    encounters: [DESERT_SECOND, DESERT_FINAL],
  },
  {
    setName: "The Desert Perpetual",
    itemNames: ["Opaque Hourglass"],
    encounters: [DESERT_THIRD, DESERT_FINAL],
  },
  {
    setName: "The Desert Perpetual",
    itemNames: ["Whirling Ovation"],
    encounters: [DESERT_FINAL],
  },
  {
    setName: "The Desert Perpetual",
    itemNames: ["Starscape Null", "Cusp Sempiternal", "The Ever-Present"],
    encounters: [EPIC_RAID],
  },
  {
    setName: "The Desert Perpetual",
    armorSlot: "legs",
    encounters: [DESERT_FIRST, DESERT_THIRD, DESERT_FINAL],
  },
  {
    setName: "The Desert Perpetual",
    armorSlot: "chest",
    encounters: [DESERT_SECOND, DESERT_FINAL],
  },
  {
    setName: "The Desert Perpetual",
    armorSlot: "class item",
    encounters: [DESERT_THIRD, DESERT_FINAL],
  },
  {
    setName: "The Desert Perpetual",
    armorSlot: "helmet",
    encounters: [DESERT_SECOND, DESERT_FINAL],
  },
  {
    setName: "The Desert Perpetual",
    armorSlot: "arms",
    encounters: [DESERT_THIRD, DESERT_FINAL],
  },

  {
    setName: "Salvation's Edge",
    itemNames: ["Nullify"],
    encounters: [SALVATION_FIRST, SALVATION_THIRD, SALVATION_FINAL],
  },
  {
    setName: "Salvation's Edge",
    itemNames: ["Summum Bonum"],
    encounters: [SALVATION_SECOND, SALVATION_FOURTH, SALVATION_FINAL],
  },
  {
    setName: "Salvation's Edge",
    itemNames: ["Non-Denouement"],
    encounters: [SALVATION_FIRST, SALVATION_SECOND, SALVATION_FOURTH],
  },
  {
    setName: "Salvation's Edge",
    itemNames: ["Critical Anomaly"],
    encounters: [SALVATION_THIRD, SALVATION_FINAL],
  },
  {
    setName: "Salvation's Edge",
    itemNames: ["Imminence"],
    encounters: [SALVATION_FIRST, SALVATION_SECOND, SALVATION_FOURTH],
  },
  {
    setName: "Salvation's Edge",
    itemNames: ["Forthcoming Deviance"],
    encounters: [SALVATION_SECOND, SALVATION_THIRD],
  },
  {
    setName: "Salvation's Edge",
    itemNames: ["Euphony"],
    encounters: [SALVATION_FINAL],
  },
  {
    setName: "Salvation's Edge",
    armorSlot: "arms",
    encounters: [SALVATION_FIRST, SALVATION_THIRD],
  },
  {
    setName: "Salvation's Edge",
    armorSlot: "helmet",
    encounters: [SALVATION_SECOND, SALVATION_FINAL],
  },
  {
    setName: "Salvation's Edge",
    armorSlot: "legs",
    encounters: [SALVATION_FOURTH, SALVATION_FINAL],
  },
  {
    setName: "Salvation's Edge",
    armorSlot: "chest",
    encounters: [SALVATION_FIRST],
  },
  {
    setName: "Salvation's Edge",
    armorSlot: "class item",
    encounters: [SALVATION_SECOND],
  },

  {
    setName: "Root of Nightmares",
    itemNames: [
      "Briar's Contempt",
      "Mykel's Reverence",
      "Koraxis's Distress",
      "Rufus's Fury",
      "Nessa's Oblation",
      "Acasia's Dejection",
    ],
    encounters: [ROOT_FINAL],
  },
  {
    setName: "Root of Nightmares",
    itemNames: ["Briar's Contempt"],
    encounters: [ROOT_FIRST],
  },
  {
    setName: "Root of Nightmares",
    itemNames: ["Mykel's Reverence"],
    encounters: [ROOT_SECOND, ROOT_THIRD],
  },
  {
    setName: "Root of Nightmares",
    itemNames: ["Koraxis's Distress"],
    encounters: [ROOT_FIRST, ROOT_SECOND, ROOT_THIRD],
  },
  {
    setName: "Root of Nightmares",
    itemNames: ["Rufus's Fury"],
    encounters: [ROOT_THIRD],
  },
  {
    setName: "Root of Nightmares",
    itemNames: ["Nessa's Oblation"],
    encounters: [ROOT_FIRST, ROOT_SECOND],
  },
  {
    setName: "Root of Nightmares",
    itemNames: ["Acasia's Dejection"],
    encounters: [ROOT_SECOND, ROOT_THIRD],
  },
  {
    setName: "Root of Nightmares",
    itemNames: ["Conditional Finality"],
    encounters: [ROOT_FINAL],
  },
  {
    setName: "Root of Nightmares",
    armorSlot: "chest",
    encounters: [ROOT_FIRST, ROOT_SECOND, ROOT_THIRD],
  },
  {
    setName: "Root of Nightmares",
    armorSlot: "helmet",
    encounters: [ROOT_FIRST, ROOT_FINAL],
  },
  {
    setName: "Root of Nightmares",
    armorSlot: "arms",
    encounters: [ROOT_FIRST, ROOT_SECOND],
  },
  {
    setName: "Root of Nightmares",
    armorSlot: "class item",
    encounters: [ROOT_THIRD, ROOT_FINAL],
  },
  {
    setName: "Root of Nightmares",
    armorSlot: "legs",
    encounters: [ROOT_SECOND, ROOT_THIRD, ROOT_FINAL],
  },

  {
    setName: "King's Fall",
    itemNames: [
      "Doom of Chelchis",
      "Smite of Merain",
      "Qullim's Terminus",
      "Defiance of Yasmin",
      "Midha's Reckoning",
      "Zaouli's Bane",
    ],
    encounters: [KINGS_FINAL],
  },
  {
    setName: "King's Fall",
    itemNames: ["Doom of Chelchis"],
    encounters: [KINGS_FIRST],
  },
  {
    setName: "King's Fall",
    itemNames: ["Smite of Merain", "Defiance of Yasmin"],
    encounters: [KINGS_SECOND, KINGS_FOURTH],
  },
  {
    setName: "King's Fall",
    itemNames: ["Qullim's Terminus"],
    encounters: [KINGS_FIRST, KINGS_THIRD],
  },
  {
    setName: "King's Fall",
    itemNames: ["Midha's Reckoning"],
    encounters: [KINGS_THIRD],
  },
  {
    setName: "King's Fall",
    itemNames: ["Zaouli's Bane"],
    encounters: [KINGS_THIRD, KINGS_FOURTH],
  },
  {
    setName: "King's Fall",
    itemNames: ["Touch of Malice"],
    encounters: [KINGS_FINAL],
  },
  {
    setName: "King's Fall",
    armorSlot: "class item",
    encounters: [KINGS_FIRST],
  },
  {
    setName: "King's Fall",
    armorSlot: "arms",
    encounters: [KINGS_SECOND, KINGS_FOURTH, KINGS_FINAL],
  },
  {
    setName: "King's Fall",
    armorSlot: "helmet",
    encounters: [KINGS_THIRD, KINGS_FINAL],
  },
  {
    setName: "King's Fall",
    armorSlot: "chest",
    encounters: [KINGS_FIRST, KINGS_SECOND, KINGS_FOURTH],
  },
  {
    setName: "King's Fall",
    armorSlot: "legs",
    encounters: [KINGS_FIRST, KINGS_THIRD],
  },

  {
    setName: "Crota's End",
    itemNames: ["Song of Ir Yut"],
    encounters: [CROTAS_FIRST, CROTAS_THIRD],
  },
  {
    setName: "Crota's End",
    itemNames: ["Swordbreaker"],
    encounters: [CROTAS_SECOND, CROTAS_FINAL],
  },
  {
    setName: "Crota's End",
    itemNames: ["Word of Crota"],
    encounters: [CROTAS_THIRD, CROTAS_FINAL],
  },
  {
    setName: "Crota's End",
    itemNames: ["Fang of Ir Yut"],
    encounters: [CROTAS_FIRST, CROTAS_SECOND],
  },
  {
    setName: "Crota's End",
    itemNames: ["Abyss Defiant"],
    encounters: [CROTAS_FIRST, CROTAS_FINAL],
  },
  {
    setName: "Crota's End",
    itemNames: ["Oversoul Edict"],
    encounters: [CROTAS_SECOND, CROTAS_THIRD],
  },
  {
    setName: "Crota's End",
    itemNames: ["Necrochasm"],
    encounters: [QUEST],
  },
  {
    setName: "Crota's End",
    armorSlot: "chest",
    encounters: [CROTAS_FIRST, CROTAS_SECOND, CROTAS_THIRD],
  },
  {
    setName: "Crota's End",
    armorSlot: "helmet",
    encounters: [CROTAS_FIRST, CROTAS_FINAL],
  },
  {
    setName: "Crota's End",
    armorSlot: "arms",
    encounters: [CROTAS_FIRST, CROTAS_SECOND],
  },
  {
    setName: "Crota's End",
    armorSlot: "class item",
    encounters: [CROTAS_THIRD, CROTAS_FINAL],
  },
  {
    setName: "Crota's End",
    armorSlot: "legs",
    encounters: [CROTAS_SECOND, CROTAS_THIRD, CROTAS_FINAL],
  },

  {
    setName: "Vow of the Disciple",
    itemNames: ["Submission"],
    encounters: [VOW_FIRST, VOW_SECOND, VOW_THIRD],
  },
  {
    setName: "Vow of the Disciple",
    itemNames: ["Deliverance"],
    encounters: [VOW_FIRST, VOW_THIRD],
  },
  {
    setName: "Vow of the Disciple",
    itemNames: ["Insidious", "Forbearance"],
    encounters: [VOW_SECOND, VOW_FINAL],
  },
  {
    setName: "Vow of the Disciple",
    itemNames: ["Cataclysmic"],
    encounters: [VOW_FIRST, VOW_SECOND],
  },
  {
    setName: "Vow of the Disciple",
    itemNames: ["Lubrae's Ruin", "Collective Obligation"],
    encounters: [VOW_FINAL],
  },
  {
    setName: "Vow of the Disciple",
    armorSlot: "helmet",
    encounters: [VOW_FIRST, VOW_SECOND, VOW_FINAL],
  },
  {
    setName: "Vow of the Disciple",
    armorSlot: "chest",
    encounters: [VOW_FIRST, VOW_THIRD],
  },
  {
    setName: "Vow of the Disciple",
    armorSlot: "arms",
    encounters: [VOW_SECOND, VOW_FINAL],
  },
  {
    setName: "Vow of the Disciple",
    armorSlot: "legs",
    encounters: [VOW_FIRST, VOW_THIRD],
  },
  {
    setName: "Vow of the Disciple",
    armorSlot: "class item",
    encounters: [VOW_SECOND, VOW_FINAL],
  },

  {
    setName: "Vault of Glass",
    itemNames: ["Vision of Confluence"],
    encounters: [VAULT_FIRST, VAULT_SECOND, VAULT_THIRD],
  },
  {
    setName: "Vault of Glass",
    itemNames: ["Praedyth's Revenge"],
    encounters: [VAULT_SECOND, VAULT_FINAL],
  },
  {
    setName: "Vault of Glass",
    itemNames: ["Fatebringer"],
    encounters: [VAULT_THIRD, VAULT_FOURTH],
  },
  {
    setName: "Vault of Glass",
    itemNames: ["Found Verdict"],
    encounters: [VAULT_FIRST, VAULT_SECOND, VAULT_FOURTH],
  },
  {
    setName: "Vault of Glass",
    itemNames: ["Hezen Vengeance"],
    encounters: [VAULT_FOURTH, VAULT_FINAL],
  },
  {
    setName: "Vault of Glass",
    itemNames: ["Corrective Measure"],
    encounters: [VAULT_FIRST, VAULT_THIRD, VAULT_FINAL],
  },
  {
    setName: "Vault of Glass",
    itemNames: ["Vex Mythoclast"],
    encounters: [VAULT_FINAL],
  },
  {
    setName: "Vault of Glass",
    armorSlot: "arms",
    encounters: [VAULT_FIRST, VAULT_SECOND, VAULT_THIRD],
  },
  {
    setName: "Vault of Glass",
    armorSlot: "helmet",
    encounters: [VAULT_FOURTH, VAULT_FINAL],
  },
  {
    setName: "Vault of Glass",
    armorSlot: "class item",
    encounters: [VAULT_FIRST],
  },
  {
    setName: "Vault of Glass",
    armorSlot: "legs",
    encounters: [VAULT_SECOND, VAULT_FOURTH],
  },
  {
    setName: "Vault of Glass",
    armorSlot: "chest",
    encounters: [VAULT_THIRD, VAULT_FINAL],
  },

  {
    setName: "Deep Stone Crypt",
    itemNames: ["Trustee"],
    encounters: [DSC_FIRST],
  },
  {
    setName: "Deep Stone Crypt",
    itemNames: ["Succession", "Heritage"],
    encounters: [DSC_SECOND],
  },
  {
    setName: "Deep Stone Crypt",
    itemNames: ["Posterity"],
    encounters: [DSC_THIRD],
  },
  {
    setName: "Deep Stone Crypt",
    itemNames: ["Bequest", "Commemoration", "Eyes of Tomorrow"],
    encounters: [DSC_FINAL],
  },
  {
    setName: "Deep Stone Crypt",
    armorSlot: "arms",
    encounters: [DSC_FIRST, DSC_SECOND, DSC_THIRD],
  },
  {
    setName: "Deep Stone Crypt",
    armorSlot: "chest",
    encounters: [DSC_THIRD, DSC_FINAL],
  },
  {
    setName: "Deep Stone Crypt",
    armorSlot: "helmet",
    encounters: [DSC_FINAL],
  },
  {
    setName: "Deep Stone Crypt",
    armorSlot: "legs",
    encounters: [DSC_FIRST, DSC_SECOND, DSC_FINAL],
  },
  {
    setName: "Deep Stone Crypt",
    armorSlot: "class item",
    encounters: [DSC_FIRST, DSC_SECOND, DSC_THIRD],
  },

  {
    setName: "Garden of Salvation",
    itemNames: ["Zealot's Reward", "Accrued Redemption"],
    encounters: [GARDEN_FIRST],
  },
  {
    setName: "Garden of Salvation",
    itemNames: ["Prophet of Doom", "Reckless Oracle"],
    encounters: [GARDEN_SECOND],
  },
  {
    setName: "Garden of Salvation",
    itemNames: ["Ancient Gospel", "Sacred Provenance"],
    encounters: [GARDEN_THIRD],
  },
  {
    setName: "Garden of Salvation",
    itemNames: ["Omniscient Eye"],
    encounters: [GARDEN_FINAL],
  },
  {
    setName: "Garden of Salvation",
    itemNames: ["Divinity"],
    encounters: [QUEST],
  },
  {
    setName: "Garden of Salvation",
    armorSlot: "legs",
    encounters: [GARDEN_FIRST],
  },
  {
    setName: "Garden of Salvation",
    armorSlot: "arms",
    encounters: [GARDEN_SECOND],
  },
  {
    setName: "Garden of Salvation",
    armorSlot: "chest",
    encounters: [GARDEN_THIRD],
  },
  {
    setName: "Garden of Salvation",
    armorSlot: "helmet",
    encounters: [GARDEN_FINAL],
  },
  {
    setName: "Garden of Salvation",
    armorSlot: "class item",
    encounters: [GARDEN_FINAL],
  },

  {
    setName: "Last Wish",
    itemNames: [
      "Chattering Bone",
      "The Supremacy",
      "Transfiguration",
      "Apex Predator",
      "Age-Old Bond",
      "Nation of Beasts",
      "Techeun Force",
      "Tyranny of Heaven",
    ],
    encounters: [ANY],
  },
  {
    setName: "Last Wish",
    itemNames: ["One Thousand Voices"],
    encounters: [LAST_WISH_FINAL],
  },
  {
    setName: "Last Wish",
    armorSlot: "helmet",
    encounters: [ANY],
  },
  {
    setName: "Last Wish",
    armorSlot: "arms",
    encounters: [ANY],
  },
  {
    setName: "Last Wish",
    armorSlot: "chest",
    encounters: [ANY],
  },
  {
    setName: "Last Wish",
    armorSlot: "legs",
    encounters: [ANY],
  },
  {
    setName: "Last Wish",
    armorSlot: "class item",
    encounters: [ANY],
  },

  {
    setName: "Duality",
    itemNames: [
      "Lingering Dread",
      "New Purpose",
      "Stormchaser",
      "Unforgiven",
      "Fixed Odds",
      "The Epicurean",
    ],
    encounters: [DUALITY_FIRST, DUALITY_SECOND],
  },
  {
    setName: "Duality",
    itemNames: ["Heartshadow"],
    encounters: [DUALITY_FINAL],
  },
  {
    setName: "Duality",
    armorSlot: "helmet",
    encounters: [DUALITY_FIRST, DUALITY_FINAL],
  },
  {
    setName: "Duality",
    armorSlot: "arms",
    encounters: [DUALITY_FIRST, DUALITY_FINAL],
  },
  {
    setName: "Duality",
    armorSlot: "chest",
    encounters: [DUALITY_FIRST, DUALITY_FINAL],
  },
  {
    setName: "Duality",
    armorSlot: "legs",
    encounters: [DUALITY_FIRST, DUALITY_FINAL],
  },
  {
    setName: "Duality",
    armorSlot: "class item",
    encounters: [DUALITY_FIRST, DUALITY_FINAL],
  },

  {
    setName: "Spire of the Watcher",
    itemNames: ["Terminus Horizon"],
    encounters: [SPIRE_FIRST, SPIRE_SECOND],
  },
  {
    setName: "Spire of the Watcher",
    itemNames: [
      "Long Arm",
      "Liminal Vigil",
      "Wilderflight",
      "Seventh Seraph Carbine",
      "Seventh Seraph Officer Revolver",
    ],
    encounters: [SPIRE_SECOND],
  },
  {
    setName: "Spire of the Watcher",
    itemNames: ["Hierarchy of Needs"],
    encounters: [SPIRE_FINAL],
  },
  {
    setName: "Spire of the Watcher",
    armorSlot: "helmet",
    encounters: [SPIRE_FIRST, SPIRE_SECOND, SPIRE_FINAL],
  },
  {
    setName: "Spire of the Watcher",
    armorSlot: "arms",
    encounters: [SPIRE_FIRST, SPIRE_SECOND, SPIRE_FINAL],
  },
  {
    setName: "Spire of the Watcher",
    armorSlot: "chest",
    encounters: [SPIRE_FIRST, SPIRE_SECOND, SPIRE_FINAL],
  },
  {
    setName: "Spire of the Watcher",
    armorSlot: "legs",
    encounters: [SPIRE_FIRST, SPIRE_SECOND, SPIRE_FINAL],
  },
  {
    setName: "Spire of the Watcher",
    armorSlot: "class item",
    encounters: [SPIRE_FIRST, SPIRE_SECOND, SPIRE_FINAL],
  },

  {
    setName: "Ghosts of the Deep",
    itemNames: ["No Survivors"],
    encounters: [GHOSTS_FIRST],
  },
  {
    setName: "Ghosts of the Deep",
    itemNames: ["The Navigator", "New Pacific Epitaph"],
    encounters: [GHOSTS_SECOND],
  },
  {
    setName: "Ghosts of the Deep",
    itemNames: ["Greasy Luck", "Cold Comfort"],
    encounters: [GHOSTS_FINAL],
  },
  {
    setName: "Ghosts of the Deep",
    armorSlot: "helmet",
    encounters: [GHOSTS_FIRST, GHOSTS_FINAL],
  },
  {
    setName: "Ghosts of the Deep",
    armorSlot: "arms",
    encounters: [GHOSTS_FIRST, GHOSTS_FINAL],
  },
  {
    setName: "Ghosts of the Deep",
    armorSlot: "chest",
    encounters: [GHOSTS_SECOND, GHOSTS_FINAL],
  },
  {
    setName: "Ghosts of the Deep",
    armorSlot: "legs",
    encounters: [GHOSTS_SECOND, GHOSTS_FINAL],
  },
  {
    setName: "Ghosts of the Deep",
    armorSlot: "class item",
    encounters: [GHOSTS_FINAL],
  },

  {
    setName: "Vesper's Host",
    itemNames: [
      "VS Chill Inhibitor",
      "VS Gravitic Arrest",
      "VS Velocity Baton",
      "VS Pyroelectric Propellant",
    ],
    encounters: [VESPERS_FIRST, VESPERS_SECOND],
  },
  {
    setName: "Vesper's Host",
    itemNames: ["Ice Breaker"],
    encounters: [VESPERS_FINAL],
  },
  {
    setName: "Vesper's Host",
    armorSlot: "chest",
    encounters: [VESPERS_FIRST, VESPERS_SECOND, VESPERS_FINAL],
  },
  {
    setName: "Vesper's Host",
    armorSlot: "helmet",
    encounters: [VESPERS_FIRST, VESPERS_SECOND, VESPERS_FINAL],
  },
  {
    setName: "Vesper's Host",
    armorSlot: "arms",
    encounters: [VESPERS_FIRST, VESPERS_SECOND, VESPERS_FINAL],
  },
  {
    setName: "Vesper's Host",
    armorSlot: "class item",
    encounters: [VESPERS_FIRST, VESPERS_SECOND, VESPERS_FINAL],
  },
  {
    setName: "Vesper's Host",
    armorSlot: "legs",
    encounters: [VESPERS_FIRST, VESPERS_SECOND, VESPERS_FINAL],
  },

  {
    setName: "Sundered Doctrine",
    itemNames: ["Unworthy", "Unsworn"],
    encounters: [SUNDERED_FIRST, SUNDERED_SECOND, SUNDERED_FINAL],
  },
  {
    setName: "Sundered Doctrine",
    itemNames: ["Unloved"],
    encounters: [SUNDERED_FIRST, SUNDERED_FINAL],
  },
  {
    setName: "Sundered Doctrine",
    itemNames: ["Unvoiced"],
    encounters: [SUNDERED_SECOND, SUNDERED_FINAL],
  },
  {
    setName: "Sundered Doctrine",
    itemNames: ["Finality's Auger"],
    encounters: [SUNDERED_FINAL],
  },
  {
    setName: "Sundered Doctrine",
    armorSlot: "helmet",
    encounters: [SUNDERED_FIRST, SUNDERED_SECOND, SUNDERED_FINAL],
  },
  {
    setName: "Sundered Doctrine",
    armorSlot: "arms",
    encounters: [SUNDERED_FIRST, SUNDERED_SECOND, SUNDERED_FINAL],
  },
  {
    setName: "Sundered Doctrine",
    armorSlot: "legs",
    encounters: [SUNDERED_FIRST, SUNDERED_SECOND, SUNDERED_FINAL],
  },
  {
    setName: "Sundered Doctrine",
    armorSlot: "chest",
    encounters: [SUNDERED_FINAL],
  },
  {
    setName: "Sundered Doctrine",
    armorSlot: "class item",
    encounters: [SUNDERED_FINAL],
  },

  {
    setName: "Equilibrium",
    itemNames: [
      "Zealous Ideal",
      "Voltaic Shade",
      "Bitter End",
      "Conspiracy Honed",
      "High Tyrant",
      "Sullen Claw",
    ],
    encounters: [EQUILIBRIUM_FIRST, EQUILIBRIUM_SECOND],
  },
  {
    setName: "Equilibrium",
    itemNames: ["Heirloom"],
    encounters: [EQUILIBRIUM_FINAL],
  },
  {
    setName: "Equilibrium",
    armorSlot: "helmet",
    encounters: [EQUILIBRIUM_FIRST, EQUILIBRIUM_FINAL],
  },
  {
    setName: "Equilibrium",
    armorSlot: "arms",
    encounters: [EQUILIBRIUM_FIRST, EQUILIBRIUM_FINAL],
  },
  {
    setName: "Equilibrium",
    armorSlot: "chest",
    encounters: [EQUILIBRIUM_SECOND, EQUILIBRIUM_FINAL],
  },
  {
    setName: "Equilibrium",
    armorSlot: "legs",
    encounters: [EQUILIBRIUM_SECOND, EQUILIBRIUM_FINAL],
  },
  {
    setName: "Equilibrium",
    armorSlot: "class item",
    encounters: [EQUILIBRIUM_FINAL],
  },

  {
    setName: "Warlord's Ruin",
    itemNames: [
      "Vengeful Whisper",
      "Indebted Kindness",
      "Naeem's Lance",
      "Dragoncult Sickle",
    ],
    encounters: [WARLORD_FIRST, WARLORD_SECOND],
  },
  {
    setName: "Warlord's Ruin",
    itemNames: ["Buried Bloodline"],
    encounters: [WARLORD_FINAL],
  },
  {
    setName: "Warlord's Ruin",
    armorSlot: "helmet",
    encounters: [WARLORD_FIRST, WARLORD_FINAL],
  },
  {
    setName: "Warlord's Ruin",
    armorSlot: "arms",
    encounters: [WARLORD_FIRST, WARLORD_FINAL],
  },
  {
    setName: "Warlord's Ruin",
    armorSlot: "chest",
    encounters: [WARLORD_FIRST, WARLORD_FINAL],
  },
  {
    setName: "Warlord's Ruin",
    armorSlot: "legs",
    encounters: [WARLORD_FIRST, WARLORD_FINAL],
  },
  {
    setName: "Warlord's Ruin",
    armorSlot: "class item",
    encounters: [WARLORD_FIRST, WARLORD_FINAL],
  },

  {
    setName: "Grasp of Avarice",
    itemNames: ["Matador 64", "Eyasluna", "1000 Yard Stare", "Hero of Ages"],
    encounters: [GRASP_FIRST, GRASP_SECOND, GRASP_FINAL],
  },
  {
    setName: "Grasp of Avarice",
    itemNames: ["Gjallarhorn"],
    encounters: [GRASP_FINAL],
  },
  {
    setName: "Grasp of Avarice",
    armorSlot: "helmet",
    encounters: [GRASP_FIRST, GRASP_SECOND, GRASP_FINAL],
  },
  {
    setName: "Grasp of Avarice",
    armorSlot: "arms",
    encounters: [GRASP_FIRST, GRASP_SECOND, GRASP_FINAL],
  },
  {
    setName: "Grasp of Avarice",
    armorSlot: "chest",
    encounters: [GRASP_FIRST, GRASP_SECOND, GRASP_FINAL],
  },
  {
    setName: "Grasp of Avarice",
    armorSlot: "legs",
    encounters: [GRASP_FIRST, GRASP_SECOND, GRASP_FINAL],
  },
  {
    setName: "Grasp of Avarice",
    armorSlot: "class item",
    encounters: [GRASP_FIRST, GRASP_SECOND, GRASP_FINAL],
  },

  {
    setName: "Prophecy",
    itemNames: ["Prosecutor", "Relentless"],
    encounters: [PROPHECY_FIRST, PROPHECY_FINAL],
  },
  {
    setName: "Prophecy",
    itemNames: ["A Sudden Death", "Adjudicator"],
    encounters: [PROPHECY_SECOND, PROPHECY_FINAL],
  },
  {
    setName: "Prophecy",
    itemNames: ["Judgment", "Darkest Before"],
    encounters: [PROPHECY_FINAL],
  },
  {
    setName: "Prophecy",
    armorSlot: "helmet",
    encounters: [PROPHECY_FINAL],
  },
  {
    setName: "Prophecy",
    armorSlot: "arms",
    encounters: [PROPHECY_SECOND, PROPHECY_FINAL],
  },
  {
    setName: "Prophecy",
    armorSlot: "chest",
    encounters: [PROPHECY_FINAL],
  },
  {
    setName: "Prophecy",
    armorSlot: "legs",
    encounters: [PROPHECY_FIRST, PROPHECY_FINAL],
  },
  {
    setName: "Prophecy",
    armorSlot: "class item",
    encounters: [PROPHECY_FIRST, PROPHECY_FINAL],
  },

  {
    setName: "Starcrossed",
    allItems: true,
    encounters: [STARCROSSED_COMPLETION],
  },
  {
    setName: "//node.ovrd.AVALON//",
    allItems: true,
    encounters: [AVALON_COMPLETION],
  },
  {
    setName: "Avalon",
    allItems: true,
    encounters: [AVALON_COMPLETION],
  },
  {
    setName: "Operation: Seraph's Shield",
    allItems: true,
    encounters: [SERAPH_COMPLETION],
  },
  {
    setName: "Vox Obscura",
    allItems: true,
    encounters: [VOX_COMPLETION],
  },
  {
    setName: "Presage",
    allItems: true,
    encounters: [PRESAGE_COMPLETION],
  },
];
