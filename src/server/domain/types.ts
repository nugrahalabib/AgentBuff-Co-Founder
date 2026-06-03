// src/server/domain/types.ts
// Core domain entities. PRD §11 (data model), §9.2.7 / §9.3.10. Timestamps are ISO strings
// (services inject the clock so logic stays testable).

import type { FinancialInputs, FinancialsResult, ScenarioSummarySet } from "../engine/financial/index";
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

// --- Structured outputs of the multi-stage research pipeline (PRD §9.2.3, §9.2.7). ---
export type TrendDirection = "rising" | "stable" | "declining" | "unknown";

export interface DemandSignal {
  label: string;
  note?: string;
}
export interface ResearchMarket {
  demandSignals: DemandSignal[];
  trendDirection: TrendDirection;
}
export interface Competitor {
  name: string;
  positioning?: string;
  priceRange?: string;
  strengths?: string[];
  weaknesses?: string[];
  sourceUrl?: string;
}
export interface PricingBenchmark {
  min: number;
  median: number;
  max: number;
  currency: string;
}
export interface CostBenchmark {
  item: string;
  estAmount: number;
  sourceUrl?: string;
}
export type RiskCategory = "regulatory" | "market" | "operational" | "financial" | "other";
export interface ResearchRisk {
  category: RiskCategory;
  /** 1..5 */
  severity: number;
  description: string;
  mitigation?: string;
}
export interface ResourceLink {
  label: string;
  url: string;
  type?: string;
}
/** Which research path produced the report. PRD §9.2.5. */
export type ResearchSourcePath = "deep_research_agent" | "custom_pipeline";

export interface ResearchReport {
  id: string;
  projectId: string;
  status: "completed" | "failed";
  /** Deterministic 0..100 (computed in code, never by the LLM). PRD §9.2.4. */
  validationScore: number;
  recommendation: Recommendation;
  /** LLM synthesis explaining the recommendation (cites sources). PRD §9.2.3 stage 6. */
  recommendationReason?: string;
  scoreBreakdown: ScoreBreakdown;
  signals: ValidationSignals;
  summary?: string;
  // Structured stage outputs (§9.2.7). Optional so the legacy single-call path still type-checks.
  sourcePath?: ResearchSourcePath;
  market?: ResearchMarket;
  competitors?: Competitor[];
  pricing?: PricingBenchmark;
  costs?: CostBenchmark[];
  risks?: ResearchRisk[];
  resources?: ResourceLink[];
  /** Clickable sources from grounding (PRD §9.2.1). Empty → claims labelled "estimasi". */
  citations: Citation[];
  sources: SourceRef[];
  isGrounded: boolean;
  /** Number of grounded queries run (budget tracking, §9.2.5). */
  groundingQueryCount?: number;
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
  /** Pessimistic/realistic/optimistic KPI summaries (deterministic). PRD §9.3.9. */
  scenarios?: ScenarioSummarySet;
  /** Narrative sections (LLM-written, numbers injected). */
  narrative?: Record<string, string>;
  stale: boolean;
  generatedAt: string;
}

// --- Deck & Docs (PRD §9.5). Template-Constrained Generation: the LLM fills TEXT slots only; the
//     server renders the HTML and binds every number from the deterministic Financial Engine. ---
export type DocumentType = "proposal" | "pitch_deck";

export interface ProposalSlots {
  tagline: string;
  problem: string;
  solution: string;
  marketAnalysis: string;
  businessModel: string;
  marketingPlan: string;
  team: string;
  financialHighlights: string;
  fundingAsk: string;
  closing: string;
}
export interface DeckSlide {
  title: string;
  bullets: string[];
}
export interface PitchDeckSlots {
  slides: DeckSlide[];
}

/** Numbers bound from the plan's deterministic financials — never authored by the LLM. PRD §9.5.2.1. */
export interface BoundFinancials {
  contributionMarginPerUnit: number;
  grossMarginPct: number;
  bepUnitsPerMonth: number | null;
  startupCapital: number;
  paybackMonths: number | null;
  roiPct: number;
}

export interface BusinessDocument {
  id: string;
  projectId: string;
  type: DocumentType;
  status: "draft" | "complete";
  version: number;
  title: string;
  /** Filled text slots (ProposalSlots for a proposal, PitchDeckSlots for a deck). */
  slots: ProposalSlots | PitchDeckSlots;
  boundFinancials: BoundFinancials;
  /** Carried from research so source chips remain clickable in the doc. */
  sources?: SourceRef[];
  theme?: string;
  stale: boolean;
  generatedAt: string;
}

/** Read-only composite for MCP `get_project` and downstream context binding. PRD §11.2. */
export interface ProjectState {
  project: Project;
  research?: ResearchReport;
  plan?: BusinessPlan;
  documents?: BusinessDocument[];
}

/** Onboarding profile — the "data diri / bisnis" we collect to personalize. PRD §9.1.5, §11. */
export interface OnboardingProfile {
  userId: string;
  sector?: string;
  stage?: string;
  primaryGoal?: string;
  budgetBand?: string;
}

export interface ProfileInput {
  displayName?: string;
  sector?: string;
  stage?: string;
  primaryGoal?: string;
  budgetBand?: string;
}
