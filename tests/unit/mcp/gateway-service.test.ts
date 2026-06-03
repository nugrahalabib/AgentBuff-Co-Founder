import { describe, expect, it } from "vitest";
import { InMemoryMcpAuditStore, InMemoryMcpClientStore } from "../../../src/server/mcp/client-store";
import { McpGatewayService, type McpServices } from "../../../src/server/mcp/gateway-service";

// The gateway only touches `userId` + the services object identity for context(); stub the services.
const services = { projects: {}, research: {}, planner: {}, docs: {} } as unknown as McpServices;

function makeGateway() {
  const clients = new InMemoryMcpClientStore();
  let n = 0;
  const idGen = () => `id-${++n}`;
  const now = () => "2026-06-04T00:00:00.000Z";
  return { clients, gw: new McpGatewayService(clients, services, idGen, now, new InMemoryMcpAuditStore()) };
}

describe("McpGatewayService", () => {
  it("issues a token that then authenticates back to the same user + client", async () => {
    const { gw } = makeGateway();
    const issued = await gw.issueToken("u1", "Laptop");
    expect(issued.token.startsWith("mcp_")).toBe(true);

    const authed = await gw.authenticate(issued.token);
    expect(authed).toEqual({ userId: "u1", clientId: issued.id });
  });

  it("rejects an unknown or empty token", async () => {
    const { gw } = makeGateway();
    expect(await gw.authenticate("mcp_nonexistent")).toBeNull();
    expect(await gw.authenticate("")).toBeNull();
  });

  it("revoked tokens no longer authenticate", async () => {
    const { gw } = makeGateway();
    const issued = await gw.issueToken("u1", "Temp");
    expect(await gw.revoke("u1", issued.id)).toBe(true);
    expect(await gw.authenticate(issued.token)).toBeNull();
  });

  it("a user cannot revoke another user's token", async () => {
    const { gw } = makeGateway();
    const issued = await gw.issueToken("u1", "Mine");
    expect(await gw.revoke("u2", issued.id)).toBe(false);
    expect(await gw.authenticate(issued.token)).not.toBeNull(); // still valid
  });

  it("lists clients without exposing secrets, and binds context to the user", async () => {
    const { gw } = makeGateway();
    await gw.issueToken("u1", "A");
    const clients = await gw.listClients("u1");
    expect(clients).toHaveLength(1);
    expect(Object.keys(clients[0]!)).not.toContain("tokenHash");
    expect(gw.context("u1").userId).toBe("u1");
  });
});
