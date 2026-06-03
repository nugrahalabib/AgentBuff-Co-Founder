// src/server/db/prisma-repositories.ts
// Prisma-backed implementations of the same Repository / CredentialStore seams the in-memory ones
// implement (PRD §10.1). Domain entities map to relational rows; JSON-flexible structures (financials,
// signals, citations…) are stored as Json (PRD §11.3). Selected when DATABASE_URL is set.

import { Prisma } from "@prisma/client";
import type { Repository } from "@/server/domain/repositories";
import type { BusinessPlan, OnboardingProfile, ProfileInput, Project, ProjectStatus, ResearchReport } from "@/server/domain/types";
import type { CredentialStore, StoredCredential } from "@/lib/ai/credential-store";
import type { Capabilities, CredentialType, ProviderId } from "@/lib/ai/types";
import type { Recommendation, ScoreBreakdown, ValidationSignals } from "@/server/engine/research/index";
import type { FinancialInputs, FinancialsResult } from "@/server/engine/financial/index";
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
      scoreBreakdown: row.scoreBreakdown as unknown as ScoreBreakdown,
      signals: row.signals as unknown as ValidationSignals,
      summary: row.summary ?? undefined,
      citations: (row.citations as unknown as ResearchReport["citations"]) ?? [],
      sources: (row.sources as unknown as ResearchReport["sources"]) ?? [],
      isGrounded: row.isGrounded,
      generatedAt: row.generatedAt.toISOString(),
      version: row.version,
    };
  }
  async save(r: ResearchReport): Promise<ResearchReport> {
    const fields = {
      status: r.status,
      validationScore: r.validationScore,
      recommendation: r.recommendation as Prisma.ResearchReportCreateInput["recommendation"],
      scoreBreakdown: json(r.scoreBreakdown),
      signals: json(r.signals),
      summary: r.summary ?? null,
      citations: json(r.citations),
      sources: json(r.sources),
      isGrounded: r.isGrounded,
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

// ---------- ByokCredential ----------
class PrismaCredentialStore implements CredentialStore {
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
      where: { userId_provider: { userId: c.userId, provider: c.provider as Prisma.ByokCredentialCreateInput["provider"] } },
      create: { user: { connect: { id: c.userId } }, provider: c.provider as Prisma.ByokCredentialCreateInput["provider"], ...fields },
      update: fields,
    });
  }
}

/** Ensure a (guest) User row exists so FK-constrained rows can reference it. */
export async function ensureUser(userId: string): Promise<void> {
  await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, googleSub: `guest:${userId}`, email: `${userId}@guest.local`, displayName: "Tamu" },
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
  credentials: PrismaCredentialStore;
  ensureUser: (userId: string) => Promise<void>;
  saveProfile: (userId: string, input: ProfileInput) => Promise<void>;
  getProfile: (userId: string) => Promise<OnboardingProfile | null>;
}

export function createPrismaPersistence(): PrismaPersistence {
  return {
    projects: new PrismaProjectRepository(),
    reports: new PrismaResearchRepository(),
    plans: new PrismaPlanRepository(),
    credentials: new PrismaCredentialStore(),
    ensureUser,
    saveProfile: savePrismaProfile,
    getProfile: getPrismaProfile,
  };
}
