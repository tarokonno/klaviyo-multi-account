import crypto from "crypto";

const KLAVIYO_AUTHORIZE_URL = "https://www.klaviyo.com/oauth/authorize";
const KLAVIYO_TOKEN_URL = "https://a.klaviyo.com/oauth/token";

export function getApiRevision() {
  return process.env.KLAVIYO_API_REVISION || "2024-10-15";
}

export function getScopes() {
  // Minimal scopes to read account info and profiles
  return (process.env.KLAVIYO_OAUTH_SCOPES || "accounts:read profiles:read").trim();
}

export function getClientId() {
  const clientId = process.env.KLAVIYO_CLIENT_ID;
  if (!clientId) throw new Error("KLAVIYO_CLIENT_ID is not set");
  return clientId;
}

export function getClientSecret() {
  return process.env.KLAVIYO_CLIENT_SECRET || "";
}

export function buildRedirectUri(origin) {
  // Prefer explicit override to ensure exact match with Klaviyo allowlist
  if (process.env.KLAVIYO_REDIRECT_URI) return process.env.KLAVIYO_REDIRECT_URI;
  return `${origin}/api/auth/klaviyo/callback`;
}

export function generateRandomState(length = 32) {
  return crypto.randomBytes(length).toString("base64url");
}

export function generateCodeVerifier() {
  // 43-128 chars per PKCE spec
  return crypto.randomBytes(64).toString("base64url");
}

export async function generateCodeChallenge(codeVerifier) {
  const hash = crypto.createHash("sha256").update(codeVerifier).digest();
  return Buffer.from(hash).toString("base64url");
}

export async function buildAuthorizeUrl(origin, state, codeChallenge) {
  const clientId = getClientId();
  const redirectUri = buildRedirectUri(origin);
  const scopes = encodeURIComponent(getScopes());
  const url = `${KLAVIYO_AUTHORIZE_URL}?response_type=code&client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${encodeURIComponent(
    state
  )}&code_challenge_method=S256&code_challenge=${encodeURIComponent(codeChallenge)}`;
  return url;
}

export async function exchangeCodeForTokens({ code, codeVerifier, redirectUri }) {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  const baseBody = {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  };

  // Attempt 1: Send client_secret in body (common OAuth server expectation)
  if (clientSecret) {
    const body = new URLSearchParams({ ...baseBody, client_secret: clientSecret });
    const res = await fetch(KLAVIYO_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (res.ok) return res.json();
    // If invalid_client, try Basic auth fallback
    if (res.status !== 401) {
      const text = await res.text();
      throw new Error(`Token exchange failed: ${res.status} ${text}`);
    }
  }

  // Attempt 2: Basic auth with client_id:client_secret (or no secret for PKCE-only apps)
  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  if (clientSecret) {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    headers.Authorization = `Basic ${basic}`;
  }
  const res2 = await fetch(KLAVIYO_TOKEN_URL, {
    method: "POST",
    headers,
    body: new URLSearchParams(baseBody).toString(),
  });
  if (!res2.ok) {
    const text = await res2.text();
    const err = new Error(`Token exchange failed: ${res2.status} ${text}`);
    err.status = res2.status;
    throw err;
  }
  return res2.json();
}

export async function refreshAccessToken({ refreshToken }) {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });
  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  if (clientSecret) {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    headers.Authorization = `Basic ${basic}`;
  }
  const res = await fetch(KLAVIYO_TOKEN_URL, { method: "POST", headers, body: body.toString() });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Token refresh failed: ${res.status} ${text}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function fetchAccounts(accessToken) {
  const url = new URL("https://a.klaviyo.com/api/accounts");
  // Request only supported fields; we'll read organization_name from contact_information
  url.searchParams.set("fields[account]", "contact_information");
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      revision: getApiRevision(),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Failed to fetch accounts: ${res.status} ${text}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function fetchProfiles(accessToken, { pageCursor, pageSize } = {}) {
  const url = new URL("https://a.klaviyo.com/api/profiles");
  url.searchParams.set("fields[profile]", "email,phone_number,external_id");
  // Include subscriptions in response if supported
  url.searchParams.set("additional-fields[profile]", "subscriptions");
  if (pageSize) url.searchParams.set("page[size]", String(pageSize));
  if (pageCursor) {
    const normalized = normalizePageCursor(pageCursor);
    if (normalized) url.searchParams.set("page[cursor]", normalized);
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      revision: getApiRevision(),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Failed to fetch profiles: ${res.status} ${text}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function normalizePageCursor(value) {
  if (!value) return undefined;
  try {
    // If value is a full next URL, extract page[cursor]
    if (value.startsWith("http://") || value.startsWith("https://")) {
      const u = new URL(value);
      const raw = u.searchParams.get("page[cursor]") || u.searchParams.get("page%5Bcursor%5D");
      return raw || undefined;
    }
    // Sometimes providers return '...page[cursor]=token'; try to split
    const idx = value.indexOf("page[cursor]=");
    if (idx !== -1) {
      return value.substring(idx + "page[cursor]=".length);
    }
    return value;
  } catch {
    return value;
  }
}


