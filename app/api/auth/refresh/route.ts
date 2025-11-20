import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('bungie_refresh_token')?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
  }

  try {
    if (!process.env.NEXT_PUBLIC_BUNGIE_CLIENT_ID || !process.env.BUNGIE_CLIENT_SECRET) {
        throw new Error("Missing Client ID or Secret");
    }

    const body = new URLSearchParams();
    body.append('grant_type', 'refresh_token');
    body.append('refresh_token', refreshToken);
    body.append('client_id', process.env.NEXT_PUBLIC_BUNGIE_CLIENT_ID);
    body.append('client_secret', process.env.BUNGIE_CLIENT_SECRET);

    const response = await fetch('https://www.bungie.net/Platform/App/OAuth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const data = await response.json();

    if (data.error) {
        console.error("Refresh Token Error from Bungie:", data);
        throw new Error(data.error_description || 'Failed to refresh token');
    }

    const { access_token, refresh_token, membership_id } = data;

    // Update Cookies
    cookieStore.set('bungie_access_token', access_token, {
      httpOnly: false, // Allow client JS to read for API calls
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600, // 1 hour
    });

    cookieStore.set('bungie_refresh_token', refresh_token, {
      httpOnly: true, // Keep secure
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 90 * 24 * 60 * 60, // 90 days
    });

    return NextResponse.json({ access_token, success: true });
  } catch (error) {
    console.error('Token Refresh Error:', error);
    // Clear cookies if refresh fails so client knows to re-login
    cookieStore.delete('bungie_access_token');
    cookieStore.delete('bungie_refresh_token');
    cookieStore.delete('bungie_membership_id');
    
    return NextResponse.json({ error: 'Refresh failed' }, { status: 401 });
  }
}

