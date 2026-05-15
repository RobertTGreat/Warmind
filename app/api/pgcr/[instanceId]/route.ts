import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 86400;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  const { instanceId } = await params;
  const apiKey = process.env.BUNGIE_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Server configuration error: API Key missing" },
      { status: 500 }
    );
  }

  if (!instanceId || !/^\d+$/.test(instanceId)) {
    return NextResponse.json({ error: "Invalid instanceId" }, { status: 400 });
  }

  const response = await fetch(
    `https://www.bungie.net/Platform/Destiny2/Stats/PostGameCarnageReport/${instanceId}/`,
    {
      headers: {
        "X-API-Key": apiKey,
      },
      next: { revalidate: 86_400 },
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return NextResponse.json(data ?? { error: "Bungie PGCR error" }, {
      status: response.status,
    });
  }

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
