import { NextResponse } from "next/server";
import { getConnections } from "@/lib/store";
import { backfillAll } from "@/lib/sync";

export async function POST(request) {
  const { nextUrl } = request;
  const accountId = nextUrl.searchParams.get("accountId") || undefined;
  const connections = accountId
    ? getConnections().filter((c) => c.accountId === accountId)
    : getConnections();

  const results = await backfillAll(connections, 100);
  return NextResponse.json({ results });
}


