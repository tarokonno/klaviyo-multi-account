import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildRedirectUri,
  exchangeCodeForTokens,
  fetchAccounts,
} from "@/lib/klaviyoOAuth";
import { saveConnection } from "@/lib/store";
import { backfillAccount } from "@/lib/sync";

export async function GET(request) {
  const { nextUrl } = request;
  const origin = `${nextUrl.protocol}//${nextUrl.host}`;
  const isHttps = nextUrl.protocol === "https:";
  const code = nextUrl.searchParams.get("code");
  const state = nextUrl.searchParams.get("state");
  const error = nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${origin}/dashboard?error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${origin}/dashboard?error=missing_code_or_state`);
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get("kl_state")?.value;
  const codeVerifier = cookieStore.get("kl_verifier")?.value;
  cookieStore.delete("kl_state", { path: "/", secure: isHttps });
  cookieStore.delete("kl_verifier", { path: "/", secure: isHttps });

  if (!storedState || storedState !== state || !codeVerifier) {
    return NextResponse.redirect(`${origin}/dashboard?error=invalid_state`);
  }

  try {
    const redirectUri = buildRedirectUri(origin);
    const tokenResponse = await exchangeCodeForTokens({ code, codeVerifier, redirectUri });
    const accessToken = tokenResponse.access_token;
    const refreshToken = tokenResponse.refresh_token || null;
    const expiresIn = tokenResponse.expires_in || 3600;
    const expiresAt = Date.now() + expiresIn * 1000;

    // Lookup account info
    const accountsJson = await fetchAccounts(accessToken);
    const firstAccount = Array.isArray(accountsJson?.data) ? accountsJson.data[0] : null;
    const accountId = firstAccount?.id || "unknown_account";
    const attr = firstAccount?.attributes || {};
    const accountName =
      attr?.contact_information?.organization_name ||
      attr?.name ||
      attr?.company_name ||
      "Klaviyo Account";

    const connection = { accountId, accountName, accessToken, refreshToken, expiresAt };
    saveConnection(connection);

    // Kick off a background backfill for this account so data appears without manual sync
    backfillAccount(connection, 100).catch(() => {});

    return NextResponse.redirect(`${origin}/dashboard?connected=${encodeURIComponent(accountId)}`);
  } catch (err) {
    console.error(err);
    return NextResponse.redirect(`${origin}/dashboard?error=${encodeURIComponent(err.message)}`);
  }
}


