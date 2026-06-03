# Auth & Credentials Setup

The app works **out of the box** with a guest session + your BYOK key. This doc covers the optional production upgrades.

## 1) BYOK providers (what users link in Onboarding)
Three options on `/onboarding` (key/token validated live, then stored **envelope-encrypted**):

| Provider | What to paste | Where to get it |
|---|---|---|
| **Gemini API key** (recommended) | `AIza…` | https://aistudio.google.com/apikey (free tier) |
| **OpenAI API key** | `sk-…` | https://platform.openai.com/api-keys |
| **Codex — Sign in with ChatGPT** | a Codex/ChatGPT **access token** | run `codex login` (Codex CLI), then copy the access token · https://developers.openai.com/codex/ |

> Note (PRD §12.16 / R19): full *interactive* ChatGPT OAuth (browser redirect) is intended for the **desktop/CLI** mode. In the hosted web app, Codex is supported as a **token paste** (`oauth_token`), validated against the OpenAI Responses API. If your token isn't API-compatible, you'll get a clear error — use a Gemini/OpenAI key instead.

## 2) Google login (NextAuth) — how to get the credentials
The app currently uses a signed-cookie **guest session**. To enable real Google login:

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
