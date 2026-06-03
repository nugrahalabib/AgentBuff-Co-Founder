# Saran Struktur Repo (peta ke PRD §10 — "Single Engine, Multi-Adapter")

> Ini *saran awal*, bukan harga mati. Inti: **logika bisnis terpusat di Engine/Service**, sedangkan **UI, MCP, dan provider AI hanyalah adapter**. Minta Claude Code menyesuaikan saat scaffolding.

```
agentbuff-cofounder/
├── CLAUDE.md
├── docs/
│   └── PRD-AgentBuff-CoFounder.md        # source of truth
├── skills/                               # skill generasi dokumen (provider-netral)
│   ├── build-proposal/SKILL.md
│   └── build-pitch-deck/SKILL.md
├── prisma/
│   └── schema.prisma                     # Project, ByokCredential, ResearchReport, BusinessPlan, BrandKit, Document, UsageEvent (PRD §11)
├── src/
│   ├── app/                              # Next.js (App Router) — UI adapter
│   │   ├── (onboarding)/                 # Auth & Onboarding (PRD §9.1)
│   │   ├── dashboard/
│   │   └── project/[id]/                 # Research / Planner / Brand / Docs views
│   ├── server/
│   │   ├── engine/                       # ENGINE (single source of truth)
│   │   │   ├── financial/                # Deterministic Financial Engine (NO LLM) — 100% unit-tested (PRD §9.3)
│   │   │   ├── research/                 # Validator pipeline + ValidationScore (deterministic) (PRD §9.2)
│   │   │   ├── brand/                    # Brand Forge Studio logic (PRD §9.4)
│   │   │   └── docs/                     # Deck & Docs orchestration + DocAgentRunner (PRD §9.5)
│   │   ├── api/                          # REST/tRPC adapter over the engine
│   │   └── mcp/                          # MCP server adapter — SAME engine (PRD §9.6, §10.5)
│   ├── lib/
│   │   ├── ai/                           # Provider Abstraction Layer (PAL) — see stubs here
│   │   │   ├── types.ts
│   │   │   ├── llm-provider.ts
│   │   │   ├── gemini-adapter.ts
│   │   │   ├── openai-adapter.ts
│   │   │   └── model-routing.ts
│   │   ├── crypto/                       # envelope encryption for BYOK creds (PRD §13.1)
│   │   └── jobs/                         # BullMQ workers (async AI/PDF jobs)
│   └── ui/                               # design tokens + shared components (PRD §14)
├── workers/                              # PDF render worker (headless Chromium + Paged.js) — isolated (PRD §15.2)
└── tests/
    ├── unit/financial-engine/            # MANDATORY 100% coverage
    └── contract/providers/               # adapter contract tests (Gemini & OpenAI parity)
```

## Prinsip penempatan
- **Tidak ada panggilan vendor SDK di `app/` atau `engine/`** — selalu lewat `lib/ai` (PAL).
- **Angka finansial hanya lahir di `engine/financial/`** (deterministik, teruji). LLM tidak menyentuh angka.
- **`api/` dan `mcp/` memanggil engine yang sama** — paritas UI↔MCP, tanpa duplikasi logika.
- **Rendering PDF dipisah ke `workers/`** agar tidak menelan kapasitas web (cost-center, PRD §15.2, §6.3).
