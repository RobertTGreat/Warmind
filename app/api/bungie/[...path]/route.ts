import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getServerBungieApiKey } from '@/lib/serverBungie';
import {
  getStaticManifestApiResponse,
  getStaticManifestDefinition,
} from '@/lib/staticManifest.server';

const BUNGIE_API_BASE = 'https://www.bungie.net/Platform';

type RouteParams = {
  params: Promise<{ path: string[] }>;
};

function buildBungieResponse(response: unknown) {
  return {
    Response: response,
    ErrorCode: 1,
    ThrottleSeconds: 0,
    ErrorStatus: 'Success',
    Message: 'Ok',
    MessageData: {},
  };
}

function isStaticManifestMetadataPath(path: string[]) {
  return path.length === 2 && path[0] === 'Destiny2' && path[1] === 'Manifest';
}

function getStaticManifestDefinitionPath(path: string[]) {
  if (path.length !== 4 || path[0] !== 'Destiny2' || path[1] !== 'Manifest') {
    return null;
  }

  return {
    definitionType: path[2],
    hash: path[3],
  };
}

async function maybeServeStaticManifest(request: NextRequest, path: string[]) {
  if (request.method !== 'GET') {
    return null;
  }

  if (isStaticManifestMetadataPath(path)) {
    return NextResponse.json(await getStaticManifestApiResponse(), {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=604800',
      },
    });
  }

  const definitionPath = getStaticManifestDefinitionPath(path);

  if (!definitionPath) {
    return null;
  }

  let staticDefinition;
  try {
    staticDefinition = await getStaticManifestDefinition(
      definitionPath.definitionType,
      definitionPath.hash
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Manifest definition not found';
    return NextResponse.json({ error: message }, { status: 404 });
  }

  const { definition, version } = staticDefinition;

  if (!definition) {
    return NextResponse.json({ error: 'Manifest definition not found' }, { status: 404 });
  }

  return NextResponse.json(buildBungieResponse(definition), {
    headers: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=604800',
      'X-Warmind-Manifest-Version': version,
    },
  });
}

async function proxyToBungie(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  if (!path?.length) {
    return NextResponse.json({ error: 'Missing Bungie path' }, { status: 400 });
  }

  const staticManifestResponse = await maybeServeStaticManifest(request, path);
  if (staticManifestResponse) {
    return staticManifestResponse;
  }

  const apiKey = getServerBungieApiKey();

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Server configuration error: API Key missing' },
      { status: 500 }
    );
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
