// scripts/with-env.mjs — run a command with .env.local loaded into the environment.
// Prisma CLI only auto-loads `.env`, but our secrets (DATABASE_URL, …) live in `.env.local`
// (Next.js convention, gitignored). This loads them WITHOUT printing any value, then execs the command.
//   Usage:  node scripts/with-env.mjs prisma db push --skip-generate
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const ENV_FILE = process.env.ENV_FILE ?? ".env.local";
try {
  const raw = readFileSync(ENV_FILE, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
} catch {
  console.error(`[with-env] could not read ${ENV_FILE}; continuing with current environment.`);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === undefined) {
  console.error("[with-env] usage: node scripts/with-env.mjs <command> [...args]");
  process.exit(2);
}
const result = spawnSync(cmd, args, { stdio: "inherit", shell: true });
process.exit(result.status ?? 1);
