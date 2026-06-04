# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Source of truth = [docs/PRD-AgentBuff-CoFounder.md](docs/PRD-AgentBuff-CoFounder.md) (v1.2, ~2,400 lines).** Read the relevant PRD section before any non-trivial work. This file is the *distilled non-negotiables + architecture map*, not a replacement for the PRD. Keep it short and current. Section refs below (e.g. §9.3) point into the PRD.

## WHY
AI **Co-Founder** web app (PWA) for Indonesian solopreneurs / UMKM with no business background — takes them from raw idea → validated research → business plan + financial model → brand identity → investor-grade proposal & pitch deck. Part of the **AgentBuff** suite (POS, Absent, Agentic). **Free, multi-provider BYOK** (Gemini API key / OpenAI API key). NOTE: "Sign in with ChatGPT"/Codex is NOT offered — OpenAI's official docs confirm it's unavailable to third-party apps (only their own Codex CLI/IDE/app); pasting the `~/.codex/auth.json` token is explicitly discouraged. Backend keeps a dormant `openai_codex` type but it is not surfaced in the UI. **MCP-native** (the engine is a callable backend for external agents, not just a UI). See §1, §1.5.

## WHAT (v1 scope — §9)
Six modules: (1) Auth & Onboarding, (2) Deep Research & Validator, (3) Master Business Planner, (4) Brand Forge Studio, (5) Deck & Docs Engine, (6) AgentBuff Agent Gateway (MCP). Golden path is **linear & guided**: each module inherits the previous module's context (§8).

## NON-NEGOTIABLE RULES (never violate)
- **LLM Proposes, Code Disposes.** ALL financial math (HPP, margin, contribution margin, BEP, ROI, payback, projections, NPV/IRR) is computed by a deterministic, unit-tested engine. An LLM must NEVER produce or alter a number — it only proposes assumptions/narrative; numbers are *injected* into narrative/PDFs via template binding. (§9.3, §3.3)
- **Verifiable sources.** Every factual/market claim carries a **clickable source** (`url_citation` → chip with favicon + domain, opens new tab). Claims with no grounded source are labelled **"estimasi"** and visually distinguished. The deterministic `ValidationScore` (0–100) is computed in code from structured signals — the LLM never invents the score. (§9.2.1, §9.2.4, §12.9)
- **Provider-agnostic.** All LLM calls go through the **Provider Abstraction Layer (`LLMProvider`)** in [src/lib/ai/](src/lib/ai/). Never call a vendor SDK directly from business/UI code. Both Gemini (`google_search`) and OpenAI (`web_search`) emit `url_citation` → normalize to ONE [Citation](src/lib/ai/types.ts) type. (§12.14)
- **Never hardcode model names or endpoints.** They live ONLY in [src/lib/ai/model-routing.ts](src/lib/ai/model-routing.ts) (config). The IDs there are placeholders captured 2026-05-30 — **verify against official docs before production** (§12.7–§12.16, §20.6–§20.7). Gemini/OpenAI/Codex APIs change fast; read the docs first (use the **context7** MCP for live docs).
- **Headless == UI.** Every UI capability has MCP parity via the **same engine** — "Single Engine, Multi-Adapter". No business logic in adapters. (§9.6, §10.1)
- **Secrets.** BYOK keys/tokens are envelope-encrypted (KMS), decrypted in-memory ONLY at call time, **never logged, never persisted as plaintext, never committed**. Store a fingerprint hash only. No secrets in this repo or this file. (§13.1)
- **User-facing copy = Bahasa Indonesia**, warm, supportive, jargon-free, with tap-to-reveal just-in-time glossary (HPP, BEP, TAM…). (§14.8)

## ARCHITECTURE (the big picture — read before structural changes)
**Single Engine, Multi-Adapter** (§10.1). Business logic lives in the engine/service layer; UI (REST/tRPC), the MCP server, and the SSO/Webhook endpoint are thin adapters over it. UI↔MCP parity comes from *sharing the engine*, never from duplicating logic.

Three abstraction seams — **do not bypass any of them**:
1. **`LLMProvider`** ([src/lib/ai/llm-provider.ts](src/lib/ai/llm-provider.ts)) — the only door to any LLM vendor. Adding a provider = one thin adapter, zero business-logic changes.
2. **`model-routing.ts`** — the only place model IDs live. `resolveModel(taskClass, provider)` maps a `TaskClass` (`parse_fast` · `deep_research` · `grounded_light` · `reasoning_heavy` · `image_gen` · `vision` · `doc_understanding` · `doc_agent`) × provider → a model string. Deprecation = a config edit, not a refactor. (§12.2, §12.14.5)
3. **`DocAgentRunner`** — CLI-agnostic doc generation. Target Gemini CLI now, Antigravity CLI later (transition ~2026-06-18) without touching the docs module. Default path is non-agent **Template-Constrained Generation** (LLM fills JSON slots → server renders); the CLI agent is optional/fallback. (§9.5.2.1, §12.12)

