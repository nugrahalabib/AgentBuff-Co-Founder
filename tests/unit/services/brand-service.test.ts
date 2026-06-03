import { describe, expect, it, vi } from "vitest";
import { InMemoryRepository } from "../../../src/server/domain/repositories";
import type { BrandKit, Project, ProjectState, ResearchReport } from "../../../src/server/domain/types";
import { BrandService, BrandInputError } from "../../../src/server/services/brand-service";
import { ProviderError } from "../../../src/lib/ai/registry";
import type { LLMProvider, ProviderRegistry } from "../../../src/lib/ai/llm-provider";
import type { Credential } from "../../../src/lib/ai/types";

const DIRECTION = {
  strategy: { essence: "hangat & lokal", positioning: "kopi spesialti terjangkau", personality: ["ramah"], pillars: ["kualitas", "komunitas"] },
  selectedName: "KopiKita",
  naming: [{ name: "KopiKita", rationale: "dekat" }, { name: "Sruput", rationale: "playful" }],
  voice: { attributes: ["hangat"], taglines: ["Ngopi, yuk"], samples: ["Halo!"], dos: ["ramah"], donts: ["kaku"] },
  primaryColor: "#6366f1",
  scheme: "complementary" as const,
  typography: { heading: "Poppins", body: "Inter" },
  logoDirection: "minimalis modern",
  imageryStyle: "hangat naturalis",
};

const project: Project = {
  id: "p1", ownerUserId: "u1", title: "Kedai Kopi", ideaText: "kopi spesialti",
  status: "branding", refs: { documentIds: [] }, createdAt: "t", updatedAt: "t",
};
const research = { summary: "pasar tumbuh" } as ResearchReport;

function world(opts?: { imageOk?: boolean; hasContext?: boolean }) {
  const imageOk = opts?.imageOk ?? false;
  const generateStructured = vi.fn().mockResolvedValue(DIRECTION);
  const generateImage = vi.fn().mockResolvedValue({ imageRef: "data:image/png;base64,AAA" });
  const provider = { id: "mock", generateStructured } as unknown as LLMProvider;
  const imgProvider = { id: "mock-img", generateImage } as unknown as LLMProvider;
  const cred: Credential = { provider: "gemini", type: "api_key", secret: "x" };
  const registry = {
    forTask: vi.fn().mockImplementation(async (_u: string, task: string) => {
      if (task === "image_gen") {
        if (imageOk) return { provider: imgProvider, cred };
        throw new ProviderError("NO_PROVIDER_FOR_TASK", "tidak ada provider gambar");
      }
      return { provider, cred };
    }),
  } as unknown as ProviderRegistry;
  const brandKits = new InMemoryRepository<BrandKit>();
  const svc = new BrandService({ brandKits, registry, idGen: () => "brand-1", now: () => "t" });
  const state: ProjectState = (opts?.hasContext ?? true) ? { project, research } : { project };
  return { svc, state, brandKits, generateImage };
}

describe("BrandService.generate", () => {
  it("produces direction text + a deterministic palette from the engine and persists the kit", async () => {
    const { svc, brandKits } = world();
    const kit = await svc.generate("u1", { projectState: world().state });
    expect(kit.selectedName).toBe("KopiKita");
    expect(kit.naming).toHaveLength(2);
    expect(kit.visualTokens.palette.primary).toBe("#6366f1"); // engine, deterministic
    expect(kit.visualTokens.palette).toHaveProperty("accent");
    expect(kit.visualTokens.typography.heading).toBe("Poppins");
    expect(await brandKits.get("brand-1")).toBeDefined();
  });

  it("ships text-only when the provider has no image capability (graceful)", async () => {
    const { svc, state } = world({ imageOk: false });
    const kit = await svc.generate("u1", { projectState: state });
    expect(kit.assets).toHaveLength(0);
  });

  it("generates moodboard + logo concepts when image generation is available", async () => {
    const { svc, state, generateImage } = world({ imageOk: true });
    const kit = await svc.generate("u1", { projectState: state });
    expect(generateImage).toHaveBeenCalledTimes(2);
    expect(kit.assets.map((a) => a.type)).toEqual(["moodboard", "logo"]);
    expect(kit.assets[0]!.imageRef.startsWith("data:image/")).toBe(true);
    expect(kit.assets[0]!.selected).toBe(true);
  });

  it("skips images that fail without losing the rest of the kit", async () => {
    const { svc, state, generateImage } = world({ imageOk: true });
    generateImage.mockRejectedValueOnce(new Error("429")); // moodboard fails
    const kit = await svc.generate("u1", { projectState: state });
    expect(kit.assets.map((a) => a.type)).toEqual(["logo"]); // only the logo survived
  });

  it("refuses without any upstream context (no research and no plan)", async () => {
    const { svc, state } = world({ hasContext: false });
    await expect(svc.generate("u1", { projectState: state })).rejects.toBeInstanceOf(BrandInputError);
  });
});
