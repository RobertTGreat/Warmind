import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

async function clearAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.delete('bungie_access_token');
  cookieStore.delete('bungie_refresh_token');
  cookieStore.delete('bungie_membership_id');
}

export async function GET(request: NextRequest) {
  await clearAuthCookies();
  return NextResponse.redirect(new URL('/', request.url));
}

export async function POST() {
  await clearAuthCookies();
  return NextResponse.json({ success: true });
}

