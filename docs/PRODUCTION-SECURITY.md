# Production Security Checklist — sebelum go-live publik

> **Baca ini saat mulai deploy ke publik.** Kode aplikasi sudah lolos audit menyeluruh (tanpa kebocoran
> secret, tanpa IDOR, kripto benar, header keamanan ada). Tapi "aman untuk publik" = **kode + infrastruktur
> + operasional**. Dokumen ini daftar yang HARUS disiapkan di sisi infra/ops. Tidak ada app yang
> "anti-hack" — keamanan itu berlapis & berkelanjutan.

## 0) Status sisi kode (sudah selesai ✅)
- Login wajib (Google), tak ada mode tamu. CSRF same-origin, security headers (CSP/HSTS/nosniff/frame-deny),
  rate-limit per-route, input divalidasi, SSRF dijaga (hanya `data:` URL), XSS di-escape, prompt-injection
  diisolasi, no committed secrets, `server-only` memblokir modul server masuk ke bundle browser.
- BYOK key/token disimpan envelope-encrypted (AES-256-GCM); nol `console.*` di `src/` (tak ada yang di-log).
- Service worker tidak meng-cache response ter-autentikasi; `Cache-Control: no-store` di GET sensitif.

---

## 1) Kunci master BYOK → pakai KMS (PALING PENTING)
**Masalah:** dengan `BYOK_MASTER_KEY_BASE64` di env, kunci ada di mesin yang sama dengan DB → kalau VPS
di-root, penyerang dapat kunci + ciphertext = bisa dekripsi semua API key user.

**Solusi (sudah ada di kode — tinggal konfigurasi):** pakai **KMS** supaya plaintext kunci tak pernah ada
di server. Seam-nya: `KmsMasterKey` (`src/lib/crypto/kms-master-key.ts`), aktif otomatis bila env diisi.

Langkah (AWS KMS; KMS lain = implementasikan `MasterKeyProvider` serupa):
```bash
# 1. Buat KMS key (IAM: hanya role aplikasi yang boleh kms:Decrypt). Catat key id/ARN.
# 2. Generate KEK 32-byte acak, enkripsi dengan KMS, simpan ciphertext base64:
head -c 32 /dev/urandom > kek.bin
aws kms encrypt --key-id <KEY_ID> --plaintext fileb://kek.bin \
  --query CiphertextBlob --output text         # → base64 ciphertext
shred -u kek.bin                                # hapus plaintext KEK lokal
```
Set di env produksi (BUKAN `BYOK_MASTER_KEY_BASE64`):
```
BYOK_KMS_KEY_ID=<key id/ARN>
BYOK_KEK_CIPHERTEXT_B64=<base64 dari langkah 2>
BYOK_KMS_REGION=ap-southeast-2        # atau AWS_REGION
# Kredensial AWS via IAM role / AWS_ACCESS_KEY_ID+SECRET (least-privilege: kms:Decrypt saja)
```
> Tetap simpan `BYOK_KEK_CIPHERTEXT_B64` + akses KMS sebagai rahasia yang di-backup. Tanpa KMS, **JANGAN
> pernah ganti `BYOK_MASTER_KEY_BASE64`** — itu satu-satunya kunci dekripsi (lihat INFRA-SETUP.md).

## 2) HTTPS / TLS (wajib)
- Sajikan via HTTPS (Let's Encrypt / Cloudflare). Cookie `__Host-`/secure + HSTS baru aktif di HTTPS.
- Pastikan `AUTH_URL`/origin produksi `https://…` (jangan dipaku ke `http`).

## 3) CDN / WAF di depan (proteksi DDoS & bot)
- Rate-limit app hanya **deterrent**, bukan anti-DDoS. Taruh **Cloudflare** (atau setara) di depan:
  proteksi DDoS, bot/IP reputation, TLS, rate-limit edge.
- Set `REDIS_URL` agar rate-limit app jadi lintas-instance (kode sudah mendukung; lihat `http-guards.ts`).

## 4) Hardening VPS (app aman ≠ server aman)
- SSH key-only, nonaktifkan login root & password; firewall (hanya 80/443 publik); fail2ban.
- **Postgres jangan diekspos ke internet** — tetap `localhost`/jaringan privat (sekarang sudah benar).
- User non-root untuk app; patch OS & dependensi rutin (`pnpm audit`, update Next.js).

## 5) Backup & pemulihan
- **Backup DB otomatis** + tes restore berkala.
- **Backup `BYOK_KEK_CIPHERTEXT_B64` + akses KMS** (atau `BYOK_MASTER_KEY_BASE64` bila non-KMS) — kalau
  hilang, SEMUA key BYOK user tak bisa didekripsi. Simpan di password manager / secret store terpisah.

## 6) Monitoring & deteksi insiden
- Sengaja nol logging di app (lindungi secret). Tambahkan observability eksternal: error monitoring (tanpa
  mencatat secret/PII), uptime, alert anomali (lonjakan 4xx/5xx/429).
- Rencana respons insiden + notifikasi breach (UU PDP).

## 7) Operasional / legal
- Google OAuth consent screen: dari **Testing → Published** (verifikasi Google) untuk publik; daftarkan
  redirect URI produksi.
- Privacy Policy + ToS; data residency Jakarta (`ap-southeast-2`) per UU PDP; fitur ekspor/hapus akun sudah ada.

## 8) Login Codex / "Sign in with ChatGPT" (per-user, your own risk)
- Tiap user pakai **akun ChatGPT mereka sendiri** (bukan akun kita untuk banyak orang). Risiko ada di akun
  masing-masing — pemakaian sesi ChatGPT untuk otomatisasi adalah area abu-abu ToS OpenAI, akun user bisa
  kena pembatasan. UI sudah menampilkan peringatan **"risiko ditanggung sendiri"**. Untuk publik, dorong
  user memakai API key (Gemini/OpenAI). Catatan: login loopback hanya jalan di mode lokal/self-host.

## 9) Migrasi DB saat deploy (zero data loss)
Ikuti runbook di [INFRA-SETUP.md](INFRA-SETUP.md): baseline sekali → `db:status` → `db:deploy` → restart.
**Jangan pernah `prisma db push`** pada DB berisi data.

---

### Rekomendasi pen-test
Sebelum publik, lakukan **penetration test / bug bounty** ringan — audit statis tak menangkap semua celah
logika/bisnis (mis. penyalahgunaan alur, chained exploit). Anggaran kecil di sini menghemat banyak nanti.
