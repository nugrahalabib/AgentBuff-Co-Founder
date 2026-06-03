// src/server/mcp/client-store.ts — persistence seam for MCP access tokens + audit log. PRD §9.6.5, §16.
// Mirrors the credential-store pattern: an interface with in-memory (dev) and Prisma (prod) impls so
// the gateway is identical either way. Tokens are stored ONLY as hashes (see token.ts).

export interface McpClientRecord {
  id: string;
  ownerUserId: string;
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  status: "active" | "revoked";
  createdAt: string;
  lastUsedAt?: string;
}

/** Public (non-secret) view of a client for the settings UI. */
export interface McpClientView {
  id: string;
  name: string;
  tokenPrefix: string;
  status: "active" | "revoked";
  createdAt: string;
  lastUsedAt?: string;
}

export interface McpAuditEntry {
  clientId: string;
  userId: string;
  tool: string;
  argsHash?: string;
  resultStatus: "ok" | "error";
  ts: string;
}

export interface McpClientStore {
  create(rec: McpClientRecord): Promise<void>;
  /** Resolve an active client by token hash (auth lookup). */
  findActiveByTokenHash(hash: string): Promise<McpClientRecord | null>;
  listForUser(userId: string): Promise<McpClientView[]>;
  revoke(userId: string, clientId: string): Promise<boolean>;
  touch(clientId: string, atIso: string): Promise<void>;
}

export interface McpAuditStore {
  record(entry: McpAuditEntry): Promise<void>;
  listForUser?(userId: string, limit?: number): Promise<McpAuditEntry[]>;
}

const toView = (r: McpClientRecord): McpClientView => ({
  id: r.id,
  name: r.name,
  tokenPrefix: r.tokenPrefix,
  status: r.status,
  createdAt: r.createdAt,
  lastUsedAt: r.lastUsedAt,
});

export class InMemoryMcpClientStore implements McpClientStore {
  private readonly rows: McpClientRecord[] = [];
  async create(rec: McpClientRecord): Promise<void> {
    this.rows.push({ ...rec });
  }
  async findActiveByTokenHash(hash: string): Promise<McpClientRecord | null> {
    return this.rows.find((r) => r.tokenHash === hash && r.status === "active") ?? null;
  }
  async listForUser(userId: string): Promise<McpClientView[]> {
    return this.rows.filter((r) => r.ownerUserId === userId).map(toView);
  }
  async revoke(userId: string, clientId: string): Promise<boolean> {
    const r = this.rows.find((x) => x.id === clientId && x.ownerUserId === userId);
    if (r === undefined || r.status === "revoked") return false;
    r.status = "revoked";
    return true;
  }
  async touch(clientId: string, atIso: string): Promise<void> {
    const r = this.rows.find((x) => x.id === clientId);
    if (r !== undefined) r.lastUsedAt = atIso;
  }
  /** Remove all of a user's MCP clients (account erasure, §13.4). */
  clearUser(userId: string): void {
    for (let i = this.rows.length - 1; i >= 0; i--) {
      if (this.rows[i]!.ownerUserId === userId) this.rows.splice(i, 1);
    }
  }
}

export class InMemoryMcpAuditStore implements McpAuditStore {
  private readonly entries: McpAuditEntry[] = [];
  async record(entry: McpAuditEntry): Promise<void> {
    this.entries.push(entry);
  }
  async listForUser(userId: string, limit = 50): Promise<McpAuditEntry[]> {
    return this.entries.filter((e) => e.userId === userId).slice(-limit).reverse();
  }
}
