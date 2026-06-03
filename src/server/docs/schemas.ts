// src/server/docs/schemas.ts — Template-Constrained Generation slot schemas. PRD §9.5.2.1.
// The LLM fills these TEXT slots only. It never writes HTML and never authors numbers — financial
// figures are injected by the server from the deterministic engine.

export const PROPOSAL_SLOTS_SCHEMA = {
  type: "object",
  required: [
    "tagline",
    "problem",
    "solution",
    "marketAnalysis",
    "businessModel",
    "marketingPlan",
    "team",
    "financialHighlights",
    "fundingAsk",
    "closing",
  ],
  additionalProperties: false,
  properties: {
    tagline: { type: "string", description: "satu kalimat penangkap perhatian" },
    problem: { type: "string" },
    solution: { type: "string" },
    marketAnalysis: { type: "string" },
    businessModel: { type: "string" },
    marketingPlan: { type: "string" },
    team: { type: "string" },
    financialHighlights: { type: "string", description: "narasi sorotan finansial; rujuk angka yang diberikan, jangan mengarang" },
    fundingAsk: { type: "string" },
    closing: { type: "string" },
  },
} as const;

export const DECK_SLOTS_SCHEMA = {
  type: "object",
  required: ["slides"],
  additionalProperties: false,
  properties: {
    slides: {
      type: "array",
      description: "8–11 slide pitch deck",
      items: {
        type: "object",
        required: ["title", "bullets"],
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          bullets: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;
