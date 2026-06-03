// src/server/db/prisma-repositories.ts
// Prisma-backed implementations of the same Repository / CredentialStore seams the in-memory ones
// implement (PRD §10.1). Domain entities map to relational rows; JSON-flexible structures (financials,
// signals, citations…) are stored as Json (PRD §11.3). Selected when DATABASE_URL is set.

import { Prisma } from "@prisma/client";
import type { Repository } from "@/server/domain/repositories";
import type {
  BoundFinancials,
  BrandAsset,
  BrandKit,
  BrandStrategy,
  BrandVisualTokens,
  BrandVoice,
  BusinessDocument,
  BusinessPlan,
  NamingOption,
  OnboardingProfile,
  PitchDeckSlots,
  ProfileInput,
  Project,
  ProjectStatus,
  ProposalSlots,
  ResearchReport,
  SourceRef,
} from "@/server/domain/types";
import type { CredentialMetaPatch, StoredCredential, UpsertableCredentialStore } from "@/lib/ai/credential-store";
import type {
  McpAuditEntry,
  McpAuditStore,
  McpClientRecord,
  McpClientStore,
  McpClientView,
} from "@/server/mcp/client-store";
import type { Capabilities, CredentialType, ProviderId } from "@/lib/ai/types";
import type { Recommendation, ScoreBreakdown, ValidationSignals } from "@/server/engine/research/index";
import type { FinancialInputs, FinancialsResult } from "@/server/engine/financial/index";
import type { UsageEntry, UsageRecorder, UsageSummary } from "@/server/services/usage-recorder";
import { summarize } from "@/server/services/usage-recorder";
import { providerOfModel } from "@/lib/ai/model-routing";
import { prisma } from "./prisma";

const json = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

// ---------- Project ----------
type ProjectRow = Prisma.ProjectGetPayload<{ include: { research: true; plan: true; brandKit: true; documents: true } }>;

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    title: row.title,
    ideaText: row.ideaText,
    sector: row.sector ?? undefined,
    geography: row.geography ?? undefined,
    stage: row.stage ?? undefined,
    primaryGoal: row.primaryGoal ?? undefined,
    status: row.status as ProjectStatus,
    refs: {
      researchReportId: row.research?.id,
      businessPlanId: row.plan?.id,
      brandKitId: row.brandKit?.id,
      documentIds: row.documents.map((d) => d.id),
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const PROJECT_INCLUDE = { research: true, plan: true, brandKit: true, documents: true } as const;

class PrismaProjectRepository implements Repository<Project> {
  async get(id: string): Promise<Project | null> {
    const row = await prisma.project.findUnique({ where: { id }, include: PROJECT_INCLUDE });
    return row === null ? null : toProject(row);
  }
  async save(p: Project): Promise<Project> {
    const data = {
      ownerUserId: p.ownerUserId,
      title: p.title,
      ideaText: p.ideaText,
      sector: p.sector ?? null,
      geography: p.geography ?? null,
      stage: p.stage ?? null,
      primaryGoal: p.primaryGoal ?? null,
      status: p.status as Prisma.ProjectCreateInput["status"],
    };
    await prisma.project.upsert({
      where: { id: p.id },
      create: { id: p.id, createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt), ...data },
      update: { updatedAt: new Date(p.updatedAt), ...data },
    });
    return p;
  }
  async list(filter?: (p: Project) => boolean): Promise<Project[]> {
    // Generic predicate → fetch then filter in JS. Fine at current scale; add scoped queries later.
    const rows = await prisma.project.findMany({ include: PROJECT_INCLUDE, orderBy: { createdAt: "desc" } });
    const all = rows.map(toProject);
    return filter === undefined ? all : all.filter(filter);
  }
}

