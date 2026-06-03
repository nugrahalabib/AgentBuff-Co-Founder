# Implementation Status — AgentBuff Co-Founder

> Living map of PRD → code. Updated as modules land. Legend: ✅ done & tested · 🟡 partial/scaffold · ⛔ needs live infra/credentials (built behind a clean interface, not yet wired to the real service) · ⬜ not started.
> Status at last update: **130 tests passing · 100% coverage on both deterministic engines · `tsc` strict clean · `next build` green (14 routes).** Runs **end-to-end with zero infra** — see [RUNNING.md](RUNNING.md).

## Verified core (deterministic + integration) — ✅
| Area | PRD | Where | Tests |
|---|---|---|---|
| **Deterministic Financial Engine** (HPP, contribution, gross margin, BEP, monthly projections, loan amortization, payback, ROI, NPV, IRR, runway, tax modes, growth models, validation + warnings) | §9.3.5, §20.4 | [src/server/engine/financial/](../src/server/engine/financial/) | 100% cov; hardened by an adversarial multi-agent review (IRR bracket + overflow guard fixed) |
| **Deterministic ValidationScore** (weighted demand/margin/competition/differentiation − regulatory penalty; go/refine/reconsider banding) | §9.2.4 | [src/server/engine/research/](../src/server/engine/research/) | 100% cov |
| **BYOK envelope encryption** (AES-256-GCM, KEK-wraps-DEK, fingerprint; KMS seam) | §13.1 | [src/lib/crypto/](../src/lib/crypto/) | round-trip, tamper, wrong-key, fingerprint |
| **Provider Abstraction Layer** contract (`LLMProvider`, normalized `Citation`) | §12.14 | [src/lib/ai/llm-provider.ts](../src/lib/ai/llm-provider.ts), [types.ts](../src/lib/ai/types.ts) | — |
| **GeminiAdapter** (REST `generateContent`: validateCredential / generateStructured / groundedSearch; grounding → clickable citations) | §12.7–§12.9 | [src/lib/ai/gemini-adapter.ts](../src/lib/ai/gemini-adapter.ts) | mocked-`fetch` contract tests |
| **OpenAIAdapter** (Responses API: validateCredential / generateStructured / groundedSearch; web_search → citations) | §12.15 | [src/lib/ai/openai-adapter.ts](../src/lib/ai/openai-adapter.ts) | mocked-`fetch` contract tests |
| **Provider Registry** (capability-aware selection, default + fallback, in-memory decrypt) | §12.14.4–5 | [src/lib/ai/registry.ts](../src/lib/ai/registry.ts), [credential-store.ts](../src/lib/ai/credential-store.ts) | selection + BYOK errors |
| **MCP tool `calculate_financials`** (wire schema → same engine; headless == UI) | §9.6, §20.3 | [src/server/mcp/tools/calculate-financials.ts](../src/server/mcp/tools/calculate-financials.ts) | parity with engine |
| **Domain model + repositories** (Project, ResearchReport, BusinessPlan, ProjectState; in-memory repo seam) | §11 | [src/server/domain/](../src/server/domain/) | via services |
| **ProjectService** (create/list/state, status flow, artifact linking; injected clock/id) | §8, §11.2 | [src/server/services/project-service.ts](../src/server/services/project-service.ts) | deterministic tests |
| **ResearchService** (grounded → LLM proposes signals → code computes score; carries citations) | §9.2 | [src/server/services/research-service.ts](../src/server/services/research-service.ts) | mock-provider tests |
| **PlannerService** (numbers from engine; LLM writes narrative with numbers injected) | §9.3 | [src/server/services/planner-service.ts](../src/server/services/planner-service.ts) | mock-provider tests |
| **MCP tool catalog + dispatcher** (create/list/get project, validate_idea, generate_business_plan, calculate_financials; ownership isolation) | §9.6.3, §20.3 | [src/server/mcp/](../src/server/mcp/) | full flow tested |
| **Prisma schema** (User, ByokCredential, Project, ResearchReport, BusinessPlan, BrandKit, Document, UsageEvent, McpClient/AuditLog, PartnerFederation) | §11 | [prisma/schema.prisma](../prisma/schema.prisma) | `prisma validate` ✓ |
| **Next.js PWA** — landing, onboarding, dashboard, **wired financial calculator** (UI → `/api/financials` → engine), manifest | §14 | [src/app/](../src/app/) | `next build` ✓ |
| **Real BYOK validation route** (`/api/byok/validate` → adapter.validateCredential, key in-memory only) | §9.1.4 | [src/app/api/byok/validate/](../src/app/api/byok/validate/) | builds |
| **No-DB runtime + signed-cookie session** (in-memory repos on globalThis; BYOK key linked & encrypted per session) | §10.1, §9.1 | [src/server/runtime.ts](../src/server/runtime.ts), [session.ts](../src/server/session.ts) | session tests |
| **Real end-to-end AI flow** — link key → create project → **grounded validate + plan generate** with your BYOK provider | §9.1–§9.3 | [src/app/api/projects/](../src/app/api/projects/), [src/app/project/](../src/app/project/) | builds; live calls need a key |
| **PostgreSQL persistence (Prisma)** — runtime auto-switches to Postgres when `DATABASE_URL` set; isolated DB on the VPS | §10.3, §11 | [src/server/db/](../src/server/db/), [src/server/runtime.ts](../src/server/runtime.ts) | **verified: project persisted to Postgres** |
| **Codex (Sign in with ChatGPT)** — 3rd BYOK provider (`oauth_token`), validated via Responses API | §12.16 | onboarding + [src/app/api/byok/link/](../src/app/api/byok/link/) | builds |
| **Model routing** (config-only model IDs, per task×provider) | §12.2 | [src/lib/ai/model-routing.ts](../src/lib/ai/model-routing.ts) | — |
| **Document Skills** (proposal A4 / pitch-deck 16:9, slot-filled, numbers bound) | §9.5 | [.claude/skills/](../.claude/skills/) | — |

