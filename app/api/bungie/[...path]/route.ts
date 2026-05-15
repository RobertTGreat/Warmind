import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getServerBungieApiKey } from '@/lib/serverBungie';

const BUNGIE_API_BASE = 'https://www.bungie.net/Platform';

type RouteParams = {
  params: Promise<{ path: string[] }>;
};

async function proxyToBungie(request: NextRequest, { params }: RouteParams) {
  const apiKey = getServerBungieApiKey();

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Server configuration error: API Key missing' },
      { status: 500 }
    );
  }

  const { path } = await params;
  if (!path?.length) {
    return NextResponse.json({ error: 'Missing Bungie path' }, { status: 400 });
  }

  const targetUrl = new URL(`${BUNGIE_API_BASE}/${path.join('/')}`);
  targetUrl.search = request.nextUrl.search;

  const cookieStore = await cookies();
  const accessToken = cookieStore.get('bungie_access_token')?.value;

  const headers = new Headers();
  headers.set('X-API-Key', apiKey);

  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers.set('content-type', contentType);
  }

  if (accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }

  const isBodyAllowed = request.method !== 'GET' && request.method !== 'HEAD';
  const rawBody = isBodyAllowed ? await request.text() : undefined;

  const isGet = request.method === 'GET';
  const isManifestRequest =
    isGet && path[0] === 'Destiny2' && path[1] === 'Manifest';

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: rawBody || undefined,
    ...(isManifestRequest
      ? { next: { revalidate: 86_400 } }
      : { cache: 'no-store' }),
  });

  const payload = await response.text();
  const responseHeaders = new Headers();
  const responseType = response.headers.get('content-type');
  if (responseType) {
    responseHeaders.set('content-type', responseType);
  }

  if (isManifestRequest) {
    responseHeaders.set(
      'Cache-Control',
      'public, max-age=3600, stale-while-revalidate=86400'
    );
  }

  return new NextResponse(payload, {
    status: response.status,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, context: RouteParams) {
  return proxyToBungie(request, context);
}

export async function POST(request: NextRequest, context: RouteParams) {
  return proxyToBungie(request, context);
}

export async function PUT(request: NextRequest, context: RouteParams) {
  return proxyToBungie(request, context);
}

export async function PATCH(request: NextRequest, context: RouteParams) {
  return proxyToBungie(request, context);
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  return proxyToBungie(request, context);
}
