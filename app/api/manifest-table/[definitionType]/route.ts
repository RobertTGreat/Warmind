import { NextRequest, NextResponse } from "next/server";
import { getStaticManifestTable } from "@/lib/staticManifest.server";

type ManifestTableCacheEntry = {
  table: Record<string, any>;
  version: string;
  expiresAt: number;
};

const manifestTableCache = new Map<string, ManifestTableCacheEntry>();

function pickInventoryCardFields(table: Record<string, any>) {
  const out: Record<string, any> = {};

  for (const [hash, def] of Object.entries(table)) {
    const isPlugDefinition = Boolean(def.plug);

    out[hash] = {
      hash: def.hash,
      displayProperties: {
        name: def.displayProperties?.name ?? "",
        icon: def.displayProperties?.icon ?? "",
        description: isPlugDefinition ? def.displayProperties?.description ?? "" : "",
        hasIcon: Boolean(def.displayProperties?.hasIcon),
      },
      inventory: {
        tierType: def.inventory?.tierType,
        tierTypeName: def.inventory?.tierTypeName,
        bucketTypeHash: def.inventory?.bucketTypeHash,
        recipeItemHash: def.inventory?.recipeItemHash,
      },
      collectibleHash: def.collectibleHash,
      crafting: def.crafting
        ? {
            outputItemHash: def.crafting.outputItemHash,
          }
        : undefined,
      investmentStats: isPlugDefinition ? def.investmentStats : undefined,
      itemType: def.itemType,
      itemTypeDisplayName: def.itemTypeDisplayName,
      classType: def.classType,
      defaultDamageTypeHash: def.defaultDamageTypeHash,
      sourceData: def.sourceData
        ? {
            sourceString: def.sourceData.sourceString,
          }
        : undefined,
      equippingBlock: def.equippingBlock
        ? {
            equipableItemSetHash: def.equippingBlock.equipableItemSetHash,
          }
        : undefined,
      plug: def.plug
        ? {
            uiPlugLabel: def.plug.uiPlugLabel,
            plugCategoryHash: def.plug.plugCategoryHash,
            plugCategoryIdentifier: def.plug.plugCategoryIdentifier,
            cannotCurrentlyRoll: def.plug.cannotCurrentlyRoll,
          }
        : undefined,
      iconWatermark: def.iconWatermark,
      iconWatermarkShelved: def.iconWatermarkShelved,
      itemCategoryHashes: isPlugDefinition ? def.itemCategoryHashes : undefined,
      isAdept: def.isAdept,
      isHolofoil: def.isHolofoil,
    };
  }

  return out;
}

function pickPatternRecordFields(table: Record<string, any>) {
  const out: Record<string, any> = {};

  for (const [hash, def] of Object.entries(table)) {
    const description = def.displayProperties?.description ?? "";
    const isPatternRecord = description.includes("unlock its Pattern");

    if (!isPatternRecord) continue;

    out[hash] = {
      hash: def.hash,
      displayProperties: {
        name: def.displayProperties?.name ?? "",
        description,
        icon: def.displayProperties?.icon ?? "",
        hasIcon: Boolean(def.displayProperties?.hasIcon),
      },
      objectiveHashes: def.objectiveHashes ?? [],
      recordTypeName: def.recordTypeName,
      scope: def.scope,
    };
  }

  return out;
}

function pickActivityCardFields(table: Record<string, any>) {
  const out: Record<string, any> = {};

  for (const [hash, def] of Object.entries(table)) {
    out[hash] = {
      hash: def.hash,
      displayProperties: {
        name: def.displayProperties?.name ?? "",
        description: def.displayProperties?.description ?? "",
        icon: def.displayProperties?.icon ?? "",
        hasIcon: Boolean(def.displayProperties?.hasIcon),
      },
      originalDisplayProperties: {
        name: def.originalDisplayProperties?.name ?? "",
      },
      selectionScreenDisplayProperties: {
        name: def.selectionScreenDisplayProperties?.name ?? "",
      },
      pgcrImage: def.pgcrImage,
      activityTypeHash: def.activityTypeHash,
      directActivityModeHash: def.directActivityModeHash,
      directActivityModeType: def.directActivityModeType,
      activityModeTypes: def.activityModeTypes,
      matchmaking: def.matchmaking
        ? {
            isMatchmade: def.matchmaking.isMatchmade,
            maxPlayers: def.matchmaking.maxPlayers,
          }
        : undefined,
      isPlaylist: def.isPlaylist,
      isPvP: def.isPvP,
      redacted: def.redacted,
      blacklisted: def.blacklisted,
    };
  }

  return out;
}

