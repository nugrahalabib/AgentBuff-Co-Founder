// src/server/db/prisma.ts — PrismaClient singleton (cached on globalThis for dev hot-reload).
import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { __prismaClient?: PrismaClient };
export const prisma: PrismaClient = g.__prismaClient ?? (g.__prismaClient = new PrismaClient());
