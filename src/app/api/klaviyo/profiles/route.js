import { NextResponse } from "next/server";
import { getConnections, getConnectionByAccountId } from "@/lib/store";
import { fetchProfiles } from "@/lib/klaviyoOAuth";

function encodeCompositeCursor(obj) {
  try {
    return Buffer.from(JSON.stringify(obj)).toString("base64url");
  } catch {
    return undefined;
  }
}

function decodeCompositeCursor(str) {
  if (!str) return { cursors: {} };
  try {
    const json = JSON.parse(Buffer.from(str, "base64url").toString("utf-8"));
    return json && typeof json === "object" ? json : { cursors: {} };
  } catch {
    return { cursors: {} };
  }
}

function normalizeSingleCursor(cursor, accountId) {
  // Accept raw provider cursor or composite base64 payload
  if (!cursor) return undefined;
  try {
    const decoded = decodeCompositeCursor(cursor);
    const candidate = decoded.cursors?.[accountId];
    return candidate || cursor;
  } catch {
    return cursor;
  }
}

export async function GET(request) {
  const { nextUrl } = request;
  const accountIdFilter = nextUrl.searchParams.get("accountId");
  const sizeParam = nextUrl.searchParams.get("size");
  const cursor = nextUrl.searchParams.get("cursor") || undefined;
  const pageSize = Math.max(1, Math.min(Number(sizeParam || 25), 100));

  const connections = accountIdFilter
    ? [getConnectionByAccountId(accountIdFilter)].filter(Boolean)
    : getConnections();

  // If exactly one account is selected, support cursor pagination
  if (connections.length === 1) {
    const conn = connections[0];
    try {
      const pageCursor = normalizeSingleCursor(cursor, conn.accountId);
      const page = await fetchProfiles(conn.accessToken, { pageCursor, pageSize });
      const items = Array.isArray(page?.data) ? page.data : [];
      const results = items.map((item) => ({
        accountId: conn.accountId,
        accountName: conn.accountName,
        klaviyoId: item.id,
        email: item.attributes?.email || null,
        phone: item.attributes?.phone_number || null,
      }));
      const links = page?.links || {};
      return NextResponse.json({ data: results, links });
    } catch (err) {
      console.error("Failed to fetch profiles for account", conn.accountId, err);
      return NextResponse.json({ data: [], links: {} });
    }
  }

  // Multiple accounts selected: composite forward cursor across accounts
  const composite = decodeCompositeCursor(cursor);
  const perAccountNext = {};
  const results = [];
  for (const conn of connections) {
    try {
      const perAccountCursor = composite.cursors?.[conn.accountId];
      const page = await fetchProfiles(conn.accessToken, {
        pageSize,
        pageCursor: normalizeSingleCursor(perAccountCursor, conn.accountId),
      });
      const items = Array.isArray(page?.data) ? page.data : [];
      for (const item of items) {
        if (results.length >= pageSize) break;
        results.push({
          accountId: conn.accountId,
          accountName: conn.accountName,
          klaviyoId: item.id,
          email: item.attributes?.email || null,
          phone: item.attributes?.phone_number || null,
        });
      }
      perAccountNext[conn.accountId] = page?.links?.next || null;
    } catch (err) {
      console.error("Failed to fetch profiles for account", conn.accountId, err);
      perAccountNext[conn.accountId] = null;
    }
  }

  // Build next composite cursor if any account has more
  const anyNext = Object.values(perAccountNext).some((v) => !!v);
  const nextCursor = anyNext ? encodeCompositeCursor({ cursors: perAccountNext }) : undefined;
  const links = nextCursor ? { next: nextCursor } : {};
  return NextResponse.json({ data: results, links });
}