function pickDisplayDefinitionFields(table: Record<string, any>) {
  const out: Record<string, any> = {};

  for (const [hash, def] of Object.entries(table)) {
    out[hash] = {
      hash: def.hash,
      displayProperties: {
        name: def.displayProperties?.name ?? "",
        description: def.displayProperties?.description ?? "",
        icon: def.displayProperties?.icon ?? "",
        hasIcon: Boolean(def.displayProperties?.hasIcon),
      },
      modeType: def.modeType,
      pgcrImage: def.pgcrImage,
    };
  }

  return out;
}

function pickActivityReportCatalogFields(table: Record<string, any>) {
  const activityCardFields = pickActivityCardFields(table);
  const out: Record<string, any> = {};

  for (const [hash, def] of Object.entries(activityCardFields)) {
    if (isActivityReportCandidate(def)) {
      out[hash] = def;
    }
  }

  return out;
}

function pickTableFields(definitionType: string, table: Record<string, any>, view: string | null) {
  if (definitionType === "DestinyInventoryItemDefinition" && view === "card") {
    return pickInventoryCardFields(table);
  }

  if (definitionType === "DestinyRecordDefinition" && view === "patterns") {
    return pickPatternRecordFields(table);
  }

  if (definitionType === "DestinyActivityDefinition" && view === "activity-report-catalog") {
    return pickActivityReportCatalogFields(table);
  }

  if (definitionType === "DestinyActivityDefinition" && view === "activity-card") {
    return pickActivityCardFields(table);
  }

  if (
    definitionType === "DestinyActivityModeDefinition" ||
    definitionType === "DestinyActivityTypeDefinition"
  ) {
    return pickDisplayDefinitionFields(table);
  }

  return table;
}

function isActivityReportCandidate(definition: any) {
  if (
    !definition.displayProperties?.name ||
    definition.redacted ||
    definition.blacklisted ||
    definition.isPlaylist ||
    definition.isPvP
  ) {
    return false;
  }

  const nameText = [
    definition.displayProperties?.name,
    definition.originalDisplayProperties?.name,
    definition.selectionScreenDisplayProperties?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (nameText.includes("pantheon")) {
    return false;
  }

  const modeTypes = new Set([
    definition.directActivityModeType,
    ...(definition.activityModeTypes ?? []),
  ]);
  const isRaid = modeTypes.has(4);
  const isDungeon = modeTypes.has(82);
  const maxPlayers = definition.matchmaking?.maxPlayers;

  if (isRaid) {
    return !maxPlayers || maxPlayers >= 6;
  }

  if (isDungeon) {
    return !maxPlayers || maxPlayers <= 3;
  }

  return false;
}

async function getManifestTable(definitionType: string) {
  const { table, version: manifestVersion } = await getStaticManifestTable(definitionType);
  const cacheKey = `${manifestVersion}:${definitionType}`;
  const cachedTable = manifestTableCache.get(cacheKey);

  if (cachedTable && cachedTable.expiresAt > Date.now()) {
    return cachedTable;
  }

  const cacheEntry = {
    table,
    version: manifestVersion,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  };

  manifestTableCache.set(cacheKey, cacheEntry);

  return cacheEntry;
}

function toErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Failed to fetch definition table";
  const status =
    message === "Definition table not found"
        ? 404
        : 502;

  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ definitionType: string }> }
) {
  const { definitionType } = await params;

  try {
    const { table: rawTable, version } = await getManifestTable(definitionType);
    const table = pickTableFields(
      definitionType,
      rawTable,
      request.nextUrl.searchParams.get("view")
    );

    return NextResponse.json(table, {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "X-Warmind-Manifest-Version": version,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ definitionType: string }> }
) {
  const { definitionType } = await params;

  try {
    const body = await request.json();
    const requestedHashes = Array.isArray(body?.hashes) ? body.hashes : [];
    const { table: rawTable, version } = await getManifestTable(definitionType);
    const selectedTable: Record<string, any> = {};

    for (const hash of requestedHashes) {
      const hashText = String(hash);
      const definition = rawTable[hashText];

      if (definition) {
        selectedTable[hashText] = definition;
      }
    }

    const table = pickTableFields(
      definitionType,
      selectedTable,
      request.nextUrl.searchParams.get("view")
    );

    return NextResponse.json(table, {
      headers: {
        "Cache-Control": "private, max-age=300",
        "X-Warmind-Manifest-Version": version,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
