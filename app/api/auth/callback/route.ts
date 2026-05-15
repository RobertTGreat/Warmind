import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const CLIENT_ID = process.env.NEXT_PUBLIC_BUNGIE_CLIENT_ID; // Use the public one if that's what is set
const CLIENT_SECRET = process.env.BUNGIE_CLIENT_SECRET;
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL 
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback` 
  : 'http://localhost:3000/api/auth/callback'; // Default for local dev

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const cookieStore = await cookies();
  const storedState = cookieStore.get('bungie_oauth_state')?.value;

  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL('/?error=invalid_oauth_state', request.url));
  }

  cookieStore.delete('bungie_oauth_state');

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', request.url));
  }

  try {
    if (!CLIENT_ID || !CLIENT_SECRET) {
       throw new Error('Missing Bungie Client ID or Secret');
    }

    const body = new URLSearchParams();
    body.append('grant_type', 'authorization_code');
    body.append('code', code);
    body.append('client_id', CLIENT_ID);
    body.append('client_secret', CLIENT_SECRET);

    // Note: Bungie's API expects client_id to be sent in the body as well, OR Basic Auth header.
    // Common issue: client_id in env might be string, but sometimes treated as int by older systems? 
    // Usually string is fine. Ensure no extra spaces in env vars.

    // Also, Bungie OAuth often requires the `Content-Type` to be exactly correct.
    // Let's try adding `Origin` header if needed, but usually not.
    
    const response = await fetch('https://www.bungie.net/Platform/App/OAuth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error_description || 'Failed to exchange code');
    }

    const { access_token, refresh_token, membership_id } = data;

    // Store tokens in httpOnly cookies
    cookieStore.set('bungie_access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600, // 1 hour
    });

    cookieStore.set('bungie_refresh_token', refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 90 * 24 * 60 * 60, // 90 days
    });

    cookieStore.set('bungie_membership_id', membership_id, {
       httpOnly: false,
       secure: process.env.NODE_ENV === 'production',
       sameSite: 'lax',
    });

    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    console.error('Auth Error:', error);
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url));
  }
}

