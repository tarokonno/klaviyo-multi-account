import { fetchProfiles, refreshAccessToken } from "@/lib/klaviyoOAuth";
import {
  upsertCachedProfiles,
  clearCachedProfilesForAccount,
  updateConnectionTokens,
  setSyncStatus,
} from "@/lib/store";

export async function backfillAccount(conn, pageSize = 100) {
  setSyncStatus(conn.accountId, { state: "running", startedAt: Date.now(), processed: 0, total: undefined });
  let cursor;
  let total = 0;
  clearCachedProfilesForAccount(conn.accountId);
  for (let i = 0; i < 10000; i++) {
    let page;
    try {
      page = await fetchProfiles(conn.accessToken, { pageCursor: cursor, pageSize });
    } catch (err) {
      if (err?.status === 401 && conn.refreshToken) {
        // Try refresh token once
        const refreshed = await refreshAccessToken({ refreshToken: conn.refreshToken });
        const newAccess = refreshed.access_token;
        const newRefresh = refreshed.refresh_token || conn.refreshToken;
        const expiresIn = refreshed.expires_in || 3600;
        const newExpiresAt = Date.now() + expiresIn * 1000;
        updateConnectionTokens(conn.accountId, {
          accessToken: newAccess,
          refreshToken: newRefresh,
          expiresAt: newExpiresAt,
        });
        conn = { ...conn, accessToken: newAccess, refreshToken: newRefresh, expiresAt: newExpiresAt };
        page = await fetchProfiles(conn.accessToken, { pageCursor: cursor, pageSize });
      } else {
        throw err;
      }
    }
    const items = Array.isArray(page?.data) ? page.data : [];
    if (items.length === 0) break;
    const rows = items.map((item) => ({
      accountId: conn.accountId,
      accountName: conn.accountName,
      klaviyoId: item.id,
      externalId: item.attributes?.external_id || null,
      email: item.attributes?.email || null,
      phone: item.attributes?.phone_number || null,
    subscriptions: item.attributes?.subscriptions || null,
    }));
    upsertCachedProfiles(rows);
    total += rows.length;
    // If API exposes total in meta, surface it; otherwise keep undefined
    const maybeTotal = page?.meta?.total || page?.meta?.count || undefined;
    setSyncStatus(conn.accountId, { state: "running", processed: total, total: maybeTotal, lastPageSize: rows.length });
    cursor = page?.links?.next || page?.links?.next_url || page?.links?.nextPage || null;
    if (!cursor) break;
  }
  setSyncStatus(conn.accountId, { state: "idle", processed: total, finishedAt: Date.now() });
  return total;
}

export async function backfillAll(connections, pageSize = 100) {
  const results = [];
  for (const conn of connections) {
    try {
      const count = await backfillAccount(conn, pageSize);
      results.push({ accountId: conn.accountId, count });
    } catch (err) {
      results.push({ accountId: conn.accountId, error: String(err) });
    }
  }
  return results;
}


