import { describe, expect, it, vi } from "vitest";
import { AccountService } from "../../../src/server/services/account-service";
import { emptySummary } from "../../../src/server/services/usage-recorder";
import type { Project, ProjectState } from "../../../src/server/domain/types";

const project: Project = {
  id: "p1", ownerUserId: "u1", title: "Kedai Kopi", ideaText: "kopi",
  status: "branding", refs: { documentIds: [] }, createdAt: "t", updatedAt: "t",
};

function makeService(overrides?: { deleteUser?: () => Promise<void> }) {
  const deleteUser = overrides?.deleteUser ?? vi.fn().mockResolvedValue(undefined);
  const svc = new AccountService({
    getProfile: vi.fn().mockResolvedValue({ userId: "u1", sector: "F&B" }),
    credentialSummary: vi.fn().mockResolvedValue({ credentials: [{ provider: "gemini", fingerprint: "fp" }] }),
    listMcpClients: vi.fn().mockResolvedValue([{ id: "c1", name: "Laptop" }]),
    usageSummary: vi.fn().mockResolvedValue({ ...emptySummary(), total: 3 }),
    listProjects: vi.fn().mockResolvedValue([project]),
    getState: vi.fn().mockResolvedValue({ project } as ProjectState),
    deleteUser,
    now: () => "2026-06-04T00:00:00Z",
  });
  return { svc, deleteUser };
}

describe("AccountService.export", () => {
  it("composes a full, secret-free export of the user's data", async () => {
    const { svc } = makeService();
    const out = await svc.export("u1");
    expect(out.userId).toBe("u1");
    expect(out.profile?.sector).toBe("F&B");
    expect(out.credentials[0]).not.toHaveProperty("ciphertext");
    expect(out.mcpClients).toHaveLength(1);
    expect(out.usage.total).toBe(3);
    expect(out.projects[0]?.project.id).toBe("p1");
    expect(out.exportedAt).toBe("2026-06-04T00:00:00Z");
  });
});

describe("AccountService.delete", () => {
  it("delegates erasure to deleteUser", async () => {
    const { svc, deleteUser } = makeService();
    await svc.delete("u1");
    expect(deleteUser).toHaveBeenCalledWith("u1");
  });
});
