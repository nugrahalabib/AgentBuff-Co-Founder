// src/server/mcp/gateway-service.ts — issue/list/revoke MCP tokens, authenticate connections, and
// build the per-call McpContext. PRD §9.6.5. The gateway is a thin adapter over the SAME services the
// web UI uses; ownership is enforced by binding the resolved token's userId into the context.

import type { ProjectService } from "../services/project-service";
import type { ResearchService } from "../services/research-service";
import type { PlannerService } from "../services/planner-service";
import type { BrandService } from "../services/brand-service";
import type { DocsService } from "../services/docs-service";
import type { McpAuditStore, McpClientStore, McpClientView, McpScope } from "./client-store";
import type { McpContext } from "./types";
import { generateToken, hashToken } from "./token";

const ALL_SCOPES: McpScope[] = ["read", "write"];

export interface McpServices {
  projects: ProjectService;
  research: ResearchService;
  planner: PlannerService;
  brand: BrandService;
  docs: DocsService;
}

export interface AuthenticatedClient {
  userId: string;
  clientId: string;
  scopes: McpScope[];
}

export class McpGatewayService {
  constructor(
    private readonly clients: McpClientStore,
    private readonly services: McpServices,
    private readonly idGen: () => string,
    private readonly now: () => string,
    readonly audit: McpAuditStore,
  ) {}

  /** Issue a new personal access token. The plaintext is returned ONCE; only its hash is stored. */
  async issueToken(
    userId: string,
    name: string,
    scopes: McpScope[] = ALL_SCOPES,
  ): Promise<{ id: string; token: string; display: string; scopes: McpScope[] }> {
    const issued = generateToken();
    const id = this.idGen();
    const normScopes = scopes.filter((s) => ALL_SCOPES.includes(s));
    const effective = normScopes.length > 0 ? normScopes : (["read"] as McpScope[]);
    await this.clients.create({
      id,
      ownerUserId: userId,
      name: name.trim() === "" ? "Token MCP" : name.trim(),
      tokenHash: issued.hash,
      tokenPrefix: issued.display,
      scopes: effective,
      status: "active",
      createdAt: this.now(),
    });
    return { id, token: issued.token, display: issued.display, scopes: effective };
  }

  listClients(userId: string): Promise<McpClientView[]> {
    return this.clients.listForUser(userId);
  }

  revoke(userId: string, clientId: string): Promise<boolean> {
    return this.clients.revoke(userId, clientId);
  }

  /** Resolve a presented bearer token to its owner, updating lastUsedAt. Returns null if invalid/revoked. */
  async authenticate(token: string): Promise<AuthenticatedClient | null> {
    if (token === "") return null;
    const record = await this.clients.findActiveByTokenHash(hashToken(token));
    if (record === null) return null;
    await this.clients.touch(record.id, this.now());
    return { userId: record.ownerUserId, clientId: record.id, scopes: record.scopes };
  }

  /** Build the per-connection tool context bound to the authenticated user. */
  context(userId: string): McpContext {
    return {
      userId,
      projects: this.services.projects,
      research: this.services.research,
      planner: this.services.planner,
      brand: this.services.brand,
      docs: this.services.docs,
    };
  }
}
