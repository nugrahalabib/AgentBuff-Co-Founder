// src/server/mcp/types.ts
// MCP server primitives. PRD §9.6. Tools are thin wrappers over the SAME engine/services the web
// API uses (Single Engine, Multi-Adapter) — no business logic lives here.

import type { ProjectService } from "../services/project-service";
import type { ResearchService } from "../services/research-service";
import type { PlannerService } from "../services/planner-service";

/** Per-call context, bound to the authenticated user (OAuth token → user). PRD §9.6.5. */
export interface McpContext {
  userId: string;
  projects: ProjectService;
  research: ResearchService;
  planner: PlannerService;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface McpTool<I = any, O = any> {
  name: string;
  description: string;
  inputSchema: object;
  handler: (input: I, ctx: McpContext) => Promise<O>;
}

export interface McpToolDescriptor {
  name: string;
  description: string;
  inputSchema: object;
}