Principles that shape every module:
- **Deterministic core, AI at the edges.** Financial Engine + ValidationScore are pure, side-effect-free, framework-agnostic code (no I/O, no LLM). LLM handles language understanding, grounded research, and generation only.
- **Async-first.** Research / plan / brand image / PDF render run as BullMQ jobs with `background=true` + streamed progress events. Never hold a sync HTTP request or block the UI > 10s. (§10.3, §15.1)
- **Structured Outputs everywhere.** Anything code consumes uses a JSON Schema (Gemini `responseSchema` / OpenAI `text.format` strict). One canonical schema set (§20.4) mapped per provider in the adapter; validate output before use. (§12.3)
- **Staleness propagation.** Modules inherit upstream context; when an upstream artifact changes, downstream artifacts are flagged "perlu diperbarui" — **no silent overwrite**; the user chooses when to update. (§9.3.7)
- **Capability detection, not assumption.** On key validation, detect actual capabilities (grounded search, deep research, image gen — OpenAI image needs Org Verification, etc.) and adjust features + routing; hide/disable unavailable features with a friendly explanation. (§12.14.4)

Where things live (target layout — see [docs/REPO-STRUCTURE.md](docs/REPO-STRUCTURE.md)). **No vendor SDK calls in `app/` or `engine/`; financial numbers are born only in `engine/financial/`; `api/` and `mcp/` call the same engine:**
- [src/lib/ai/](src/lib/ai/) — PAL (exists, stubs) · `src/server/engine/{financial,research,brand,docs}` — the engine (to build) · `src/server/api/` + `src/server/mcp/` — adapters · `workers/` — PDF render (headless Chromium + Paged.js, isolated) · `prisma/schema.prisma` — data model (Project is the aggregate root; artifacts = relational rows + JSONB) · `tests/unit/financial-engine/` (**mandatory 100%**) + `tests/contract/providers/` (Gemini↔OpenAI parity).

## CURRENT STATE (Fase 1 → Fase 2, the golden path is end-to-end)
**Full map: [docs/IMPLEMENTATION-STATUS.md](docs/IMPLEMENTATION-STATUS.md) · run/test: [docs/RUNNING.md](docs/RUNNING.md).** Status: **260 tests passing · 100% coverage on all deterministic engines (financial, research scoring + signals, brand palette) · `tsc` strict clean · `next build` green.** Persistence auto-switches: **Postgres (Prisma) when `DATABASE_URL` is set** (verified against the isolated VPS DB `agentbuff_cofounder`), else in-memory. Auth = Google (Auth.js, real user persisted on sign-in); **login required — no guest sessions** (`google:<sub>` is the only identity).

**Done & tested (all five modules + gateway, the full golden path Research→Plan→Brand→Docs):**
- **Engines (100%):** Financial + ValidationScore + research **signal derivation** ([engine/research/signals.ts](src/server/engine/research/signals.ts)) + deterministic **scenarios** (P/R/O) + **brand palette** (color/HSL/contrast).
- **Trust/security:** fail-closed secrets ([env.ts](src/server/env.ts)), CSP/security headers, retry+backoff, LLM-output schema validate+repair, prompt-injection isolation, CSRF same-origin guard, HTML sanitizer.
- **Module 2 — Deep Research:** multi-stage grounded pipeline (Jalur B, stages 0–6) with deterministic scoring, SSE progress stepper, rich report UI (competitors/pricing/risks/resources + clickable citations + "estimasi").
- **Module 3 — Planner:** scenarios + cash-flow chart + staleness propagation.
- **Module 4 — Brand Forge:** BrandService (direction/naming/voice + deterministic palette) + real image-gen adapters (Gemini Nano Banana, OpenAI gpt-image).
- **Module 5 — Deck & Docs:** Template-Constrained Generation → sanitized A4 proposal + 16:9 deck HTML → print/PDF.
- **Module 6 — MCP Gateway:** Streamable-HTTP JSON-RPC, hashed bearer PAT auth, **granular per-tool scopes** (read/write), audit log, 9 tools, token mgmt UI.
- **Cross-cutting:** BYOK usage/cost tracking (recording-registry decorator), UU PDP **data export + account erasure**, just-in-time **glossary**, ObjectStorage + JobQueue seams ([storage/](src/server/storage/), [jobs/](src/server/jobs/)).

**Setup notes:** pnpm uses `node-linker=hoisted` ([.npmrc](.npmrc)) so Turbopack resolves on Windows; `next.config.ts` pins `turbopack.root`. Tailwind v4 (CSS-first). Prisma schema changes go through **versioned migrations** against the isolated VPS DB — `node scripts/with-env.mjs pnpm exec prisma migrate deploy` (loads `.env.local`). **Never `db push`** on a populated DB (drops data). See [docs/INFRA-SETUP.md](docs/INFRA-SETUP.md).

**Remaining (infra/spec-completion, behind seams):** live BullMQ/Redis + S3 backends (in-memory seams exist); headless-Chromium server-side PDF worker (browser print works today); full OAuth 2.1 AS + DCR/PKCE (PAT bearer + scopes work today); MCP resources/prompts; Deep Research **Jalur A** (Interactions/Responses async agents — 501 stubs); context caching + Batch API; richer analytics. The I/O boundaries sit behind interfaces with in-memory/test impls; they go live when credentials/infra are provided.

