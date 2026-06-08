import type { ActivityHistoryItem } from "@/hooks/useActivityHistory";
import {
  getActivityTypeSortIndex,
  type ActivityDefinition,
} from "@/lib/activityDefinitions";

// Report grouping and special-clear rules are adapted from Kigstn/DestinyActivityReport.
export type ActivitySortDirection = "asc" | "desc";

export type ActivitySortKey =
  | "activity"
  | "type"
  | "totalClears"
  | "clears"
  | "specialClears"
  | "failedClears"
  | "fastest"
  | "average"
  | "totalTime"
  | "kills"
  | "assists"
  | "deaths"
  | "recent";

export interface ActivityRunSummary {
  instanceId: string;
  referenceId: number;
  period: string;
  durationSeconds: number;
  completed: boolean;
  kills: number;
  deaths: number;
  assists: number;
  playerCount: number | null;
  characterId?: string;
  specialTags: string[];
  specialTagLabels: Record<string, string>;
}

export interface ActivityTagCount {
  amount: number;
  instanceId: string;
  label?: string;
}

export interface ActivityReportSummary {
  activity: ActivityDefinition;
  runs: ActivityRunSummary[];
  completedRuns: ActivityRunSummary[];
  failedRuns: ActivityRunSummary[];
  regularClears: number;
  specialClears: number;
  failedClears: number;
  totalClears: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  totalSeconds: number;
  fastestSeconds: number | null;
  averageSeconds: number | null;
  kd: number | null;
  specialTagCounts: Record<string, ActivityTagCount>;
  latestRun: ActivityRunSummary | null;
}

export const ACTIVITY_SPECIAL_TAGS = [
  "Personal Flawless",
  "Solo",
  "Solo Flawless",
  "Duo",
  "Duo Flawless",
  "Trio",
  "Trio Flawless",
  "Contest",
  "Day One",
];

const MINIMUM_SPECIAL_CLEAR_SECONDS = 60 * 3;
const DEFAULT_ACTIVITY_RELEASE_HOUR_UTC = 17;
const DAY_ONE_WINDOW_MS = 24 * 60 * 60 * 1000;
const WEEK_ONE_WINDOW_MS = 7 * DAY_ONE_WINDOW_MS;

const EXCLUDED_SPECIAL_PERIODS = [
  {
    reason: "Weapon crafting exploit period",
    start: new Date("2023-09-15T18:00:00.000Z"),
    end: new Date("2023-09-18T18:00:00.000Z"),
  },
];

export interface ActivityDefinitionContext {
  hash?: number;
  displayProperties?: {
    name?: string;
    description?: string;
  };
  originalDisplayProperties?: {
    name?: string;
  };
  selectionScreenDisplayProperties?: {
    name?: string;
  };
  pgcrImage?: string;
  activityTypeHash?: number;
  directActivityModeHash?: number;
  activityTypeName?: string;
  directActivityModeName?: string;
  directActivityModeType?: number;
  activityModeTypes?: number[];
  matchmaking?: {
    isMatchmade?: boolean;
    maxPlayers?: number;
  };
  isPlaylist?: boolean;
  isPvP?: boolean;
  blacklisted?: boolean;
  redacted?: boolean;
}

const ACTIVITY_MODE_LABELS: Record<number, string> = {
  2: "Story",
  3: "Strike",
  4: "Raid",
  5: "All PvP",
  6: "Patrol",
  7: "All PvE",
  10: "Control",
  15: "Crimson Doubles",
  16: "Nightfall",
  17: "Heroic Nightfall",
  18: "All Strikes",
  19: "Iron Banner",
  31: "Supremacy",
  32: "Private Match",
  37: "Survival",
  38: "Countdown",
  39: "Trials of the Nine",
  40: "Social",
  46: "Trials Countdown",
  47: "Trials Survival",
  48: "Iron Banner Control",
  49: "Iron Banner Clash",
  50: "Iron Banner Supremacy",
  51: "Scored Nightfall",
  52: "Scored Heroic Nightfall",
  56: "Mayhem",
  57: "Rumble",
  58: "Heroic Adventure",
  59: "Showdown",
  60: "Lockdown",
  61: "Scorched",
  62: "Scorched Team",
  63: "Gambit",
  64: "All PvE Competitive",
  65: "Breakthrough",
  66: "Black Armory Run",
  67: "Salvage",
  68: "Iron Banner Salvage",
  69: "PvP Competitive",
  70: "PvP Quickplay",
  71: "Clash",
  72: "Clash Quickplay",
  73: "Clash Competitive",
  74: "Control Quickplay",
  75: "Control Competitive",
  76: "Gambit Prime",
  77: "Reckoning",
  78: "Menagerie",
  79: "Vex Offensive",
  80: "Nightmare Hunt",
  81: "Elimination",
  82: "Dungeon",
  83: "Sundial",
  84: "Trials of Osiris",
  85: "Dares",
  86: "Offensive",
  87: "Lost Sector",
  88: "Rift",
  89: "Zone Control",
  90: "Iron Banner Rift",
};

