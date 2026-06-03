---
name: build-pitch-deck
description: Build the AgentBuff Co-Founder Pitch Deck as a 16:9 landscape PDF via constrained HTML/CSS → headless Chromium (Paged.js). Use when the user/engine requests a "pitch deck" for a project.
---

# Skill: Build Pitch Deck (PDF)

**Goal:** turn a project's structured data into a compelling **investor Pitch Deck PDF** (16:9 landscape), one idea per slide, big type, visual-first.

## Hard rules (from PRD §9.5, §9.3, §9.2)
- **Numbers are bound, never invented.** Financial figures come from the Financial Engine (`financials_result`). Do NOT compute/alter numbers here.
- **Template-Constrained Generation.** The LLM fills **structured JSON slots** per slide (see `docs/PRD-AgentBuff-CoFounder.md` §20.4 `deck_slot_content`); it does NOT free-write HTML. Validate against schema.
- **One idea per slide, short punchy lines, large font, visuals dominate.**
- **Brand tokens** drive theme; insert BrandKit logo/imagery. Embed fonts.

## Slide structure (Sequoia/YC canon — PRD §2.4 / §9.5.4)
Cover → Problem → Solution → Why Now → Market (TAM/SAM/SOM) → Product → Business Model → GTM/Traction → Competition/Moat → Team → Financials → The Ask.

## Inputs
- `project` profile, `financials_result`, `research_summary` + citations, `brand_tokens`, `template` (e.g. sequoia_classic | modern_minimal).

## Steps
1. Load brand tokens + financial numbers + research.
2. LLM (via Provider Abstraction Layer, Structured Outputs) fills the **deck slot schema** — headlines + supporting points only; numbers injected.
3. Inject slots + tokens into a 16:9 HTML template; Paged.js for slide pagination.
4. Render HTML → PDF (headless Chromium worker).
5. Post-process: metadata, compress images, store, return signed URL. Optional speaker notes.

## Output language
Bahasa Indonesia, persuasive and concise.

## Quality checklist before returning
- [ ] Financials match the engine exactly; "The Ask" is consistent with the plan.
- [ ] One idea per slide; minimal text; readable type sizes.
- [ ] Market claims cite sources; estimates labelled.
- [ ] Brand theme applied; 16:9 aspect; no overflow.

> Default path is this deterministic template + render. CLI agent (Gemini/Antigravity/Codex) = OPTIONAL/fallback behind `DocAgentRunner` (PRD §9.5.2.1, §12.12).
