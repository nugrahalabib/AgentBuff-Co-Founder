// src/server/runtime.ts
// App runtime container. Auto-selects persistence:
//   • DATABASE_URL set  → Prisma-backed repos + credential store (Postgres).
//   • otherwise         → in-memory (zero-setup; data resets on restart).
// Either way the services/registry are identical. Cached on globalThis for dev hot-reload. PRD §10.1.

import { randomUUID } from "node:crypto";
import { LocalMasterKey } from "@/lib/crypto";
import { InMemoryCredentialStore, type UpsertableCredentialStore } from "@/lib/ai/credential-store";
import { DefaultProviderRegistry } from "@/lib/ai/registry";
import type { ProviderRegistry } from "@/lib/ai/llm-provider";
import { RecordingProviderRegistry } from "@/server/ai/recording-registry";
import { InMemoryUsageRecorder, type UsageRecorder } from "@/server/services/usage-recorder";
import { InMemoryRepository, type Repository } from "@/server/domain/repositories";
import type { BrandKit, BusinessDocument, BusinessPlan, OnboardingProfile, ProfileInput, Project, ResearchReport } from "@/server/domain/types";
import { ProjectService } from "@/server/services/project-service";
import { ResearchService } from "@/server/services/research-service";
import { PlannerService } from "@/server/services/planner-service";
import { BrandService } from "@/server/services/brand-service";
import { DocsService } from "@/server/services/docs-service";
import { CredentialService } from "@/server/services/credential-service";
import { AccountService } from "@/server/services/account-service";
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
  registry: ProviderRegistry;
  usage: UsageRecorder;
  credentialService: CredentialService;
  projects: ProjectService;
  research: ResearchService;
  planner: PlannerService;
  brand: BrandService;
  docs: DocsService;
  account: AccountService;
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
  let usage: UsageRecorder;
  let mcpClients: McpClientStore;
  let mcpAudit: McpAuditStore;
  let ensureUser: (userId: string) => Promise<void>;
  let saveProfile: (userId: string, input: ProfileInput) => Promise<void>;
  let getProfile: (userId: string) => Promise<OnboardingProfile | null>;
  let deleteUser: (userId: string) => Promise<void>;

  if (usePostgres) {
    const p = createPrismaPersistence();
    credentials = p.credentials;
    projectsRepo = p.projects;
    reportsRepo = p.reports;
    plansRepo = p.plans;
    brandKitsRepo = p.brandKits;
    documentsRepo = p.documents;
    usage = p.usage;
    mcpClients = p.mcpClients;
    mcpAudit = p.mcpAudit;
    ensureUser = p.ensureUser;
    saveProfile = p.saveProfile;
    getProfile = p.getProfile;
    deleteUser = p.deleteUser; // Postgres cascade from the User row
  } else {
    const memCredentials = new InMemoryCredentialStore();
    const memProjects = new InMemoryRepository<Project>();
    const memReports = new InMemoryRepository<ResearchReport>();
    const memPlans = new InMemoryRepository<BusinessPlan>();
    const memBrand = new InMemoryRepository<BrandKit>();
    const memDocs = new InMemoryRepository<BusinessDocument>();
    const memUsage = new InMemoryUsageRecorder();
    const memMcp = new InMemoryMcpClientStore();
    credentials = memCredentials;
    projectsRepo = memProjects;
    reportsRepo = memReports;
    plansRepo = memPlans;
    brandKitsRepo = memBrand;
    documentsRepo = memDocs;
    usage = memUsage;
    mcpClients = memMcp;
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
    deleteUser = async (userId) => {
      const owned = await memProjects.list((p) => p.ownerUserId === userId);
      const pids = new Set(owned.map((p) => p.id));
      await memProjects.deleteWhere((p) => p.ownerUserId === userId);
      await memReports.deleteWhere((r) => pids.has(r.projectId));
      await memPlans.deleteWhere((p) => pids.has(p.projectId));
      await memBrand.deleteWhere((b) => pids.has(b.projectId));
      await memDocs.deleteWhere((d) => pids.has(d.projectId));
      memCredentials.clearUser(userId);
      memMcp.clearUser(userId);
      memUsage.clearUser(userId);
      profiles.delete(userId);
    };
  }

  const idGen = (): string => randomUUID();
  const now = (): string => new Date().toISOString();
  // Records BYOK usage on every LLM call (UI + MCP) via a single registry decorator. PRD §16.
  const registry = new RecordingProviderRegistry(new DefaultProviderRegistry(credentials, master), usage, now);

  // Hoist services so the MCP gateway shares the SAME instances as the web adapters (headless == UI).
  const projects = new ProjectService({ projects: projectsRepo, research: reportsRepo, plans: plansRepo, brandKits: brandKitsRepo, documents: documentsRepo, idGen, now });
  const research = new ResearchService({ reports: reportsRepo, registry, idGen, now });
  const planner = new PlannerService({ plans: plansRepo, registry, idGen, now });
  const brand = new BrandService({ brandKits: brandKitsRepo, registry, idGen, now });
  const docs = new DocsService({ documents: documentsRepo, registry, idGen, now });
  const mcpGateway = new McpGatewayService(mcpClients, { projects, research, planner, brand, docs }, idGen, now, mcpAudit);
  const credentialService = new CredentialService(credentials, master);
  const account = new AccountService({
    getProfile,
    credentialSummary: (userId) => credentialService.summary(userId),
    listMcpClients: (userId) => mcpGateway.listClients(userId),
    usageSummary: (userId) => usage.summary(userId),
    listProjects: (userId) => projects.listForUser(userId),
    getState: (projectId) => projects.getState(projectId),
    deleteUser,
    now,
  });

  return {
    master,
    credentials,
    registry,
    usage,
    credentialService,
    projects,
    research,
    planner,
    brand,
    docs,
    account,
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
