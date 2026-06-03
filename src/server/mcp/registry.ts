// src/server/mcp/registry.ts
// Tool registry + dispatcher. The Streamable-HTTP / JSON-RPC transport (and OAuth 2.1) wrap this;
// the registry itself is transport-agnostic and unit-testable. PRD §9.6.2, §10.5.

import { McpError, type McpContext, type McpTool, type McpToolDescriptor } from "./types";

export class McpToolRegistry {
  private readonly tools = new Map<string, McpTool>();

  register(tool: McpTool): this {
    this.tools.set(tool.name, tool);
    return this;
  }

  /** tools/list payload (cacheable per spec). PRD §9.6.2. */
  list(): McpToolDescriptor[] {
    return [...this.tools.values()].map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  /** tools/call dispatch. Throws McpError("TOOL_NOT_FOUND") for an unknown tool. */
  async call(name: string, input: unknown, ctx: McpContext): Promise<unknown> {
    const tool = this.tools.get(name);
    if (tool === undefined) {
      throw new McpError("TOOL_NOT_FOUND", `Tool tidak ditemukan: ${name}`);
    }
    return tool.handler(input, ctx);
  }
}