const CRUCIBLE_MODE_TYPES = new Set([
  5, 10, 15, 19, 31, 32, 37, 38, 39, 46, 47, 48, 49, 50, 56, 57, 59, 60, 61,
  62, 65, 67, 68, 69, 70, 71, 72, 73, 74, 75, 81, 84, 88, 89, 90,
]);
const GAMBIT_MODE_TYPES = new Set([63, 76]);
const PINNACLE_MODE_TYPES = new Set([16, 17, 51, 52]);
const STRIKE_MODE_TYPES = new Set([3, 18]);
const ARENA_MODE_TYPES = new Set([77, 78, 83, 85]);
const SEASONAL_MODE_TYPES = new Set([66, 79, 86]);
const SOLO_MODE_TYPES = new Set([2, 58, 87]);
const EXPLORATION_MODE_TYPES = new Set([6]);
const SOCIAL_MODE_TYPES = new Set([40]);
const FIRETEAM_MODE_TYPES = new Set([7, 64, 80]);

interface ObservedModeBucket {
  label: string;
  type: ActivityDefinition["type"];
  modeType: number;
  activityHashes: Set<number>;
  groupKeys: Set<string>;
  tags: Set<string>;
  maxPlayers?: number;
  image?: string;
}

interface ManifestActivityBucket {
  name: string;
  type: ActivityDefinition["type"];
  modeType: number;
  activityHashes: Set<number>;
  tags: Set<string>;
  maxPlayers?: number;
  image?: string;
}

export function collectActivityReferenceHashes(history: ActivityHistoryItem[]): number[] {
  return [...new Set(history.map((historyItem) => historyItem.activityDetails.referenceId))]
    .filter(Number.isFinite)
    .sort((firstHash, secondHash) => firstHash - secondHash);
}

export function buildManifestActivityCatalog(
  baseActivities: ActivityDefinition[],
  activityDefinitions: Record<string, ActivityDefinitionContext>
): ActivityDefinition[] {
  const manifestBuckets = buildManifestActivityBuckets(activityDefinitions);
  const baseActivityGroupKeys = new Set(baseActivities.map((activity) => normalizeActivityGroupName(activity.name)));
  const mergedBaseActivities = baseActivities.map((activity) => {
    const groupKey = normalizeActivityGroupName(activity.name);
    const bucket = manifestBuckets.get(groupKey);
    const activityWithDefinitionTags = addActivityTagsFromDefinitions(activity, activityDefinitions);

    if (!bucket) {
      return activityWithDefinitionTags;
    }

    return mergeManifestBucketIntoActivity(activityWithDefinitionTags, bucket);
  });
  const manifestOnlyActivities = [...manifestBuckets.entries()]
    .filter(([groupKey]) => !baseActivityGroupKeys.has(groupKey))
    .map(([groupKey, bucket]) => buildManifestOnlyActivity(groupKey, bucket))
    .sort(compareActivitiesByTypeAndName);

  return [
    ...mergedBaseActivities,
    ...manifestOnlyActivities,
  ];
}

export function buildActivityCatalog(
  baseActivities: ActivityDefinition[],
  history: ActivityHistoryItem[],
  activityDefinitions: Record<string, ActivityDefinitionContext>,
  includeObservedActivities: boolean
): ActivityDefinition[] {
  const knownActivities = baseActivities.map((activity) => ({
    ...activity,
    relatedActivityHashes: uniqueHashes([
      activity.activityHash,
      ...(activity.relatedActivityHashes ?? []),
    ]),
  }));
  const knownActivityByGroupKey = new Map<string, ActivityDefinition>();

  for (const activity of knownActivities) {
    knownActivityByGroupKey.set(normalizeActivityGroupName(activity.name), activity);
  }

  const observedActivityByGroupKey = new Map<string, ActivityDefinition>();
  const observedModeBuckets = new Map<string, ObservedModeBucket>();

  for (const historyItem of history) {
    const referenceId = historyItem.activityDetails.referenceId;
    const definition = activityDefinitions[String(referenceId)];
    const rawName = getActivityNameFromDefinition(definition) || `Activity ${referenceId}`;
    const groupKey = normalizeActivityGroupName(rawName);
    const canUseDefinition = Boolean(includeObservedActivities && definition && !isActivityDefinitionHidden(definition));

    if (canUseDefinition && definition) {
      const modeType = getActivityModeType(definition, historyItem);
      addObservedModeBucket(observedModeBuckets, groupKey, referenceId, definition, modeType);
    }

    const knownActivity = knownActivityByGroupKey.get(groupKey);

    if (knownActivity) {
      knownActivity.relatedActivityHashes = uniqueHashes([
        knownActivity.activityHash,
        ...(knownActivity.relatedActivityHashes ?? []),
        referenceId,
      ]);
      continue;
    }

    if (!canUseDefinition || !definition) {
      continue;
    }

    const existingActivity = observedActivityByGroupKey.get(groupKey);

    if (existingActivity) {
      existingActivity.relatedActivityHashes = uniqueHashes([
        existingActivity.activityHash,
        ...(existingActivity.relatedActivityHashes ?? []),
        referenceId,
      ]);
      continue;
    }

    const modeType = getActivityModeType(definition, historyItem);
    const activityType = getActivityTypeFromDefinition(definition, modeType, rawName);

    observedActivityByGroupKey.set(groupKey, {
      id: `observed_${groupKey}`,
      name: rawName,
      type: activityType,
      activityHash: referenceId,
      relatedActivityHashes: [referenceId],
      activityMode: getActivityModeName(definition, modeType),
      activityModeType: modeType,
      maxPlayers: definition.matchmaking?.maxPlayers,
      tags: getActivityTags(definition),
      image: definition.pgcrImage ? `https://www.bungie.net${definition.pgcrImage}` : undefined,
    });
  }

  return [
    ...knownActivities,
    ...observedActivityByGroupKey.values(),
    ...buildModeAggregateActivities(observedModeBuckets),
  ];
}