## Next (orchestration & app) — 🟡 / ⬜
| Area | PRD | Status | Note |
|---|---|---|---|
| Service layer — BrandService, DocsService (Brand Forge, Deck & Docs orchestration) | §9.4–§9.5 | ⬜ | engines + PAL; mock-provider tests |
| MCP Streamable-HTTP transport + JSON-RPC + OAuth 2.1 + audit log | §10.5, §9.6.5 | 🟡 | tool catalog + dispatcher done; transport/OAuth ⛔ (needs an auth server) |
| Provider methods: Deep Research (Interactions/o3), image gen (Nano Banana/gpt-image), doc/vision | §12.8, §12.10–11, §12.15 | 🟡 | stubs throw 501 with the exact doc refs; need a live key to verify |
| Doc render → PDF (HTML/CSS + Paged.js → headless Chromium worker) | §9.5.2 | ⛔ | slot-assembly logic testable; Chromium render needs the worker |
| UI deepening: research→real grounded view, planner wizard polish, brand/docs wired to services | §14 | 🟡 | all 6 modules have a UI now; Validasi (deterministic scoring) + Calculator are fully functional; Brand/Docs are scaffolds pending their services |
| **Google login (Auth.js v5)** — wired + verified (providers/csrf OK); guest-session fallback | §9.1 | ✅ | button on /onboarding; provide GOOGLE_CLIENT_ID/SECRET in .env.local |
| SSO/Webhook partner federation | §9.1.3.1 | ⛔ | per-partner signed JWT handoff |
| Redis (BullMQ async jobs) + S3 object storage | §10.3 | ⛔ | for long jobs & artifact storage |

## What "needs infra/credentials" means
These are built (or will be) behind interfaces with in-memory/test implementations, so the logic is unit-tested now and goes live by swapping the implementation once you provide: a Google OAuth client, a Postgres/Redis/S3 endpoint, a KMS key, and (per BYOK) the app never needs an LLM key itself — users bring their own. Nothing here blocks the deterministic core, which is the trust moat and is complete.
