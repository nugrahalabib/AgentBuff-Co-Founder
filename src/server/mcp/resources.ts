// src/server/mcp/resources.ts — MCP resources (PRD §10.5). Exposes the user's project artifacts as
// read-only resources an agent can fetch (e.g. the full project state, research report, business plan).
// Ownership is enforced per read. URIs: agentbuff://project/<id>[/research|/plan|/brand].

import { McpError, type McpContext } from "./types";

export interface ResourceDescriptor {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface ResourceContents {
  uri: string;
  mimeType: string;
  text: string;
}

/** List the resources available to the authenticated user (their projects + artifacts). */
export async function listResources(ctx: McpContext): Promise<ResourceDescriptor[]> {
  const projects = await ctx.projects.listForUser(ctx.userId);
  return projects.flatMap((p) => {
    const out: ResourceDescriptor[] = [
      { uri: `agentbuff://project/${p.id}`, name: `Project: ${p.title}`, description: "State lengkap project (riset + plan + brand + dokumen)", mimeType: "application/json" },
    ];
    if (p.refs.researchReportId !== undefined) {
      out.push({ uri: `agentbuff://project/${p.id}/research`, name: `Riset: ${p.title}`, description: "Laporan riset + skor validasi", mimeType: "application/json" });
    }
    if (p.refs.businessPlanId !== undefined) {
      out.push({ uri: `agentbuff://project/${p.id}/plan`, name: `Plan: ${p.title}`, description: "Business plan + angka deterministik", mimeType: "application/json" });
    }
    if (p.refs.brandKitId !== undefined) {
      out.push({ uri: `agentbuff://project/${p.id}/brand`, name: `Brand: ${p.title}`, description: "Brand kit (palet, naming, voice)", mimeType: "application/json" });
    }
    return out;
  });
}

const URI_RE = /^agentbuff:\/\/project\/([^/]+)(?:\/(research|plan|brand))?$/;

/** Read a resource by URI, enforcing ownership. */
export async function readResource(ctx: McpContext, uri: string): Promise<ResourceContents> {
  const m = URI_RE.exec(uri);
  if (m === null) throw new McpError("NOT_FOUND", `URI resource tidak dikenal: ${uri}`);
  const projectId = m[1]!;
  const sub = m[2];

  const state = await ctx.projects.getState(projectId);
  if (state === null) throw new McpError("NOT_FOUND", "Project tidak ditemukan.");
  if (state.project.ownerUserId !== ctx.userId) throw new McpError("FORBIDDEN", "Project ini bukan milik pengguna token.");

  const body =
    sub === "research" ? (state.research ?? null) :
    sub === "plan" ? (state.plan ?? null) :
    sub === "brand" ? (state.brandKit ?? null) :
    state;
  if (body === null) throw new McpError("NOT_FOUND", `Artefak "${sub}" belum ada di project ini.`);

  return { uri, mimeType: "application/json", text: JSON.stringify(body) };
}
