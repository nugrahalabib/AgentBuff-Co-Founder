// src/server/mcp/types.ts
// MCP server primitives. PRD §9.6. Tools are thin wrappers over the SAME engine/services the web
// API uses (Single Engine, Multi-Adapter) — no business logic lives here.

import type { ProjectService } from "../services/project-service";
import type { ResearchService } from "../services/research-service";
import type { PlannerService } from "../services/planner-service";
import type { BrandService } from "../services/brand-service";
import type { DocsService } from "../services/docs-service";

/** Per-call context, bound to the authenticated user (OAuth token → user). PRD §9.6.5. */
export interface McpContext {
  userId: string;
  projects: ProjectService;
  research: ResearchService;
  planner: PlannerService;
  brand: BrandService;
  docs: DocsService;
}

export type McpErrorCode =
  | "TOOL_NOT_FOUND"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "BYOK_KEY_INVALID"
  | "INVALID_INPUT";

export class McpError extends Error {
  constructor(
    readonly code: McpErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "McpError";
  }
}

/** Access scope a tool requires (PRD §10.5). Read-only tools = "read"; mutating tools = "write". */
export type McpToolScope = "read" | "write";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface McpTool<I = any, O = any> {
  name: string;
  description: string;
  inputSchema: object;
  /** Defaults to "write" when omitted (fail-safe: unknown tools need the broader scope). */
  scope?: McpToolScope;
  handler: (input: I, ctx: McpContext) => Promise<O>;
}

export interface McpToolDescriptor {
  name: string;
  description: string;
  inputSchema: object;
  scope: McpToolScope;
}
