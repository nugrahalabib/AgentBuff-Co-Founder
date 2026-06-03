// src/server/services/project-service.ts
// Project lifecycle over the engine + repositories. The clock & id generator are injected so the
// service is deterministic in tests. PRD §8 (guided journey), §11.2.

import type { Repository } from "../domain/repositories";
import type { Project, ProjectState, ResearchReport, BusinessPlan, BusinessDocument, BrandKit } from "../domain/types";

export interface ProjectServiceDeps {
  projects: Repository<Project>;
  research?: Repository<ResearchReport>;
  plans?: Repository<BusinessPlan>;
  brandKits?: Repository<BrandKit>;
  documents?: Repository<BusinessDocument>;
  idGen: () => string;
  now: () => string;
}

export interface CreateProjectInput {
  ownerUserId: string;
  ideaText: string;
  title?: string;
  sector?: string;
  geography?: string;
  stage?: string;
  primaryGoal?: string;
}

/** Derive a short, human title from the first sentence of the idea. */
export function deriveTitle(ideaText: string): string {
  const trimmed = ideaText.trim();
  const firstSentence = (trimmed.split(/[.!?\n]/)[0] ?? trimmed).trim();
  const base = firstSentence.length > 0 ? firstSentence : "Ide bisnis baru";
  return base.length > 60 ? `${base.slice(0, 57)}...` : base;
}

export class ProjectService {
  constructor(private readonly deps: ProjectServiceDeps) {}

  async create(input: CreateProjectInput): Promise<Project> {
    const ts = this.deps.now();
    const project: Project = {
      id: this.deps.idGen(),
      ownerUserId: input.ownerUserId,
      title: input.title ?? deriveTitle(input.ideaText),
      ideaText: input.ideaText,
      sector: input.sector,
      geography: input.geography,
      stage: input.stage,
      primaryGoal: input.primaryGoal,
      status: "draft",
      refs: { documentIds: [] },
      createdAt: ts,
      updatedAt: ts,
    };
    return this.deps.projects.save(project);
  }

  get(id: string): Promise<Project | null> {
    return this.deps.projects.get(id);
  }

  listForUser(userId: string): Promise<Project[]> {
    return this.deps.projects.list((p) => p.ownerUserId === userId);
  }

  /** Composite read for MCP `get_project` / context binding. PRD §11.2. */
  async getState(id: string): Promise<ProjectState | null> {
    const project = await this.deps.projects.get(id);
    if (project === null) return null;
    const state: ProjectState = { project };
    if (project.refs.researchReportId !== undefined && this.deps.research !== undefined) {
      state.research = (await this.deps.research.get(project.refs.researchReportId)) ?? undefined;
    }
    if (project.refs.businessPlanId !== undefined && this.deps.plans !== undefined) {
      state.plan = (await this.deps.plans.get(project.refs.businessPlanId)) ?? undefined;
    }
    if (project.refs.brandKitId !== undefined && this.deps.brandKits !== undefined) {
      state.brandKit = (await this.deps.brandKits.get(project.refs.brandKitId)) ?? undefined;
    }
    if (project.refs.documentIds.length > 0 && this.deps.documents !== undefined) {
      const docs = await Promise.all(project.refs.documentIds.map((d) => this.deps.documents!.get(d)));
      const found = docs.filter((d): d is NonNullable<typeof d> => d !== null);
      if (found.length > 0) state.documents = found;
    }
    return state;
  }

  async attachResearch(projectId: string, reportId: string): Promise<Project> {
    const project = await this.update(projectId, (p) => {
      p.refs.researchReportId = reportId;
      // Don't regress a project that already has a plan/brand/docs back to "planning".
      if (p.status === "draft" || p.status === "researching") p.status = "planning";
    });
    // §9.3.7 staleness propagation: fresh upstream research makes any existing plan downstream-stale.
    await this.markPlanStale(project);
    return project;
  }

  /** Mark the project's business plan as needing a refresh (no silent overwrite). PRD §9.3.7. */
  async markPlanStale(project: Project): Promise<void> {
    if (project.refs.businessPlanId === undefined || this.deps.plans === undefined) return;
    const plan = await this.deps.plans.get(project.refs.businessPlanId);
    if (plan !== null && !plan.stale) {
      plan.stale = true;
      await this.deps.plans.save(plan);
    }
  }

  async attachPlan(projectId: string, planId: string): Promise<Project> {
    return this.update(projectId, (p) => {
      p.refs.businessPlanId = planId;
      if (p.status === "draft" || p.status === "researching" || p.status === "planning") p.status = "branding";
    });
  }

  async attachBrandKit(projectId: string, brandKitId: string): Promise<Project> {
    return this.update(projectId, (p) => {
      p.refs.brandKitId = brandKitId;
      if (p.status === "draft" || p.status === "researching" || p.status === "planning" || p.status === "branding") {
        p.status = "documenting";
      }
    });
  }

  async attachDocument(projectId: string, documentId: string): Promise<Project> {
    return this.update(projectId, (p) => {
      if (!p.refs.documentIds.includes(documentId)) p.refs.documentIds.push(documentId);
      p.status = "complete";
    });
  }

  private async update(id: string, mutate: (p: Project) => void): Promise<Project> {
    const project = await this.deps.projects.get(id);
    if (project === null) throw new Error(`Project tidak ditemukan: ${id}`);
    mutate(project);
    project.updatedAt = this.deps.now();
    return this.deps.projects.save(project);
  }
}
