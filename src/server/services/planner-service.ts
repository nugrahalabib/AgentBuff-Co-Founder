// src/server/services/planner-service.ts
// Master Business Planner orchestration. PRD §9.3. "LLM Proposes, Code Disposes": the deterministic
// engine computes ALL numbers first; the LLM then narrates the plan with those numbers injected and is
// explicitly forbidden from recomputing them (PRD §9.3.2, §9.3.6, §20.2 P-PLAN-NARRATE-01).

import type { Repository } from "../domain/repositories";
import type { BusinessPlan } from "../domain/types";
import {
  computeFinancials,
  computeScenarioSummaries,
  type FinancialInputs,
  type FinancialsResult,
} from "../engine/financial/index";
import type { ProviderRegistry } from "../../lib/ai/llm-provider";

export interface PlannerServiceDeps {
  plans: Repository<BusinessPlan>;
  registry: ProviderRegistry;
  idGen: () => string;
  now: () => string;
}

export interface GeneratePlanInput {
  projectId: string;
  inputs: FinancialInputs;
  researchSummary?: string;
}

/** Financial figures extracted from an uploaded document to pre-fill the intake wizard. PRD §9.3.4.1. */
export interface ImportedIntake {
  price?: number;
  unitCost?: number;
  fixedMonthly?: number;
  capex?: number;
  workingCapital?: number;
  volume?: number;
}

/** Schema the doc-understanding model fills from a price list / invoice / financial note. §9.3.4.1. */
export const INTAKE_IMPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    price: { type: "number", description: "harga jual per unit (IDR)" },
    unitCost: { type: "number", description: "biaya variabel/HPP per unit (IDR)" },
    fixedMonthly: { type: "number", description: "total biaya tetap per bulan (IDR)" },
    capex: { type: "number", description: "modal awal/peralatan (IDR)" },
    workingCapital: { type: "number", description: "modal kerja (IDR)" },
    volume: { type: "number", description: "perkiraan volume penjualan per bulan (unit)" },
  },
} as const;

/** Narrative sections only — never numbers. PRD §9.3.6. */
export const PLAN_NARRATIVE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["execSummary", "businessDesc", "marketAnalysis", "marketingStrategy", "operations", "roadmap", "risks", "closing"],
  properties: {
    execSummary: { type: "string" },
    businessDesc: { type: "string" },
    marketAnalysis: { type: "string" },
    marketingStrategy: { type: "string" },
    funnel: { type: "string" },
    operations: { type: "string" },
    team: { type: "string" },
    financialPlan: { type: "string" },
    roadmap: { type: "string" },
    risks: { type: "string" },
    closing: { type: "string" },
  },
} as const;

const PLAN_SYSTEM =
  "Kamu penulis business plan profesional berbahasa Indonesia yang hangat & jelas untuk pemula. " +
  "Angka finansial bersifat FINAL & sudah dihitung sistem; JANGAN mengubah/menghitung ulang. " +
  "Rujuk angka persis seperti diberikan. Jawab HANYA JSON sesuai schema.";

function buildNarrativePrompt(input: GeneratePlanInput, financials: FinancialsResult): string {
  return [
    `Riset (ringkas): ${input.researchSummary ?? "(tidak ada)"}`,
    `Angka finansial terhitung (FINAL — jangan ubah):`,
    JSON.stringify(financials),
    `Susun narasi business plan per-section. Narasikan HPP/BEP/proyeksi/ROI dari angka di atas.`,
  ].join("\n\n");
}

export class PlannerService {
  constructor(private readonly deps: PlannerServiceDeps) {}

  /** Extract financial figures from an uploaded document (PDF/image data URL) to pre-fill intake. §9.3.4.1.
   *  Human-in-the-loop: the user reviews & edits before the engine computes — numbers stay deterministic. */
  async importIntake(userId: string, fileDataUrl: string): Promise<ImportedIntake> {
    const { provider, cred } = await this.deps.registry.forTask(userId, "doc_understanding");
    return provider.understandDocument<ImportedIntake>(cred, fileDataUrl, INTAKE_IMPORT_SCHEMA);
  }

  async generatePlan(userId: string, input: GeneratePlanInput): Promise<BusinessPlan> {
    // CODE DISPOSES: numbers first, deterministically — base case + three scenarios.
    const financials = computeFinancials(input.inputs);
    const scenarios = computeScenarioSummaries(input.inputs);

    // LLM PROPOSES the narrative, with the final numbers injected.
    const { provider, cred } = await this.deps.registry.forTask(userId, "reasoning_heavy");
    const narrative = await provider.generateStructured<Record<string, string>>(
      cred,
      buildNarrativePrompt(input, financials),
      { jsonSchema: PLAN_NARRATIVE_SCHEMA, reasoning: "high", systemPrompt: PLAN_SYSTEM, task: "reasoning_heavy" },
    );

    const plan: BusinessPlan = {
      id: this.deps.idGen(),
      projectId: input.projectId,
      status: "complete",
      version: 1,
      inputs: input.inputs,
      financials,
      scenarios,
      narrative,
      stale: false,
      generatedAt: this.deps.now(),
    };
    return this.deps.plans.save(plan);
  }
}
