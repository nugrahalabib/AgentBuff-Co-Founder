// scripts/gen-icons.mjs — regenerate all app icons from the brand logo source.
//   node scripts/gen-icons.mjs ["<path to source png>"]
// The source is a square transparent PNG of the mascot mark. We place it on a white tile (so the dark
// mark stays crisp on any browser-tab / theme / launcher background) at a few sizes:
//   src/app/icon.png        → Chrome tab favicon (Next file convention)
//   src/app/apple-icon.png  → iOS home-screen icon
//   public/icon-{192,512}.png + icon-maskable.png → PWA manifest
//   public/logo-mark.png    → transparent mark for in-app use on custom backgrounds
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = process.argv[2] ?? "C:/Users/nugra/Documents/Project/Agentbuff-App/LOGO APP/Logo - CoFounder AgentBuff.png";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

async function tile(size, out, { logoFrac = 0.76 } = {}) {
  const inner = Math.round(size * logoFrac);
  const logo = await sharp(SRC).trim().resize(inner, inner, { fit: "contain", background: CLEAR }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: WHITE } })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(out);
  console.log("wrote", out.replace(ROOT, "."));
}

await tile(512, join(ROOT, "src/app/icon.png"));
await tile(180, join(ROOT, "src/app/apple-icon.png"), { logoFrac: 0.82 });
await tile(192, join(ROOT, "public/icon-192.png"));
await tile(512, join(ROOT, "public/icon-512.png"));
await tile(512, join(ROOT, "public/icon-maskable.png"), { logoFrac: 0.6 }); // extra safe-zone for masking
await sharp(SRC).trim().resize(256, 256, { fit: "contain", background: CLEAR }).png().toFile(join(ROOT, "public/logo-mark.png"));
console.log("done");
