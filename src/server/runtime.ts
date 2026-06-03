// src/server/runtime.ts
// No-DB runtime container so the app runs with ZERO infra setup (in-memory repos + a generated KEK).
// Data lives in-process (resets on restart) — perfect for local use & testing. Swap the in-memory
// repos/credential store for Prisma-backed ones in prod without touching services. PRD §10.1.
// Cached on globalThis so Next.js hot-reload doesn't wipe data between requests.

import { randomUUID } from "node:crypto";
import { LocalMasterKey } from "@/lib/crypto";
import { InMemoryCredentialStore } from "@/lib/ai/credential-store";
import { DefaultProviderRegistry } from "@/lib/ai/registry";
import { InMemoryRepository } from "@/server/domain/repositories";
import type { BusinessPlan, Project, ResearchReport } from "@/server/domain/types";
import { ProjectService } from "@/server/services/project-service";
import { ResearchService } from "@/server/services/research-service";
import { PlannerService } from "@/server/services/planner-service";
import { buildToolRegistry } from "@/server/mcp/build-registry";
import type { McpToolRegistry } from "@/server/mcp/registry";

export interface AppRuntime {
  master: LocalMasterKey;
  credentials: InMemoryCredentialStore;
  registry: DefaultProviderRegistry;
  projects: ProjectService;
  research: ResearchService;
  planner: PlannerService;
  mcp: McpToolRegistry;
  repos: {
    projects: InMemoryRepository<Project>;
    reports: InMemoryRepository<ResearchReport>;
    plans: InMemoryRepository<BusinessPlan>;
  };
}

function createRuntime(): AppRuntime {
  const master = process.env.BYOK_MASTER_KEY_BASE64
    ? LocalMasterKey.fromBase64(process.env.BYOK_MASTER_KEY_BASE64)
    : LocalMasterKey.generate();

  const credentials = new InMemoryCredentialStore();
  const projects = new InMemoryRepository<Project>();
  const reports = new InMemoryRepository<ResearchReport>();
  const plans = new InMemoryRepository<BusinessPlan>();
  const registry = new DefaultProviderRegistry(credentials, master);

  const idGen = (): string => randomUUID();
  const now = (): string => new Date().toISOString();

  return {
    master,
    credentials,
    registry,
    projects: new ProjectService({ projects, research: reports, plans, idGen, now }),
    research: new ResearchService({ reports, registry, idGen, now }),
    planner: new PlannerService({ plans, registry, idGen, now }),
    mcp: buildToolRegistry(),
    repos: { projects, reports, plans },
  };
}

const g = globalThis as unknown as { __agentbuffApp?: AppRuntime };
export const app: AppRuntime = g.__agentbuffApp ?? (g.__agentbuffApp = createRuntime());
