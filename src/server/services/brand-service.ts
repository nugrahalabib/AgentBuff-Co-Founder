// src/server/services/brand-service.ts
// Brand Forge Studio (PRD §9.4). The LLM proposes brand DIRECTION (strategy, naming, voice, a primary
// colour + scheme, typography pairing, imagery style); the CODE generates the coherent colour palette
// (design tokens) deterministically. Image assets (moodboard/logo) are generated when the user's provider
// supports image generation (capability-gated, §12.14.4) and degrade gracefully on quota/limit (§9.4.7).

import type { Repository } from "../domain/repositories";
import type {
  BrandAsset,
  BrandKit,
  BrandStrategy,
  BrandTypography,
  BrandVoice,
  NamingOption,
  ProjectState,
} from "../domain/types";
import { generatePalette, normalizePrimary, type PaletteScheme } from "../engine/brand/index";
import type { ProviderRegistry } from "../../lib/ai/llm-provider";
import { ProviderError } from "../../lib/ai/registry";
import { UNTRUSTED_SYSTEM_NOTE, wrapUntrusted } from "../../lib/ai/prompt-safety";
import { parseDataUrl, type ObjectStorage } from "../storage/object-storage";

export class BrandInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrandInputError";
  }
}

export interface BrandServiceDeps {
  brandKits: Repository<BrandKit>;
  registry: ProviderRegistry;
  idGen: () => string;
  now: () => string;
  /** When present, generated images are persisted to object storage and referenced by URL
   *  (instead of inlining a large data URL into the DB). PRD §9.4.7. */
  storage?: ObjectStorage;
}

export interface GenerateBrandInput {
  projectState: ProjectState;
  /** Whether to attempt image assets (moodboard/logo). Default true; auto-skips if no image capability. */
  withImages?: boolean;
}

interface BrandDirection {
  strategy: BrandStrategy;
  selectedName: string;
  naming: NamingOption[];
  voice: BrandVoice;
  primaryColor: string;
  scheme: PaletteScheme;
  typography: BrandTypography;
  logoDirection: string;
  imageryStyle: string;
}

export const BRAND_DIRECTION_SCHEMA = {
  type: "object",
  required: ["strategy", "selectedName", "naming", "voice", "primaryColor", "scheme", "typography", "logoDirection", "imageryStyle"],
  additionalProperties: false,
  properties: {
    strategy: {
      type: "object",
      required: ["essence", "positioning", "personality", "pillars"],
      additionalProperties: false,
      properties: {
        essence: { type: "string" },
        positioning: { type: "string" },
        personality: { type: "array", items: { type: "string" } },
        pillars: { type: "array", items: { type: "string" } },
      },
    },
    selectedName: { type: "string" },
    naming: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "rationale"],
        additionalProperties: false,
        properties: { name: { type: "string" }, rationale: { type: "string" }, availabilityHint: { type: "string" } },
      },
    },
    voice: {
      type: "object",
      required: ["attributes", "taglines", "samples", "dos", "donts"],
      additionalProperties: false,
      properties: {
        attributes: { type: "array", items: { type: "string" } },
        taglines: { type: "array", items: { type: "string" } },
        samples: { type: "array", items: { type: "string" } },
        dos: { type: "array", items: { type: "string" } },
        donts: { type: "array", items: { type: "string" } },
      },
    },
    primaryColor: { type: "string", description: "hex warna utama, mis. #6366f1" },
    scheme: { type: "string", enum: ["complementary", "analogous", "triadic"] },
    typography: {
      type: "object",
      required: ["heading", "body"],
      additionalProperties: false,
      properties: { heading: { type: "string", description: "Google Font heading" }, body: { type: "string", description: "Google Font body" } },
    },
    logoDirection: { type: "string" },
    imageryStyle: { type: "string" },
  },
} as const;

const BRAND_SYSTEM =
  "Kamu brand strategist & creative director berbahasa Indonesia. Hasilkan arah brand yang koheren dengan plan bisnis. " +
  "Pilih pasangan font Google Fonts (bebas lisensi). Untuk primaryColor berikan HEX valid. Jawab HANYA JSON sesuai schema. " +
  "Jangan meniru brand terkenal.\n\n" +
  UNTRUSTED_SYSTEM_NOTE;

