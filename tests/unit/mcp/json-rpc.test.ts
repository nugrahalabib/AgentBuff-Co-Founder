import { describe, expect, it } from "vitest";
import { McpToolRegistry } from "../../../src/server/mcp/registry";
import { McpError, type McpContext } from "../../../src/server/mcp/types";
import {
  MCP_PROTOCOL_VERSION,
  RPC,
  dispatch,
  handleRpc,
  isValidEnvelope,
  type JsonRpcResponse,
} from "../../../src/server/mcp/json-rpc";
import { InMemoryMcpAuditStore } from "../../../src/server/mcp/client-store";

function buildRegistry(): McpToolRegistry {
  const r = new McpToolRegistry();
  r.register({
    name: "echo",
    description: "Echo the message.",
    inputSchema: {
      type: "object",
      required: ["message"],
      additionalProperties: false,
      properties: { message: { type: "string" } },
    },
    handler: async (input: { message: string }) => ({ echoed: input.message }),
  });
  r.register({
    name: "boom",
    description: "Always throws.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      throw new McpError("FORBIDDEN", "nope");
    },
  });
  return r;
}

const ctx = { userId: "u1" } as unknown as McpContext;
function deps(audit = new InMemoryMcpAuditStore()) {
  return { registry: buildRegistry(), ctx, clientId: "c1", audit, now: () => "2026-06-04T00:00:00.000Z" };
}

describe("isValidEnvelope", () => {
  it("accepts a well-formed envelope and rejects malformed ones", () => {
    expect(isValidEnvelope({ jsonrpc: "2.0", method: "ping", id: 1 })).toBe(true);
    expect(isValidEnvelope({ jsonrpc: "1.0", method: "ping" })).toBe(false);
    expect(isValidEnvelope({ jsonrpc: "2.0" })).toBe(false);
    expect(isValidEnvelope(null)).toBe(false);
  });
});

describe("handleRpc — protocol methods", () => {
  it("initialize returns protocol version + tools capability + serverInfo", async () => {
    const res = (await handleRpc({ jsonrpc: "2.0", id: 1, method: "initialize" }, deps())) as JsonRpcResponse;
    expect(res.result).toMatchObject({
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "agentbuff-cofounder" },
    });
  });

  it("ping returns an empty result", async () => {
    const res = (await handleRpc({ jsonrpc: "2.0", id: 2, method: "ping" }, deps())) as JsonRpcResponse;
    expect(res.result).toEqual({});
  });

  it("tools/list returns the catalog descriptors", async () => {
    const res = (await handleRpc({ jsonrpc: "2.0", id: 3, method: "tools/list" }, deps())) as JsonRpcResponse;
    const tools = (res.result as { tools: { name: string }[] }).tools;
    expect(tools.map((t) => t.name).sort()).toEqual(["boom", "echo"]);
  });

  it("unknown method → JSON-RPC METHOD_NOT_FOUND", async () => {
    const res = (await handleRpc({ jsonrpc: "2.0", id: 4, method: "nope" }, deps())) as JsonRpcResponse;
    expect(res.error?.code).toBe(RPC.METHOD_NOT_FOUND);
  });

  it("a notification (no id) returns null and produces no response", async () => {
    const res = await handleRpc({ jsonrpc: "2.0", method: "notifications/initialized" }, deps());
    expect(res).toBeNull();
  });
});

describe("handleRpc — tools/call", () => {
  it("calls a tool and returns text + structuredContent, recording an ok audit entry", async () => {
    const audit = new InMemoryMcpAuditStore();
    const res = (await handleRpc(
      { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "echo", arguments: { message: "hai" } } },
      deps(audit),
    )) as JsonRpcResponse;
    const result = res.result as { content: { type: string; text: string }[]; structuredContent: unknown; isError: boolean };
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toEqual({ echoed: "hai" });
    expect(JSON.parse(result.content[0]!.text)).toEqual({ echoed: "hai" });
    const log = await audit.listForUser("u1");
    expect(log[0]).toMatchObject({ tool: "echo", resultStatus: "ok", clientId: "c1" });
  });

  it("schema-invalid arguments → INVALID_PARAMS (no tool execution)", async () => {
    const res = (await handleRpc(
      { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "echo", arguments: { wrong: 1 } } },
      deps(),
    )) as JsonRpcResponse;
    expect(res.error?.code).toBe(RPC.INVALID_PARAMS);
  });

  it("unknown tool name → INVALID_PARAMS", async () => {
    const res = (await handleRpc(
      { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "ghost", arguments: {} } },
      deps(),
    )) as JsonRpcResponse;
    expect(res.error?.code).toBe(RPC.INVALID_PARAMS);
  });

  it("a tool that throws → result with isError:true and an error audit entry", async () => {
    const audit = new InMemoryMcpAuditStore();
    const res = (await handleRpc(
      { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "boom", arguments: {} } },
      deps(audit),
    )) as JsonRpcResponse;
    const result = res.result as { content: { text: string }[]; isError: boolean };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("FORBIDDEN");
    expect((await audit.listForUser("u1"))[0]!.resultStatus).toBe("error");
  });

  it("missing `name` param → INVALID_PARAMS", async () => {
    const res = (await handleRpc(
      { jsonrpc: "2.0", id: 9, method: "tools/call", params: {} },
      deps(),
    )) as JsonRpcResponse;
    expect(res.error?.code).toBe(RPC.INVALID_PARAMS);
  });

  it("denies a write-scoped tool to a read-only token (PRD §10.5)", async () => {
    // `echo` defaults to scope "write"; a read-only token must be rejected.
    const res = (await handleRpc(
      { jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "echo", arguments: { message: "hi" } } },
      { ...deps(), scopes: ["read"] },
    )) as JsonRpcResponse;
    expect(res.error?.code).toBe(RPC.INVALID_PARAMS);
    expect(res.error?.message).toMatch(/scope/i);
  });
});

describe("dispatch — batch + malformed", () => {
  it("malformed envelope → INVALID_REQUEST", async () => {
    const res = (await dispatch({ not: "valid" }, deps())) as JsonRpcResponse;
    expect(res.error?.code).toBe(RPC.INVALID_REQUEST);
  });

  it("processes a batch and drops notification responses", async () => {
    const res = (await dispatch(
      [
        { jsonrpc: "2.0", id: 1, method: "ping" },
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { jsonrpc: "2.0", id: 2, method: "tools/list" },
      ],
      deps(),
    )) as JsonRpcResponse[];
    expect(Array.isArray(res)).toBe(true);
    expect(res.map((r) => r.id).sort()).toEqual([1, 2]); // notification produced no response
  });

  it("an empty batch → INVALID_REQUEST", async () => {
    const res = (await dispatch([], deps())) as JsonRpcResponse;
    expect(res.error?.code).toBe(RPC.INVALID_REQUEST);
  });
});
