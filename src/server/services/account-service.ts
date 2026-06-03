// src/server/services/account-service.ts — UU PDP data rights (§13.4): right to access (export) and
// right to erasure (delete). Export composes the user's data from existing read paths (no secrets — only
// credential fingerprints/capabilities). Delete removes everything the user owns (Postgres cascades from
// the User row; in-memory clears each store). Both are user-initiated and same-origin/auth guarded upstream.

import type { CredentialView } from "./credential-service";
import type { McpClientView } from "../mcp/client-store";
import type { UsageSummary } from "./usage-recorder";
import type { OnboardingProfile, Project, ProjectState } from "../domain/types";

export interface AccountExport {
  exportedAt: string;
  userId: string;
  profile: OnboardingProfile | null;
  credentials: CredentialView[];
  mcpClients: McpClientView[];
  usage: UsageSummary;
  projects: ProjectState[];
}

export interface AccountServiceDeps {
  getProfile: (userId: string) => Promise<OnboardingProfile | null>;
  credentialSummary: (userId: string) => Promise<{ credentials: CredentialView[] }>;
  listMcpClients: (userId: string) => Promise<McpClientView[]>;
  usageSummary: (userId: string) => Promise<UsageSummary>;
  listProjects: (userId: string) => Promise<Project[]>;
  getState: (projectId: string) => Promise<ProjectState | null>;
  deleteUser: (userId: string) => Promise<void>;
  now: () => string;
}

export class AccountService {
  constructor(private readonly deps: AccountServiceDeps) {}

  /** Full machine-readable export of everything we hold about the user (no secrets). */
  async export(userId: string): Promise<AccountExport> {
    const [profile, credSummary, mcpClients, usage, projects] = await Promise.all([
      this.deps.getProfile(userId),
      this.deps.credentialSummary(userId),
      this.deps.listMcpClients(userId),
      this.deps.usageSummary(userId),
      this.deps.listProjects(userId),
    ]);
    const states = await Promise.all(projects.map((p) => this.deps.getState(p.id)));
    return {
      exportedAt: this.deps.now(),
      userId,
      profile,
      credentials: credSummary.credentials,
      mcpClients,
      usage,
      projects: states.filter((s): s is ProjectState => s !== null),
    };
  }

  /** Erase the account and all owned data. */
  async delete(userId: string): Promise<void> {
    await this.deps.deleteUser(userId);
  }
}
