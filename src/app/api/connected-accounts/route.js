import { NextResponse } from "next/server";
import { getConnections, saveConnection, getSyncStatusForAccount } from "@/lib/store";
import { fetchAccounts } from "@/lib/klaviyoOAuth";

export async function GET(request) {
  const debug = request.nextUrl.searchParams.get("debug") === "1";
  const stored = getConnections();
  const enriched = [];
  for (const c of stored) {
    let name = c.accountName;
    let accountsRaw = null;
    if (!name || name === "Klaviyo Account") {
      try {
        const accountsJson = await fetchAccounts(c.accessToken);
        accountsRaw = accountsJson;
        const first = Array.isArray(accountsJson?.data) ? accountsJson.data[0] : null;
        const a = first?.attributes || {};
        const fetchedName = a?.contact_information?.organization_name || a?.name || a?.company_name || null;
        if (fetchedName) {
          name = fetchedName;
          saveConnection({ ...c, accountName: name });
        }
      } catch (err) {
        // ignore; keep existing name
      }
    }
    const syncStatus = getSyncStatusForAccount(c.accountId) || { state: "idle" };
    enriched.push({
      accountId: c.accountId,
      accountName: name || "Klaviyo Account",
      sync: syncStatus,
      ...(debug ? { accountsRaw } : {}),
    });
  }
  return NextResponse.json({ data: enriched });
}


