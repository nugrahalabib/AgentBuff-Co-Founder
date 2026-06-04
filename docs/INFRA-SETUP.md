# Infrastructure Setup — turning on the config-driven backends

Everything below is **optional** and **config-driven**: the app runs fully without any of it (in-memory
runtime, local-disk storage, in-browser PDF print). Set the env var and the corresponding real backend
activates automatically — no code changes. Put these in `.env.local` (gitignored).

> The app auto-detects each backend the same way persistence auto-switches: present → use it, absent → fall back.

## Database migrations (data safety) — PRD §13.4
**Never run `prisma db push` against a database that has real user data** — it can drop columns/data on a
rename or type change. The project uses **versioned migrations** (`prisma/migrations/`, baselined):

```bash
pnpm db:status     # show migration state
pnpm db:migrate    # dev: create + apply a new migration after editing schema.prisma (reviewable SQL)
pnpm db:deploy     # prod: apply committed migrations only — never drops, no --accept-data-loss
```

Commit every generated migration and code-review its SQL. `db push` is allowed ONLY for throwaway local
sketching against an empty DB. Existing logged-in users keep their data across schema changes this way.

## Core (already wired)
| Var | Purpose | Fallback if unset |
|---|---|---|
| `DATABASE_URL` | PostgreSQL (Prisma). | In-memory repos (data resets on restart). |
| `AUTH_SECRET` | Signs Auth.js sessions. Generate: `openssl rand -base64 32`. | Dev fallback (throws in production). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google sign-in. See [AUTH-SETUP.md](AUTH-SETUP.md). | Guest signed-cookie sessions only. |
| `BYOK_MASTER_KEY_BASE64` | Master key wrapping BYOK secrets (envelope encryption). 32 bytes base64. | Ephemeral key (throws in production). |

## Object storage (brand images, rendered PDFs) — PRD §10.2, §9.4.7
Default is **durable local disk** (`.data/storage`, zero setup). To use S3-compatible storage (MinIO, R2, AWS S3 — region `ap-southeast-2` per UU PDP):
| Var | Example |
|---|---|
| `STORAGE_S3_BUCKET` | `agentbuff-cofounder` |
| `STORAGE_S3_REGION` | `ap-southeast-2` |
| `STORAGE_S3_ENDPOINT` | (optional, for MinIO/R2) `https://<account>.r2.cloudflarestorage.com` |
| `STORAGE_S3_ACCESS_KEY_ID` / `STORAGE_S3_SECRET_ACCESS_KEY` | credentials |
| `STORAGE_S3_URL_TTL` | presigned URL lifetime in seconds (default `3600`) |
| `STORAGE_DIR` | override the local disk dir (default `./.data/storage`) |

When all three required S3 vars are set, `createObjectStorage()` uses S3 (with expiring presigned URLs); otherwise disk.

## Async jobs (long Deep Research / batch) — PRD §10.3
| Var | Purpose |
|---|---|
| `REDIS_URL` | e.g. `redis://localhost:6379`. Activates the Redis-backed job-state queue (multi-instance progress). Unset → in-memory queue. |

## Server-side PDF rendering — PRD §9.5
Headless Chromium (Puppeteer) is **already installed**, so `GET /api/projects/<id>/docs/<docId>/pdf` renders a real
PDF. If Chromium is missing in your deploy, run `pnpm exec puppeteer browsers install chrome`; until then the route
returns 503 and users use the in-browser **Cetak / Simpan PDF** (always available).

## Deep Research (Jalur A, async agents) — PRD §12.8/§12.15
| Var | Purpose |
|---|---|
| `GEMINI_API_REVISION` | Interactions API revision header (default `2026-05-20`). **Verify against current docs before production** (§12.13). |

Jalur A runs on the user's BYOK key (Gemini Interactions / OpenAI Responses background). The always-available
**Jalur B** custom grounded pipeline needs no extra config.

## MCP gateway auth
Tokens (PAT, hashed) work out of the box. For OAuth 2.1 clients, discovery is automatic via
`/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`; clients self-register
(`/api/oauth/register`), authorize with PKCE (`/api/oauth/authorize`), and exchange (`/api/oauth/token`).
