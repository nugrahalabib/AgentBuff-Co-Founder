# Menjalankan & Menguji AgentBuff Co-Founder

Aplikasi sudah bisa langsung dipakai **tanpa setup database/auth apa pun** (runtime in-memory + session cookie). Auth Google & Postgres bersifat opsional dan ditambahkan nanti.

## Prasyarat
- Node.js 20+ dan pnpm.
- (Opsional, untuk fitur AI) sebuah **API key**: Gemini ([aistudio.google.com/apikey](https://aistudio.google.com/apikey)) atau OpenAI. Free tier Gemini cukup.

## Jalankan
```bash
pnpm install
pnpm dev          # buka http://localhost:1717
```
Build produksi: `pnpm build && pnpm start`.

### (Opsional) .env
Salin `.env.example` → `.env`. Untuk dev, dua nilai yang relevan:
```
AUTH_SECRET="apa-saja-yang-acak"                 # menandatangani cookie sesi
BYOK_MASTER_KEY_BASE64="<32 byte base64>"        # kunci enkripsi BYOK; jika kosong, dibuat acak saat start
# generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
Tanpa `.env` pun aplikasi tetap jalan (memakai default dev + KEK acak per-restart).

## Alur uji (end-to-end)
1. **Landing** (`/`) → **Mulai** → **Onboarding** (`/onboarding`).
2. **Tautkan API key**: pilih Gemini/OpenAI, tempel key, **Validasi key**. Key divalidasi nyata ke provider, lalu disimpan terenkripsi pada sesimu. → **Lanjut ke Dashboard**.
3. **Dashboard** (`/dashboard`): ketik ide bisnis → **Buat Project**.
4. **Workspace project** (`/project/<id>`):
   - **Jalankan Validasi (AI)** → riset pasar *grounded* dengan key-mu → skor kelayakan **deterministik** + rekomendasi + **sumber yang bisa diklik**.
   - Isi input keuangan → **Susun Plan** → angka dari engine deterministik + narasi plan dari AI (angka disuntik, bukan dikarang).

## Yang bekerja TANPA API key
- **Kalkulator Keuangan** (`/calculator`) — model finansial lengkap, deterministik.
- **Validasi Ide interaktif** (`/research`) — skor deterministik via slider sinyal.
- **Brand Forge** (`/brand`) & **Deck & Docs** (`/docs`) — scaffold (generasi butuh key + worker).
- Buat & lihat project.

## Menguji
```bash
pnpm test         # 130 unit/contract test
pnpm test:cov     # engine deterministik di-gate 100%
pnpm typecheck    # tsc strict
pnpm build        # next build (sekaligus TS check)
pnpm exec prisma validate
```

## Catatan
- **Data in-memory**: project/sesi tersimpan di memori proses → reset saat server restart. Untuk persistensi, sambungkan Prisma + Postgres (schema sudah ada di `prisma/schema.prisma`; tukar repo in-memory di `src/server/runtime.ts`).
- **Auth**: sesi tamu via cookie bertanda-tangan. Untuk login Google, pasang Auth.js + isi `GOOGLE_CLIENT_ID/SECRET` (PRD §9.1).
- **Fitur AI berat** (Deep Research penuh, generasi gambar, render PDF) masih stub yang jelas — butuh key live & Chromium; lihat [IMPLEMENTATION-STATUS.md](IMPLEMENTATION-STATUS.md).
