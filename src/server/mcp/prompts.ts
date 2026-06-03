// src/server/mcp/prompts.ts — MCP prompts (PRD §10.5). Reusable, Bahasa-Indonesia prompt templates an
// agent can fetch + fill, keeping the "warm, beginner-friendly, sources-required" house style consistent.

import { McpError } from "./types";

export interface PromptArgument {
  name: string;
  description: string;
  required: boolean;
}
export interface PromptDescriptor {
  name: string;
  description: string;
  arguments: PromptArgument[];
}
export interface PromptMessage {
  role: "user" | "assistant";
  content: { type: "text"; text: string };
}

export const PROMPTS: PromptDescriptor[] = [
  {
    name: "validate_business_idea",
    description: "Brief untuk memvalidasi ide bisnis di pasar Indonesia (permintaan, kompetitor, harga, risiko).",
    arguments: [
      { name: "idea", description: "Ide bisnis dalam 1–3 kalimat", required: true },
      { name: "market", description: "Geografi/segmen target (mis. Jakarta)", required: false },
    ],
  },
  {
    name: "review_business_plan",
    description: "Kritik business plan dari sudut pandang investor (gunakan angka apa adanya).",
    arguments: [{ name: "project_id", description: "ID project yang sudah punya plan", required: true }],
  },
  {
    name: "pitch_feedback",
    description: "Umpan balik pitch deck: kejelasan, daya tarik, dan kelengkapan untuk investor awal.",
    arguments: [{ name: "project_id", description: "ID project yang sudah punya dokumen", required: true }],
  },
];

const text = (s: string): PromptMessage => ({ role: "user", content: { type: "text", text: s } });

export function getPrompt(name: string, args: Record<string, string>): PromptMessage[] {
  switch (name) {
    case "validate_business_idea":
      return [
        text(
          `Validasi ide bisnis berikut untuk pasar Indonesia${args["market"] !== undefined ? ` (${args["market"]})` : ""}. ` +
            `Gunakan tool agentbuff.validate_idea bila tersedia; jangan mengarang angka, sertakan sumber yang bisa diklik.\n\nIde: ${args["idea"] ?? ""}`,
        ),
      ];
    case "review_business_plan":
      return [
        text(
          `Ambil state project lewat resource agentbuff://project/${args["project_id"] ?? ""}/plan, lalu kritik business plan ` +
            `dari sudut investor: kekuatan, kelemahan, asumsi berisiko, dan pertanyaan yang akan diajukan investor. ` +
            `Gunakan angka APA ADANYA dari engine — jangan menghitung ulang.`,
        ),
      ];
    case "pitch_feedback":
      return [
        text(
          `Tinjau dokumen pitch untuk project agentbuff://project/${args["project_id"] ?? ""}. Beri umpan balik tentang ` +
            `kejelasan narasi, daya tarik, struktur slide, dan kelengkapan finansial untuk investor tahap awal.`,
        ),
      ];
    default:
      throw new McpError("NOT_FOUND", `Prompt tidak dikenal: ${name}`);
  }
}