// ---------- ResearchReport (one per project; projectId is unique) ----------
class PrismaResearchRepository implements Repository<ResearchReport> {
  async get(id: string): Promise<ResearchReport | null> {
    const row = await prisma.researchReport.findUnique({ where: { id } });
    if (row === null) return null;
    return {
      id: row.id,
      projectId: row.projectId,
      status: row.status as ResearchReport["status"],
      validationScore: row.validationScore,
      recommendation: row.recommendation as Recommendation,
      recommendationReason: row.recommendationReason ?? undefined,
      scoreBreakdown: row.scoreBreakdown as unknown as ScoreBreakdown,
      signals: row.signals as unknown as ValidationSignals,
      summary: row.summary ?? undefined,
      sourcePath: (row.sourcePath as ResearchReport["sourcePath"]) ?? undefined,
      market: (row.market as unknown as ResearchReport["market"]) ?? undefined,
      competitors: (row.competitors as unknown as ResearchReport["competitors"]) ?? undefined,
      pricing: (row.pricing as unknown as ResearchReport["pricing"]) ?? undefined,
      costs: (row.costs as unknown as ResearchReport["costs"]) ?? undefined,
      risks: (row.risks as unknown as ResearchReport["risks"]) ?? undefined,
      resources: (row.resources as unknown as ResearchReport["resources"]) ?? undefined,
      citations: (row.citations as unknown as ResearchReport["citations"]) ?? [],
      sources: (row.sources as unknown as ResearchReport["sources"]) ?? [],
      isGrounded: row.isGrounded,
      groundingQueryCount: row.groundingQueryCount,
      generatedAt: row.generatedAt.toISOString(),
      version: row.version,
    };
  }
  async save(r: ResearchReport): Promise<ResearchReport> {
    const fields = {
      status: r.status,
      validationScore: r.validationScore,
      recommendation: r.recommendation as Prisma.ResearchReportCreateInput["recommendation"],
      recommendationReason: r.recommendationReason ?? null,
      scoreBreakdown: json(r.scoreBreakdown),
      signals: json(r.signals),
      summary: r.summary ?? null,
      sourcePath: r.sourcePath ?? null,
      market: r.market === undefined ? Prisma.JsonNull : json(r.market),
      competitors: r.competitors === undefined ? Prisma.JsonNull : json(r.competitors),
      pricing: r.pricing === undefined ? Prisma.JsonNull : json(r.pricing),
      costs: r.costs === undefined ? Prisma.JsonNull : json(r.costs),
      risks: r.risks === undefined ? Prisma.JsonNull : json(r.risks),
      resources: r.resources === undefined ? Prisma.JsonNull : json(r.resources),
      citations: json(r.citations),
      sources: json(r.sources),
      isGrounded: r.isGrounded,
      groundingQueryCount: r.groundingQueryCount ?? 0,
      version: r.version,
      generatedAt: new Date(r.generatedAt),
    };
    await prisma.researchReport.upsert({
      where: { projectId: r.projectId },
      create: { id: r.id, project: { connect: { id: r.projectId } }, ...fields },
      update: fields,
    });
    return r;
  }
  async list(): Promise<ResearchReport[]> {
    return [];
  }
}

// ---------- BusinessPlan (one per project) ----------
class PrismaPlanRepository implements Repository<BusinessPlan> {
  async get(id: string): Promise<BusinessPlan | null> {
    const row = await prisma.businessPlan.findUnique({ where: { id } });
    if (row === null) return null;
    return {
      id: row.id,
      projectId: row.projectId,
      status: row.status as BusinessPlan["status"],
      version: row.version,
      inputs: row.inputs as unknown as FinancialInputs,
      financials: row.financials as unknown as FinancialsResult,
      scenarios: (row.scenarios as unknown as BusinessPlan["scenarios"]) ?? undefined,
      narrative: (row.narrative as unknown as Record<string, string> | null) ?? undefined,
      stale: row.stale,
      generatedAt: row.generatedAt.toISOString(),
    };
  }
  async save(p: BusinessPlan): Promise<BusinessPlan> {
    const fields = {
      status: p.status,
      version: p.version,
      inputs: json(p.inputs),
      financials: json(p.financials),
      scenarios: p.scenarios === undefined ? Prisma.JsonNull : json(p.scenarios),
      narrative: p.narrative === undefined ? Prisma.JsonNull : json(p.narrative),
      stale: p.stale,
      generatedAt: new Date(p.generatedAt),
    };
    await prisma.businessPlan.upsert({
      where: { projectId: p.projectId },
      create: { id: p.id, project: { connect: { id: p.projectId } }, ...fields },
      update: fields,
    });
    return p;
  }
  async list(): Promise<BusinessPlan[]> {
    return [];
  }
}

