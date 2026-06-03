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
import type { BrandKit, BusinessDocument, BusinessPlan, OnboardingProfile, ProfileInput, Project, ResearchReport } from "@/server/domain/types";
import { ProjectService } from "@/server/services/project-service";
import { ResearchService } from "@/server/services/research-service";
import { PlannerService } from "@/server/services/planner-service";
import { BrandService } from "@/server/services/brand-service";
import { DocsService } from "@/server/services/docs-service";
import { CredentialService } from "@/server/services/credential-service";
import { buildToolRegistry } from "@/server/mcp/build-registry";
import type { McpToolRegistry } from "@/server/mcp/registry";
import {
  InMemoryMcpAuditStore,
  InMemoryMcpClientStore,
  type McpAuditStore,
  type McpClientStore,
} from "@/server/mcp/client-store";
import { McpGatewayService } from "@/server/mcp/gateway-service";
import { createPrismaPersistence } from "@/server/db/prisma-repositories";
import { byokMasterKeyBase64 } from "@/server/env";

export interface AppRuntime {
  master: LocalMasterKey;
  credentials: UpsertableCredentialStore;
  registry: DefaultProviderRegistry;
  credentialService: CredentialService;
  projects: ProjectService;
  research: ResearchService;
  planner: PlannerService;
  brand: BrandService;
  docs: DocsService;
  mcp: McpToolRegistry;
  mcpGateway: McpGatewayService;
  repos: {
    projects: Repository<Project>;
    reports: Repository<ResearchReport>;
    plans: Repository<BusinessPlan>;
    brandKits: Repository<BrandKit>;
    documents: Repository<BusinessDocument>;
  };
  /** Ensure the (guest) User row exists before creating FK-constrained rows. No-op in memory mode. */
  ensureUser: (userId: string) => Promise<void>;
  saveProfile: (userId: string, input: ProfileInput) => Promise<void>;
  getProfile: (userId: string) => Promise<OnboardingProfile | null>;
  persistence: "postgres" | "memory";
}

function createRuntime(): AppRuntime {
  const masterB64 = byokMasterKeyBase64(); // throws in prod if unset
  const master = masterB64 !== null ? LocalMasterKey.fromBase64(masterB64) : LocalMasterKey.generate();

  const usePostgres = typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;

  let credentials: UpsertableCredentialStore;
  let projectsRepo: Repository<Project>;
  let reportsRepo: Repository<ResearchReport>;
  let plansRepo: Repository<BusinessPlan>;
  let brandKitsRepo: Repository<BrandKit>;
  let documentsRepo: Repository<BusinessDocument>;
  let mcpClients: McpClientStore;
  let mcpAudit: McpAuditStore;
  let ensureUser: (userId: string) => Promise<void>;
  let saveProfile: (userId: string, input: ProfileInput) => Promise<void>;
  let getProfile: (userId: string) => Promise<OnboardingProfile | null>;

  if (usePostgres) {
    const p = createPrismaPersistence();
    credentials = p.credentials;
    projectsRepo = p.projects;
    reportsRepo = p.reports;
    plansRepo = p.plans;
    brandKitsRepo = p.brandKits;
    documentsRepo = p.documents;
    mcpClients = p.mcpClients;
    mcpAudit = p.mcpAudit;
    ensureUser = p.ensureUser;
    saveProfile = p.saveProfile;
    getProfile = p.getProfile;
  } else {
    credentials = new InMemoryCredentialStore();
    projectsRepo = new InMemoryRepository<Project>();
    reportsRepo = new InMemoryRepository<ResearchReport>();
    plansRepo = new InMemoryRepository<BusinessPlan>();
    brandKitsRepo = new InMemoryRepository<BrandKit>();
    documentsRepo = new InMemoryRepository<BusinessDocument>();
    mcpClients = new InMemoryMcpClientStore();
    mcpAudit = new InMemoryMcpAuditStore();
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

  // Hoist services so the MCP gateway shares the SAME instances as the web adapters (headless == UI).
  const projects = new ProjectService({ projects: projectsRepo, research: reportsRepo, plans: plansRepo, brandKits: brandKitsRepo, documents: documentsRepo, idGen, now });
  const research = new ResearchService({ reports: reportsRepo, registry, idGen, now });
  const planner = new PlannerService({ plans: plansRepo, registry, idGen, now });
  const brand = new BrandService({ brandKits: brandKitsRepo, registry, idGen, now });
  const docs = new DocsService({ documents: documentsRepo, registry, idGen, now });
  const mcpGateway = new McpGatewayService(mcpClients, { projects, research, planner, brand, docs }, idGen, now, mcpAudit);

  return {
    master,
    credentials,
    registry,
    credentialService: new CredentialService(credentials, master),
    projects,
    research,
    planner,
    brand,
    docs,
    mcp: buildToolRegistry(),
    mcpGateway,
    repos: { projects: projectsRepo, reports: reportsRepo, plans: plansRepo, brandKits: brandKitsRepo, documents: documentsRepo },
    ensureUser,
    saveProfile,
    getProfile,
    persistence: usePostgres ? "postgres" : "memory",
  };
}

const g = globalThis as unknown as { __agentbuffApp?: AppRuntime };
export const app: AppRuntime = g.__agentbuffApp ?? (g.__agentbuffApp = createRuntime());
