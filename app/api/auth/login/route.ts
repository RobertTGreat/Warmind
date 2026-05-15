import { NextRequest, NextResponse } from "next/server";

const CLIENT_ID = process.env.NEXT_PUBLIC_BUNGIE_CLIENT_ID;

export async function GET(request: NextRequest) {
  if (!CLIENT_ID) {
    return NextResponse.redirect(new URL("/?error=missing_client_id", request.url));
  }

  const state = crypto.randomUUID();

  const redirectUrl = new URL("https://www.bungie.net/en/OAuth/Authorize");
  redirectUrl.searchParams.set("client_id", CLIENT_ID);
  redirectUrl.searchParams.set("response_type", "code");
  redirectUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(redirectUrl);

  response.cookies.set("bungie_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });

  return response;
}
