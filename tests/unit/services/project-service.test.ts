import { describe, expect, it } from "vitest";
import { InMemoryRepository } from "../../../src/server/domain/repositories";
import type { BusinessPlan, Project, ResearchReport } from "../../../src/server/domain/types";
import { ProjectService, deriveTitle } from "../../../src/server/services/project-service";

function makeService() {
  let idSeq = 0;
  let nowSeq = 0;
  const projects = new InMemoryRepository<Project>();
  const research = new InMemoryRepository<ResearchReport>();
  const plans = new InMemoryRepository<BusinessPlan>();
  const service = new ProjectService({
    projects,
    research,
    plans,
    idGen: () => `id-${++idSeq}`,
    now: () => `t-${++nowSeq}`,
  });
  return { service, projects, research, plans };
}

describe("deriveTitle", () => {
  it("uses the first sentence, truncates long ones, and falls back when empty", () => {
    expect(deriveTitle("Kedai kopi spesialti. Lokasi Jakarta.")).toBe("Kedai kopi spesialti");
    expect(deriveTitle("   ")).toBe("Ide bisnis baru");
    expect(deriveTitle("a".repeat(80))).toBe(`${"a".repeat(57)}...`);
  });
});

describe("ProjectService", () => {
  it("creates a draft project with a derived title and empty refs", async () => {
    const { service } = makeService();
    const p = await service.create({ ownerUserId: "u1", ideaText: "Thrift online untuk Gen-Z" });
    expect(p).toMatchObject({
      id: "id-1",
      ownerUserId: "u1",
      title: "Thrift online untuk Gen-Z",
      status: "draft",
      createdAt: "t-1",
      updatedAt: "t-1",
    });
    expect(p.refs.documentIds).toEqual([]);
  });

  it("lists only the owner's projects", async () => {
    const { service } = makeService();
    await service.create({ ownerUserId: "u1", ideaText: "A" });
    await service.create({ ownerUserId: "u2", ideaText: "B" });
    await service.create({ ownerUserId: "u1", ideaText: "C" });
    expect((await service.listForUser("u1")).map((p) => p.ideaText)).toEqual(["A", "C"]);
  });

  it("advances status and links artifacts; composes ProjectState", async () => {
    const { service, research, plans } = makeService();
    const project = await service.create({ ownerUserId: "u1", ideaText: "Roti sourdough" });

    await research.save({
      id: "rep-1",
      projectId: project.id,
      status: "completed",
      validationScore: 72,
      recommendation: "go",
      scoreBreakdown: { demand: 28, margin: 21, competition: 12, differentiation: 11, regulatoryPenalty: 0 },
      signals: { demandStrength: 0.8, marginHeadroom: 0.7, competitionGap: 0.6, differentiation: 0.7 },
      citations: [],
      sources: [],
      isGrounded: false,
      generatedAt: "t",
      version: 1,
    });
    const afterResearch = await service.attachResearch(project.id, "rep-1");
    expect(afterResearch.status).toBe("planning");
    expect(afterResearch.refs.researchReportId).toBe("rep-1");

    await plans.save({
      id: "plan-1",
      projectId: project.id,
      status: "complete",
      version: 1,
      inputs: {} as BusinessPlan["inputs"],
      financials: {} as BusinessPlan["financials"],
      stale: false,
      generatedAt: "t",
    });
    const afterPlan = await service.attachPlan(project.id, "plan-1");
    expect(afterPlan.status).toBe("branding");

    const state = await service.getState(project.id);
    expect(state?.research?.id).toBe("rep-1");
    expect(state?.plan?.id).toBe("plan-1");
  });

  it("returns null state for an unknown project and throws when attaching to one", async () => {
    const { service } = makeService();
    expect(await service.getState("nope")).toBeNull();
    await expect(service.attachResearch("nope", "x")).rejects.toThrow(/tidak ditemukan/i);
  });
});
