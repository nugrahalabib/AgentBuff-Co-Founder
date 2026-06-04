// src/server/db/prisma.ts — PrismaClient singleton (cached on globalThis for dev hot-reload).
import "server-only"; // DB access — never reachable from the client bundle (build-time guard)
import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { __prismaClient?: PrismaClient };
export const prisma: PrismaClient = g.__prismaClient ?? (g.__prismaClient = new PrismaClient());
