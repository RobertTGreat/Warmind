import { NextRequest, NextResponse } from "next/server";
import { getServerBungieApiKey } from "@/lib/serverBungie";

const ALLOWED_TYPES = new Set([
  "DestinyInventoryItemDefinition",
  "DestinyCollectibleDefinition",
  "DestinyPresentationNodeDefinition",
  "DestinyRecordDefinition",
]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ definitionType: string }> }
) {
  const { definitionType } = await params;

  if (!ALLOWED_TYPES.has(definitionType)) {
    return NextResponse.json({ error: "Unsupported definition type" }, { status: 400 });
  }

  const apiKey = getServerBungieApiKey();

  if (!apiKey) {
    return NextResponse.json({ error: "Missing Bungie API key" }, { status: 500 });
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
    return NextResponse.json({ error: "Failed to fetch manifest" }, { status: 502 });
  }

  const manifestJson = await manifestResponse.json();
  const tablePath =
    manifestJson.Response?.jsonWorldComponentContentPaths?.en?.[definitionType];

  if (!tablePath) {
    return NextResponse.json({ error: "Definition table not found" }, { status: 404 });
  }

  const tableResponse = await fetch(`https://www.bungie.net${tablePath}`, {
    next: { revalidate: 86_400 },
  });

  if (!tableResponse.ok) {
    return NextResponse.json({ error: "Failed to fetch definition table" }, { status: 502 });
  }

  const table = await tableResponse.json();

  return NextResponse.json(table, {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
