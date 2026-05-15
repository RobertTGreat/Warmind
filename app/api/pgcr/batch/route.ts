import { NextRequest, NextResponse } from "next/server";

const MAX_IDS = 50;
const CONCURRENCY = 5;

async function runPool<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentItem = items[nextIndex++];
      results.push(await worker(currentItem));
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, runWorker)
  );

  return results;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.BUNGIE_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids.slice(0, MAX_IDS) : [];

  const cleanIds = ids.map(String).filter((id: string) => /^\d+$/.test(id));

  if (cleanIds.length === 0) {
    return NextResponse.json({ reports: {} });
  }

  const entries = await runPool(cleanIds, async (id) => {
    const response = await fetch(
      `https://www.bungie.net/Platform/Destiny2/Stats/PostGameCarnageReport/${id}/`,
      {
        headers: {
          "X-API-Key": apiKey,
        },
        next: { revalidate: 86_400 },
      }
    );

    if (!response.ok) {
      return [id, null] as const;
    }

    const json = await response.json().catch(() => null);
    return [id, json] as const;
  });

  return NextResponse.json(
    {
      reports: Object.fromEntries(entries),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
      },
    }
  );
}
