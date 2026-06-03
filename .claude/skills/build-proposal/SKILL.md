---
name: build-proposal
description: Build the AgentBuff Co-Founder Business Proposal as an A4 portrait PDF via constrained HTML/CSS → headless Chromium (Paged.js). Use when the user/engine requests a "proposal" document for a project.
---

# Skill: Build Business Proposal (PDF)

**Goal:** turn a project's structured data into a clean, investor-grade **Business Proposal PDF** (A4 portrait, table of contents, page numbers), on-brand and with accurate numbers.

## Hard rules (from PRD §9.5, §9.3, §9.2)
- **Numbers are bound, never invented.** Pull every financial figure from the Financial Engine output (`financials_result`) / resource `agentbuff://project/{id}/financials`. Do NOT compute or alter numbers here.
- **Template-Constrained Generation.** The LLM fills **structured JSON slots** for a fixed template; it does NOT free-write raw HTML. Validate slot JSON against the schema before rendering.
- **Sources stay clickable.** Market claims keep their citations; unsourced claims show "estimasi".
- **Brand tokens** (colors/typography from BrandKit) drive the CSS. Embed fonts.

## Document structure (PRD §2.4 / §9.5.4)
Cover → Ringkasan Eksekutif → Latar Belakang → Solusi/Usaha → Analisis Pasar → Strategi Pemasaran → Operasional → Tim → Rencana Keuangan (tabel + KPI) → Risiko & Mitigasi → Roadmap → Penutup/Lampiran. Include TOC + page numbers.

## Inputs
- `project` profile, `financials_result` (from engine), `research_summary` + citations, `brand_tokens`.

## Steps
1. Load brand tokens + financial numbers + research (with citations).
2. Ask the LLM (via the Provider Abstraction Layer, Structured Outputs) to fill the **proposal slot schema** (see `docs/PRD-AgentBuff-CoFounder.md` §20.4 `deck_slot_content`-style schema; adapt for proposal sections). Narrative only — numbers are injected, not generated.
3. Inject slots + tokens into the HTML template (A4 portrait). Apply Paged.js for pagination/TOC/page numbers.
4. Render HTML → PDF with headless Chromium (server worker).
5. Post-process: PDF metadata, compress images, store to object storage, return signed URL.

## Output language
Bahasa Indonesia, formal but clear.

## Quality checklist before returning
- [ ] All numbers match the engine output exactly.
- [ ] Every market claim has a clickable source; estimates are labelled.
- [ ] TOC + page numbers present; no broken layout/overflow.
- [ ] Brand colors/fonts applied; images compressed; file size reasonable.

> Default path is this deterministic template + render. A full CLI agent (Gemini/Antigravity/Codex) is OPTIONAL/fallback behind `DocAgentRunner` (PRD §9.5.2.1, §12.12).
