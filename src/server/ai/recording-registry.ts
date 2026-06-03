// src/server/ai/recording-registry.ts — a ProviderRegistry decorator that records BYOK usage. PRD §16.
// Wraps DefaultProviderRegistry; the returned provider delegates to the real adapter and logs each call
// after it succeeds. Because all services depend on the ProviderRegistry interface, swapping this in at
// the runtime records usage everywhere (UI + MCP) with zero changes to business logic. (Single seam.)

import type { LLMProvider, ImageOpts, ProviderRegistry, StructuredOpts } from "@/lib/ai/llm-provider";
import type { Credential, DeepResearchHandle, GroundedResult, ProviderId, TaskClass } from "@/lib/ai/types";
import { resolveModel } from "@/lib/ai/model-routing";
import type { UsageRecorder } from "@/server/services/usage-recorder";

class RecordingProvider implements LLMProvider {
  readonly id: string;
  constructor(
    private readonly inner: LLMProvider,
    private readonly rec: UsageRecorder,
    private readonly userId: string,
    private readonly task: string,
    private readonly now: () => string,
  ) {
    this.id = inner.id;
  }

  private model(task?: string): string | undefined {
    return resolveModel((task ?? this.task) as TaskClass, this.inner.id as ProviderId);
  }

  validateCredential(cred: Credential) {
    return this.inner.validateCredential(cred);
  }

  async generateStructured<T = unknown>(cred: Credential, prompt: string, opts: StructuredOpts): Promise<T> {
    const out = await this.inner.generateStructured<T>(cred, prompt, opts);
    await this.rec.record({ userId: this.userId, operation: "structured", provider: this.inner.id as ProviderId, model: this.model(opts.task), ts: this.now() });
    return out;
  }

  async groundedSearch(cred: Credential, query: string, opts?: { maxQueries?: number }): Promise<GroundedResult> {
    const out = await this.inner.groundedSearch(cred, query, opts);
    await this.rec.record({ userId: this.userId, operation: "grounded", provider: this.inner.id as ProviderId, model: this.model("grounded_light"), groundedQueries: 1, ts: this.now() });
    return out;
  }

  async generateImage(cred: Credential, prompt: string, opts?: ImageOpts): Promise<{ imageRef: string }> {
    const out = await this.inner.generateImage(cred, prompt, opts);
    await this.rec.record({ userId: this.userId, operation: "image", provider: this.inner.id as ProviderId, model: this.model("image_gen"), imagesGenerated: 1, ts: this.now() });
    return out;
  }

  async runDeepResearch(cred: Credential, brief: string, opts?: { max?: boolean }): Promise<DeepResearchHandle> {
    const out = await this.inner.runDeepResearch(cred, brief, opts);
    await this.rec.record({ userId: this.userId, operation: "deep_research", provider: this.inner.id as ProviderId, model: this.model("deep_research"), ts: this.now() });
    return out;
  }
  pollDeepResearch(cred: Credential, handle: DeepResearchHandle) {
    return this.inner.pollDeepResearch(cred, handle);
  }
  understandImage<T = unknown>(cred: Credential, imageRef: string, prompt: string, jsonSchema?: object) {
    return this.inner.understandImage<T>(cred, imageRef, prompt, jsonSchema);
  }
  understandDocument<T = unknown>(cred: Credential, fileRef: string, jsonSchema: object) {
    return this.inner.understandDocument<T>(cred, fileRef, jsonSchema);
  }
}

export class RecordingProviderRegistry implements ProviderRegistry {
  constructor(
    private readonly inner: ProviderRegistry,
    private readonly recorder: UsageRecorder,
    private readonly now: () => string,
  ) {}

  async forTask(userId: string, task: string): Promise<{ provider: LLMProvider; cred: Credential }> {
    const { provider, cred } = await this.inner.forTask(userId, task);
    return { provider: new RecordingProvider(provider, this.recorder, userId, task, this.now), cred };
  }
}
