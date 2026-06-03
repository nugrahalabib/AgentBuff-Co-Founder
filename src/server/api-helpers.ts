// src/server/api-helpers.ts — shared helpers for Route Handlers (session + JSON responses).

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { SESSION_COOKIE, signSession, readUserIdFromCookieHeader } from "./session";

export interface SessionUser {
  userId: string;
  isNew: boolean;
}

/** Read the session user, or mint a new guest id (the caller attaches the cookie via {@link withSession}). */
export function sessionUser(req: Request): SessionUser {
  const existing = readUserIdFromCookieHeader(req.headers.get("cookie"));
  return existing !== null ? { userId: existing, isNew: false } : { userId: randomUUID(), isNew: true };
}

/** Read the session user without creating one (for GET / read-only routes). */
export function currentUserId(req: Request): string | null {
  return readUserIdFromCookieHeader(req.headers.get("cookie"));
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
