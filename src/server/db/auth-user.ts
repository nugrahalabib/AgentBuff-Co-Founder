// src/server/db/auth-user.ts — persist the real Google identity on sign-in. PRD §9.1, §11.2.
// Called from the Auth.js `signIn` event (Node runtime, behind a dynamic import so Prisma is never
// bundled into the edge). Best-effort: a DB hiccup must never block the user from logging in.

import { prisma } from "./prisma";

export interface GoogleIdentity {
  email: string | null;
  name: string | null;
  picture: string | null;
  sub: string;
}

/** Upsert the User row from the verified Google profile. `userId` is `google:<sub>`. */
export async function persistGoogleUser(userId: string, id: GoogleIdentity): Promise<void> {
  const email = id.email ?? `${userId}@google.local`;
  const displayName = id.name ?? undefined;
  const avatarUrl = id.picture ?? undefined;
  await prisma.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      googleSub: id.sub,
      email,
      displayName: displayName ?? "Pengguna",
      avatarUrl: avatarUrl ?? null,
      lastLoginAt: new Date(),
    },
    // On return visits keep the profile fresh, but never clobber a name the user edited in onboarding
    // with a null from Google — only overwrite when Google actually supplies a value.
    update: {
      email,
      ...(displayName !== undefined ? { displayName } : {}),
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      lastLoginAt: new Date(),
    },
  });
}
