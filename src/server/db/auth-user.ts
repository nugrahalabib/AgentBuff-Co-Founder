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

/**
 * Re-point everything a GUEST created onto the now-logged-in Google user, then delete the empty guest.
 * Prevents data loss when someone works as a guest and later signs in (PRD §13.4 durability). Idempotent,
 * transactional, and refuses to touch any non-guest row. `googleUserId` must already exist (persistGoogleUser).
 */
export async function claimGuestData(googleUserId: string, guestUserId: string): Promise<void> {
  if (googleUserId === guestUserId || guestUserId === "") return;
  const guest = await prisma.user.findUnique({ where: { id: guestUserId } });
  if (guest === null || !guest.googleSub.startsWith("guest:")) return; // only ever claim from a guest row

  await prisma.$transaction(async (tx) => {
    await tx.project.updateMany({ where: { ownerUserId: guestUserId }, data: { ownerUserId: googleUserId } });
    await tx.usageEvent.updateMany({ where: { userId: guestUserId }, data: { userId: googleUserId } });
    await tx.mcpClient.updateMany({ where: { ownerUserId: guestUserId }, data: { ownerUserId: googleUserId } });

    // BYOK credentials: avoid the unique(userId, provider) collision — keep the Google account's if it
    // already has that provider, otherwise move the guest's over.
    const creds = await tx.byokCredential.findMany({ where: { userId: guestUserId } });
    for (const c of creds) {
      const existing = await tx.byokCredential.findFirst({ where: { userId: googleUserId, provider: c.provider } });
      if (existing === null) await tx.byokCredential.update({ where: { id: c.id }, data: { userId: googleUserId } });
      else await tx.byokCredential.delete({ where: { id: c.id } });
    }

    // The onboarding profile (PK = userId) and the empty guest row cascade away with the delete.
    await tx.user.delete({ where: { id: guestUserId } });
  });
}