function buildManifestActivityBuckets(
  activityDefinitions: Record<string, ActivityDefinitionContext>
): Map<string, ManifestActivityBucket> {
  const buckets = new Map<string, ManifestActivityBucket>();

  for (const [hashText, definition] of Object.entries(activityDefinitions)) {
    const activityHash = Number(definition.hash ?? hashText);
    const activityType = getManifestEndgameActivityType(definition);
    const activityName = getActivityNameFromDefinition(definition);
    const groupKey = normalizeActivityGroupName(activityName);

    if (
      !activityType ||
      !Number.isFinite(activityHash) ||
      !groupKey ||
      !shouldUseManifestActivity(definition, activityType)
    ) {
      continue;
    }

    const existingBucket = buckets.get(groupKey);
    const bucket = existingBucket ?? {
      name: activityName,
      type: activityType,
      modeType: activityType === "RAID" ? 4 : 82,
      activityHashes: new Set<number>(),
      tags: new Set<string>(),
    };

    bucket.activityHashes.add(activityHash);

    if (!bucket.image && definition.pgcrImage) {
      bucket.image = `https://www.bungie.net${definition.pgcrImage}`;
    }

    if (definition.matchmaking?.maxPlayers) {
      bucket.maxPlayers = Math.max(bucket.maxPlayers ?? 0, definition.matchmaking.maxPlayers);
    }

    for (const tag of getActivityTags(definition)) {
      bucket.tags.add(tag);
    }

    buckets.set(groupKey, bucket);
  }

  return buckets;
}

function mergeManifestBucketIntoActivity(
  activity: ActivityDefinition,
  bucket: ManifestActivityBucket
): ActivityDefinition {
  return {
    ...activity,
    relatedActivityHashes: uniqueHashes([
      activity.activityHash,
      ...(activity.relatedActivityHashes ?? []),
      ...bucket.activityHashes,
    ]),
    activityMode: activity.activityMode ?? getActivityModeLabel(bucket.modeType),
    activityModeType: activity.activityModeType ?? bucket.modeType,
    maxPlayers: activity.maxPlayers ?? bucket.maxPlayers,
    tags: uniqueStrings([
      ...(activity.tags ?? []),
      ...bucket.tags,
    ]),
    image: activity.image ?? bucket.image,
  };
}

function buildManifestOnlyActivity(
  groupKey: string,
  bucket: ManifestActivityBucket
): ActivityDefinition {
  const activityHashes = uniqueHashes([...bucket.activityHashes]);
  const primaryHash = activityHashes[0];

  return {
    id: `manifest_${groupKey}`,
    name: bucket.name,
    type: bucket.type,
    activityHash: primaryHash,
    relatedActivityHashes: activityHashes,
    activityMode: getActivityModeLabel(bucket.modeType),
    activityModeType: bucket.modeType,
    maxPlayers: bucket.maxPlayers,
    tags: [...bucket.tags],
    image: bucket.image,
  };
}

function compareActivitiesByTypeAndName(firstActivity: ActivityDefinition, secondActivity: ActivityDefinition): number {
  if (firstActivity.type !== secondActivity.type) {
    return getActivityTypeSortIndex(firstActivity.type) - getActivityTypeSortIndex(secondActivity.type);
  }

  return firstActivity.name.localeCompare(secondActivity.name);
}

function getManifestEndgameActivityType(
  definition: ActivityDefinitionContext
): ActivityDefinition["type"] | null {
  const modeTypes = uniqueHashes([
    definition.directActivityModeType ?? 0,
    ...(definition.activityModeTypes ?? []),
  ]);

  if (modeTypes.includes(4)) {
    return "RAID";
  }

  if (modeTypes.includes(82)) {
    return "DUNGEON";
  }

  return null;
}

