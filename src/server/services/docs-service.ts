// src/server/services/docs-service.ts
// Deck & Docs Engine (PRD §9.5). Default path = Template-Constrained Generation (§9.5.2.1): the LLM fills
// structured TEXT slots; the server renders HTML and binds every number from the deterministic Financial
// Engine. The LLM never writes HTML and never authors numbers. Research text is treated as untrusted data.

import type { Repository } from "../domain/repositories";
import type {
  BoundFinancials,
  BusinessDocument,
  DocumentType,
  PitchDeckSlots,
  ProjectState,
  ProposalSlots,
} from "../domain/types";
import type { FinancialsResult } from "../engine/financial/index";
import type { ProviderRegistry } from "../../lib/ai/llm-provider";
import { UNTRUSTED_SYSTEM_NOTE, wrapUntrusted } from "../../lib/ai/prompt-safety";
import { DECK_SLOTS_SCHEMA, PROPOSAL_SLOTS_SCHEMA } from "../docs/schemas";

export class DocsInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocsInputError";
  }
}

export interface DocsServiceDeps {
  documents: Repository<BusinessDocument>;
  registry: ProviderRegistry;
  idGen: () => string;
  now: () => string;
}

export interface GenerateDocInput {
  projectState: ProjectState;
  type: DocumentType;
  theme?: string;
}

/** Select the numbers to bind into the document — straight from the deterministic engine. */
export function boundFromFinancials(f: FinancialsResult): BoundFinancials {
  return {
    contributionMarginPerUnit: f.unitEconomics.contributionMarginPerUnit,
    grossMarginPct: f.unitEconomics.grossMarginPct,
    bepUnitsPerMonth: f.breakEven.bepUnitsPerMonthRounded,
    startupCapital: f.capital.startupCapital,
    paybackMonths: f.returns.paybackPeriodMonths,
    roiPct: f.returns.roiPct,
  };
}

const DOC_SYSTEM =
  "Kamu penulis dokumen bisnis profesional berbahasa Indonesia yang hangat & meyakinkan untuk investor/mitra. " +
  "Isi HANYA slot teks yang diminta. JANGAN menulis HTML/markup. JANGAN mengarang atau mengubah angka finansial — " +
  "angka sudah final dari sistem dan akan disisipkan otomatis; kamu boleh merujuknya dalam narasi. Jawab HANYA JSON sesuai schema.\n\n" +
  UNTRUSTED_SYSTEM_NOTE;

function buildPrompt(state: ProjectState, bound: BoundFinancials, type: DocumentType): string {
  const p = state.project;
  const research = state.research;
  const competitors = (research?.competitors ?? []).map((c) => c.name).join(", ");
  const narrative = state.plan?.narrative;
  const kind = type === "proposal" ? "proposal bisnis A4 untuk investor/mitra" : "pitch deck 16:9 (8–11 slide)";
  return [
    `Buat ${kind} untuk usaha berikut.`,
    `Ide: ${p.ideaText}`,
    p.sector !== undefined ? `Sektor: ${p.sector}` : "",
    research?.summary !== undefined ? `Ringkasan riset (DATA tergrounding):\n${wrapUntrusted(research.summary)}` : "",
    // Competitor names + plan exec-summary are derived from grounded web content → wrap as DATA (§13.3).
    competitors !== "" ? `Kompetitor (DATA): ${wrapUntrusted(competitors)}` : "",
    narrative?.execSummary !== undefined ? `Ringkasan plan (DATA): ${wrapUntrusted(narrative.execSummary)}` : "",
    `Angka finansial FINAL (rujuk, jangan ubah): ${JSON.stringify(bound)}`,
    `Tulis konten yang spesifik, jujur, dan persuasif untuk audiens investor Indonesia.`,
  ]
    .filter((l) => l !== "")
    .join("\n\n");
}

export class DocsService {
  constructor(private readonly deps: DocsServiceDeps) {}

  async generate(userId: string, input: GenerateDocInput): Promise<BusinessDocument> {
    const plan = input.projectState.plan;
    if (plan === undefined) {
      throw new DocsInputError("Buat Business Plan dulu agar dokumen punya angka untuk diikat.");
    }
    const bound = boundFromFinancials(plan.financials);
    const { provider, cred } = await this.deps.registry.forTask(userId, "reasoning_heavy");
    const schema = input.type === "proposal" ? PROPOSAL_SLOTS_SCHEMA : DECK_SLOTS_SCHEMA;
    const slots = await provider.generateStructured<ProposalSlots | PitchDeckSlots>(
      cred,
      buildPrompt(input.projectState, bound, input.type),
      { jsonSchema: schema, reasoning: "high", systemPrompt: DOC_SYSTEM, task: "reasoning_heavy" },
    );

    const label = input.type === "proposal" ? "Proposal" : "Pitch Deck";
    const doc: BusinessDocument = {
      id: this.deps.idGen(),
      projectId: input.projectState.project.id,
      type: input.type,
      status: "complete",
      version: 1,
      title: `${label} — ${input.projectState.project.title}`,
      slots,
      boundFinancials: bound,
      sources: input.projectState.research?.sources,
      theme: input.theme,
      stale: false,
      generatedAt: this.deps.now(),
    };
    return this.deps.documents.save(doc);
  }
}
