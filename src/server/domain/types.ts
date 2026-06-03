// src/server/domain/types.ts
// Core domain entities. PRD §11 (data model), §9.2.7 / §9.3.10. Timestamps are ISO strings
// (services inject the clock so logic stays testable).

import type { FinancialInputs, FinancialsResult } from "../engine/financial/index";
import type { Recommendation, ScoreBreakdown, ValidationSignals } from "../engine/research/index";
import type { Citation } from "../../lib/ai/types";

export type ProjectStatus =
  | "draft"
  | "researching"
  | "planning"
  | "branding"
  | "documenting"
  | "complete";

export interface ProjectRefs {
  researchReportId?: string;
  businessPlanId?: string;
  brandKitId?: string;
  documentIds: string[];
}

export interface Project {
  id: string;
  ownerUserId: string;
  title: string;
  ideaText: string;
  sector?: string;
  geography?: string;
  stage?: string;
  primaryGoal?: string;
  status: ProjectStatus;
  refs: ProjectRefs;
  createdAt: string;
  updatedAt: string;
}

export interface SourceRef {
  url: string;
  title?: string;
}

export interface ResearchReport {
  id: string;
  projectId: string;
  status: "completed" | "failed";
  /** Deterministic 0..100 (computed in code, never by the LLM). PRD §9.2.4. */
  validationScore: number;
  recommendation: Recommendation;
  scoreBreakdown: ScoreBreakdown;
  signals: ValidationSignals;
  summary?: string;
  /** Clickable sources from grounding (PRD §9.2.1). Empty → claims labelled "estimasi". */
  citations: Citation[];
  sources: SourceRef[];
  isGrounded: boolean;
  generatedAt: string;
  version: number;
}

export interface BusinessPlan {
  id: string;
  projectId: string;
  status: "draft" | "complete";
  version: number;
  inputs: FinancialInputs;
  /** Numbers from the deterministic engine — never authored by the LLM. PRD §9.3.2. */
  financials: FinancialsResult;
  /** Narrative sections (LLM-written, numbers injected). */
  narrative?: Record<string, string>;
  stale: boolean;
  generatedAt: string;
}

/** Read-only composite for MCP `get_project` and downstream context binding. PRD §11.2. */
export interface ProjectState {
  project: Project;
  research?: ResearchReport;
  plan?: BusinessPlan;
}