function shouldUseManifestActivity(
  definition: ActivityDefinitionContext,
  activityType: ActivityDefinition["type"]
): boolean {
  if (isActivityDefinitionHidden(definition) || definition.isPlaylist || definition.isPvP) {
    return false;
  }

  if (getActivityNameSearchText(definition).includes("pantheon")) {
    return false;
  }

  const maxPlayers = definition.matchmaking?.maxPlayers;

  if (activityType === "RAID" && maxPlayers && maxPlayers < 6) {
    return false;
  }

  if (activityType === "DUNGEON" && maxPlayers && maxPlayers > 3) {
    return false;
  }

  return true;
}

export function buildActivityReport(
  activity: ActivityDefinition,
  history: ActivityHistoryItem[],
  invalidInstanceIds: Set<string> = new Set()
): ActivityReportSummary {
  const runs = history
    .filter((historyItem) => activityMatchesHistoryItem(activity, historyItem))
    .filter((historyItem) => !invalidInstanceIds.has(historyItem.activityDetails.instanceId))
    .map((historyItem) => buildRunSummary(activity, historyItem))
    .sort(sortRunsNewestFirst);

  return summarizeActivityRuns(activity, runs);
}

export function filterActivityReportByTag(
  report: ActivityReportSummary,
  selectedTag: string | null
): ActivityReportSummary {
  if (!selectedTag) {
    return report;
  }

  const matchingRuns = report.runs.filter((run) => run.specialTags.includes(selectedTag));
  return summarizeActivityRuns(report.activity, matchingRuns);
}

function summarizeActivityRuns(
  activity: ActivityDefinition,
  runs: ActivityRunSummary[]
): ActivityReportSummary {
  const completedRuns = runs.filter((run) => run.completed);
  const failedRuns = runs.filter((run) => !run.completed);
  const regularClears = completedRuns.filter((run) => run.specialTags.length === 0).length;
  const specialClears = completedRuns.length - regularClears;
  const totalKills = runs.reduce((total, run) => total + run.kills, 0);
  const totalDeaths = runs.reduce((total, run) => total + run.deaths, 0);
  const totalAssists = runs.reduce((total, run) => total + run.assists, 0);
  const totalSeconds = completedRuns.reduce((total, run) => total + run.durationSeconds, 0);
  const fastestSeconds = getFastestSeconds(completedRuns);
  const averageSeconds = completedRuns.length > 0 ? totalSeconds / completedRuns.length : null;

  return {
    activity,
    runs,
    completedRuns,
    failedRuns,
    regularClears,
    specialClears,
    failedClears: failedRuns.length,
    totalClears: completedRuns.length,
    totalKills,
    totalDeaths,
    totalAssists,
    totalSeconds,
    fastestSeconds,
    averageSeconds,
    kd: totalDeaths > 0 ? totalKills / totalDeaths : totalKills > 0 ? totalKills : null,
    specialTagCounts: countSpecialTags(completedRuns),
    latestRun: runs[0] ?? null,
  };
}

export function formatActivityDuration(seconds: number | null | undefined): string {
  if (!seconds || !Number.isFinite(seconds)) {
    return "--";
  }

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

export function sortActivityReports(
  reports: ActivityReportSummary[],
  sortKey: ActivitySortKey,
  sortDirection: ActivitySortDirection
): ActivityReportSummary[] {
  const directionMultiplier = sortDirection === "asc" ? 1 : -1;

  return [...reports].sort((firstReport, secondReport) => {
    const firstValue = getSortValue(firstReport, sortKey);
    const secondValue = getSortValue(secondReport, sortKey);
    return compareSortValues(firstValue, secondValue) * directionMultiplier;
  });
}

export function activityMatchesHistoryItem(
  activity: ActivityDefinition,
  historyItem: ActivityHistoryItem
): boolean {
  const relatedActivityHashes = activity.relatedActivityHashes ?? [];
  const referenceId = historyItem.activityDetails.referenceId;
  return referenceId === activity.activityHash || relatedActivityHashes.includes(referenceId);
}

export function normalizeActivityGroupName(activityName: string): string {
  return stripActivityDifficulty(activityName)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^the_/, "")
    .replace(/^_+|_+$/g, "");
}

