export const DEFAULT_PAGE_OPTIONS = [
  {
    value: "/",
    label: "Home",
    description: "News, clan roster, and fireteam overview",
  },
  {
    value: "/character",
    label: "Character",
    description: "Character equipment overview",
  },
  {
    value: "/character/inventory",
    label: "Inventory",
    description: "Inventory and vault management",
  },
  {
    value: "/character/loadouts",
    label: "Loadouts",
    description: "Saved builds and equipment sets",
  },
  {
    value: "/character/optimizer",
    label: "Optimizer",
    description: "Armor stat build planner",
  },
  {
    value: "/collections",
    label: "Collections",
    description: "Weapons, armor, and collectibles",
  },
  {
    value: "/triumphs",
    label: "Triumphs",
    description: "Achievements, seals, and score",
  },
  {
    value: "/quests",
    label: "Quests",
    description: "Active quests and pursuits",
  },
  {
    value: "/activity",
    label: "Activities",
    description: "Recent activity reports",
  },
  {
    value: "/activity/wrapped",
    label: "Wrapped",
    description: "Seasonal activity summaries",
  },
] as const;

export type DefaultPage = (typeof DEFAULT_PAGE_OPTIONS)[number]["value"];

export const DEFAULT_PAGE_FALLBACK: DefaultPage = "/";

export function isDefaultPage(page: string): page is DefaultPage {
  return DEFAULT_PAGE_OPTIONS.some((option) => option.value === page);
}
