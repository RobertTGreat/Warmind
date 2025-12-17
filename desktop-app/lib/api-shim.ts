/**
 * API shim for desktop app authentication
 * Provides client-side functions for OAuth token exchange and refresh
 */

import Cookies from 'js-cookie';

const CLIENT_ID = process.env.NEXT_PUBLIC_BUNGIE_CLIENT_ID;
const CLIENT_SECRET = process.env.BUNGIE_CLIENT_SECRET;
const API_KEY = process.env.NEXT_PUBLIC_BUNGIE_API_KEY || '';

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  membership_id: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

export interface RefreshResponse {
  access_token: string;
  refresh_token?: string;
  membership_id?: string;
  error?: string;
  error_description?: string;
}

/**
 * Exchange an authorization code for access and refresh tokens
 * For desktop app, this calls Bungie's OAuth endpoint directly
 */
export async function exchangeAuthCode(code: string): Promise<AuthResponse> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Missing Bungie Client ID or Secret');
  }

  const body = new URLSearchParams();
  body.append('grant_type', 'authorization_code');
  body.append('code', code);
  body.append('client_id', CLIENT_ID);
  body.append('client_secret', CLIENT_SECRET);

  const response = await fetch('https://www.bungie.net/Platform/App/OAuth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const data = await response.json();

  if (data.error) {
    return {
      error: data.error,
      error_description: data.error_description || 'Failed to exchange code',
      access_token: '',
      refresh_token: '',
      membership_id: '',
    };
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    membership_id: data.membership_id || data.member_id,
    expires_in: data.expires_in,
  };
}

/**
 * Refresh an access token using a refresh token
 * For desktop app, this calls Bungie's OAuth endpoint directly
 */
export async function refreshAuthToken(refreshToken: string): Promise<RefreshResponse> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Missing Bungie Client ID or Secret');
  }

  const body = new URLSearchParams();
  body.append('grant_type', 'refresh_token');
  body.append('refresh_token', refreshToken);
  body.append('client_id', CLIENT_ID);
  body.append('client_secret', CLIENT_SECRET);

  const response = await fetch('https://www.bungie.net/Platform/App/OAuth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const data = await response.json();

  if (data.error) {
    return {
      error: data.error,
      error_description: data.error_description || 'Failed to refresh token',
      access_token: '',
    };
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    membership_id: data.membership_id || data.member_id,
  };
}

export interface BungieResponse<T> {
  Response: T;
  ErrorCode: number;
  ThrottleSeconds: number;
  ErrorStatus: string;
  Message: string;
  MessageData: Record<string, string>;
}

/**
 * Fetch Post Game Carnage Report (PGCR) for a given activity instance ID
 * For desktop app, this calls Bungie's API directly
 */
export async function fetchPGCR(instanceId: string): Promise<BungieResponse<any>> {
  if (!API_KEY) {
    throw new Error('Missing Bungie API Key');
  }

  const accessToken = Cookies.get('bungie_access_token');
  
  const headers: HeadersInit = {
    'X-API-Key': API_KEY,
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(
    `https://www.bungie.net/Platform/Destiny2/Stats/PostGameCarnageReport/${instanceId}/`,
    {
      headers,
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch PGCR: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

export interface RSSResponse {
  items?: Array<{
    title: string;
    link: string;
    pubDate: string;
    description: string;
    image: string;
  }>;
  error?: string;
}

/**
 * Fetch RSS feed from Bungie news
 * For desktop app, this calls the internal API route which handles RSS parsing
 */
export async function fetchRSS(): Promise<RSSResponse> {
  try {
    const response = await fetch('/api/rss');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch RSS: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('RSS fetch error:', error);
    return { error: 'Failed to fetch RSS feed', items: [] };
  }
}