// ---------- BrandKit (one per project) ----------
class PrismaBrandKitRepository implements Repository<BrandKit> {
  async get(id: string): Promise<BrandKit | null> {
    const row = await prisma.brandKit.findUnique({ where: { id } });
    if (row === null) return null;
    const naming = (row.naming as unknown as NamingOption[]) ?? [];
    return {
      id: row.id,
      projectId: row.projectId,
      status: row.status as BrandKit["status"],
      version: row.version,
      strategy: (row.strategy as unknown as BrandStrategy) ?? { essence: "", positioning: "", personality: [], pillars: [] },
      selectedName: row.selectedName ?? "",
      naming,
      voice: (row.voice as unknown as BrandVoice) ?? { attributes: [], taglines: [], samples: [], dos: [], donts: [] },
      visualTokens: row.visualTokens as unknown as BrandVisualTokens,
      assets: (row.assets as unknown as BrandAsset[]) ?? [],
      stale: row.stale,
      generatedAt: row.generatedAt.toISOString(),
    };
  }
  async save(k: BrandKit): Promise<BrandKit> {
    const fields = {
      status: k.status,
      version: k.version,
      selectedName: k.selectedName,
      strategy: json(k.strategy),
      naming: json(k.naming),
      voice: json(k.voice),
      visualTokens: json(k.visualTokens),
      assets: json(k.assets),
      stale: k.stale,
      generatedAt: new Date(k.generatedAt),
    };
    await prisma.brandKit.upsert({
      where: { projectId: k.projectId },
      create: { id: k.id, project: { connect: { id: k.projectId } }, ...fields },
      update: fields,
    });
    return k;
  }
  async list(): Promise<BrandKit[]> {
    return [];
  }
}

// ---------- Document (many per project) ----------
interface DocContent {
  title: string;
  slots: ProposalSlots | PitchDeckSlots;
  boundFinancials: BoundFinancials;
  sources?: SourceRef[];
}
class PrismaDocumentRepository implements Repository<BusinessDocument> {
  async get(id: string): Promise<BusinessDocument | null> {
    const row = await prisma.document.findUnique({ where: { id } });
    if (row === null) return null;
    const c = row.contentJson as unknown as DocContent;
    return {
      id: row.id,
      projectId: row.projectId,
      type: row.type as BusinessDocument["type"],
      status: (row.renderStatus as BusinessDocument["status"]) ?? "complete",
      version: row.version,
      title: c.title,
      slots: c.slots,
      boundFinancials: c.boundFinancials,
      sources: c.sources,
      theme: row.theme ?? undefined,
      stale: row.stale,
      generatedAt: row.generatedAt.toISOString(),
    };
  }
  async save(d: BusinessDocument): Promise<BusinessDocument> {
    const content: DocContent = { title: d.title, slots: d.slots, boundFinancials: d.boundFinancials, sources: d.sources };
    const fields = {
      type: d.type as Prisma.DocumentCreateInput["type"],
      theme: d.theme ?? null,
      contentJson: json(content),
      renderStatus: d.status,
      stale: d.stale,
      version: d.version,
      generatedAt: new Date(d.generatedAt),
    };
    await prisma.document.upsert({
      where: { id: d.id },
      create: { id: d.id, project: { connect: { id: d.projectId } }, ...fields },
      update: fields,
    });
    return d;
  }
  async list(filter?: (d: BusinessDocument) => boolean): Promise<BusinessDocument[]> {
    const rows = await prisma.document.findMany({ orderBy: { generatedAt: "desc" } });
    const all = await Promise.all(rows.map((r) => this.get(r.id)));
    const docs = all.filter((d): d is BusinessDocument => d !== null);
    return filter === undefined ? docs : docs.filter(filter);
  }
}

// ---------- ByokCredential ----------
const asProvider = (p: ProviderId): Prisma.ByokCredentialCreateInput["provider"] =>
  p as Prisma.ByokCredentialCreateInput["provider"];