function addObservedModeBucket(
  buckets: Map<string, ObservedModeBucket>,
  groupKey: string,
  referenceId: number,
  definition: ActivityDefinitionContext,
  modeType: number
): void {
  const modeLabel = getActivityModeName(definition, modeType);
  const modeKey = normalizeActivityGroupName(modeLabel);
  const activityName = getActivityNameFromDefinition(definition);
  const existingBucket = buckets.get(modeKey);
  const bucket = existingBucket ?? {
    label: modeLabel,
    type: getActivityTypeFromDefinition(definition, modeType, activityName),
    modeType,
    activityHashes: new Set<number>(),
    groupKeys: new Set<string>(),
    tags: new Set<string>(),
  };

  bucket.activityHashes.add(referenceId);
  bucket.groupKeys.add(groupKey);

  for (const tag of getActivityTags(definition)) {
    bucket.tags.add(tag);
  }

  if (definition.matchmaking?.maxPlayers) {
    bucket.maxPlayers = Math.max(bucket.maxPlayers ?? 0, definition.matchmaking.maxPlayers);
  }

  if (!bucket.image && definition.pgcrImage) {
    bucket.image = `https://www.bungie.net${definition.pgcrImage}`;
  }

  buckets.set(modeKey, bucket);
}

function buildModeAggregateActivities(
  buckets: Map<string, ObservedModeBucket>
): ActivityDefinition[] {
  const aggregateActivities: ActivityDefinition[] = [];

  for (const [modeKey, bucket] of buckets) {
    if (bucket.groupKeys.size < 3) {
      continue;
    }

    const activityHashes = uniqueHashes([...bucket.activityHashes]);
    const primaryHash = activityHashes[0];

    if (!primaryHash) {
      continue;
    }

    aggregateActivities.push({
      id: `observed_all_${modeKey}`,
      name: `All - ${bucket.label}`,
      type: bucket.type,
      activityHash: primaryHash,
      relatedActivityHashes: activityHashes,
      activityMode: bucket.label,
      activityModeType: bucket.modeType,
      maxPlayers: bucket.maxPlayers,
      tags: [...bucket.tags],
      image: bucket.image,
    });
  }

  return aggregateActivities;
}

function getActivityNameFromDefinition(definition: ActivityDefinitionContext | undefined): string {
  return stripActivityDifficulty(getRawActivityNameFromDefinition(definition));
}

function getRawActivityNameFromDefinition(definition: ActivityDefinitionContext | undefined): string {
  if (!definition) {
    return "";
  }

  const displayName = definition.displayProperties?.name?.trim() ?? "";
  const originalName = definition.originalDisplayProperties?.name?.trim() ?? "";
  const selectionName = definition.selectionScreenDisplayProperties?.name?.trim() ?? "";

  if (displayName && !isGenericActivityVariantName(displayName)) {
    return displayName;
  }

  if (originalName && !isGenericActivityVariantName(originalName)) {
    return originalName;
  }

  if (selectionName && !isGenericActivityVariantName(selectionName)) {
    return selectionName;
  }

  return displayName || originalName || selectionName;
}

function stripActivityDifficulty(activityName: string): string {
  const difficultySuffix = "(Normal|Standard|Master|Legend|Hero|Adept|Expert|Grandmaster|Contest Mode|Contest|Classic|Prestige|Challenge Mode|Level\\s+\\d+)";

  return activityName
    .replace(new RegExp(`\\s*:\\s*${difficultySuffix}(\\s+Difficulty)?$`, "i"), "")
    .replace(new RegExp(`\\s*-\\s*${difficultySuffix}(\\s+Difficulty)?$`, "i"), "")
    .replace(new RegExp(`\\s*\\(${difficultySuffix}(\\s+Difficulty)?\\)$`, "i"), "")
    .replace(new RegExp(`\\s+${difficultySuffix}(\\s+Difficulty)?$`, "i"), "")
    .trim();
}

function isGenericActivityVariantName(activityName: string): boolean {
  return /^(normal|standard|master|legend|hero|adept|expert|grandmaster|contest mode|contest|classic|prestige|challenge mode|level\s+\d+)$/i.test(activityName.trim());
}

