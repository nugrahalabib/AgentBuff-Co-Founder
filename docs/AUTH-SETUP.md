# Auth & Credentials Setup

Sign in with **Google** is required (the old guest session was removed). Persistence auto-switches:
Postgres when `DATABASE_URL` is set, else in-memory. This doc covers the optional production upgrades.

## 1) BYOK providers (what users link in Onboarding)
Three options on `/onboarding` (key/token validated live, then stored **envelope-encrypted**):

| Provider | How to link | Where to get it |
|---|---|---|
| **Gemini API key** (recommended) | paste `AIza…` | https://aistudio.google.com/apikey (free tier) |
| **OpenAI API key** | paste `sk-…` | https://platform.openai.com/api-keys |
| **Codex — Login dengan ChatGPT** | click **Login ChatGPT** → approve in the OpenAI tab | uses your ChatGPT subscription (no API key) |

### Codex / "Sign in with ChatGPT" — the honest constraints (PRD §12.16)
The **Login dengan ChatGPT (Codex)** button runs the real OpenAI Codex OAuth flow (PKCE/S256 against
`auth.openai.com`, public Codex CLI client `app_EMoamEEZ73f0CkXaXp7hrann`). Once linked, AgentBuff serves
the user's LLM calls against the **ChatGPT backend** (`https://chatgpt.com/backend-api/codex/responses`),
so a ChatGPT Plus/Pro subscription can replace a Gemini/OpenAI API key for text reasoning, structured
JSON, and grounded search. Tokens (access + rotating refresh + `chatgpt-account-id`) are stored
envelope-encrypted and refreshed automatically (5-day lead). **It does not expose api.openai.com
features** — image generation, background Deep Research, and vision/doc are gated off for a Codex-only
account (link a Gemini/OpenAI key for those); the registry routes those tasks accordingly.

Two hard limits, by design of OpenAI's Codex client:
1. **Loopback only.** The client only accepts the redirect `http://localhost:1455/auth/callback`. The
   in-browser callback therefore works **only when AgentBuff runs on the same machine as the browser** —
   i.e. local `pnpm dev`, or a self-hosted single-user instance reached over localhost / an SSH tunnel.
   A remote, multi-user hosted deployment **cannot** catch that callback on its server (the `start`
   endpoint returns a clear 503 explaining this). There is no first-party hosted "Sign in with ChatGPT".
2. **ToS grey area.** Driving a personal ChatGPT subscription session programmatically is not a
   sanctioned API use; treat it as use-at-your-own-risk for **your own** account. Prefer an API key for
   anything shared/production.

## 2) Google login (Auth.js / NextAuth v5) — WIRED ✅
Google sign-in is **implemented** (Auth.js v5, JWT session, user id `google:<sub>`; falls back to the
signed-cookie guest session). With the 3 env values set in `.env.local`, the **"Login dengan Google"**
button on `/onboarding` works. How to get the credentials:

1. [console.cloud.google.com](https://console.cloud.google.com) → create/select a **Project**.
2. **APIs & Services → OAuth consent screen** → **External** → fill app name "AgentBuff Co-Founder", support email → save (Testing mode is fine to start).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → **Web application**.
4. **Authorized redirect URIs** → add `http://localhost:1717/api/auth/callback/google` (and your production URL later).
5. Copy the **Client ID** and **Client Secret** into `.env.local`:
   ```
   GOOGLE_CLIENT_ID="…"
   GOOGLE_CLIENT_SECRET="…"
   AUTH_SECRET="<random>"   # node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
   ```
Give those three values and the Auth.js (NextAuth) Google provider gets wired into the existing session.

## 3) Database (PostgreSQL via Prisma)
Persistence is **already wired**. When `DATABASE_URL` is set, the app uses Postgres (Prisma); otherwise it falls back to in-memory.

- A dedicated, isolated database `agentbuff_cofounder` (own role, non-superuser) was created on the VPS Postgres — **separate** from other projects.
- `DATABASE_URL` lives in `.env.local` (gitignored). Schema is applied with `pnpm exec prisma db push`.
- **Local dev** reaches the VPS DB through an SSH tunnel:
  ```bash
  ssh -N -L 55432:localhost:5432 agentbuff-vps     # keep running
  # DATABASE_URL=postgresql://agentbuff_cofounder:<pw>@localhost:55432/agentbuff_cofounder?schema=public
  ```
- **Production** (app running on the VPS): use `…@localhost:5432/agentbuff_cofounder`.

Inspect: `pnpm exec prisma studio` (with the tunnel + DATABASE_URL), or `psql` on the VPS.
