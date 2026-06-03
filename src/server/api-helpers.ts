// src/server/api-helpers.ts — session helpers for Route Handlers / server components.
// User id resolution priority: Google (Auth.js) session → signed-cookie guest session → new guest.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { SESSION_COOKIE, signSession, verifySession, readUserIdFromCookieHeader } from "./session";

export interface SessionUser {
  userId: string;
  isNew: boolean;
}

/** The logged-in Google user id (`google:<sub>`), or null. */
async function googleUserId(): Promise<string | null> {
  try {
    const session = await auth();
    const id = (session?.user as { id?: string } | undefined)?.id;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

/** Resolve the acting user, minting a guest id if neither a Google nor guest session exists. */
export async function resolveSessionUser(req: Request): Promise<SessionUser> {
  const google = await googleUserId();
  if (google !== null) return { userId: google, isNew: false };
  const existing = readUserIdFromCookieHeader(req.headers.get("cookie"));
  return existing !== null ? { userId: existing, isNew: false } : { userId: randomUUID(), isNew: true };
}

/** Read the acting user without minting one (for GET / read-only routes). */
export async function currentUserId(req: Request): Promise<string | null> {
  const google = await googleUserId();
  if (google !== null) return google;
  return readUserIdFromCookieHeader(req.headers.get("cookie"));
}

/** Server-component variant (reads cookies via next/headers). */
export async function getServerUserId(): Promise<string | null> {
  const google = await googleUserId();
  if (google !== null) return google;
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** JSON response that sets the guest session cookie when the user is newly minted. */
export function withSession(data: unknown, s: SessionUser, init?: ResponseInit): NextResponse {
  const res = NextResponse.json(data, init);
  if (s.isNew) {
    res.cookies.set(SESSION_COOKIE, signSession(s.userId), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}