function getActivityNameSearchText(definition: ActivityDefinitionContext): string {
  return [
    definition.displayProperties?.name,
    definition.originalDisplayProperties?.name,
    definition.selectionScreenDisplayProperties?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isActivityDefinitionHidden(definition: ActivityDefinitionContext): boolean {
  const activityName = definition.displayProperties?.name?.trim();
  return !activityName || Boolean(definition.redacted || definition.blacklisted);
}

function getActivityModeType(
  definition: ActivityDefinitionContext,
  historyItem: ActivityHistoryItem
): number {
  return (
    historyItem.activityDetails.mode ||
    definition.directActivityModeType ||
    definition.activityModeTypes?.[0] ||
    0
  );
}

function getActivityTypeFromDefinition(
  definition: ActivityDefinitionContext,
  modeType: number,
  activityName: string
): ActivityDefinition["type"] {
  if (modeType === 4) {
    return "RAID";
  }

  if (modeType === 82) {
    return "DUNGEON";
  }

  const searchText = getActivityClassificationText(definition, activityName);

  if (GAMBIT_MODE_TYPES.has(modeType) || hasAnyText(searchText, ["gambit", "reckoning"])) {
    return "GAMBIT";
  }

  if (definition.isPvP || CRUCIBLE_MODE_TYPES.has(modeType) || hasAnyText(searchText, [
    "crucible",
    "trials of osiris",
    "iron banner",
    "competitive",
    "private match",
  ])) {
    return "CRUCIBLE";
  }

  if (PINNACLE_MODE_TYPES.has(modeType) || hasAnyText(searchText, [
    "nightfall",
    "grandmaster",
    "the ordeal",
    "pinnacle",
  ])) {
    return "PINNACLE_OPS";
  }

  if (STRIKE_MODE_TYPES.has(modeType) || hasAnyText(searchText, [
    "strike",
    "vanguard ops",
    "vanguard playlist",
  ])) {
    return "STRIKE";
  }

  if (ARENA_MODE_TYPES.has(modeType) || hasAnyText(searchText, [
    "altars of sorrow",
    "arena",
    "blind well",
    "coil",
    "dares",
    "menagerie",
    "onslaught",
    "prison of elders",
    "reckoning",
    "sundial",
    "wellspring",
  ])) {
    return "ARENA_OPS";
  }

  if (SEASONAL_MODE_TYPES.has(modeType) || hasAnyText(searchText, [
    "astral alignment",
    "battleground",
    "breach executable",
    "deep dive",
    "enigma protocol",
    "expedition",
    "ketchcrash",
    "override",
    "salvage",
    "savathun's spire",
    "seasonal",
    "vex offensive",
  ])) {
    return "SEASONAL_OPS";
  }

  if (SOLO_MODE_TYPES.has(modeType) || hasAnyText(searchText, [
    "adventure",
    "campaign",
    "exotic mission",
    "lost sector",
    "mission",
    "story",
  ])) {
    return "SOLO_OPS";
  }

  if (EXPLORATION_MODE_TYPES.has(modeType) || hasAnyText(searchText, [
    "destination",
    "exploration",
    "patrol",
    "public event",
  ])) {
    return "EXPLORATION";
  }

  if (SOCIAL_MODE_TYPES.has(modeType) || hasAnyText(searchText, [
    "farm",
    "h.e.l.m",
    "social",
    "tower",
  ])) {
    return "SOCIAL";
  }

  if (
    FIRETEAM_MODE_TYPES.has(modeType) ||
    definition.matchmaking?.isMatchmade ||
    (definition.matchmaking?.maxPlayers ?? 0) > 1
  ) {
    return "FIRETEAM_OPS";
  }

  return "OTHER";
}

function getActivityClassificationText(
  definition: ActivityDefinitionContext,
  activityName: string
): string {
  return [
    activityName,
    definition.activityTypeName,
    definition.directActivityModeName,
    definition.displayProperties?.name,
    definition.displayProperties?.description,
    definition.originalDisplayProperties?.name,
    definition.selectionScreenDisplayProperties?.name,
    getActivityModeLabel(definition.directActivityModeType ?? 0),
    ...(definition.activityModeTypes ?? []).map(getActivityModeLabel),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getActivityModeName(
  definition: ActivityDefinitionContext,
  modeType: number
): string {
  const activityTypeName = definition.activityTypeName?.trim();
  const directActivityModeName = definition.directActivityModeName?.trim();

  return activityTypeName || directActivityModeName || getActivityModeLabel(modeType);
}

function hasAnyText(searchText: string, phrases: string[]): boolean {
  return phrases.some((phrase) => searchText.includes(phrase));
}

function getActivityModeLabel(modeType: number): string {
  return ACTIVITY_MODE_LABELS[modeType] ?? "Activity";
}

function getActivityTags(definition: ActivityDefinitionContext): string[] {
  const tags: string[] = [];

  if (isContestActivityDefinition(definition)) {
    tags.push("Contest");
  }

  if (definition.isPvP) {
    tags.push("PvP");
  }

  if (definition.isPlaylist) {
    tags.push("Playlist");
  }

  if (definition.matchmaking?.isMatchmade) {
    tags.push("Matchmade");
  }

  return tags;
}

function addActivityTagsFromDefinitions(
  activity: ActivityDefinition,
  activityDefinitions: Record<string, ActivityDefinitionContext>
): ActivityDefinition {
  const tags = new Set(activity.tags ?? []);

  for (const activityHash of getActivityDefinitionHashes(activity)) {
    const definition = activityDefinitions[String(activityHash)];

    if (!definition) {
      continue;
    }

    for (const tag of getActivityTags(definition)) {
      tags.add(tag);
    }
  }

  return {
    ...activity,
    tags: [...tags],
  };
}

function getActivityDefinitionHashes(activity: ActivityDefinition): number[] {
  return uniqueHashes([
    activity.activityHash,
    ...(activity.relatedActivityHashes ?? []),
    ...(activity.contestActivityHashes ?? []),
  ]);
}

function isContestActivityDefinition(definition: ActivityDefinitionContext): boolean {
  return /\bcontest\b/i.test(getActivityNameSearchText(definition));
}

function uniqueHashes(hashes: number[]): number[] {
  return [...new Set(hashes.filter(Number.isFinite))];
}

function uniqueStrings(strings: string[]): string[] {
  return [...new Set(strings.filter(Boolean))];
}

function buildRunSummary(
  activity: ActivityDefinition,
  historyItem: ActivityHistoryItem
): ActivityRunSummary {
  const durationSeconds = historyItem.values.activityDurationSeconds?.basic?.value ?? 0;
  const completed = isCompletedRun(historyItem);
  const playerCount = getPlayerCount(historyItem);
  const specialTags = getSpecialTags(activity, historyItem, completed, durationSeconds, playerCount);

  return {
    instanceId: historyItem.activityDetails.instanceId,
    referenceId: historyItem.activityDetails.referenceId,
    period: historyItem.period,
    durationSeconds,
    completed,
    kills: historyItem.values.kills?.basic?.value ?? 0,
    deaths: historyItem.values.deaths?.basic?.value ?? 0,
    assists: historyItem.values.assists?.basic?.value ?? 0,
    playerCount,
    characterId: historyItem.characterId,
    specialTags,
    specialTagLabels: getSpecialTagLabels(activity, historyItem, specialTags),
  };
}

function isCompletedRun(historyItem: ActivityHistoryItem): boolean {
  const completedValue = historyItem.values.completed?.basic?.value;
  const completionReason = historyItem.values.completionReason?.basic?.value;
  return completedValue === 1 && (completionReason === undefined || completionReason === 0);
}

function getPlayerCount(historyItem: ActivityHistoryItem): number | null {
  const playerCount = historyItem.values.playerCount?.basic?.value;
  return typeof playerCount === "number" && Number.isFinite(playerCount) ? playerCount : null;
}

function getSpecialTags(
  activity: ActivityDefinition,
  historyItem: ActivityHistoryItem,
  completed: boolean,
  durationSeconds: number,
  playerCount: number | null
): string[] {
  if (!completed || playerCount === null || durationSeconds < MINIMUM_SPECIAL_CLEAR_SECONDS) {
    return [];
  }

  const period = new Date(historyItem.period);
  if (isExcludedSpecialPeriod(period)) {
    return [];
  }

  const tags: string[] = [];
  const deaths = historyItem.values.deaths?.basic?.value ?? 0;
  const supportsLowManTags = activity.type === "RAID" || activity.type === "DUNGEON";
  const clearDate = getRunClearDate(period, durationSeconds);

  if (supportsLowManTags && playerCount === 1 && deaths === 0) {
    tags.push("Solo Flawless");
  } else if (deaths === 0) {
    tags.push("Personal Flawless");
  } else if (supportsLowManTags && playerCount === 1) {
    tags.push("Solo");
  }

  if (isContestRun(activity, historyItem)) {
    tags.push("Contest");
  }

  if (activity.type === "RAID" && isWithinDayOneWindow(activity, clearDate)) {
    tags.push("Day One");
  }

  if (activity.type === "RAID") {
    addLowManRaidTags(tags, playerCount, deaths);
  }

  if (activity.type === "DUNGEON") {
    addLowManDungeonTags(tags, playerCount, deaths);
  }

  return tags;
}

function addLowManRaidTags(tags: string[], playerCount: number, deaths: number): void {
  if (playerCount === 1) {
    addUniqueTag(tags, "Solo");

    if (deaths === 0) {
      addUniqueTag(tags, "Solo Flawless");
    }
  }

  if (playerCount === 2) {
    addUniqueTag(tags, "Duo");

    if (deaths === 0) {
      addUniqueTag(tags, "Duo Flawless");
    }
  }

  if (playerCount === 3) {
    addUniqueTag(tags, "Trio");

    if (deaths === 0) {
      addUniqueTag(tags, "Trio Flawless");
    }
  }
}

function addLowManDungeonTags(tags: string[], playerCount: number, deaths: number): void {
  if (playerCount === 1) {
    addUniqueTag(tags, "Solo");

    if (deaths === 0) {
      addUniqueTag(tags, "Solo Flawless");
    }
  }

  if (playerCount === 2) {
    addUniqueTag(tags, "Duo");

    if (deaths === 0) {
      addUniqueTag(tags, "Duo Flawless");
    }
  }
}

function addUniqueTag(tags: string[], tag: string): void {
  if (!tags.includes(tag)) {
    tags.push(tag);
  }
}

function isContestRun(activity: ActivityDefinition, historyItem: ActivityHistoryItem): boolean {
  const referenceId = historyItem.activityDetails.referenceId;
  const contestActivityHashes = new Set(activity.contestActivityHashes ?? []);
  return contestActivityHashes.has(referenceId);
}

function getSpecialTagLabels(
  activity: ActivityDefinition,
  historyItem: ActivityHistoryItem,
  specialTags: string[]
): Record<string, string> {
  const specialTagLabels: Record<string, string> = {};

  if (specialTags.includes("Contest")) {
    const contestRank = getContestRunRank(activity, historyItem);

    if (contestRank !== null) {
      specialTagLabels.Contest = `Contest #${contestRank}`;
    }
  }

  return specialTagLabels;
}

function getContestRunRank(
  activity: ActivityDefinition,
  historyItem: ActivityHistoryItem
): number | null {
  const rank = activity.contestRankByInstanceId?.[historyItem.activityDetails.instanceId];
  return typeof rank === "number" && Number.isFinite(rank) ? rank : null;
}

export function isWithinDayOneWindow(activity: ActivityDefinition, clearDate: Date): boolean {
  return isWithinActivityReleaseWindow(activity, clearDate, DAY_ONE_WINDOW_MS);
}

export function isWithinWeekOneWindow(activity: ActivityDefinition, clearDate: Date): boolean {
  return isWithinActivityReleaseWindow(activity, clearDate, WEEK_ONE_WINDOW_MS);
}

export function getRunClearDate(period: Date, durationSeconds: number): Date {
  return new Date(period.getTime() + durationSeconds * 1000);
}

function isWithinActivityReleaseWindow(
  activity: ActivityDefinition,
  clearDate: Date,
  windowLengthMs: number
): boolean {
  const releaseStart = getActivityReleaseStart(activity);
  if (!releaseStart) {
    return false;
  }

  const releaseEnd = new Date(releaseStart.getTime() + windowLengthMs);
  return clearDate >= releaseStart && clearDate <= releaseEnd;
}

function getActivityReleaseStart(activity: ActivityDefinition): Date | null {
  if (!activity.releaseDate) {
    return null;
  }

  const releaseStart = activity.releaseDate.includes("T")
    ? new Date(activity.releaseDate)
    : new Date(`${activity.releaseDate}T${String(DEFAULT_ACTIVITY_RELEASE_HOUR_UTC).padStart(2, "0")}:00:00.000Z`);

  return Number.isNaN(releaseStart.getTime()) ? null : releaseStart;
}

function isExcludedSpecialPeriod(period: Date): boolean {
  return EXCLUDED_SPECIAL_PERIODS.some(
    (excludedPeriod) => period >= excludedPeriod.start && period <= excludedPeriod.end
  );
}

function getFastestSeconds(completedRuns: ActivityRunSummary[]): number | null {
  if (completedRuns.length === 0) {
    return null;
  }

  return Math.min(...completedRuns.map((run) => run.durationSeconds));
}

function countSpecialTags(completedRuns: ActivityRunSummary[]): Record<string, ActivityTagCount> {
  const tagCounts: Record<string, ActivityTagCount> = {};

  for (const run of completedRuns) {
    for (const specialTag of run.specialTags) {
      if (!tagCounts[specialTag]) {
        tagCounts[specialTag] = {
          amount: 0,
          instanceId: run.instanceId,
          label: run.specialTagLabels[specialTag],
        };
      }

      tagCounts[specialTag].amount += 1;
      tagCounts[specialTag].instanceId = run.instanceId;

      if (!tagCounts[specialTag].label && run.specialTagLabels[specialTag]) {
        tagCounts[specialTag].label = run.specialTagLabels[specialTag];
      }
    }
  }

  return tagCounts;
}

function sortRunsNewestFirst(firstRun: ActivityRunSummary, secondRun: ActivityRunSummary): number {
  return new Date(secondRun.period).getTime() - new Date(firstRun.period).getTime();
}

function getSortValue(report: ActivityReportSummary, sortKey: ActivitySortKey): string | number {
  switch (sortKey) {
    case "activity":
      return report.activity.name.toLowerCase();
    case "type":
      return (report.activity.activityMode ?? "").toLowerCase();
    case "totalClears":
      return report.totalClears;
    case "clears":
      return report.regularClears;
    case "specialClears":
      return report.specialClears;
    case "failedClears":
      return report.failedClears;
    case "fastest":
      return report.fastestSeconds ?? Number.POSITIVE_INFINITY;
    case "average":
      return report.averageSeconds ?? Number.POSITIVE_INFINITY;
    case "totalTime":
      return report.totalSeconds;
    case "kills":
      return report.totalKills;
    case "assists":
      return report.totalAssists;
    case "deaths":
      return report.totalDeaths;
    case "recent":
      return report.latestRun ? new Date(report.latestRun.period).getTime() : 0;
  }
}

function compareSortValues(firstValue: string | number, secondValue: string | number): number {
  if (typeof firstValue === "string" && typeof secondValue === "string") {
    return firstValue.localeCompare(secondValue);
  }

  if (firstValue > secondValue) {
    return 1;
  }

  if (firstValue < secondValue) {
    return -1;
  }

  return 0;
}
