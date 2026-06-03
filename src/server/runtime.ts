// src/server/runtime.ts
// App runtime container. Auto-selects persistence:
//   • DATABASE_URL set  → Prisma-backed repos + credential store (Postgres).
//   • otherwise         → in-memory (zero-setup; data resets on restart).
// Either way the services/registry are identical. Cached on globalThis for dev hot-reload. PRD §10.1.

import { randomUUID } from "node:crypto";
import { LocalMasterKey } from "@/lib/crypto";
import { InMemoryCredentialStore, type UpsertableCredentialStore } from "@/lib/ai/credential-store";
import { DefaultProviderRegistry } from "@/lib/ai/registry";
import { InMemoryRepository, type Repository } from "@/server/domain/repositories";
import type { BusinessPlan, OnboardingProfile, ProfileInput, Project, ResearchReport } from "@/server/domain/types";
import { ProjectService } from "@/server/services/project-service";
import { ResearchService } from "@/server/services/research-service";
import { PlannerService } from "@/server/services/planner-service";
import { buildToolRegistry } from "@/server/mcp/build-registry";
import type { McpToolRegistry } from "@/server/mcp/registry";
import { createPrismaPersistence } from "@/server/db/prisma-repositories";

export interface AppRuntime {
  master: LocalMasterKey;
  credentials: UpsertableCredentialStore;
  registry: DefaultProviderRegistry;
  projects: ProjectService;
  research: ResearchService;
  planner: PlannerService;
  mcp: McpToolRegistry;
  repos: {
    projects: Repository<Project>;
    reports: Repository<ResearchReport>;
    plans: Repository<BusinessPlan>;
  };
  /** Ensure the (guest) User row exists before creating FK-constrained rows. No-op in memory mode. */
  ensureUser: (userId: string) => Promise<void>;
  saveProfile: (userId: string, input: ProfileInput) => Promise<void>;
  getProfile: (userId: string) => Promise<OnboardingProfile | null>;
  persistence: "postgres" | "memory";
}

function createRuntime(): AppRuntime {
  const master = process.env.BYOK_MASTER_KEY_BASE64
    ? LocalMasterKey.fromBase64(process.env.BYOK_MASTER_KEY_BASE64)
    : LocalMasterKey.generate();

  const usePostgres = typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;

  let credentials: UpsertableCredentialStore;
  let projectsRepo: Repository<Project>;
  let reportsRepo: Repository<ResearchReport>;
  let plansRepo: Repository<BusinessPlan>;
  let ensureUser: (userId: string) => Promise<void>;
  let saveProfile: (userId: string, input: ProfileInput) => Promise<void>;
  let getProfile: (userId: string) => Promise<OnboardingProfile | null>;

  if (usePostgres) {
    const p = createPrismaPersistence();
    credentials = p.credentials;
    projectsRepo = p.projects;
    reportsRepo = p.reports;
    plansRepo = p.plans;
    ensureUser = p.ensureUser;
    saveProfile = p.saveProfile;
    getProfile = p.getProfile;
  } else {
    credentials = new InMemoryCredentialStore();
    projectsRepo = new InMemoryRepository<Project>();
    reportsRepo = new InMemoryRepository<ResearchReport>();
    plansRepo = new InMemoryRepository<BusinessPlan>();
    ensureUser = async () => {};
    const profiles = new Map<string, OnboardingProfile>();
    saveProfile = async (userId, input) => {
      profiles.set(userId, {
        userId,
        sector: input.sector,
        stage: input.stage,
        primaryGoal: input.primaryGoal,
        budgetBand: input.budgetBand,
      });
    };
    getProfile = async (userId) => profiles.get(userId) ?? null;
  }

  const registry = new DefaultProviderRegistry(credentials, master);
  const idGen = (): string => randomUUID();
  const now = (): string => new Date().toISOString();

  return {
    master,
    credentials,
    registry,
    projects: new ProjectService({ projects: projectsRepo, research: reportsRepo, plans: plansRepo, idGen, now }),
    research: new ResearchService({ reports: reportsRepo, registry, idGen, now }),
    planner: new PlannerService({ plans: plansRepo, registry, idGen, now }),
    mcp: buildToolRegistry(),
    repos: { projects: projectsRepo, reports: reportsRepo, plans: plansRepo },
    ensureUser,
    saveProfile,
    getProfile,
    persistence: usePostgres ? "postgres" : "memory",
  };
}

const g = globalThis as unknown as { __agentbuffApp?: AppRuntime };
export const app: AppRuntime = g.__agentbuffApp ?? (g.__agentbuffApp = createRuntime());
