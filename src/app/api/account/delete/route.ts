// POST /api/account/delete — UU PDP right to erasure: permanently delete the account + all owned data.
// Same-origin guarded; requires an explicit { confirm: "HAPUS" } body. Clears the guest session cookie.

import { NextResponse } from "next/server";
import { app } from "@/server/runtime";
import { currentUserId, guardMutation } from "@/server/api-helpers";
import { SESSION_COOKIE } from "@/server/session";

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

  const res = NextResponse.json({ ok: true, deleted: true });
  // Drop the guest session; Google users should also sign out client-side.
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
