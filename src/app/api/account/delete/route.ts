// POST /api/account/delete — UU PDP right to erasure: permanently delete the account + all owned data.
// Same-origin guarded; requires an explicit { confirm: "HAPUS" } body.

import { NextResponse } from "next/server";
import { app } from "@/server/runtime";
import { currentUserId, guardMutation } from "@/server/api-helpers";

export async function POST(req: Request): Promise<Response> {
  const blocked = guardMutation(req);
  if (blocked !== null) return blocked;
  const userId = await currentUserId(req);
  if (userId === null) return NextResponse.json({ error: "Masuk dulu." }, { status: 401 });

  let confirm: string | undefined;
  try {
    confirm = ((await req.json()) as { confirm?: string }).confirm;
  } catch {
    confirm = undefined;
  }
  if (confirm !== "HAPUS") {
    return NextResponse.json({ error: 'Konfirmasi diperlukan: kirim { "confirm": "HAPUS" }.' }, { status: 400 });
  }

  await app.account.delete(userId);
  // The client signs out of Google after this resolves (clears the Auth.js session).
  return NextResponse.json({ ok: true, deleted: true });
}
