import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildAuthorizeUrl,
  buildRedirectUri,
  generateCodeChallenge,
  generateCodeVerifier,
  generateRandomState,
} from "@/lib/klaviyoOAuth";

export async function GET(request) {
  const { nextUrl } = request;
  const origin = `${nextUrl.protocol}//${nextUrl.host}`;
  const dryRun = nextUrl.searchParams.get("dryRun") === "1";
  const isHttps = nextUrl.protocol === "https:";

  const state = generateRandomState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const url = await buildAuthorizeUrl(origin, state, codeChallenge);
  // For debugging: reveal the exact redirect URI and authorize URL without mutating cookies
  if (dryRun) {
    const redirectUriFallback = new URL("/api/auth/klaviyo/callback", origin).toString();
    const redirectUriEffective = buildRedirectUri(origin);
    return NextResponse.json({
      origin,
      redirectUriEnv: process.env.KLAVIYO_REDIRECT_URI || null,
      redirectUriFallback,
      redirectUriEffective,
      authorizeUrl: url,
    });
  }

  const cookieStore = await cookies();
  const cookieOpts = { httpOnly: true, secure: isHttps, sameSite: "lax", path: "/", maxAge: 300 };
  cookieStore.set("kl_state", state, cookieOpts);
  cookieStore.set("kl_verifier", codeVerifier, cookieOpts);

  return NextResponse.redirect(url);
}


