// Integration test for the MCP Streamable-HTTP transport route. Exercises auth + JSON-RPC dispatch +
// a deterministic tool end-to-end against the in-memory runtime (no DATABASE_URL → memory mode).
import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/mcp/route";
import { app } from "@/server/runtime";

function rpc(token: string | null, body: unknown): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== null) headers["Authorization"] = `Bearer ${token}`;
  return new Request("http://localhost:1717/api/mcp", { method: "POST", headers, body: JSON.stringify(body) });
}

describe("/api/mcp transport", () => {
  it("401s without a bearer token", async () => {
    const res = await POST(rpc(null, { jsonrpc: "2.0", id: 1, method: "ping" }));
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("Bearer");
  });

  it("401s for an unknown/revoked token", async () => {
    const res = await POST(rpc("mcp_bogus", { jsonrpc: "2.0", id: 1, method: "ping" }));
    expect(res.status).toBe(401);
  });

  it("initialize succeeds with a valid token", async () => {
    const { token } = await app.mcpGateway.issueToken("itest:u1", "vitest");
    const res = await POST(rpc(token, { jsonrpc: "2.0", id: 1, method: "initialize" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { result: { protocolVersion: string; serverInfo: { name: string } } };
    expect(json.result.protocolVersion).toBeDefined();
    expect(json.result.serverInfo.name).toBe("agentbuff-cofounder");
  });

  it("runs the deterministic calculate_financials tool headlessly (headless == UI)", async () => {
    const { token } = await app.mcpGateway.issueToken("itest:u2", "vitest");
    const res = await POST(
      rpc(token, {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "agentbuff.calculate_financials",
          arguments: {
            pricing: { unit_price: 20000 },
            costs: { variable_cost_per_unit: 10000, fixed_costs_monthly: 5000000 },
            assumptions: { monthly_volume: 600, horizon_months: 12 },
          },
        },
      }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      result: { isError: boolean; structuredContent: { unitEconomics: { contributionMarginPerUnit: number } } };
    };
    expect(json.result.isError).toBe(false);
    // Contribution margin = 20000 − 10000 = 10000 (computed by the deterministic engine, not an LLM).
    expect(json.result.structuredContent.unitEconomics.contributionMarginPerUnit).toBe(10000);
  });

  it("returns 202 for a notification (no id)", async () => {
    const { token } = await app.mcpGateway.issueToken("itest:u3", "vitest");
    const res = await POST(rpc(token, { jsonrpc: "2.0", method: "notifications/initialized" }));
    expect(res.status).toBe(202);
  });

  it("GET is 405 (no server-initiated SSE)", () => {
    const res = GET();
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST");
  });
});