function buildPrompt(state: ProjectState): string {
  const p = state.project;
  const positioning = state.plan?.narrative?.marketingStrategy ?? state.research?.summary ?? "";
  return [
    `Buat arah identitas brand untuk usaha ini.`,
    `Ide: ${p.ideaText}`,
    p.sector !== undefined ? `Sektor: ${p.sector}` : "",
    positioning !== "" ? `Konteks (DATA):\n${wrapUntrusted(positioning)}` : "",
    `Sertakan strategi, 5–8 opsi nama (+rasional), tone of voice, 1 warna utama (HEX) + skema, pasangan tipografi, arah logo, dan gaya imagery.`,
  ]
    .filter((l) => l !== "")
    .join("\n\n");
}

export class BrandService {
  constructor(private readonly deps: BrandServiceDeps) {}

  async generate(userId: string, input: GenerateBrandInput): Promise<BrandKit> {
    if (input.projectState.plan === undefined && input.projectState.research === undefined) {
      throw new BrandInputError("Jalankan validasi atau susun plan dulu agar brand selaras dengan bisnismu.");
    }

    // 1) LLM proposes direction.
    const { provider, cred } = await this.deps.registry.forTask(userId, "reasoning_heavy");
    const dir = await provider.generateStructured<BrandDirection>(cred, buildPrompt(input.projectState), {
      jsonSchema: BRAND_DIRECTION_SCHEMA,
      reasoning: "high",
      systemPrompt: BRAND_SYSTEM,
      task: "reasoning_heavy",
    });

    // 2) CODE generates the coherent palette (design tokens).
    const primary = normalizePrimary(dir.primaryColor);
    const palette = generatePalette(primary, dir.scheme);

    // 3) Image assets — capability-gated + graceful.
    const assets: BrandAsset[] = [];
    if (input.withImages !== false) {
      assets.push(...(await this.tryImages(userId, dir, primary, palette.accent)));
    }

    const kit: BrandKit = {
      id: this.deps.idGen(),
      projectId: input.projectState.project.id,
      status: "complete",
      version: 1,
      strategy: dir.strategy,
      selectedName: dir.selectedName,
      naming: dir.naming,
      voice: dir.voice,
      visualTokens: {
        palette,
        scheme: dir.scheme,
        typography: dir.typography,
        logoDirection: dir.logoDirection,
        imageryStyle: dir.imageryStyle,
      },
      assets,
      stale: false,
      generatedAt: this.deps.now(),
    };
    return this.deps.brandKits.save(kit);
  }

  /** Attempt moodboard + logo concept images; returns [] if no provider can do images. */
  private async tryImages(userId: string, dir: BrandDirection, primary: string, accent: string): Promise<BrandAsset[]> {
    let imgProvider;
    try {
      imgProvider = await this.deps.registry.forTask(userId, "image_gen");
    } catch (e) {
      if (e instanceof ProviderError) return []; // no image capability → text-only brand kit
      throw e;
    }
    const seeds: { type: BrandAsset["type"]; prompt: string }[] = [
      { type: "moodboard", prompt: `Brand moodboard untuk "${dir.selectedName}". Gaya: ${dir.imageryStyle}. Warna utama ${primary}, aksen ${accent}. Suasana ${dir.strategy.essence}. Kolase referensi, tanpa logo merek nyata.` },
      { type: "logo", prompt: `Konsep arah logo untuk "${dir.selectedName}" (${dir.logoDirection}). Minimalis, warna ${primary}. Bukan vektor produksi; orisinal.` },
    ];
    const out: BrandAsset[] = [];
    for (const seed of seeds) {
      try {
        const { imageRef } = await imgProvider.provider.generateImage(imgProvider.cred, seed.prompt);
        out.push({ type: seed.type, imageRef: await this.persistImage(imageRef, seed.type, userId), promptUsed: seed.prompt, selected: out.length === 0 });
      } catch {
        // Quota/limit/policy → skip this asset; the rest of the kit still ships (§9.4.7).
      }
    }
    return out;
  }

  /** Move a data-URL image into object storage (durable, no DB bloat, owner-stamped); fall back to the data URL. */
  private async persistImage(imageRef: string, type: BrandAsset["type"], ownerUserId: string): Promise<string> {
    const storage = this.deps.storage;
    if (storage === undefined || !imageRef.startsWith("data:")) return imageRef;
    const parsed = parseDataUrl(imageRef);
    if (parsed === null) return imageRef;
    try {
      const ext = parsed.contentType.split("/")[1] ?? "png";
      const { ref } = await storage.put({
        key: `brand/${this.deps.idGen()}-${type}.${ext}`,
        data: parsed.data,
        contentType: parsed.contentType,
        ownerUserId,
      });
      return storage.url(ref);
    } catch {
      return imageRef; // storage hiccup → keep the inline image
    }
  }
}
