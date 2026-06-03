<div align="center">

# 🤝 AgentBuff Co-Founder

### Your AI Co-Founder — from a raw idea to investor-ready business.
**Co-Founder AI yang mendampingimu dari ide mentah hingga rencana, brand, & dokumen siap investor.**

<br/>

[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tests](https://img.shields.io/badge/tests-130%20passing-22c55e)](#-quality--testing)
[![Engine coverage](https://img.shields.io/badge/financial%20engine-100%25%20covered-6366F1)](#-quality--testing)
[![MCP](https://img.shields.io/badge/MCP-native-818CF8)](#-mcp--headless--ui)
[![BYOK](https://img.shields.io/badge/BYOK-Gemini%20%7C%20OpenAI%20%7C%20Codex-059669)](#-byok--bring-your-own-key)

</div>

---

> **AgentBuff Co-Founder** turns *"I have a business idea but don't know where to start"* into a **validated research report, a deterministic financial model, a brand identity, and investor-grade documents** — in hours, free, using your own AI key. It is built **mobile-first, in Bahasa Indonesia**, for the 65M+ Indonesian solopreneurs & UMKM. Part of the **AgentBuff** suite.

---

## ✨ Why it's different

Most "AI business" tools just let ChatGPT make up numbers. AgentBuff Co-Founder is built on one hard rule:

> ### 🧮 **"LLM Proposes, Code Disposes."**
> Every financial number — HPP, margin, BEP, ROI, payback, NPV/IRR, projections — is computed by a **deterministic, 100%-unit-tested engine**. An LLM never produces or alters a number. It only proposes assumptions and narrative; the math is auditable and reproducible.

Plus three more non-negotiables:

| | Principle | What it means |
|---|---|---|
| 🔗 | **Verifiable by default** | Every market claim carries a **clickable source** (`url_citation` → chip). No source → labelled **"estimasi"**. |
| 🔌 | **Provider-agnostic (BYOK)** | All AI goes through a **Provider Abstraction Layer**. Bring your **Gemini / OpenAI / Codex** key — the app costs ~0 to run. |
| 🤖 | **MCP-native** | Every capability is callable **headless** by external agents (Claude, ChatGPT, Cursor…) via Model Context Protocol — *headless == UI*. |
| 🔒 | **Secrets are sacred** | BYOK keys are **envelope-encrypted** (AES-256-GCM), decrypted in-memory only, never logged, never committed. |

---

## 🧩 The six modules

| # | Module | What it does |
|---|---|---|
| 1️⃣ | **Auth & Onboarding** | Frictionless sign-in + guided BYOK key validation (real liveness + capability detection). |
| 2️⃣ | **Deep Research & Validator** | Grounded market research → LLM proposes signals → **deterministic 0–100 Validation Score** + clickable sources. |
| 3️⃣ | **Master Business Planner** | A financial intake wizard → **deterministic engine** (HPP→BEP→projections→payback/ROI/NPV/IRR) → LLM writes the plan with numbers injected. |
| 4️⃣ | **Brand Forge Studio** | Positioning, naming, tone, palette & typography, moodboard, logo concepts (Nano Banana / gpt-image, BYOK). |
| 5️⃣ | **Deck & Docs Engine** | Investor-grade **Business Proposal (A4)** & **Pitch Deck (16:9)** PDFs via template-constrained HTML/CSS → Paged.js → Chromium. |
| 6️⃣ | **AgentBuff Agent Gateway (MCP)** | The whole engine, callable by AI agents over Model Context Protocol. |

---

## 🏗️ Architecture — *Single Engine, Multi-Adapter*

Business logic lives in one engine; the UI, the MCP server, and webhooks are **thin adapters** over it. The deterministic core sits at the center; AI lives at the edges.

```
        Web App (PWA)            External AI Agents            Partner SSO
        REST / Route Handlers    MCP over Streamable HTTP      Webhook / OIDC
                 \                       |                        /
                  \                      |                       /
                   ▼                     ▼                      ▼
        ┌───────────────────────────────────────────────────────────────┐
        │                    ENGINE / SERVICE LAYER                      │
        │   FinancialEngine (deterministic, 100% tested) · ValidationScore │
        │   ProjectService · ResearchService · PlannerService            │
        │   ── Provider Abstraction Layer (LLMProvider) ──►  Gemini / OpenAI │
        │   ── BYOK Key Vault (envelope encryption) ──                    │
        └───────────────────────────────────────────────────────────────┘
                   │            │             │              │
              PostgreSQL     Redis        Object Store    PDF Worker
              (Prisma)     (BullMQ)        (S3-compat)   (Chromium)
```

**Three abstraction seams** keep it future-proof: `LLMProvider` (the only door to any vendor), `model-routing.ts` (the only place model IDs live), and `DocAgentRunner` (CLI-agnostic doc generation).

---

## 🚀 Quick start

> **Zero infra required** — runs end-to-end on your laptop with an in-memory runtime + signed-cookie session. (Add Postgres & Google OAuth later for production.)

```bash
pnpm install
pnpm dev            # → http://localhost:1717
```

Then:
1. Open **http://localhost:1717** → **Onboarding**.
2. (Optional, for AI features) paste a free **Gemini** key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — it's validated live and stored encrypted on your session.
3. Create a project → run **Validasi Ide** (grounded) & **Susun Plan** (deterministic numbers + AI narrative).

**Works without any key:** the full financial calculator, the interactive validation-score tool, and project creation. See [`docs/RUNNING.md`](docs/RUNNING.md) for details.

### 🔑 BYOK — Bring Your Own Key
The app never needs an AI key of its own. You bring **Gemini**, **OpenAI**, or **Codex** — your quota covers the compute (Gemini's free tier is generous), and your key is envelope-encrypted and never logged.

---

## 🧪 Quality & testing

```bash
pnpm test           # 130 unit / contract tests
pnpm test:cov       # deterministic engines gated at 100%
pnpm typecheck      # tsc --strict, clean
pnpm build          # next build (also type-checks)
pnpm exec prisma validate
```

- **100% coverage** (statements / branches / functions / lines) on the Financial Engine **and** the Validation-Score engine.
- The Financial Engine was **hardened by an adversarial multi-agent review** (caught & fixed an IRR-bracket bug and a numeric-overflow edge case).
- Provider adapters have **mocked-`fetch` contract tests**; the MCP catalog has a full end-to-end flow test.

---

## 🔌 MCP — *headless == UI*

External agents get the exact same engine as the web app, via the **AgentBuff Agent Gateway**:

```
agentbuff.create_project · agentbuff.list_projects · agentbuff.get_project
agentbuff.validate_idea  · agentbuff.calculate_financials (deterministic, no LLM)
agentbuff.generate_business_plan
```

`calculate_financials` is pure and deterministic — agents get auditable numbers with zero hallucination.

---

## 📂 Project structure

```
src/
  app/                      # Next.js App Router — UI + API routes (the "adapter")
  server/
    engine/financial/       # Deterministic Financial Engine (100% tested)
    engine/research/        # Deterministic Validation-Score engine (100% tested)
    services/               # ProjectService · ResearchService · PlannerService
    mcp/                    # MCP tool catalog + dispatcher
    domain/                 # entities + repositories (in-memory; Prisma-ready)
    runtime.ts · session.ts # no-DB runtime container + signed-cookie session
  lib/
    ai/                     # Provider Abstraction Layer (Gemini/OpenAI adapters, registry)
    crypto/                 # BYOK envelope encryption (AES-256-GCM)
prisma/schema.prisma        # full data model (§11)
docs/                       # PRD (source of truth), IMPLEMENTATION-STATUS, RUNNING
```

---

## 🗺️ Status

| ✅ Done & verified | 🔌 Optional next (needs your infra) |
|---|---|
| Deterministic engines (100%) · BYOK encryption · Gemini + OpenAI adapters · Provider registry · domain + services · full MCP catalog · Prisma schema · Next.js PWA (all 6 modules) · **real end-to-end flow** (link key → project → grounded validate + plan) | Google OAuth login · Postgres persistence (Prisma) · Deep Research / image-gen / PDF-render worker (need live keys + Chromium) |

Full map: [`docs/IMPLEMENTATION-STATUS.md`](docs/IMPLEMENTATION-STATUS.md).

---

## 🛠️ Tech stack

**Next.js 16** (App Router, PWA) · **React 19** · **TypeScript** (strict) · **Tailwind CSS v4** · **Prisma** (PostgreSQL) · **Vitest** · Provider Abstraction Layer over **Gemini API** & **OpenAI Responses API** · **Model Context Protocol**.

---

## 📄 License

[MIT](LICENSE) © 2026 **Nugraha Labib Mujaddid** and **AgentBuff**.

> Disclaimer: financial outputs are estimates based on your assumptions — not guarantees, and not professional financial/legal advice.

<div align="center">
<sub>Built with care for Indonesian founders. 🇮🇩 · Part of the <b>AgentBuff</b> suite.</sub>
</div>
