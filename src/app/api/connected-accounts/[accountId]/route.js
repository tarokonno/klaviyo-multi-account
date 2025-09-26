import { NextResponse } from "next/server";
import { removeConnection } from "@/lib/store";

export async function DELETE(_request, { params }) {
  const { accountId } = params;
  if (!accountId) {
    return NextResponse.json({ error: "accountId required" }, { status: 400 });
  }
  removeConnection(accountId);
  return NextResponse.json({ ok: true });
}