## STACK & CONVENTIONS (confirm against §10 before changing)
- **Web:** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui. PWA, **mobile-first (design from 360px up;** breakpoints 360/768/1024/1440). TanStack Query, streaming UI (SSE).
- **Data:** PostgreSQL + Prisma, Redis, BullMQ (async jobs), S3-compatible object storage (expiring URLs). Region: asia-southeast2 (Jakarta), per UU PDP. (§13.4)
- **AI:** PAL → `GeminiAdapter` (Interactions API for Deep Research + `generateContent`) and `OpenAIAdapter` (Responses API). Context caching + Batch API to protect the user's BYOK quota. (§12.4)
- **MCP:** official TS SDK; Streamable HTTP, JSON-RPC 2.0, OAuth 2.1 + PKCE, granular per-tool scopes; same engine as the web API. (§10.5)
- **Docs/PDF:** deterministic template + Skill (HTML/CSS + Paged.js → headless Chromium) by default; CLI agent behind `DocAgentRunner` as optional/fallback.

## SKILLS & SUBAGENTS (in `.claude/`)
**Project document Skills** (engine-native, provider-neutral): `build-proposal` (A4 portrait) and `build-pitch-deck` (16:9 landscape) — both render via constrained HTML/CSS → Paged.js → Chromium. They fill **structured JSON slots** for a fixed template (never free-write HTML), bind every number from the Financial Engine output, and keep citations clickable.

**Subagents** (delegate matching work to them): `financial-engine` (deterministic, test-first, refuses to let an LLM produce numbers) and `api-integrator` (reads official docs first via context7, never hardcodes models, normalizes citations). The Agent tool exposes these as `subagent_type`.

**UI/UX skill suite** — installed from `nextlevelbuilder/ui-ux-pro-max-skill` into `.claude/skills/`: `ui-ux-pro-max` (flagship), `design`, `design-system`, `ui-styling`, `brand`, `banner-design`, `slides`. See the UI/UX workflow below.

## UI/UX WORKFLOW (use the skill — required for any interface work)
For ANY task that changes how a feature **looks, feels, moves, or is interacted with** (new pages/components, styling, color/type, layout, animation, a11y, or UI review), **use the `ui-ux-pro-max` skill** — it auto-activates, and the flagship ships a searchable design-intelligence engine (Python 3 required; verified working with 3.14):
- Start with a tailored design system: `python .claude/skills/ui-ux-pro-max/scripts/search.py "<product> <industry> <keywords>" --design-system -p "AgentBuff Co-Founder"` (add `--persist` to write `design-system/MASTER.md` for reuse across sessions; add `--page "<name>"` for page-level overrides).
- Drill in as needed: `--domain <product|style|color|typography|ux|chart|landing|google-fonts>` and `--stack <stack>`.
- **Our stack is WEB** (Next.js + React + Tailwind + shadcn/ui) — the skill's examples sometimes default to React Native, so pass the right `--stack` and lean on the `ui-styling` skill for shadcn/ui + Tailwind specifics.
- **Project UI/UX guidelines win on conflict.** PRD §14 is product-specific and authoritative: mobile-first 360px, one dominant primary CTA per screen with action-specific Bahasa labels (e.g. "Validasi Ide Saya", not "Submit"), **meaningful AI loading states — never an empty spinner** (show real pipeline stages, stream narrative, partial results, cancelable, cost-aware confirms), per-slot shimmer for image gen, WCAG AA, ≥44px touch targets, glossary popovers, honest-but-encouraging tone. Use the skill for craft; defer to §14 for product behavior.

## WORKFLOW & MILESTONES
- **Explore → Plan → Implement → Commit.** Use **plan mode** and show the plan; wait for approval before large changes (scaffolding, engine, schema).
- Build in **milestones per §18**: Fase 0 Foundation → 1 Core Value (text-centric golden path: research → plan → PDFs) → 2 Creative & Polish (Brand Forge) → 3 Agentic/MCP → 4 GA. **Provider order: Gemini first → OpenAI adapter → Codex.**
- **Definition of Done (§18.4):** UI (responsive + a11y) *and* MCP parity where relevant; numbers from the deterministic engine; factual claims grounded; loading/empty/error states; instrumented; AI eval/QA; no key/PII leak.
- **Tests:** 100% unit coverage for the Financial Engine; contract tests per provider adapter (Gemini↔OpenAI parity); validate every LLM output against its JSON Schema; golden-path E2E. (§12.6, §15.4)

## COMMANDS
- dev: `pnpm dev` · build: `pnpm build` (`next build`, runs TS check) · start: `pnpm start`
- test: `pnpm test` (single file: `pnpm test <path>`; by name: `pnpm test -t "<name>"`) · coverage: `pnpm test:cov` (engines gated at 100%) · typecheck: `pnpm typecheck`
- Prisma: `pnpm exec prisma validate` · (with a real DB) `pnpm exec prisma migrate dev`
- UI/UX design-system query: `python .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system`

Note: PowerShell cmdlets are blocked via the Bash tool (project policy) — use the dedicated file/search tools or POSIX commands instead.
