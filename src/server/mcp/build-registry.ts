// src/server/mcp/build-registry.ts
// The AgentBuff Agent Gateway tool catalog. PRD §9.6.3, §20.3. Every tool calls the same services
// the web UI uses (headless == UI). Ownership is enforced per call (PRD §9.6.5 isolation).

import type { FinancialInputs } from "../engine/financial/index";
import { McpToolRegistry } from "./registry";
import { McpError, type McpContext } from "./types";
import {
  CALCULATE_FINANCIALS_INPUT_SCHEMA,
  calculateFinancials,
  calculateScenarios,
  type CalculateFinancialsInput,
} from "./tools/calculate-financials";

async function requireOwnedProject(ctx: McpContext, projectId: string) {
  const project = await ctx.projects.get(projectId);
  if (project === null) throw new McpError("NOT_FOUND", `Project tidak ditemukan: ${projectId}`);
  if (project.ownerUserId !== ctx.userId) {
    throw new McpError("FORBIDDEN", "Project ini bukan milik pengguna token.");
  }
  return project;
}

export function buildToolRegistry(): McpToolRegistry {
  const registry = new McpToolRegistry();

  registry.register({
    name: "agentbuff.create_project",
    description: "Buat project baru dari ide bisnis.",
    inputSchema: {
      type: "object",
      required: ["idea"],
      properties: { idea: { type: "string" }, sector: { type: "string" }, geography: { type: "string" } },
    },
    handler: async (input: { idea: string; sector?: string; geography?: string }, ctx) => {
      const p = await ctx.projects.create({
        ownerUserId: ctx.userId,
        ideaText: input.idea,
        sector: input.sector,
        geography: input.geography,
      });
      return { project_id: p.id, title: p.title, status: p.status };
    },
  });

  registry.register({
    name: "agentbuff.list_projects",
    description: "Daftar project milik pengguna.",
    inputSchema: { type: "object", properties: {} },
    handler: async (_input: unknown, ctx) => {
      const projects = await ctx.projects.listForUser(ctx.userId);
      return { projects: projects.map((p) => ({ id: p.id, title: p.title, status: p.status })) };
    },
  });

  registry.register({
    name: "agentbuff.get_project",
    description: "Ambil state lengkap project (riset + plan).",
    inputSchema: { type: "object", required: ["project_id"], properties: { project_id: { type: "string" } } },
    handler: async (input: { project_id: string }, ctx) => {
      await requireOwnedProject(ctx, input.project_id);
      return ctx.projects.getState(input.project_id);
    },
  });

  registry.register({
    name: "agentbuff.calculate_financials",
    description: "Hitung HPP/BEP/proyeksi/payback/ROI deterministik. Tidak memanggil LLM.",
    inputSchema: CALCULATE_FINANCIALS_INPUT_SCHEMA,
    handler: async (input: CalculateFinancialsInput) => calculateFinancials(input),
  });

  registry.register({
    name: "agentbuff.compute_scenarios",
    description: "Hitung skenario Pesimistis/Realistis/Optimistis (KPI deterministik). Tidak memanggil LLM.",
    inputSchema: CALCULATE_FINANCIALS_INPUT_SCHEMA,
    handler: async (input: CalculateFinancialsInput) => calculateScenarios(input),
  });

  registry.register({
    name: "agentbuff.validate_idea",
    description: "Validasi ide bisnis tergrounding + ValidationScore deterministik (0-100); simpan ke project.",
    inputSchema: {
      type: "object",
      required: ["project_id"],
      properties: { project_id: { type: "string" }, market: { type: "string" } },
    },
    handler: async (input: { project_id: string; market?: string }, ctx) => {
      const project = await requireOwnedProject(ctx, input.project_id);
      const report = await ctx.research.validateIdea(ctx.userId, {
        projectId: project.id,
        ideaText: project.ideaText,
        market: input.market,
      });
      await ctx.projects.attachResearch(project.id, report.id);
      return {
        report_id: report.id,
        validation_score: report.validationScore,
        recommendation: report.recommendation,
        score_breakdown: report.scoreBreakdown,
        sources: report.sources,
      };
    },
  });

  registry.register({
    name: "agentbuff.generate_business_plan",
    description: "Susun business plan: angka dari engine deterministik, narasi dari LLM; simpan ke project.",
    inputSchema: {
      type: "object",
      required: ["project_id", "financial_inputs"],
      properties: { project_id: { type: "string" }, financial_inputs: { type: "object" } },
    },
    handler: async (input: { project_id: string; financial_inputs: FinancialInputs }, ctx) => {
      const project = await requireOwnedProject(ctx, input.project_id);
      const state = await ctx.projects.getState(project.id);
      const plan = await ctx.planner.generatePlan(ctx.userId, {
        projectId: project.id,
        inputs: input.financial_inputs,
        researchSummary: state?.research?.summary,
      });
      await ctx.projects.attachPlan(project.id, plan.id);
      return { plan_id: plan.id, financials: plan.financials };
    },
  });

  return registry;
}
