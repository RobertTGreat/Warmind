import { NextResponse } from "next/server";
import {
  getClarityDescriptionsForHashes,
  type ClarityDatabase,
} from "@/lib/clarityDescriptions";

const CLARITY_DATABASE_URL =
  "https://raw.githubusercontent.com/Database-Clarity/Live-Clarity-Database/live/descriptions/clarity.json";
const CLARITY_CACHE_DURATION_MS = 12 * 60 * 60 * 1000;

let cachedClarityDatabase: {
  loadedAt: number;
  entries: ClarityDatabase;
} | null = null;

function parseRequestedHashes(hashesParam: string | null): number[] {
  if (!hashesParam) {
    return [];
  }

  return Array.from(
    new Set(
      hashesParam
        .split(",")
        .map((hashText) => Number(hashText.trim()))
        .filter((hash) => Number.isSafeInteger(hash) && hash > 0)
    )
  );
}

async function getClarityDatabase(): Promise<ClarityDatabase> {
  const now = Date.now();

  if (
    cachedClarityDatabase &&
    now - cachedClarityDatabase.loadedAt < CLARITY_CACHE_DURATION_MS
  ) {
    return cachedClarityDatabase.entries;
  }

  const response = await fetch(CLARITY_DATABASE_URL, {
    next: { revalidate: 12 * 60 * 60 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Clarity database: ${response.status}`);
  }

  const entries = (await response.json()) as ClarityDatabase;
  cachedClarityDatabase = {
    loadedAt: now,
    entries,
  };

  return entries;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const requestedHashes = parseRequestedHashes(requestUrl.searchParams.get("hashes"));

  if (requestedHashes.length === 0) {
    return NextResponse.json({});
  }

  const clarityDatabase = await getClarityDatabase();
  const descriptions = getClarityDescriptionsForHashes(clarityDatabase, requestedHashes);

  return NextResponse.json(descriptions, {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
