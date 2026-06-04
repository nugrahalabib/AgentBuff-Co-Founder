// src/server/mcp/json-rpc.ts — JSON-RPC 2.0 dispatch for the MCP Streamable-HTTP gateway. PRD §9.6.2, §10.5.
// Transport-agnostic: the route handler owns HTTP/SSE + auth; this owns the protocol. Methods:
//   initialize · ping · tools/list · tools/call · notifications/* (no response).
// Tool *execution* failures are returned as { isError:true } results (MCP convention, so the agent can
// react); protocol misuse (unknown method, bad params) uses JSON-RPC error objects.

import { createHash } from "node:crypto";
import { validateAgainstSchema } from "@/lib/ai/schema-validate";
import { McpError, type McpContext } from "./types";
import type { McpToolRegistry } from "./registry";
import type { McpAuditStore } from "./client-store";
import { listResources, readResource } from "./resources";
import { PROMPTS, getPrompt } from "./prompts";

export const MCP_PROTOCOL_VERSION = "2025-06-18";
export const MCP_SERVER_INFO = { name: "agentbuff-cofounder", version: "1.0.0" } as const;

// Standard JSON-RPC 2.0 error codes.
export const RPC = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

export type JsonRpcId = string | number | null;
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}
export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface RpcDeps {
  registry: McpToolRegistry;
  ctx: McpContext;
  /** Identifies the audit subject (MCP client id) for this connection. */
  clientId: string;
  /** Scopes granted to the presented token (PRD §10.5). Defaults to full access if omitted. */
  scopes?: ("read" | "write")[];
  audit?: McpAuditStore;
  now: () => string;
}

const ok = (id: JsonRpcId, result: unknown): JsonRpcResponse => ({ jsonrpc: "2.0", id, result });
const err = (id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  error: data === undefined ? { code, message } : { code, message, data },
});

const argsHash = (args: unknown): string =>
  createHash("sha256").update(JSON.stringify(args ?? null)).digest("hex").slice(0, 32);

/** Validate a single JSON-RPC request envelope shape. */
export function isValidEnvelope(value: unknown): value is JsonRpcRequest {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return v["jsonrpc"] === "2.0" && typeof v["method"] === "string";
}

/**
 * Handle one JSON-RPC request. Returns a response, or `null` for notifications (no `id`).
 * Never throws — internal failures map to JSON-RPC error objects.
 */
export async function handleRpc(req: JsonRpcRequest, deps: RpcDeps): Promise<JsonRpcResponse | null> {
  const isNotification = req.id === undefined || req.method.startsWith("notifications/");
  const id: JsonRpcId = req.id ?? null;

  try {
    switch (req.method) {
      case "initialize":
        return ok(id, {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {
            tools: { listChanged: false },
            resources: { listChanged: false, subscribe: false },
            prompts: { listChanged: false },
          },
          serverInfo: MCP_SERVER_INFO,
        });

      case "ping":
        return ok(id, {});

      case "tools/list":
        return ok(id, { tools: deps.registry.list() });

      case "tools/call":
        return await handleToolCall(id, req.params, deps);

      case "resources/list":
        return ok(id, { resources: await listResources(deps.ctx) });

      case "resources/read": {
        const uri = (req.params as { uri?: unknown } | undefined)?.uri;
        if (typeof uri !== "string") return err(id, RPC.INVALID_PARAMS, "Parameter `uri` (string) wajib.");
        try {
          return ok(id, { contents: [await readResource(deps.ctx, uri)] });
        } catch (e) {
          return err(id, RPC.INVALID_PARAMS, e instanceof McpError ? e.message : "Resource tidak terbaca.");
        }
      }

      case "prompts/list":
        return ok(id, { prompts: PROMPTS });

      case "prompts/get": {
        const p = (req.params ?? {}) as { name?: unknown; arguments?: Record<string, string> };
        if (typeof p.name !== "string") return err(id, RPC.INVALID_PARAMS, "Parameter `name` (string) wajib.");
        try {
          return ok(id, { messages: getPrompt(p.name, p.arguments ?? {}) });
        } catch (e) {
          return err(id, RPC.INVALID_PARAMS, e instanceof McpError ? e.message : "Prompt tidak ditemukan.");
        }
      }

      default:
        if (isNotification) return null; // unknown notification → ignore silently
        return err(id, RPC.METHOD_NOT_FOUND, `Metode tidak dikenal: ${req.method}`);
    }
  } catch (e) {
    if (isNotification) return null;
    // Only controlled McpError text is client-safe; never echo raw native/Prisma/internal messages.
    const message = e instanceof McpError ? e.message : "Kesalahan internal.";
    return err(id, RPC.INTERNAL_ERROR, message);
  }
}