class PrismaCredentialStore implements UpsertableCredentialStore {
  async listForUser(userId: string): Promise<StoredCredential[]> {
    const rows = await prisma.byokCredential.findMany({ where: { userId } });
    return rows.map((r) => ({
      userId: r.userId,
      provider: r.provider as ProviderId,
      credType: r.credType as CredentialType,
      ciphertext: r.ciphertext,
      fingerprint: r.fingerprint,
      capabilities: r.capabilities as unknown as Capabilities,
      isDefault: r.isDefault,
      status: r.status as StoredCredential["status"],
    }));
  }
  async upsert(c: StoredCredential): Promise<void> {
    const fields = {
      credType: c.credType as Prisma.ByokCredentialCreateInput["credType"],
      ciphertext: c.ciphertext,
      fingerprint: c.fingerprint,
      capabilities: json(c.capabilities),
      isDefault: c.isDefault,
      status: c.status as Prisma.ByokCredentialCreateInput["status"],
      lastValidatedAt: new Date(),
    };
    await prisma.byokCredential.upsert({
      where: { userId_provider: { userId: c.userId, provider: asProvider(c.provider) } },
      create: { user: { connect: { id: c.userId } }, provider: asProvider(c.provider), ...fields },
      update: fields,
    });
    // A newly-defaulted credential demotes the others (one default per user).
    if (c.isDefault) {
      await prisma.byokCredential.updateMany({
        where: { userId: c.userId, provider: { not: asProvider(c.provider) } },
        data: { isDefault: false },
      });
    }
  }
  async remove(userId: string, provider: ProviderId): Promise<boolean> {
    const res = await prisma.byokCredential.deleteMany({ where: { userId, provider: asProvider(provider) } });
    return res.count > 0;
  }
  async setDefault(userId: string, provider: ProviderId): Promise<boolean> {
    const target = await prisma.byokCredential.findUnique({
      where: { userId_provider: { userId, provider: asProvider(provider) } },
    });
    if (target === null) return false;
    await prisma.$transaction([
      prisma.byokCredential.updateMany({ where: { userId }, data: { isDefault: false } }),
      prisma.byokCredential.update({
        where: { userId_provider: { userId, provider: asProvider(provider) } },
        data: { isDefault: true },
      }),
    ]);
    return true;
  }
  async patchMeta(userId: string, provider: ProviderId, patch: CredentialMetaPatch): Promise<boolean> {
    const data: Prisma.ByokCredentialUpdateManyMutationInput = { lastValidatedAt: new Date() };
    if (patch.status !== undefined) data.status = patch.status as Prisma.ByokCredentialCreateInput["status"];
    if (patch.capabilities !== undefined) data.capabilities = json(patch.capabilities);
    const res = await prisma.byokCredential.updateMany({ where: { userId, provider: asProvider(provider) }, data });
    return res.count > 0;
  }
}

// ---------- MCP client tokens + audit log ----------
class PrismaMcpClientStore implements McpClientStore {
  async create(rec: McpClientRecord): Promise<void> {
    await prisma.mcpClient.create({
      data: {
        id: rec.id,
        name: rec.name,
        owner: { connect: { id: rec.ownerUserId } },
        oauthClientId: rec.id, // PAT mode: reuse the row id as the (unique) client id
        scopes: ["tools"],
        tokenHash: rec.tokenHash,
        tokenPrefix: rec.tokenPrefix,
        status: rec.status,
        createdAt: new Date(rec.createdAt),
      },
    });
  }
  async findActiveByTokenHash(hash: string): Promise<McpClientRecord | null> {
    const r = await prisma.mcpClient.findFirst({ where: { tokenHash: hash, status: "active" } });
    if (r === null || r.tokenHash === null || r.tokenPrefix === null) return null;
    return {
      id: r.id,
      ownerUserId: r.ownerUserId,
      name: r.name,
      tokenHash: r.tokenHash,
      tokenPrefix: r.tokenPrefix,
      status: r.status as McpClientRecord["status"],
      createdAt: r.createdAt.toISOString(),
      lastUsedAt: r.lastUsedAt?.toISOString(),
    };
  }
  async listForUser(userId: string): Promise<McpClientView[]> {
    const rows = await prisma.mcpClient.findMany({ where: { ownerUserId: userId }, orderBy: { createdAt: "desc" } });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      tokenPrefix: r.tokenPrefix ?? "—",
      status: r.status as McpClientView["status"],
      createdAt: r.createdAt.toISOString(),
      lastUsedAt: r.lastUsedAt?.toISOString(),
    }));
  }
  async revoke(userId: string, clientId: string): Promise<boolean> {
    const res = await prisma.mcpClient.updateMany({
      where: { id: clientId, ownerUserId: userId, status: "active" },
      data: { status: "revoked" },
    });
    return res.count > 0;
  }
  async touch(clientId: string, atIso: string): Promise<void> {
    await prisma.mcpClient.update({ where: { id: clientId }, data: { lastUsedAt: new Date(atIso) } }).catch(() => undefined);
  }
}

class PrismaMcpAuditStore implements McpAuditStore {
  async record(entry: McpAuditEntry): Promise<void> {
    await prisma.mcpAuditLog
      .create({
        data: {
          client: { connect: { id: entry.clientId } },
          userId: entry.userId,
          tool: entry.tool,
          argsHash: entry.argsHash ?? null,
          resultStatus: entry.resultStatus,
          ts: new Date(entry.ts),
        },
      })
      .catch(() => undefined); // audit must never break a tool call
  }
  async listForUser(userId: string, limit = 50): Promise<McpAuditEntry[]> {
    const rows = await prisma.mcpAuditLog.findMany({ where: { userId }, orderBy: { ts: "desc" }, take: limit });
    return rows.map((r) => ({
      clientId: r.clientId,
      userId: r.userId,
      tool: r.tool,
      argsHash: r.argsHash ?? undefined,
      resultStatus: r.resultStatus as McpAuditEntry["resultStatus"],
      ts: r.ts.toISOString(),
    }));
  }
}

