import { NextRequest, NextResponse } from "next/server";
import { getServerBungieApiKey } from "@/lib/serverBungie";

const ALLOWED_TYPES = new Set([
  "DestinyInventoryItemDefinition",
  "DestinyCollectibleDefinition",
  "DestinyEquipableItemSetDefinition",
  "DestinyPresentationNodeDefinition",
  "DestinyRecordDefinition",
  "DestinySandboxPerkDefinition",
  "DestinySocketCategoryDefinition",
  "DestinySocketTypeDefinition",
  "DestinyStatDefinition",
]);

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
      },
      investmentStats: isPlugDefinition ? def.investmentStats : undefined,
      itemType: def.itemType,
      itemTypeDisplayName: def.itemTypeDisplayName,
      classType: def.classType,
      defaultDamageTypeHash: def.defaultDamageTypeHash,
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

function validateDefinitionType(definitionType: string) {
  if (!ALLOWED_TYPES.has(definitionType)) {
    return NextResponse.json({ error: "Unsupported definition type" }, { status: 400 });
  }

  return null;
}

async function getManifestTable(definitionType: string) {
  const apiKey = getServerBungieApiKey();

  if (!apiKey) {
    throw new Error("Missing Bungie API key");
  }

  const manifestResponse = await fetch(
    "https://www.bungie.net/Platform/Destiny2/Manifest/",
    {
      headers: {
        "X-API-Key": apiKey,
      },
      next: { revalidate: 3600 },
    }
  );

  if (!manifestResponse.ok) {
    throw new Error("Failed to fetch manifest");
  }

  const manifestJson = await manifestResponse.json();
  const manifestVersion = manifestJson.Response?.version ?? "";
  const tablePath =
    manifestJson.Response?.jsonWorldComponentContentPaths?.en?.[definitionType];

  if (!tablePath) {
    throw new Error("Definition table not found");
  }

  const cacheKey = `${manifestVersion}:${tablePath}`;
  const cachedTable = manifestTableCache.get(cacheKey);

  if (cachedTable && cachedTable.expiresAt > Date.now()) {
    return cachedTable;
  }

  const tableResponse = await fetch(`https://www.bungie.net${tablePath}`, {
    cache: "no-store",
  });

  if (!tableResponse.ok) {
    throw new Error("Failed to fetch definition table");
  }

  const rawTable = await tableResponse.json();
  const cacheEntry = {
    table: rawTable,
    version: manifestVersion,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  };

  manifestTableCache.set(cacheKey, cacheEntry);

  return cacheEntry;
}

function toErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Failed to fetch definition table";
  const status =
    message === "Missing Bungie API key"
      ? 500
      : message === "Definition table not found"
        ? 404
        : 502;

  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ definitionType: string }> }
) {
  const { definitionType } = await params;
  const validationError = validateDefinitionType(definitionType);

  if (validationError) {
    return validationError;
  }

  try {
    const { table: rawTable, version } = await getManifestTable(definitionType);
    const table =
      definitionType === "DestinyInventoryItemDefinition" &&
      request.nextUrl.searchParams.get("view") === "card"
        ? pickInventoryCardFields(rawTable)
        : rawTable;

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
  const validationError = validateDefinitionType(definitionType);

  if (validationError) {
    return validationError;
  }

  if (definitionType !== "DestinyInventoryItemDefinition") {
    return NextResponse.json(
      { error: "Hash filtering is only supported for inventory items" },
      { status: 400 }
    );
  }

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

    const table =
      request.nextUrl.searchParams.get("view") === "card"
        ? pickInventoryCardFields(selectedTable)
        : selectedTable;

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