async function handleToolCall(id: JsonRpcId, params: unknown, deps: RpcDeps): Promise<JsonRpcResponse> {
  const p = (params ?? {}) as { name?: unknown; arguments?: unknown };
  if (typeof p.name !== "string") {
    return err(id, RPC.INVALID_PARAMS, "Parameter `name` (string) wajib untuk tools/call.");
  }
  const name = p.name;
  const args = p.arguments ?? {};

  if (!deps.registry.has(name)) {
    return err(id, RPC.INVALID_PARAMS, `Tool tidak ditemukan: ${name}`);
  }

  // Enforce the tool's required scope against the token's granted scopes (PRD §10.5).
  const descriptor = deps.registry.list().find((t) => t.name === name);
  if (descriptor !== undefined && deps.scopes !== undefined && !deps.scopes.includes(descriptor.scope)) {
    return err(id, RPC.INVALID_PARAMS, `Token tidak punya scope "${descriptor.scope}" untuk tool ini.`);
  }

  // Defense-in-depth: validate arguments against the tool's declared inputSchema.
  if (descriptor !== undefined) {
    const check = validateAgainstSchema(args, descriptor.inputSchema);
    if (!check.ok) {
      return err(id, RPC.INVALID_PARAMS, `Argumen tidak valid terhadap schema: ${check.errors}`);
    }
  }

  try {
    const result = await deps.registry.call(name, args, deps.ctx);
    await deps.audit?.record({
      clientId: deps.clientId,
      userId: deps.ctx.userId,
      tool: name,
      argsHash: argsHash(args),
      resultStatus: "ok",
      ts: deps.now(),
    });
    return ok(id, {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
      isError: false,
    });
  } catch (e) {
    await deps.audit?.record({
      clientId: deps.clientId,
      userId: deps.ctx.userId,
      tool: name,
      argsHash: argsHash(args),
      resultStatus: "error",
      ts: deps.now(),
    });
    // MCP convention: report tool failures as result content with isError:true. Only controlled McpError
    // text is surfaced; any other (native/Prisma/adapter) error is genericized so nothing internal leaks.
    const message = e instanceof McpError ? `[${e.code}] ${e.message}` : "Tool gagal dijalankan.";
    return ok(id, { content: [{ type: "text", text: message }], isError: true });
  }
}

/** Max JSON-RPC requests in one batch (amplification cap). */
const MAX_BATCH = 20;

/**
 * Handle a raw request body (already JSON-parsed). Supports a single request or a batch (array).
 * Returns the response payload (object, array, or null for an all-notification batch).
 */
export async function dispatch(body: unknown, deps: RpcDeps): Promise<unknown> {
  if (Array.isArray(body)) {
    if (body.length === 0) return err(null, RPC.INVALID_REQUEST, "Batch kosong.");
    // Cap batch fan-out: one POST must not trigger an unbounded number of concurrent tool executions
    // (each can call an LLM provider on the user's BYOK quota). (DOS-004)
    if (body.length > MAX_BATCH) return err(null, RPC.INVALID_REQUEST, `Batch maksimum ${MAX_BATCH} permintaan.`);
    const responses = await Promise.all(
      body.map((item) =>
        isValidEnvelope(item)
          ? handleRpc(item, deps)
          : Promise.resolve(err((item as { id?: JsonRpcId })?.id ?? null, RPC.INVALID_REQUEST, "Envelope tidak valid.")),
      ),
    );
    const filtered = responses.filter((r): r is JsonRpcResponse => r !== null);
    return filtered.length === 0 ? null : filtered;
  }
  if (!isValidEnvelope(body)) return err(null, RPC.INVALID_REQUEST, "Envelope JSON-RPC tidak valid.");
  return handleRpc(body, deps);
}