// ---------- UsageEvent (BYOK usage tracking) ----------
class PrismaUsageRecorder implements UsageRecorder {
  async record(e: UsageEntry): Promise<void> {
    await prisma.usageEvent
      .create({
        data: {
          user: { connect: { id: e.userId } },
          source: e.source ?? "ui",
          operation: e.operation,
          modelUsed: e.model ?? null,
          groundedQueries: e.groundedQueries ?? null,
          imagesGenerated: e.imagesGenerated ?? null,
          ts: new Date(e.ts),
        },
      })
      .catch(() => undefined); // usage logging must never break an LLM call
  }
  async summary(userId: string, limit = 20): Promise<UsageSummary> {
    const rows = await prisma.usageEvent.findMany({ where: { userId }, orderBy: { ts: "asc" }, take: 500 });
    const entries: UsageEntry[] = rows.map((r) => ({
      userId: r.userId,
      operation: r.operation as UsageEntry["operation"],
      provider: providerOfModel(r.modelUsed ?? undefined) as UsageEntry["provider"],
      model: r.modelUsed ?? undefined,
      groundedQueries: r.groundedQueries ?? undefined,
      imagesGenerated: r.imagesGenerated ?? undefined,
      source: (r.source as UsageEntry["source"]) ?? undefined,
      ts: r.ts.toISOString(),
    }));
    return summarize(entries, limit);
  }
}

/**
 * Ensure a User row exists so FK-constrained rows can reference it.
 * Google users are normally created earlier by the sign-in event (persistGoogleUser); this is a
 * fallback that still records a real googleSub for `google:<sub>` ids and a guest placeholder otherwise.
 */
export async function ensureUser(userId: string): Promise<void> {
  const isGoogle = userId.startsWith("google:");
  const googleSub = isGoogle ? userId.slice("google:".length) : `guest:${userId}`;
  const email = isGoogle ? `${userId}@google.local` : `${userId}@guest.local`;
  const displayName = isGoogle ? "Pengguna" : "Tamu";
  await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, googleSub, email, displayName },
    update: {},
  });
}

export async function savePrismaProfile(userId: string, input: ProfileInput): Promise<void> {
  const fields = {
    sector: input.sector ?? null,
    stage: input.stage ?? null,
    primaryGoal: input.primaryGoal ?? null,
    budgetBand: input.budgetBand ?? null,
  };
  await prisma.onboardingProfile.upsert({ where: { userId }, create: { userId, ...fields }, update: fields });
  if (input.displayName !== undefined && input.displayName !== "") {
    await prisma.user.update({ where: { id: userId }, data: { displayName: input.displayName } }).catch(() => undefined);
  }
}

export async function getPrismaProfile(userId: string): Promise<OnboardingProfile | null> {
  const row = await prisma.onboardingProfile.findUnique({ where: { userId } });
  return row === null
    ? null
    : {
        userId: row.userId,
        sector: row.sector ?? undefined,
        stage: row.stage ?? undefined,
        primaryGoal: row.primaryGoal ?? undefined,
        budgetBand: row.budgetBand ?? undefined,
      };
}

export interface PrismaPersistence {
  projects: PrismaProjectRepository;
  reports: PrismaResearchRepository;
  plans: PrismaPlanRepository;
  brandKits: PrismaBrandKitRepository;
  documents: PrismaDocumentRepository;
  credentials: PrismaCredentialStore;
  mcpClients: PrismaMcpClientStore;
  mcpAudit: PrismaMcpAuditStore;
  usage: PrismaUsageRecorder;
  ensureUser: (userId: string) => Promise<void>;
  saveProfile: (userId: string, input: ProfileInput) => Promise<void>;
  getProfile: (userId: string) => Promise<OnboardingProfile | null>;
}

export function createPrismaPersistence(): PrismaPersistence {
  return {
    projects: new PrismaProjectRepository(),
    reports: new PrismaResearchRepository(),
    plans: new PrismaPlanRepository(),
    brandKits: new PrismaBrandKitRepository(),
    documents: new PrismaDocumentRepository(),
    credentials: new PrismaCredentialStore(),
    mcpClients: new PrismaMcpClientStore(),
    mcpAudit: new PrismaMcpAuditStore(),
    usage: new PrismaUsageRecorder(),
    ensureUser,
    saveProfile: savePrismaProfile,
    getProfile: getPrismaProfile,
  };
}
