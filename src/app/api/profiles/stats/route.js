import { NextResponse } from "next/server";
import { getCachedProfiles } from "@/lib/store";

export async function GET() {
  const all = getCachedProfiles();
  const byAccount = {};
  for (const r of all) {
    byAccount[r.accountId] = (byAccount[r.accountId] || 0) + 1;
  }
  return NextResponse.json({ total: all.length, byAccount });
}


