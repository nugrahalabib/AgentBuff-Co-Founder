# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## AgentBuff Co-Founder — AI Co-Founder untuk Membangun Bisnis dari Nol

> **AgentBuff Co-Founder** adalah anggota baru dari **suite produk AgentBuff** (bersama AgentBuff POS, AgentBuff Absent, Agentic AgentBuff, dan lainnya). Posisinya bukan sekadar *tool*, melainkan **AI Co-Founder**: mendampingi pebisnis pemula dari ide mentah hingga dokumen yang layak dibawa ke investor. Sebagai bagian dari ekosistem AgentBuff yang **agent-first & MCP-native**, AgentBuff Co-Founder dirancang agar dapat saling-terhubung dengan produk AgentBuff lain (mis. menarik data penjualan nyata dari AgentBuff POS, struktur biaya tenaga kerja dari AgentBuff Absent) dan diorkestrasi oleh Agentic AgentBuff.

| Field | Value |
|---|---|
| **Produk** | AgentBuff Co-Founder (bagian dari suite **AgentBuff**) |
| **Versi Dokumen** | 1.2 |
| **Status** | Draft for Engineering & Design Review |
| **Tanggal** | 30 Mei 2026 |
| **Perubahan v1.2** | **Multi-provider BYOK**: selain Gemini, kini mendukung **OpenAI API key** dan **Codex auth (Sign in with ChatGPT)**. Ditambah **Provider Abstraction Layer** (§12.14), detail integrasi OpenAI (Responses API, Deep Research, web search, gpt-image, vision/dokumen — §12.15), detail Codex CLI & auth (§12.16), matriks kapabilitas lintas-provider, dan referensi dokumentasi OpenAI/Codex (Appendix §20.7). Mandat **sumber clickable** kini provider-agnostik (Gemini & OpenAI sama-sama menghasilkan `url_citation`). |
| **Perubahan v1.1** | Rebranding ke AgentBuff Co-Founder + posisi ekosistem; integrasi mendalam dokumentasi resmi Gemini API (Deep Research, Google Search grounding, Nano Banana, Image/Document Understanding, Imagen) & Gemini CLI; mandat **sumber data clickable**; pipeline dokumen berbasis **Gemini CLI / Antigravity CLI** |
| **Penyusun** | Chief Product Office |
| **Tipe Produk** | Responsive Web App (PWA) — *no native app* |
| **Model Bisnis** | Gratis, **multi-provider BYOK** — pengguna membawa **Gemini API key**, **OpenAI API key**, atau **Codex (Sign in with ChatGPT)** |
| **Arsitektur Pembeda** | **MCP-native** + **Provider-agnostic** (Provider Abstraction Layer) — engine dapat diakses headless oleh agen AI eksternal & produk AgentBuff lain, dan dapat ditenagai oleh model Gemini *atau* OpenAI |
| **Stack AI** | Gemini API (Interactions + generateContent) · OpenAI API (Responses API) · agen CLI: Gemini CLI / Antigravity CLI / Codex CLI · image: Nano Banana / Imagen / gpt-image |
| **Pasar Utama** | Indonesia (solopreneur, pebisnis pemula, UMKM naik kelas) |

> ⚠️ **CATATAN UNTUK AI/ENGINEER YANG MENGIMPLEMENTASIKAN PRD INI:** Seluruh detail teknis pemakaian Gemini API, OpenAI API, Gemini CLI, dan Codex di dokumen ini **wajib** diverifikasi terhadap dokumentasi resmi yang tautannya tercantum di **§12.7–§12.16** dan diringkas di **Appendix §20.6 (Gemini) & §20.7 (OpenAI/Codex)**. Baca dokumentasi tersebut sebelum menulis kode agar tidak ada halusinasi pada nama model, endpoint, header, bentuk request/response, maupun perintah CLI. Dokumentasi resmi adalah **satu-satunya sumber kebenaran**; jika PRD dan dokumentasi berbeda (mis. karena pembaruan API), ikuti dokumentasi resmi lalu perbarui PRD.

---

## DAFTAR ISI

1. Executive Summary
   - 1.5 Posisi dalam Ekosistem AgentBuff
2. Problem Statement & Konteks Pasar (Deep Research)
3. Product Vision, Goals & Principles
4. Target Users & Personas
5. Success Metrics (North Star, KPI, Guardrails)
6. Business Model & Ekonomi BYOK
7. Scope (In / Out) & Strategi Rilis
8. End-to-End User Journey (Golden Path)
9. Feature Breakdown — 6 Core Modules
   - 9.1 Modul Authentication & Onboarding
   - 9.2 Modul Deep Research & Validator (Interactions API + Sumber Clickable)
   - 9.3 Modul Master Business Planner (+ Import Dokumen)
   - 9.4 Modul Creative & Brand Studio ("Brand Forge Studio" — Nano Banana/Imagen)
   - 9.5 Modul Docs & Pitch Generator ("Deck & Docs Engine" — Gemini CLI)
   - 9.6 Modul MCP / Agentic Integration ("AgentBuff Agent Gateway")
10. System Architecture & Tech Stack (termasuk MCP Implementation)
11. Data Model & Schema
12. AI Orchestration Layer (Prompt Architecture, Model Routing, Cost Control)
   - 12.7 Pemetaan Fitur → Gemini API & Dokumentasi (WAJIB DIBACA)
   - 12.8 Deep Research via Interactions API
   - 12.9 Grounding Google Search & Sumber Clickable
   - 12.10 Image Stack (Nano Banana, Imagen, Image Understanding)
   - 12.11 Document Understanding (Import & Parsing)
   - 12.12 Gemini CLI / Antigravity CLI untuk Generasi Dokumen
   - 12.13 Breaking Changes & Deprecations yang Harus Dipantau
   - 12.14 Arsitektur Multi-Provider (Provider Abstraction Layer)
   - 12.15 Integrasi OpenAI (Responses API, Deep Research, gpt-image, vision/dokumen)
   - 12.16 Codex Auth & Lapisan Agentik OpenAI (DocAgentRunner lintas-CLI)
13. Security, Privacy & Compliance (BYOK Key Handling, UU PDP)
14. Detailed UI/UX Guidelines
15. Non-Functional Requirements
16. Analytics & Instrumentation
17. Risks & Mitigations
18. Release Plan & Roadmap
19. Open Questions
20. Appendix (Glossary, Prompt Library, MCP Tool Catalog, JSON Schemas)
   - 20.6 Referensi Dokumentasi Resmi (Gemini API & Gemini CLI)
   - 20.7 Referensi Dokumentasi Resmi (OpenAI API & Codex)

---

# 1. EXECUTIVE SUMMARY

## 1.1 Ringkasan Eksekutif

AgentBuff Co-Founder adalah aplikasi web AI yang berfungsi sebagai **co-founder digital** bagi 65,5 juta pelaku UMKM dan calon wirausaha Indonesia yang ingin membangun bisnis berkelanjutan tetapi tidak memiliki latar belakang ilmu bisnis formal. Aplikasi ini menutup empat *gap* terbesar pebisnis pemula — **validasi ide, perencanaan bisnis & finansial, identitas brand, dan dokumen yang layak investor** — dalam satu alur kerja terpandu yang sepenuhnya berbahasa Indonesia, ramah-mobile, dan bebas jargon.

Model bisnisnya unik: **gratis dengan BYOK (Bring Your Own Key)**. Pengguna memasukkan Gemini API key milik mereka sendiri, sehingga biaya komputasi LLM ditanggung langsung oleh pengguna melalui *free tier* Google yang sangat dermawan. Ini menekan biaya operasional AgentBuff Co-Founder mendekati nol untuk lapisan AI, memungkinkan model gratis yang benar-benar berkelanjutan tanpa investor-subsidy yang biasa membakar startup AI.

Pembeda arsitektural utama: AgentBuff Co-Founder dibangun **MCP-native**. Setiap kapabilitas inti (riset, planner, brand, generator dokumen) diekspos sebagai *tools*, *resources*, dan *prompts* melalui Model Context Protocol over Streamable HTTP. Artinya agen AI eksternal — Claude, ChatGPT, Cursor, OpenClaw, Hermes, atau orchestrator kustom — dapat memanggil "mesin bisnis" AgentBuff Co-Founder secara *headless* tanpa membuka UI. AgentBuff Co-Founder berperan ganda: sebagai aplikasi untuk manusia **dan** sebagai *backend kapabilitas bisnis* untuk ekosistem agentic.

## 1.2 The One-Liner

> *"AgentBuff Co-Founder mengubah 'saya punya ide bisnis tapi tidak tahu harus mulai dari mana' menjadi business plan, identitas brand, proposal, dan pitch deck siap-investor — dalam hitungan jam, gratis, dengan API key Anda sendiri."*

## 1.3 Strategic Bets (Asumsi Strategis yang Dipertaruhkan)

1. **BYOK menghilangkan friksi biaya, bukan menambahnya.** Free tier Gemini cukup besar (ribuan request/hari, ribuan grounded prompt/bulan) sehingga 90%+ pengguna individu tidak pernah membayar apa pun ke Google. Onboarding key adalah satu-satunya friksi, dan kami menanganinya dengan *deep linking* + panduan visual 60 detik.
2. **Pebisnis pemula tidak butuh fitur lebih banyak; mereka butuh keputusan yang dibuatkan untuk mereka.** Nilai AgentBuff Co-Founder bukan "memberi tools", tetapi "menghapus *analysis paralysis*" dengan jalur terpandu (guided path) yang opinionated.
3. **Determinisme finansial adalah moat kepercayaan.** Angka (HPP, margin, BEP, ROI, proyeksi) **tidak boleh dihalusinasi LLM**. LLM mengusulkan asumsi; perhitungan dieksekusi oleh *deterministic calculation engine*. Inilah yang membedakan AgentBuff Co-Founder dari "ChatGPT yang mengarang angka".
4. **MCP-native menjadikan AgentBuff Co-Founder infrastruktur, bukan sekadar app.** Saat agen AI menjadi antarmuka utama (2026+), produk yang hanya punya UI akan tertinggal. AgentBuff Co-Founder menang dengan menjadi *callable engine*.

## 1.4 Kenapa Sekarang (Why Now)

- **Sisi teknologi**: Gemini 3.x (per Mei 2026) menggabungkan *structured outputs* (JSON Schema), *grounding with Google Search*, *URL context*, *function calling*, dan generasi gambar (Nano Banana) dalam satu API — semua dengan free tier untuk developer/end-user. Ini baru matang dalam ~6 bulan terakhir.
- **Sisi protokol**: MCP telah menjadi standar de-facto integrasi agen (dukungan Anthropic, OpenAI, Google, Microsoft, AWS; puluhan juta unduhan SDK/bulan). Streamable HTTP + OAuth 2.1 membuat MCP server remote layak-produksi.
- **Sisi pasar**: 65,5 juta UMKM, kontribusi ~61% PDB, tetapi adopsi digital baru ~33,6% dan ekspor baru ~15,7%. *Gap* literasi bisnis & digital sangat besar dan belum tergarap oleh produk yang benar-benar ramah pemula berbahasa Indonesia.

## 1.5 Posisi dalam Ekosistem AgentBuff (Strategic Moat Tambahan)

AgentBuff Co-Founder tidak berdiri sendiri — ia adalah **lapisan "fase nol → fase tumbuh"** dari suite AgentBuff. Karena seluruh suite bersifat agent-first & MCP-native, masing-masing produk dapat menjadi **sumber data** atau **konsumen kapabilitas** bagi yang lain. Ini menciptakan *moat* yang tidak dimiliki kompetitor berdiri-sendiri: data nyata yang mengalir antar-produk membuat output AgentBuff Co-Founder makin akurat seiring bisnis pengguna tumbuh.

| Produk AgentBuff | Peran | Sinergi dengan AgentBuff Co-Founder (via MCP) |
|---|---|---|
| **AgentBuff Co-Founder** (produk ini) | Membangun bisnis dari nol: validasi → plan → brand → dokumen | Menghasilkan business plan & proyeksi yang menjadi *baseline* untuk produk operasional |
| **AgentBuff POS** | Point-of-sale / transaksi penjualan | **Sumber data penjualan & HPP nyata** → menggantikan asumsi di Financial Engine dengan angka aktual; memvalidasi proyeksi vs realisasi; rekomendasi harga berbasis data riil |
| **AgentBuff Absent** | Absensi & manajemen tenaga kerja | **Sumber struktur biaya tenaga kerja** (gaji, jam kerja) → memperkuat komponen *fixed/variable cost* & HPP pada model finansial |
| **Agentic AgentBuff** | Lapisan agen orkestrator | **Konsumen utama AgentBuff Agent Gateway (MCP)** — menjalankan alur lintas-produk secara headless (mis. "validasi ide → buat plan → siapkan proposal" dipicu agen) |
| **Produk AgentBuff lain** (mendatang) | — | Terhubung lewat MCP/standar yang sama; AgentBuff Co-Founder mengekspos *tools* yang konsisten |

**Implikasi desain (dibawa ke seluruh PRD):**
1. **Konsistensi identitas & auth lintas-suite.** Federasi SSO/OIDC (lihat §9.1) harus mendukung *single sign-on* antar-produk AgentBuff, sehingga pengguna AgentBuff POS dapat masuk ke AgentBuff Co-Founder tanpa friksi.
2. **Kontrak MCP yang seragam.** Tool/Resource AgentBuff Co-Founder mengikuti konvensi penamaan & skema yang dapat dikenali produk AgentBuff lain (lihat §9.6, §12.7, §20.4).
3. **Data-source adapter opsional.** Financial Engine (§9.3) dirancang menerima sumber angka dari *adapter* — default = input manual pengguna, namun dapat dialihkan ke **AgentBuff POS/Absent** bila pengguna mengaktifkan koneksi. Ini menjadikan prinsip *"LLM Proposes, Code Disposes"* makin kuat: angka bukan hanya deterministik, tapi bisa berbasis **data transaksi nyata**.
4. **Non-v1, tetapi tidak boleh menutup pintu.** Integrasi data antar-produk adalah *roadmap* (lihat §18.3); v1 cukup memastikan arsitektur (auth, MCP, adapter) tidak menghalangi integrasi tersebut.

---

# 2. PROBLEM STATEMENT & KONTEKS PASAR (DEEP RESEARCH)

## 2.1 Lanskap Pasar Indonesia (Data Terkini)

UMKM adalah tulang punggung ekonomi Indonesia, namun paradoksnya, sektor ini paling kekurangan kapabilitas perencanaan formal:

- **Jumlah & bobot ekonomi**: ±65,5 juta unit UMKM pada 2025 (sebagian sumber pemerintah mencatat ±64,2 juta), menyumbang ±60–62% PDB nasional (setara ±Rp 9.580 triliun) dan menyerap ±117–119 juta tenaga kerja (±97% angkatan kerja). 99% pelaku usaha di Indonesia adalah UMKM.
- **Defisit digital**: Adopsi digital UMKM baru ±33,6% (Permendag 2023). Mayoritas akses internet via smartphone, bukan desktop — **mobile-first bukan opsi, tapi keharusan**.
- **Defisit ekspor & skala**: Kontribusi ekspor UMKM baru ±15,7%. Hambatan utama yang berulang dalam literatur: rendahnya literasi bisnis/finansial, minim akses pembiayaan & pelatihan, ketiadaan dokumen formal (business plan, proposal) yang dibutuhkan untuk naik kelas.
- **Sinyal positif**: Penetrasi pembayaran digital melonjak (QRIS >57 juta pengguna H1-2025), program pembiayaan pemerintah aktif (KUR, UMi, PNM Mekaar). Artinya **demand untuk formalisasi & akses modal sedang naik** — dan formalisasi butuh dokumen yang AgentBuff Co-Founder hasilkan.

**Implikasi produk**: TAM realistis = puluhan juta pelaku & calon pelaku usaha digital-curious. SAM v1 = solopreneur/UMKM mikro yang melek smartphone & ingin naik kelas (estimasi 8–15 juta). SOM tahun pertama = early adopters yang aktif mencari "cara bikin business plan/proposal/pitch deck".

## 2.2 Psikologi & Pain Points Solopreneur Pemula

Kami memetakan empat *pain* inti yang menjadi tulang punggung desain produk. Setiap *pain* dipetakan langsung ke modul AgentBuff Co-Founder.

### Pain #1 — "Takut Gagal" (Fear of Failure)
Pemula menunda memulai karena takut rugi modal dan malu jika gagal. Ketidakpastian terasa seperti risiko eksistensial.
- **Manifestasi UX**: enggan commit, butuh validasi eksternal, sensitif terhadap nada menghakimi.
- **Respons AgentBuff Co-Founder**: **Modul Deep Research & Validator** memberi *evidence-based reality check* (data pasar nyata + skor validasi), bukan opini kosong. Nada produk *supportive, never preachy*. Risiko di-frame sebagai "hal yang bisa dikelola", lengkap dengan mitigasi.

### Pain #2 — "Buta Finansial" (Financial Blindness)
Tidak bisa menghitung HPP, margin, modal awal, BEP, atau proyeksi. Ini akar #1 kebangkrutan UMKM.
- **Manifestasi UX**: takut angka, tidak tahu istilah (HPP, margin kotor, BEP, cash flow), tidak punya spreadsheet.
- **Respons AgentBuff Co-Founder**: **Modul Master Business Planner** dengan *deterministic financial engine*. Pengguna menjawab pertanyaan sederhana berbahasa awam ("Berapa harga jual rencananya?", "Apa saja bahan bakunya?"); AgentBuff Co-Founder menghitung HPP, margin, BEP, proyeksi 12–36 bulan, ROI, payback period — **dengan angka deterministik, bukan karangan AI**, plus penjelasan setiap istilah secara *just-in-time*.

### Pain #3 — "Bingung Mulai dari Mana" (Analysis Paralysis)
Terlalu banyak nasihat bertentangan di internet; tidak ada urutan yang jelas. Pemula lumpuh di titik nol.
- **Manifestasi UX**: membuka 20 tab, tidak menyelesaikan apa pun, menyerah.
- **Respons AgentBuff Co-Founder**: **Guided Linear Journey** yang opinionated. Satu jalur utama (Ide → Validasi → Plan → Brand → Dokumen), satu langkah aktif pada satu waktu, progres yang terlihat, dan keputusan default yang sudah dibuatkan ("AgentBuff Co-Founder merekomendasikan X karena Y" — pengguna tinggal setujui/ubah).

### Pain #4 — "Tidak Bisa Bikin Proposal/Pitch Deck"
Untuk akses modal (KUR, investor, kompetisi, akselerator), butuh proposal & pitch deck profesional. Pemula tidak punya skill desain/penulisan bisnis.
- **Manifestasi UX**: mentok saat butuh dokumen formal; menyalin template asal-asalan yang ditolak.
- **Respons AgentBuff Co-Founder**: **Modul Docs & Pitch Generator** — Gemini menghasilkan HTML berkualitas tinggi yang dikonversi ke **PDF Business Proposal** (formal, terstruktur) dan **PDF Pitch Deck** (landscape, gaya investor, satu ide per slide), mengikuti standar yang benar-benar disukai investor.

### Pain Sekunder
- **Literasi digital rendah** → UI ekstrem-sederhana, bahasa Indonesia, definisikan tiap istilah, mobile-first.
- **Modal terbatas** → gratis + BYOK (hanya menyentuh free tier Gemini).
- **Tidak punya mentor** → AgentBuff Co-Founder berperan sebagai mentor/co-founder yang sabar dan selalu tersedia.

## 2.3 Lanskap Kompetitif

| Kategori | Contoh | Kelemahan untuk pemula Indonesia | Diferensiasi AgentBuff Co-Founder |
|---|---|---|---|
| AI chatbot umum | ChatGPT, Gemini app | Mengarang angka finansial; tidak terstruktur; tidak menghasilkan PDF rapi; tidak ada jalur terpandu | Jalur terpandu + financial engine deterministik + output PDF siap pakai |
| Business plan builder Barat | LivePlan, Bizplan | Mahal (berbayar USD), berbahasa Inggris, asumsi pasar non-Indonesia | Gratis (BYOK), Bahasa Indonesia, grounding data pasar lokal |
| Tools desain | Canva | Tidak tahu konten bisnis Anda; user harus mendesain sendiri | Brand & deck dihasilkan dari business plan yang sudah tervalidasi |
| Konsultan/agensi | Jasa pembuatan proposal | Mahal, lambat, tidak scalable | Hitungan jam, biaya mendekati nol |
| MCP/agentic tools | Belum ada yang fokus business-building untuk pemula | — | First-mover sebagai *callable business engine* via MCP |

**Kesimpulan**: tidak ada pemain yang menggabungkan (a) gratis + BYOK, (b) jalur terpandu end-to-end, (c) financial engine deterministik, (d) output dokumen investor-grade, (e) Bahasa Indonesia & data lokal, (f) MCP-native. Ini adalah ruang *blue ocean*.

## 2.4 Standar Dokumen & Pitching yang Disukai Investor (Riset)

Standar yang akan ditanamkan ke generator (lihat Modul 9.5):

**Pitch Deck — Struktur kanonik (Sequoia / Y Combinator / Guy Kawasaki 10/20/30):**
1. Cover (nama, tagline, kontak)
2. Problem (rasa sakit yang dialami siapa)
3. Solution (produk & value proposition)
4. Why Now (timing pasar)
5. Market Size (TAM / SAM / SOM)
6. Product (cara kerja, demo/visual)
7. Business Model (cara menghasilkan uang)
8. Go-to-Market & Traction
9. Competition & Moat
10. Team
11. Financials & Projections
12. The Ask (jumlah pendanaan & use of funds)

Prinsip desain deck: **10 slide inti, 1 ide per slide, font besar (≥30pt), visual dominan, teks minimal, konsisten dengan brand**. (Kaidah 10/20/30 Guy Kawasaki.)

**Business Proposal — Struktur formal:**
Executive Summary → Latar Belakang & Masalah → Solusi/Deskripsi Usaha → Analisis Pasar → Strategi Pemasaran → Rencana Operasional → Struktur Organisasi/Tim → Rencana Keuangan (modal, HPP, proyeksi, BEP, ROI) → Analisis Risiko & Mitigasi → Roadmap → Penutup & Lampiran.

Prinsip: formal, terstruktur, ada daftar isi, penomoran halaman, tabel keuangan rapi, ringkas namun lengkap, *skimmable*.

---

# 3. PRODUCT VISION, GOALS & PRINCIPLES

## 3.1 Vision Statement

> Menjadi **co-founder AI default** bagi setiap orang Indonesia yang ingin membangun bisnis — menurunkan barrier dari "tidak tahu harus mulai dari mana" menjadi "punya rencana, brand, dan dokumen yang layak modal" — sekaligus menjadi **mesin bisnis yang dapat dipanggil** oleh seluruh ekosistem agen AI.

## 3.2 Goals (Outcome, bukan Output)

| # | Goal | Indikator keberhasilan |
|---|---|---|
| G1 | Pemula berhasil memvalidasi ide & mendapat kejelasan | ≥70% pengguna yang memulai validasi menyelesaikannya |
| G2 | Pemula memiliki business plan + model finansial yang utuh | ≥50% menyelesaikan business plan dalam 7 hari pertama |
| G3 | Pemula menghasilkan dokumen investor-grade | ≥30% mengunduh minimal 1 PDF (proposal/deck) |
| G4 | Biaya AI ditanggung user via BYOK tanpa friksi berarti | ≥85% berhasil memvalidasi API key di onboarding |
| G5 | AgentBuff Co-Founder menjadi engine agentic | ≥X panggilan MCP/bulan dari klien eksternal |

## 3.3 Product Principles (Aturan Main Desain & Engineering)

1. **Guided over Open-ended.** Selalu tawarkan jalur dan default. Kebebasan adalah fitur lanjutan, bukan default.
2. **LLM Proposes, Code Disposes.** Semua angka & logika finansial dieksekusi deterministik di kode. LLM hanya mengusulkan input/asumsi/narasi.
3. **Grounded & Verifiable by Default.** Klaim pasar/kompetitor menggunakan *grounding with Google Search* + **sumber yang dapat diklik** (anotasi `url_citation`) sehingga pengguna bisa **memverifikasi sendiri** ke halaman aslinya. Tidak ada klaim faktual tanpa basis; klaim tanpa sumber wajib berlabel "estimasi". (Implementasi: §9.2.1, §12.9.)
4. **Plain Bahasa, Zero Jargon (tanpa mengorbankan akurasi).** Setiap istilah teknis (HPP, BEP, TAM) punya penjelasan *just-in-time* yang bisa di-tap.
5. **Mobile-first, Responsive-perfect.** Desain dimulai dari layar 360px. Desktop adalah perluasan, bukan acuan utama.
6. **BYOK is Sacred.** API key user dienkripsi, tidak pernah di-log, hanya didekripsi in-memory saat panggilan. Transparansi penuh soal biaya.
7. **Headless-equal-to-UI.** Setiap kapabilitas yang ada di UI juga tersedia via MCP. Engine adalah *single source of truth*; UI dan MCP adalah dua *adapter* di atasnya.
8. **Progress is Sacred.** Pekerjaan pengguna (jawaban, draft, hasil) selalu *auto-saved*. Tidak ada kerja yang hilang.
9. **Honest Encouragement.** Mendukung secara emosional tanpa membohongi. Jika data menunjukkan ide berisiko, sampaikan jujur disertai jalan keluar.

## 3.4 Anti-Goals (Yang Sengaja TIDAK Dilakukan)

- Bukan platform eksekusi operasional (bukan POS, bukan akuntansi harian, bukan e-commerce). AgentBuff Co-Founder fokus **fase merancang & memformalkan**, lalu *handoff* — termasuk *handoff* ke produk AgentBuff lain (mis. **AgentBuff POS** untuk operasional penjualan) via MCP saat bisnis mulai berjalan (lihat §1.5).
- Bukan native app (iOS/Android store). 100% web/PWA.
- Bukan penyedia LLM. AgentBuff Co-Founder tidak menjual token; user membawa key sendiri.
- Bukan "tool serba bisa". v1 fokus tajam pada 6 modul inti.

---

# 4. TARGET USERS & PERSONAS

## 4.1 Persona Primer — "Sari, si Calon Solopreneur"
- **Profil**: 27 tahun, karyawan yang ingin resign untuk buka usaha *home-baking*/kedai kopi/thrift online. Akses utama via smartphone. Tidak punya background bisnis.
- **Tujuan**: tahu apakah idenya layak, butuh modal berapa, harga jual berapa, dan butuh proposal untuk pinjam modal ke keluarga/KUR.
- **Frustrasi**: takut rugi, bingung hitung HPP, tidak tahu bikin proposal.
- **Definition of success**: dalam satu akhir pekan, punya gambaran modal, proyeksi, dan proposal PDF.

## 4.2 Persona Sekunder — "Bagas, si UMKM Naik Kelas"
- **Profil**: 34 tahun, sudah punya warung/brand kecil yang jalan, ingin ekspansi/cari investor/ikut akselerator. Butuh pitch deck & proyeksi yang meyakinkan.
- **Tujuan**: pitch deck investor-grade + proyeksi finansial yang kredibel.
- **Frustrasi**: bisnisnya jalan tapi "di kepala", belum terdokumentasi; ditolak akselerator karena deck berantakan.

## 4.3 Persona Tersier — "Dimas, si Pengembang/Power User Agentic"
- **Profil**: developer/agency yang membangun produk di atas agen AI (Claude, custom orchestrator).
- **Tujuan**: memanggil engine AgentBuff Co-Founder (riset, plan, dokumen) via MCP dari workflow agentic miliknya, tanpa membuka UI AgentBuff Co-Founder.
- **Frustrasi**: harus membangun ulang logika business-planning dari nol.

## 4.4 Persona Pendukung — "Mentor/Inkubator"
- **Profil**: pendamping UMKM, dosen kewirausahaan, pengelola inkubator yang ingin memakai AgentBuff Co-Founder bersama mentee.
- **Catatan**: di luar scope v1 untuk fitur multi-tenant/kelas, tetapi dipertimbangkan di roadmap (lihat §18).

## 4.5 Jobs To Be Done (JTBD)

- "Ketika saya **punya ide bisnis tapi ragu**, saya ingin **tahu apakah ada pasarnya dan apa risikonya**, supaya saya **berani/tidak nekat memulai**."
- "Ketika saya **siap merencanakan**, saya ingin **tahu modal, harga, dan proyeksi keuntungan secara akurat**, supaya saya **tidak bangkrut karena salah hitung**."
- "Ketika saya **butuh modal/partner**, saya ingin **dokumen yang membuat saya terlihat profesional & kredibel**, supaya saya **dipercaya pemberi modal**."
- "Ketika saya **membangun agen AI**, saya ingin **memanggil mesin business-building yang sudah jadi**, supaya saya **tidak membangun ulang logikanya**."

---

# 5. SUCCESS METRICS (NORTH STAR, KPI, GUARDRAILS)

## 5.1 North Star Metric (NSM)

> **Jumlah "Activated Founders" per minggu** — pengguna yang menyelesaikan minimal **Validasi Ide + Business Plan inti** dan menghasilkan **minimal 1 artefak bernilai** (business plan tersimpan, proposal/deck terunduh, atau panggilan MCP sukses).

Alasan: metrik ini menangkap *value delivered*, bukan vanity (signup). Seorang founder yang "activated" telah melewati jurang *analysis paralysis* dan menerima output nyata.

## 5.2 KPI Funnel (AARRR + BYOK)

| Tahap | Metrik | Target awal |
|---|---|---|
| **Acquisition** | Signup via Google | baseline |
| **BYOK Activation** | % berhasil validasi Gemini API key | ≥85% |
| **Onboarding Completion** | % selesai onboarding (key + profil + ide pertama) | ≥70% |
| **Validator Completion** | % menyelesaikan minimal 1 validasi ide | ≥60% |
| **Plan Completion** | % menyelesaikan business plan inti | ≥45% |
| **Doc Generation** | % menghasilkan ≥1 PDF | ≥30% |
| **Retention (D7/D30)** | kembali & melanjutkan project | D7 ≥35%, D30 ≥18% |
| **Referral** | undangan/share artefak | tracked |
| **Agentic** | panggilan MCP unik/bulan & klien aktif | tracked |

## 5.3 Quality & Trust Metrics

- **Financial Trust Score**: % proyeksi finansial yang lolos *validation rules* (tanpa nilai negatif tak wajar, BEP terdefinisi, margin dalam rentang masuk akal). Target ≥99% (karena deterministik).
- **Grounding Citation Rate**: % klaim pasar di laporan riset yang memiliki sitasi sumber. Target 100%.
- **Generation Success Rate**: % job AI (riset/plan/brand/PDF) selesai tanpa error fatal. Target ≥97%.
- **Time-to-First-Artifact (TTFA)**: median waktu dari signup ke artefak pertama. Target < 45 menit untuk proposal sederhana.

## 5.4 Guardrail Metrics (Tidak Boleh Memburuk)

- **p95 latency** per kelas tugas (lihat §15).
- **BYOK error rate** (key invalid/quota habis yang tidak ter-handle gracefully) < 1%.
- **Cost-incurred-on-user** transparansi: 0 keluhan "tiba-tiba ditagih Google" akibat AgentBuff Co-Founder tidak transparan.
- **Data incident**: 0 kebocoran API key.

---

# 6. BUSINESS MODEL & EKONOMI BYOK

## 6.1 Prinsip Model

AgentBuff Co-Founder **gratis** untuk pengguna. Biaya inferensi LLM ditanggung pengguna melalui **Gemini API key milik mereka sendiri (BYOK)**. AgentBuff Co-Founder tidak menjadi *reseller* token dan tidak menyimpan biaya inferensi di sisinya.

## 6.2 Mengapa BYOK Layak Secara Ekonomi (Analisis Free Tier Gemini)

Berdasarkan kondisi Gemini API per Mei 2026:
- **Free tier developer** sangat dermawan: ribuan request/hari untuk model Flash/Flash-Lite, dan **±5.000 grounded prompt/bulan** untuk model Gemini 3 (grounding with Google Search).
- Model termurah (mis. Flash-Lite tier) berbiaya ~USD 0,10 / 1 juta token input — bahkan saat melewati free tier, biaya per business plan tetap sangat kecil (hitungan ratusan–ribuan rupiah).
- **Context caching** dapat memangkas biaya prompt berulang hingga ~90%; **Batch API** memberi diskon ~50% untuk job non-urgent.

**Konsekuensi desain ekonomi**: dengan *model routing* yang disiplin (lihat §12), satu siklus lengkap (validasi → plan → brand → 2 PDF) untuk satu pengguna dapat **muat dalam free tier Gemini** pada mayoritas kasus. Pengguna individu khas **tidak pernah membayar Google**. Inilah yang membuat "gratis selamanya" berkelanjutan bagi AgentBuff Co-Founder: **biaya marjinal lapisan AI ≈ 0 untuk AgentBuff Co-Founder**.

## 6.3 Biaya yang Tetap Ditanggung AgentBuff Co-Founder (dan Strategi Menekannya)

| Komponen biaya | Strategi penekanan |
|---|---|
| Hosting frontend (Vercel/edge) | Tier hemat; caching agresif; PWA |
| Backend & orchestration | Serverless/containers auto-scale; job queue |
| Database & storage (PDF/gambar) | Postgres terjangkau (Neon/Supabase); lifecycle policy hapus artefak lama; kompresi |
| **Generasi gambar (Nano Banana / gpt-image-2)** & **HTML→PDF rendering** | Ini bisa jadi cost-center utama jika ditanggung AgentBuff Co-Founder. **Mitigasi**: gambar via **key/akun provider milik user (BYOK)** — Gemini menanggung Nano Banana, OpenAI menanggung gpt-image, Codex memakai langganan ChatGPT; PDF rendering ringan (headless Chromium pada worker hemat, atau opsi client-side) |
| Egress/CDN | CDN murah; expiring URLs |

**Catatan strategis**: karena generasi gambar dan grounding/riset adalah operasi paling mahal, keduanya **diarahkan ke kredensial provider milik user (BYOK)** — apa pun providernya (Gemini free tier / OpenAI usage-based / langganan ChatGPT via Codex) — bukan ke akun AgentBuff Co-Founder. AgentBuff Co-Founder hanya menanggung *plumbing* (orkestrasi, rendering, penyimpanan sementara). **Transparansi biaya disampaikan sesuai provider** (jangan klaim "gratis" universal — lihat R21).

## 6.4 Jalur Monetisasi Masa Depan (Opsional, Non-v1)

Tetap menjaga lapisan inti gratis, monetisasi opsional yang tidak mengkhianati prinsip:
- **AgentBuff Co-Founder Pro** (opsional): fitur lanjutan non-AI (kolaborasi tim, versi dokumen tanpa batas, template premium, ekspor brand kit lengkap, custom domain untuk one-pager).
- **MCP Gateway berbayar untuk volume tinggi** (B2B/agency): rate limit lebih tinggi, SLA, analytics — untuk persona Dimas/agency.
- **Marketplace template & jasa** (mentor/desainer terverifikasi). 
- **Catatan**: AgentBuff Co-Founder **tidak** menampilkan iklan dan **tidak** menjual data pengguna.

---

# 7. SCOPE (IN / OUT) & STRATEGI RILIS

> Catatan standar kualitas: AgentBuff Co-Founder **tidak** dirilis sebagai "MVP amatir". v1 adalah produk **enterprise-grade pada scope yang sengaja difokuskan** — sedikit modul, tetapi tiap modul matang, aman, dan mendalam.

## 7.1 In Scope (v1)

- Auth Google-only + validasi BYOK key + onboarding terpandu.
- SSO/Webhook federation endpoint untuk login dari ekosistem mitra.
- Deep Research & Validator (grounded).
- Master Business Planner + deterministic financial engine.
- Creative & Brand Studio ("Brand Forge Studio") termasuk generasi gambar (Nano Banana).
- Docs & Pitch Generator ("Deck & Docs Engine") → PDF Proposal + PDF Pitch Deck.
- MCP Server ("AgentBuff Agent Gateway") — tools, resources, prompts via Streamable HTTP + OAuth 2.1.
- Project workspace (auto-save, versi dasar, riwayat).
- Responsif penuh (mobile/tablet/desktop), PWA installable.
- Bahasa Indonesia (default) + arsitektur i18n siap (English sebagai fast-follow).

## 7.2 Out of Scope (v1)

- Native mobile app.
- Modul operasional (POS, akuntansi harian, inventory, e-commerce storefront).
- Kolaborasi real-time multi-user / komentar (roadmap).
- Marketplace & monetisasi berbayar (roadmap).
- Penyediaan LLM milik AgentBuff Co-Founder (tetap BYOK).
- Integrasi langsung ke lembaga pembiayaan (roadmap; v1 hanya menghasilkan dokumen).

## 7.3 Strategi Rilis Bertingkat

- **Alpha (internal)**: end-to-end golden path dengan akun internal; uji financial engine & PDF.
- **Closed Beta**: undangan ke kohort solopreneur nyata; fokus aktivasi BYOK & TTFA.
- **Public Beta**: buka pendaftaran; MCP gateway dibuka untuk developer terbatas (allowlist).
- **GA**: SLA, dokumentasi MCP publik, i18n English.

(Detail timeline pada §18.)

---

# 8. END-TO-END USER JOURNEY (GOLDEN PATH)

Bagian ini adalah *blueprint* alur presisi yang menjadi acuan desain & engineering. Alur utama **linear & terpandu**, dengan kemampuan kembali/iterasi.

## 8.1 Peta Alur Tingkat Tinggi

```
[Landing] 
   → [Login Google] 
   → [Onboarding: Validasi Gemini Key → Profil singkat → Ide pertama] 
   → [Project Dashboard] 
        → 1. Deep Research & Validator  (output: Laporan Validasi + Skor)
        → 2. Master Business Planner     (output: Business Plan + Model Finansial deterministik)
        → 3. Brand Forge Studio          (output: Brand Concept + Aset visual)
        → 4. Deck & Docs Engine          (output: PDF Proposal + PDF Pitch Deck)
   → [Handoff: unduh/bagikan/lanjut iterasi]

   ╔════════════════════════════════════════════════════════╗
   ║ Paralel & headless: AgentBuff Agent Gateway (MCP)            ║
   ║ Agen eksternal memanggil tools yang sama atas nama user ║
   ╚════════════════════════════════════════════════════════╝
```

Setiap modul **mewarisi konteks** dari modul sebelumnya (mis. business plan memakai hasil riset; brand memakai business plan; dokumen memakai semuanya). Konteks ini disimpan sebagai *Project State* dan di-*cache* untuk Gemini (context caching) demi hemat biaya & konsistensi.

## 8.2 Journey Detail per Fase

### Fase 0 — Discovery & Landing
- Landing menjelaskan janji nilai dalam 1 kalimat + demo singkat + penekanan "Gratis, pakai API key Anda sendiri".
- CTA tunggal & dominan: **"Mulai Gratis dengan Google"**.
- Edukasi ringkas "Apa itu BYOK & kenapa gratis" (expandable, opsional).

### Fase 1 — Authentication
- Klik CTA → Google OAuth consent → kembali ke AgentBuff Co-Founder terautentikasi.
- Tidak ada form manual, OTP, atau email verifikasi. (Detail di §9.1.)

### Fase 2 — Onboarding (3 langkah, < 3 menit)
1. **Validasi Gemini API Key** (langkah wajib & paling kritis). Panduan visual + deep link ke Google AI Studio. Real-time validation. (Detail di §9.1.4.)
2. **Profil singkat**: nama panggilan, sektor minat (F&B, fashion/thrift, jasa, kreatif, dll.), tahap (punya ide / sudah jalan), tujuan (validasi / cari modal / naik kelas). Maks 4 pertanyaan tap-based.
3. **Ide pertama**: input bebas 1–3 kalimat "Ceritakan ide bisnismu". AgentBuff Co-Founder langsung membuat **Project** dan masuk ke Dashboard dengan langkah pertama (Validasi) ter-*highlight*.

### Fase 3 — Deep Research & Validator
- AgentBuff Co-Founder menjalankan riset *grounded* (pasar, kompetitor, demand, harga pasaran) → menghasilkan **Laporan Validasi** + **Skor Validasi** + risiko & rekomendasi.
- Pengguna meninjau, dapat bertanya lanjutan, lalu menekan **"Lanjut ke Business Plan"**.

### Fase 4 — Master Business Planner
- *Wizard* menanyakan input bisnis sederhana (model bisnis, struktur biaya, harga, target).
- *Financial engine* menghitung HPP, margin, modal awal, BEP, proyeksi, ROI, payback.
- AgentBuff Co-Founder menyusun narasi business plan (strategi, marketing, funneling, roadmap) yang *grounded* pada hasil riset.
- Output: **Business Plan** yang dapat diedit + **Model Finansial** interaktif.

### Fase 5 — Brand Forge Studio
- Setelah plan disetujui, AgentBuff Co-Founder menghasilkan **Brand Concept**: positioning, naming options, tone, **moodboard**, **konsep logo (visual)**, **palet warna & tipografi**, **konsep outlet/interior** (untuk bisnis fisik), **konsep desain produk/kemasan**.
- Aset gambar di-generate via Nano Banana (BYOK).

### Fase 6 — Deck & Docs Engine
- AgentBuff Co-Founder merakit data dari fase 3–5 menjadi HTML berkualitas tinggi → konversi PDF.
- Output 1: **PDF Business Proposal** (portrait, formal).
- Output 2: **PDF Pitch Deck** (landscape 16:9, gaya investor).
- Pengguna *preview* → *regenerate* bagian tertentu → **unduh/bagikan**.

### Fase 7 — Handoff & Iterasi
- Dashboard menampilkan semua artefak, status, dan versi.
- Pengguna dapat mengulang modul mana pun; perubahan upstream menandai artefak downstream sebagai "perlu diperbarui" (lihat §9.3.7 *staleness propagation*).

## 8.3 Prinsip Navigasi Journey

- **Satu langkah aktif** ditonjolkan; langkah berikutnya *locked-soft* (bisa dilewati untuk power user, tapi AgentBuff Co-Founder menyarankan urutan).
- **Progress tracker** persisten (stepper) terlihat di semua viewport.
- **Auto-save** di setiap interaksi.
- **Resume**: pengguna yang kembali langsung diarahkan ke langkah terakhir yang belum selesai ("Lanjutkan di mana kamu berhenti").

---

# 9. FEATURE BREAKDOWN — 6 CORE MODULES

> Format tiap modul: **Tujuan → User Flow → Functional Logic (algoritma konseptual) → Integrasi Gemini → Data Model → Edge Cases → States (loading/empty/error)**.

---

## 9.1 MODUL 1 — AUTHENTICATION & ONBOARDING (Frictionless)

### 9.1.1 Tujuan
Membawa pengguna dari "belum kenal" ke "siap berkarya" dengan friksi seminimal mungkin, sambil memastikan satu prasyarat teknis terpenuhi: **minimal satu kredensial AI tervalidasi** (Gemini API key / OpenAI API key / Codex Sign-in with ChatGPT — lihat §9.1.4 & §12.14).

### 9.1.2 User Flow
```
Landing → "Mulai dengan Google" → Google OAuth → 
  Onboarding Step 1: Validasi Gemini Key (wajib) →
  Onboarding Step 2: Profil (4 tap questions) →
  Onboarding Step 3: Ide pertama (free text) →
  Project dibuat → Dashboard
```

### 9.1.3 Authentication — Logic & Keputusan Desain
- **Hanya Google Login (OAuth 2.0 / OIDC).** Tidak ada email/password, OTP, atau SMS. Alasan: friksi terendah, identitas tepercaya, mayoritas target punya akun Google (selaras ekosistem Android di Indonesia).
- **Provider**: implementasi melalui *auth library* standar (mis. Auth.js/NextAuth atau Clerk/Supabase Auth) dengan Google sebagai satu-satunya IdP di v1.
- **Session**: token sesi *httpOnly, secure, sameSite* + refresh. Tidak menyimpan kredensial Google.
- **Akun baru** otomatis dibuat saat pertama login (no separate signup).

#### 9.1.3.1 SSO / Webhook Federation (login dari ekosistem mitra)
Kebutuhan: pengguna dari Web/App mitra (mis. marketplace yang sudah ada) bisa masuk AgentBuff Co-Founder memakai kredensial ekosistem tersebut.
- **Pola**: AgentBuff Co-Founder bertindak sebagai **OIDC Relying Party** terhadap IdP mitra **dan** menyediakan **Federation/Webhook Endpoint** untuk *trusted partner sign-in*.
- **Mekanisme A — OIDC/SAML Federation**: mitra terdaftar sebagai IdP tambahan; tombol "Masuk dengan [Mitra]" muncul jika domain/flag mitra terdeteksi.
- **Mekanisme B — Signed Webhook / JWT Handoff**: mitra memanggil endpoint `POST /api/federation/sso` dengan **JWT yang ditandatangani** (shared secret/asymmetric key per mitra) berisi klaim identitas (sub, email, partner_id, nonce, exp). AgentBuff Co-Founder memverifikasi tanda tangan & exp, melakukan *just-in-time provisioning* akun, lalu menerbitkan sesi AgentBuff Co-Founder atau *one-time login code* yang ditukar di redirect.
- **Keamanan**: per-partner key, *nonce* anti-replay, exp pendek, allowlist redirect URI, audit log. (Detail keamanan §13.)
- **Catatan BYOK pada federated user**: pengguna federasi tetap wajib melewati langkah Validasi Gemini Key (kecuali mitra menyuplai key terenkripsi via klaim khusus — opsional, lihat §13.4).

### 9.1.4 Validasi Kredensial AI (Multi-Provider) — Logic Mendalam (Langkah Wajib)
Ini titik *make-or-break* aktivasi. Desainnya wajib mulus. **Pengguna memilih provider** lalu menautkan kredensial; minimal **satu** provider wajib tervalidasi untuk memakai fitur AI.

**Pilihan provider (BYOK):**
1. **Gemini API key** — jalur paling ramah pemula (free tier Google dermawan). *Default yang disarankan untuk hosted.*
2. **OpenAI API key** — usage-based via OpenAI Platform (Responses API).
3. **Codex — Sign in with ChatGPT** — memakai langganan ChatGPT (OAuth/device-code). Terutama untuk pengguna lanjutan / mode desktop / DocAgentRunner (lihat §12.16 untuk batasan hosted).

**Algoritma konseptual validasi (per provider, via adapter `validateCredential`):**
```
INPUT: provider, credential (api_key ATAU oauth_token)
1. Sanitasi & format check sesuai provider (prefix/panjang plausibel). Gagal → error inline ramah.
2. Validasi liveness (panggilan termurah, sesuai provider):
   - Gemini  : GET ListModels  ATAU generateContent minimal (flash-lite, thinking_level=MINIMAL)
   - OpenAI  : panggilan Responses API minimal (model mini, max output kecil) ATAU list models
   - Codex   : verifikasi sesi/token (OAuth access token valid)
3. Interpretasi respons (normalisasi lintas provider):
   - 200 OK            → kredensial valid & berizin. Lanjut step 4.
   - 401/403           → ditolak provider → "Kredensial ditolak. Cek kembali."
   - 429               → "valid tapi sedang limit"; info ramah.
   - 5xx/timeout       → masalah sementara provider → "Coba lagi sebentar."
4. Deteksi kapabilitas (best-effort, isi matriks §12.14.4): grounded search, deep research,
   image generation (mis. OpenAI butuh Org Verification untuk GPT Image), vision/dokumen.
   → simpan capability flags per provider untuk model routing & penyesuaian UI.
5. Simpan kredensial dengan envelope encryption via KMS (api_key MAUPUN oauth_token).
   PLAINTEXT/TOKEN TIDAK PERNAH DI-LOG / DISIMPAN MENTAH.
6. Tandai onboarding.byok = true (untuk provider tersebut). User boleh menautkan >1 provider.
OUTPUT: status valid + capability flags + provider aktif (default).
```

**Prinsip UX validasi:**
- **Pemilih provider yang jelas** dengan penjelasan singkat "untuk apa" tiap pilihan + rekomendasi default (Gemini untuk pemula).
- **Panduan 60 detik per provider**: kartu bergambar + **deep link** ke tempat membuat kredensial (Google AI Studio / OpenAI dashboard / ChatGPT sign-in) — buka tab baru.
- **Paste-friendly** (untuk API key): field besar, tombol *paste*, masking otomatis (`••••••••abCD`). Untuk Codex: tombol "Masuk dengan ChatGPT" (OAuth) atau alur device-code.
- **Real-time feedback**: **Validating… → Valid ✓** atau error spesifik & *actionable*.
- **Transparansi biaya** (sesuai provider): Gemini → "memakai kuota gratis Google-mu"; OpenAI → "memakai kuota usage-based OpenAI-mu"; Codex → "memakai langganan ChatGPT-mu".
- **Keamanan terlihat**: ikon gembok + "Kredensialmu dienkripsi dan tidak pernah kami lihat dalam bentuk asli."

### 9.1.5 Onboarding Profil & Ide Pertama
- **Profil (tap-based, maks 4)**: Sektor • Tahap (ide/jalan) • Tujuan utama • (opsional) Skala anggaran. Disimpan untuk personalisasi default & prompt.
- **Ide pertama**: textarea "Ceritakan ide bisnismu dalam 1–3 kalimat." + contoh placeholder. Jika kosong, pengguna boleh "Saya belum punya ide, bantu eksplor" → AgentBuff Co-Founder masuk mode *ideation* ringan (di Modul Research).
- Saat selesai → buat **Project** (entity utama) → masuk Dashboard.

### 9.1.6 Data Model (ringkas)
```
User { id, google_sub, email, display_name, locale, created_at }
ByokCredential { user_id, provider('gemini'|'openai'|'openai_codex'),
                 cred_type('api_key'|'oauth_token'),
                 ciphertext, fingerprint(hash),
                 capability_flags{ grounded_search:bool, deep_research:bool,
                                   image_gen:bool, vision:bool, doc_understanding:bool,
                                   doc_agent_cli:bool },
                 is_default:bool, last_validated_at, status }
// Catatan: user boleh punya >1 ByokCredential (multi-provider). is_default menandai
// provider aktif; routing per-kelas-tugas dapat menimpa (lihat §12.14.5).
OnboardingProfile { user_id, sector, stage, primary_goal, budget_band }
PartnerFederation { partner_id, name, public_key/secret_ref, redirect_allowlist[], status }
```

### 9.1.7 Edge Cases
- Key valid saat onboarding lalu **dicabut/limit** di kemudian hari → sistem mendeteksi 401/429 saat runtime → banner "Key bermasalah; perbarui di Pengaturan" + *graceful pause* job.
- Pengguna menutup tab saat validasi → state tersimpan; saat kembali diminta lagi.
- Federated user tanpa key → diarahkan ke alur Validasi Key sebelum bisa pakai modul AI.
- Multiple keys (lanjutan): v1 = satu key per user; arsitektur menyiapkan *key rotation*.

### 9.1.8 States
- **Loading (validasi)**: tombol jadi spinner + label "Memeriksa key…"; field terkunci sementara.
- **Empty (belum input)**: ilustrasi + CTA + tautan panduan.
- **Error**: pesan spesifik per kode (lihat 9.1.4) dengan langkah perbaikan; tidak pernah menampilkan stack trace.
- **Success**: centang hijau + transisi otomatis ke step berikutnya setelah 800ms.

---

## 9.2 MODUL 2 — DEEP RESEARCH & VALIDATOR

### 9.2.1 Tujuan
Mengubah ide mentah menjadi **keputusan berbasis bukti**: apakah ada pasar, siapa kompetitor, berapa kisaran harga & demand, apa risiko utama, dan **skor kelayakan**. Menjawab pain "takut gagal" dan "bingung mulai".

> 🔗 **MANDAT SUMBER DATA CLICKABLE (NON-NEGOTIABLE).** Setiap klaim faktual/numerik hasil validasi **wajib** disertai **sumber yang dapat diklik** dan dibuka langsung oleh pengguna ke halaman aslinya. Tujuannya menghapus keraguan *"data ini benar tidak, jangan-jangan AI-nya bohong?"*. Mekanisme teknisnya memakai **anotasi `url_citation`** dari Grounding Google Search (lihat detail di §12.9): setiap segmen teks (ditandai `start_index`/`end_index`) terhubung ke `url` + `title` sumber. Di UI, klaim yang tergrounding menampilkan **chip sumber** kecil (favicon + nama domain) yang membuka tab baru; daftar **"Semua Sumber"** ditampilkan di akhir laporan. Klaim **tanpa** sumber tergrounding **wajib** diberi label **"estimasi"** secara eksplisit dan dibedakan visualnya. AgentBuff Co-Founder tidak pernah menyajikan angka pasar seolah-olah fakta tanpa jejak sumber. *(Catatan kepatuhan: snippet `search_suggestions` dari Google Search dirender sesuai Terms of Service.)*

### 9.2.2 User Flow
```
Dashboard → "Validasi Ide" → 
  (opsional) Klarifikasi cepat (target market? lokasi? model?) →
  AgentBuff Co-Founder menjalankan Research Pipeline (grounded, multi-step, streaming progress) →
  Laporan Validasi + Skor + Risiko + Rekomendasi →
  Q&A lanjutan (chat kontekstual) →
  "Lanjut ke Business Plan"
```

### 9.2.3 Functional Logic — Research Pipeline (Algoritma Konseptual)
Pipeline bersifat *multi-step* dengan *grounding* nyata dan *structured output*:

```
STAGE 0 — Idea Normalization
  - LLM (flash) merapikan ide → {product, target_segment, geography, business_model, value_prop}
  - Jika ambigu, ajukan 1–3 pertanyaan klarifikasi (tap/short text).

STAGE 1 — Market Demand Research (GROUNDED)
  - Panggilan Gemini dengan tool google_search aktif → cari ukuran pasar, tren, perilaku konsumen, kata kunci permintaan di geografi target.
  - Output terstruktur (responseSchema): demand_signals[], trend_direction, sources[].

STAGE 2 — Competitor Research (GROUNDED + URL CONTEXT)
  - google_search untuk menemukan kompetitor; url_context untuk membaca situs/listing kompetitor bila URL tersedia.
  - Output: competitors[] { name, positioning, price_range, strengths, weaknesses, source }.

STAGE 3 — Pricing & Cost Benchmarks (GROUNDED)
  - Cari kisaran harga pasar & benchmark biaya bahan/operasional lokal.
  - Output: price_benchmarks{min,median,max,currency=IDR}, cost_benchmarks[].

STAGE 4 — Risk & Regulatory Scan
  - Identifikasi risiko (saturasi, musiman, margin tipis) + regulasi/izin relevan (mis. PIRT/halal/izin usaha) bila terdeteksi sektor terkait.
  - Output: risks[] { type, severity(1-5), description, mitigation }.

STAGE 5 — Validation Scoring (DETERMINISTIC)
  - Skor 0–100 dihitung di KODE dari sinyal terstruktur stage 1–4 (bukan diminta LLM mengarang skor).
  - Lihat 9.2.4 untuk formula.

STAGE 6 — Synthesis (Narasi)
  - LLM menyusun ringkasan eksekutif + rekomendasi "Go / Refine / Reconsider" dengan alasan, mengutip sumber.
  - Semua klaim numerik mengikat ke data terstruktur stage sebelumnya.
```

Pipeline dieksekusi sebagai **async job** (queue) dengan **streaming progress** ke UI (lihat States).

### 9.2.4 Validation Score — Formula Deterministik (Konsep)
Skor adalah agregasi tertimbang dari sinyal terstruktur (semua sinyal dinormalisasi 0–1):
```
ValidationScore = 100 * (
    w1 * demand_strength        // dari jumlah & kekuatan demand_signals + trend_direction
  + w2 * margin_headroom        // (price_median - cost_estimate)/price_median, clamp 0..1
  + w3 * competition_gap        // 1 - saturation_index (dari jumlah & kekuatan kompetitor)
  + w4 * differentiation        // kecocokan value_prop terhadap weakness kompetitor (skor LLM 0..1, tapi dibobot kecil)
  - penalty_regulatory          // jika ada izin berat belum terpenuhi
)
Σ w = 1 (mis. w1=0.35, w2=0.30, w3=0.20, w4=0.15)
```
- **Banding**: skor ≥70 → "Go" (hijau), 45–69 → "Refine" (kuning, beri saran perbaikan), <45 → "Reconsider/Pivot" (merah, beri arah pivot).
- **Transparansi**: tampilkan *breakdown* per komponen agar pengguna paham *mengapa*. Hindari "black box".
- **Kejujuran**: skor rendah disampaikan suportif + jalur pivot, bukan sekadar "ditolak".

### 9.2.5 Integrasi Gemini (Dua Jalur Implementasi)

AgentBuff Co-Founder menyediakan **dua jalur** yang berbagi *output schema* sama; engine memilih berdasarkan kedalaman yang diminta & kapabilitas key pengguna.

**Jalur A — Managed Deep Research Agent (disarankan untuk "Riset Mendalam").** Memakai **Interactions API** Gemini dengan agen `deep-research-preview-04-2026` (cepat, ideal di-*stream* ke UI) atau `deep-research-max-preview-04-2026` (komprehensif). Agen ini secara mandiri **merencanakan, menelusuri, membaca, dan mensintesis** laporan multi-langkah **lengkap dengan kutisan/citations** — persis kebutuhan validasi. Karakteristik teknis yang **wajib** diikuti (rujuk dok §12.8):
- Hanya tersedia via Interactions API (`client.interactions.create(...)`), **bukan** `generateContent`. Endpoint `POST https://generativelanguage.googleapis.com/v1beta/interactions`, header `x-goog-api-key` + `Api-Revision` (mis. `2026-05-20`).
- **Wajib async**: set `background=true`, lalu *poll* `client.interactions.get(id)` (status `completed`/`failed`, baca `output_text`/`error`) atau *stream* update. Tugas dapat memakan beberapa menit → sejalan dengan async job + progress (lihat States).
- **Perencanaan kolaboratif** (`agent_config.collaborative_planning=true`): agen mengembalikan *rencana riset* lebih dulu untuk ditinjau/diubah pengguna sebelum dieksekusi (lanjutkan via `previous_interaction_id`). Ini cocok untuk persona pemula yang ingin mengarahkan fokus ("lebih fokus ke kompetitor lokal"). `agent_config.thinking_summaries="auto"` menampilkan ringkasan proses berpikir untuk transparansi.
- Mendukung **MCP, visualisasi (diagram/grafik), dan input dokumen** — dimanfaatkan untuk Q&A lanjutan & impor materi (lihat §9.3 Import).

**Jalur B — Custom Multi-Stage Pipeline (Stage 0–6 di atas).** Untuk validasi cepat/hemat dan kontrol granular skoring. Memakai `generateContent` (atau Interactions) per-stage dengan:
- **Grounding `google_search`** pada stage yang butuh data live (1–4). Respons mengandung langkah `google_search_call` (queries), `google_search_result` (`search_suggestions`), dan `model_output` dengan **`annotations: url_citation`** → inilah sumber clickable (lihat §12.9). Rujuk dok §12.9.
- **`url_context`** untuk membaca situs/listing kompetitor bila URL spesifik tersedia (rujuk dok URL context, §12.7).
- **Structured Outputs** (JSON Schema) agar hasil tiap stage *type-safe* untuk Financial Engine & dokumen hilir (rujuk dok Structured Output, §12.7).
- **`thinking_level`** dinaikkan pada sintesis berat untuk hemat (alih-alih memakai Pro).

**Umum untuk kedua jalur:**
- **Provider-agnostik (lihat §12.14).** Kedua jalur diakses lewat `LLMProvider`. Pada **OpenAI**, Jalur A = model **`o3-deep-research`/`o4-mini-deep-research`** (Responses API, `background=true`, wajib ≥1 sumber data) dan Jalur B = tool **`web_search`**. Keduanya menghasilkan **`url_citation`** sehingga sumber clickable identik lintas vendor (§12.9, §12.15).
- **Model routing** (lihat §12.2): normalisasi/sintesis ringan → Flash-Lite/Flash; riset → Deep Research agent atau Flash+grounding; penalaran berat → Pro atau Flash dengan `thinking_level` tinggi.
- **Skor tetap deterministik** (Stage 5): apa pun jalurnya, **ValidationScore dihitung KODE** dari sinyal terstruktur — agen riset hanya menyediakan bahan tergrounding, **tidak** memberi skor.
- **Caching**: hasil riset disimpan di Project State & di-*context-cache* untuk modul berikutnya (rujuk dok Context Caching, §12.7) — hemat token & jaga konsistensi.
- **Budget grounding**: batasi query grounded per validasi (mis. 6–10) demi free tier key pengguna (±5.000 grounded prompt/bulan untuk Gemini 3; lihat §12.4).

### 9.2.6 Fitur Pendukung
- **Sumber Daya (Resource Finder)**: AgentBuff Co-Founder mengumpulkan tautan sumber daya relevan (supplier, asosiasi, program pembiayaan seperti KUR, marketplace) sebagai *resource list* tersitasi.
- **Q&A Kontekstual**: setelah laporan, pengguna bisa bertanya ("Bagaimana kalau di kota X?") → AgentBuff Co-Founder menjawab dalam konteks laporan, dapat memicu mini-research tambahan.
- **Re-run**: pengguna bisa mengubah parameter (lokasi/segmen) dan menjalankan ulang; versi laporan tersimpan.

### 9.2.7 Data Model
```
ResearchReport {
  id, project_id, status, validation_score, recommendation('go'|'refine'|'reconsider'),
  source_path('deep_research_agent'|'custom_pipeline'),   // jalur yang dipakai
  interaction_id,                                          // bila Jalur A (Interactions API)
  score_breakdown{...},
  market{ demand_signals[], trend_direction },
  competitors[]{ name, positioning, price_range, strengths, weaknesses, source_url },
  pricing{ min, median, max, currency },
  costs[]{ item, est_amount, source },
  risks[]{ type, severity, description, mitigation },
  resources[]{ label, url, type },
  // Sumber clickable — disimpan apa adanya dari anotasi grounding:
  citations[]{ claim_text, start_index, end_index, source_url, source_title, confidence },
  sources[]{ title, url, favicon_url, accessed_at },
  is_grounded(bool), grounding_query_count,
  search_suggestions_html,        // dirender sesuai ToS Google Search
  generated_at, version
}
```
- Setiap item bertanda **estimasi** (tanpa entri `citations`) ditandai `confidence='estimate'` agar UI membedakannya.

### 9.2.8 Edge Cases
- **Grounding kosong/lemah** (ide sangat niche) → tandai *low-confidence*, sampaikan keterbatasan data, sarankan riset manual. Skor diberi *confidence band*.
- **Hasil bertentangan antar sumber** → tampilkan rentang & catat ketidakpastian (jangan memaksakan satu angka).
- **Quota grounding habis** (429) → degrade gracefully ke riset non-grounded + peringatan, atau tunda dengan opsi "lanjutkan nanti".
- **Sektor sensitif/ilegal** → AgentBuff Co-Founder menolak melakukan riset yang memfasilitasi hal melanggar hukum, dengan penjelasan sopan.

### 9.2.9 States
- **Loading (pipeline berjalan)**: **stepper progres bermakna** — "Menganalisis permintaan pasar… → Memeriksa kompetitor… → Membandingkan harga… → Menilai risiko… → Menyusun laporan…". Tampilkan estimasi waktu, hasil parsial yang sudah masuk, dan tombol *Cancel*. **Tidak pernah spinner kosong tanpa konteks.**
- **Long job**: jika >X detik, izinkan *background* + notifikasi saat selesai ("Laporan validasimu siap").
- **Empty**: sebelum dijalankan, tampilkan penjelasan apa yang akan dilakukan + tombol mulai.
- **Error**: pesan ramah + tombol *Coba lagi*; simpan progres parsial.
- **Success**: laporan tampil dengan skor menonjol, breakdown, dan CTA "Lanjut ke Business Plan". **Setiap klaim faktual menampilkan chip sumber clickable** (favicon + domain) yang membuka tab baru; bagian **"Semua Sumber (N)"** dapat dilipat di akhir; item **estimasi** diberi badge abu-abu "estimasi" agar jujur. Tombol "Lihat proses berpikir" (opsional) menampilkan ringkasan langkah riset.

---

## 9.3 MODUL 3 — MASTER BUSINESS PLANNER

### 9.3.1 Tujuan
Menghasilkan **business plan end-to-end** lengkap dengan **model finansial yang akurat dan deterministik**: modal awal, HPP, margin, proyeksi laba-rugi & arus kas, BEP, ROI, payback period, roadmap, strategi marketing, dan funneling. Menjawab pain "buta finansial".

### 9.3.2 Filosofi Inti — "LLM Proposes, Code Disposes"
**Angka tidak boleh dihalusinasi.** Pembagian peran yang tegas:
- **LLM bertugas**: menafsirkan input awam, mengusulkan *asumsi* yang masuk akal (di-*ground* pada benchmark riset), menyusun narasi strategi/marketing/roadmap.
- **Deterministic Financial Engine (kode) bertugas**: semua aritmetika finansial (HPP, margin, BEP, proyeksi, ROI, cash flow). Engine ini *unit-tested* dan *auditable*.

Ini adalah **moat kepercayaan** AgentBuff Co-Founder dan pembeda utama vs chatbot generik.

### 9.3.3 User Flow
```
Dashboard → "Buat Business Plan" →
  Financial Intake Wizard (pertanyaan awam, bertahap, dengan saran terisi otomatis dari riset) →
  Engine menghitung → tampilkan Model Finansial interaktif (bisa diutak-atik) →
  AgentBuff Co-Founder menyusun narasi plan (grounded) →
  Business Plan utuh (editable, berssection) →
  "Setujui & Lanjut ke Brand"
```

### 9.3.4 Financial Intake Wizard — Logic
Pertanyaan dalam bahasa awam, dikelompokkan, dengan **default cerdas** dari Research Report (pengguna tinggal konfirmasi/ubah):
- **Model bisnis**: produk fisik / jasa / digital / hybrid (menentukan rumus yang dipakai).
- **Harga jual** per unit/paket (default: median harga dari riset).
- **Komponen biaya bahan/COGS** per unit (untuk produk; daftar item + biaya).
- **Biaya tetap bulanan** (sewa, gaji, listrik, langganan, dll.).
- **Biaya variabel non-COGS** (komisi, ongkir, marketing per penjualan).
- **Estimasi volume penjualan** awal + asumsi pertumbuhan (default skenario dari tren riset).
- **Modal awal items** (peralatan, renovasi, stok awal, perizinan, dll.).
- **Sumber modal** (sendiri/pinjaman/investor) + bunga bila ada.
- **Horizon proyeksi**: 12 / 24 / 36 bulan.

UX: satu kelompok per layar, *inline help* tiap istilah, validasi input (angka, mata uang IDR), tombol "AgentBuff Co-Founder, isikan saran" (mengisi dari benchmark riset).

#### 9.3.4.1 Import Dokumen (Pre-fill Otomatis via Document Understanding)
Untuk mempercepat intake dan mengurangi ketik manual, pengguna dapat **mengunggah dokumen** (PDF) yang sudah dimiliki — daftar harga supplier, catatan keuangan sederhana, invoice, menu, atau bahkan proposal lama — lalu AgentBuff Co-Founder mengekstrak angka/komponen relevan untuk **mengisi wizard**. Implementasi (rujuk dok Document Understanding, §12.11):
- Memakai **native vision `generateContent`** yang memahami teks, tabel, diagram, dan grafik dalam PDF (hingga 1000 halaman). Dokumen kecil dikirim *inline*; dokumen besar/akan-dipakai-ulang via **Files API**.
- Output **Structured Output (JSON Schema)** yang dipetakan ke field wizard (mis. `cost_items[]`, `price_list[]`, `fixed_costs[]`). 
- **Human-in-the-loop wajib**: hasil ekstraksi disajikan sebagai **saran terisi** yang harus dikonfirmasi/diedit pengguna sebelum masuk engine — sesuai prinsip *"LLM Proposes, Code Disposes"* (angka final tetap milik pengguna/engine, bukan ditarik mentah dari LLM).
- **Roadmap (non-v1):** alih-alih unggah manual, sumber angka dapat ditarik dari **AgentBuff POS** (penjualan & HPP nyata) / **AgentBuff Absent** (biaya tenaga kerja) via MCP (lihat §1.5 & §18.3).
- **Edge case**: dokumen buram/*scan* → Document Understanding tetap mencoba (vision), namun bila keyakinan rendah, tandai field sebagai "perlu diperiksa". Dokumen non-PDF diperlakukan sebagai teks biasa (kehilangan konteks tabel/format) — sarankan unggah PDF.

### 9.3.5 Deterministic Financial Engine — Algoritma Konseptual
Semua dihitung di kode (server-side, dapat juga dipratinjau client-side). Output disimpan terstruktur.

```
INPUT (tervalidasi & ternormalisasi ke IDR):
  price, cogs_items[], fixed_costs_monthly[], variable_costs[], 
  volume_initial, growth_model{type, rate/seasonality}, 
  capex_items[], funding{equity, loan{principal, rate, tenor}}, horizon_months

DERIVED:
  HPP_per_unit (COGS/unit)      = Σ cogs_items
  fixed_monthly                 = Σ fixed_costs_monthly
  variable_per_unit             = Σ variable_costs (yang per-unit)
  contribution_margin_per_unit  = price - HPP_per_unit - variable_per_unit
  gross_margin_pct              = (price - HPP_per_unit) / price
  startup_capital               = Σ capex_items + working_capital_buffer

BREAK-EVEN:
  BEP_units (per bulan)         = fixed_monthly / contribution_margin_per_unit
  BEP_revenue                   = BEP_units * price
  (Guard: jika contribution_margin_per_unit <= 0 → FLAG "harga di bawah biaya"; minta revisi.)

MONTHLY PROJECTION (t = 1..horizon):
  units_t        = projeksi volume via growth_model (linear/compound/seasonal)
  revenue_t      = units_t * price
  cogs_t         = units_t * HPP_per_unit
  var_cost_t     = units_t * variable_per_unit
  gross_profit_t = revenue_t - cogs_t
  opex_t         = fixed_monthly + var_cost_t + loan_interest_t
  net_profit_t   = gross_profit_t - fixed_monthly - var_cost_t - loan_interest_t - tax_estimate_t
  cash_flow_t    = net_profit_t + non_cash_adjustments - loan_principal_repayment_t
  cumulative_cash_t = cumulative_cash_(t-1) + cash_flow_t

KPIs:
  payback_period   = bulan saat cumulative_net_profit ≥ startup_capital
  ROI (horizon)    = (Σ net_profit over horizon) / total_investment
  (Opsional lanjutan) NPV, IRR dengan discount rate yang dapat diatur
  runway           = bulan hingga cumulative_cash < 0 (jika rugi)

OUTPUT (structured): semua tabel bulanan + ringkasan KPI + flags/warnings.
```

**Validation rules (Financial Trust):**
- Tidak boleh ada margin negatif tak disengaja tanpa peringatan.
- BEP harus terdefinisi; jika tak tercapai dalam horizon → peringatan eksplisit.
- Semua nilai dalam IDR, format ribuan, pembulatan konsisten.
- Sanity bounds dari benchmark riset (mis. margin 95% di sektor F&B → minta konfirmasi).

### 9.3.6 Penyusunan Narasi Business Plan (LLM, Grounded)
Setelah angka final, LLM menyusun section naratif yang **mengikat ke angka & riset** (structured output → template):
- Executive Summary
- Deskripsi Usaha & Value Proposition
- Analisis Pasar (dari Research Report)
- **Strategi Pemasaran** (kanal, positioning, konten, anggaran marketing yang konsisten dengan model finansial)
- **Funneling** (awareness → consideration → conversion → retention; taktik konkret per tahap + metrik)
- Rencana Operasional & Supply
- Struktur Tim/Organisasi
- **Rencana Keuangan** (menyisipkan tabel & KPI dari engine — bukan angka karangan)
- **Roadmap Pengembangan** (milestone bertahap, mis. 0–3 bln, 3–6 bln, 6–12 bln)
- Analisis Risiko & Mitigasi (dari riset)
- Penutup

Setiap angka di narasi **ditarik dari engine** (template binding), bukan diketik ulang oleh LLM.

### 9.3.7 Staleness Propagation (Konsistensi Antar Modul)
Karena modul saling mewarisi konteks:
- Jika Research Report diubah → Business Plan ditandai "perlu diperbarui".
- Jika input finansial diubah → engine re-compute → narasi keuangan & dokumen hilir (proposal/deck) ditandai *stale* dengan badge "Perbarui".
- Pengguna memutuskan kapan menerima pembaruan (no silent overwrite).

### 9.3.8 Integrasi Gemini
- **Intake parsing & saran**: Flash-Lite/Flash (cepat, murah) + structured output untuk menormalkan input awam jadi angka.
- **Narasi plan**: Pro atau Flash dengan `thinking_level` MEDIUM/HIGH untuk kualitas penalaran strategi; structured output ke skema section.
- **Grounding**: dipakai bila perlu benchmark tambahan (mis. CPC marketing, biaya sewa area tertentu).
- **Caching**: Project State (riset + angka) di-context-cache; narasi panjang memakai cache untuk hemat & konsistensi.
- **Code Execution (opsional)**: untuk skenario *what-if* kompleks, perhitungan boleh dijalankan via sandbox; namun **engine deterministik internal tetap sumber kebenaran** untuk angka final.

### 9.3.9 Fitur Interaktif Model Finansial
- **Sliders/what-if**: ubah harga/volume/biaya → tabel & grafik update real-time (kalkulasi client-side untuk responsivitas; sinkron server).
- **Skenario**: Pesimistis / Realistis / Optimistis (engine menghasilkan tiga set).
- **Visualisasi**: grafik proyeksi laba, cash flow kumulatif, titik BEP, payback.
- **Glossary inline**: tap istilah → definisi + contoh.

### 9.3.10 Data Model
```
BusinessPlan {
  id, project_id, status, version,
  inputs{ model_type, price, cogs_items[], fixed_costs[], variable_costs[], 
          volume_initial, growth_model, capex_items[], funding, horizon_months },
  financials{
    hpp_per_unit, gross_margin_pct, contribution_margin_per_unit, startup_capital,
    bep_units, bep_revenue, payback_period_months, roi_pct, npv?, irr?,
    monthly[]{ t, units, revenue, cogs, gross_profit, opex, net_profit, cash_flow, cumulative_cash },
    scenarios{ pessimistic{...}, realistic{...}, optimistic{...} },
    warnings[]
  },
  narrative{ exec_summary, business_desc, market_analysis, marketing_strategy, 
             funnel, operations, team, financial_plan, roadmap[], risks[], closing },
  stale: bool, generated_at
}
```

### 9.3.11 Edge Cases
- Margin negatif / biaya > harga → blokir lanjut, minta revisi dengan penjelasan.
- Volume nol/tidak realistis → peringatan & saran.
- Pinjaman dengan bunga ekstrem → tampilkan dampak ke cash flow & payback.
- Bisnis jasa tanpa COGS unit → pakai rumus berbasis kapasitas/jam, bukan unit produk.
- Horizon pendek tapi payback panjang → tampilkan "belum balik modal dalam horizon".

### 9.3.12 States
- **Loading (compute)**: engine cepat (deterministik) → biasanya instan; narasi LLM → streaming section per section dengan skeleton.
- **Empty**: penjelasan + tombol mulai wizard.
- **Error (LLM narasi)**: angka tetap tampil (engine sukses); narasi bisa di-*retry* tanpa kehilangan angka.
- **Warning state**: badge kuning untuk flags finansial.
- **Success**: model finansial + plan tampil; CTA "Setujui & Lanjut ke Brand".

---

## 9.4 MODUL 4 — CREATIVE & BRAND STUDIO ("Brand Forge Studio")

> **Nama fitur profesional:** **Brand Forge Studio** — "menempa identitas bisnis dari rencana yang sudah tervalidasi."

### 9.4.1 Tujuan
Setelah business plan disetujui, menghasilkan **konsep identitas brand** yang koheren: positioning & naming, tone of voice, **moodboard konten**, **ide visual logo**, **palet warna & tipografi**, **konsep interior/outlet** (bisnis fisik), dan **konsep desain produk/kemasan**. Menjawab kebutuhan "tampil profesional" tanpa skill desain.

### 9.4.2 Prinsip
- **Konsep, bukan aset final cetak.** Brand Forge menghasilkan *concept direction* + visual referensi berkualitas yang bisa langsung dipakai atau dibawa ke desainer. (Transparansi: ini akselerator kreatif, bukan pengganti brand agency penuh.)
- **Koheren dengan plan.** Semua output diturunkan dari value proposition, segmen, dan positioning di business plan (context-cached).
- **Brand consistency.** Sekali arah brand dipilih, seluruh aset (dan nanti pitch deck) memakai palet/tipografi/tone yang sama → menghasilkan **Brand Kit** sebagai *single source of truth* desain.

### 9.4.3 User Flow
```
Dashboard → "Buat Identitas Brand" →
  Brand Brief otomatis (ditarik dari plan) + 2–3 pilihan arah (tap) →
  AgentBuff Co-Founder generate Brand Concept v1 (teks + visual) →
  Pengguna pilih/iterasi tiap komponen (naming, logo, palet, moodboard, interior, kemasan) →
  Brand Kit terkunci → "Lanjut ke Dokumen"
```

### 9.4.4 Komponen & Logic per Sub-fitur

1. **Brand Strategy & Positioning** (LLM, structured):
   - Output: brand_essence, positioning_statement, personality_traits, value_pillars, target_persona_recap.
2. **Naming Studio** (LLM):
   - Hasilkan 5–8 opsi nama + rasional + cek ketersediaan dasar (heuristik: domain/username plausibility; opsional grounding untuk cek tabrakan nama umum). *Tidak* mengklaim hasil pengecekan merek hukum (beri disclaimer untuk verifikasi DJKI/legal).
3. **Tone of Voice & Messaging** (LLM):
   - Voice attributes, contoh tagline (3–5), contoh caption, do/don'ts.
4. **Color Palette & Typography** (LLM + tokenisasi):
   - Palet (primary/secondary/accent/neutral dengan HEX), rasional psikologi warna, pasangan tipografi (heading/body) dari font open-source (mis. Google Fonts) agar bebas lisensi.
   - Disimpan sebagai **design tokens** (dipakai ulang oleh Deck & Docs Engine).
5. **Moodboard Generator** (Nano Banana — gambar):
   - Generate beberapa visual moodboard (suasana, gaya fotografi, referensi konten) sesuai brand brief.
6. **Logo Concept Generator** (Nano Banana — gambar):
   - Hasilkan beberapa **konsep/arah logo** (bukan file vektor produksi). Disclaimer: konsep awal untuk dibawa ke desainer/di-vektorkan. Hindari meniru logo merek nyata.
7. **Interior / Outlet Concept** (Nano Banana — gambar, kondisional bisnis fisik):
   - Render konsep tata letak/atmosfer outlet (kedai, booth, toko) sesuai brand & budget.
8. **Product / Packaging Concept** (Nano Banana — gambar, kondisional):
   - Konsep desain produk/kemasan/mockup.

### 9.4.5 Integrasi Gemini (Image Stack — rujuk §12.10)
- **Teks brand** (strategi, naming, tone, rasional palet): Flash/Pro + Structured Output (JSON Schema).
- **Gambar — model utama: Nano Banana / Nano Banana Pro** (Gemini multimodal image generation) via **key user (BYOK)**. Dipilih sebagai default karena keunggulan yang relevan untuk brand kit:
  - **Teks akurat di dalam gambar** → nama brand dapat dirender benar pada mockup kemasan, signage outlet, dan moodboard (kemampuan yang historisnya lemah pada model image lama).
  - **Preservasi detail tinggi & integrasi logo** → menempatkan konsep logo ke mockup produk/ad secara konsisten.
  - **Search grounding pada gambar** (Google Image Search grounding) → referensi visual yang akurat untuk gaya/objek tertentu.
  - Cocok untuk: moodboard, konsep logo, interior/outlet, produk/kemasan, mockup komersial.
- **Gambar — opsi fotorealistis: Imagen** (rujuk dok Imagen, §12.10) untuk *hero shot* fotorealistis berkualitas tinggi. **Catatan wajib:** semua keluaran Imagen menyertakan **watermark SynthID**; gunakan untuk visual realistis, sedangkan Nano Banana untuk pekerjaan yang butuh teks/edit/integrasi logo. **Verifikasi status & ketersediaan model di halaman Deprecations** sebelum implementasi (lihat §12.13) — pilihan model dibuat *config-driven* (§12.2) agar tahan perubahan.
- **Gambar — alternatif provider: OpenAI `gpt-image-2`** (rujuk §12.15). Bila pengguna memakai OpenAI, brand assets digenerate dengan `gpt-image-2` (juga unggul **rendering teks akurat**, edit, world knowledge) via Image API atau Responses API tool `{type:"image_generation"}`. **Catatan:** GPT Image **butuh API Organization Verification** pada akun OpenAI pengguna; bila belum, fitur gambar dinonaktifkan dengan penjelasan + saran (mis. tambah Gemini key untuk gambar). Adapter menormalkan output (base64) ke `assets[].image_ref`.
- **Pemilihan provider gambar** mengikuti capability detection (§12.14.4) & preferensi pengguna; estetika di-*seed* design tokens yang sama agar konsisten lintas provider.
  - **Analisis unggahan pengguna**: foto logo lama, etalase, atau produk kompetitor → AgentBuff Co-Founder mengekstrak gaya/warna untuk menyelaraskan konsep, atau membandingkan terhadap kompetitor.
  - **QA aset hasil generasi**: memeriksa apakah teks pada gambar terbaca benar / sesuai brief (OCR & visual Q&A) sebelum ditampilkan.
- **Konsistensi**: prompt gambar di-*seed* dengan **design tokens** (warna HEX, estetika, nama brand) untuk hasil seragam lintas aset & lintas dokumen (Deck & Docs Engine memakai tokens yang sama).
- **Cost control (BYOK)**: batasi jumlah generasi gambar default per komponen (mis. 3–4), dengan tombol "buat lagi" eksplisit agar pengguna sadar konsumsi kuota; gambar adalah operasi termahal sehingga selalu di-antri & diberi indikator pemakaian kuota.

### 9.4.6 Brand Kit (Output Terstruktur)
```
BrandKit {
  id, project_id, status, version,
  strategy{ essence, positioning, personality[], pillars[] },
  naming{ selected_name, alternatives[]{name, rationale, availability_hint} },
  voice{ attributes[], taglines[], samples[], dos[], donts[] },
  visual_tokens{ colors{primary,secondary,accent,neutral[]}, typography{heading,body}, 
                 logo_direction, imagery_style },
  assets[]{ type('moodboard'|'logo'|'interior'|'packaging'), image_ref(storage_url), prompt_used, selected:bool },
  generated_at
}
```

### 9.4.7 Edge Cases
- **Bisnis non-fisik** → sembunyikan komponen interior/kemasan.
- **Generasi gambar gagal/limit (429)** → tampilkan placeholder + opsi retry; teks brand tetap tersedia.
- **Konten gambar tidak sesuai kebijakan** → filter & regenerate; jangan menampilkan konten bermasalah.
- **Permintaan meniru brand terkenal** → tolak; arahkan ke konsep orisinal.
- **Penyimpanan**: aset gambar disimpan dengan *expiring URLs*; pengguna diingatkan mengunduh.

### 9.4.8 States
- **Loading (teks)**: skeleton kartu komponen + streaming.
- **Loading (gambar)**: placeholder ber-*shimmer* per slot gambar dengan label "Membuat konsep visual… (memakai kuota Gemini-mu)"; tampilkan satu per satu saat selesai.
- **Empty**: brief + tombol generate.
- **Error**: per-komponen, tidak menggagalkan seluruh studio.
- **Success**: galeri komponen terpilih + tombol kunci Brand Kit.

---

## 9.5 MODUL 5 — DOCS & PITCH GENERATOR ("Deck & Docs Engine")

> **Nama fitur profesional:** **Deck & Docs Engine** — merakit seluruh data project menjadi dokumen investor-grade.

### 9.5.1 Tujuan
Menghasilkan dua artefak berkualitas tinggi melalui pipeline **Gemini → HTML/CSS → PDF**:
- **Output 1 — PDF Business Proposal**: formal, terstruktur, rapi (portrait A4).
- **Output 2 — PDF Pitch Deck**: gaya presentasi (landscape 16:9), cantik, *to-the-point*, menjual di mata investor.

Menjawab pain "tidak bisa bikin proposal/pitch deck".

### 9.5.2 Mengapa HTML→PDF (Keputusan Teknis)
- Gemini sangat baik menghasilkan **HTML/CSS terstruktur**. Dengan mengarahkan ke **template + design tokens** (dari Brand Kit), hasil jadi konsisten & on-brand, bukan "free-style" yang rapuh.
- HTML→PDF memberi kontrol tipografi, layout, page-break, header/footer, dan pagination yang jauh lebih baik dari "ekspor teks".
- **Rendering engine**: headless Chromium (mis. Puppeteer/Playwright) + **paged media (Paged.js / CSS Paged Media)** untuk pagination presisi (nomor halaman, daftar isi, page-break terkontrol). Untuk hemat, opsi *print-to-PDF* sisi klien tersedia sebagai fallback.

#### 9.5.2.1 Generator Berbasis Agen CLI (Gemini CLI / Antigravity CLI)
Karena membangun dokumen HTML yang rapi adalah tugas **agentik** (butuh penalaran "harus pakai komponen/template apa", menulis HTML/CSS, lalu menjalankan konversi), AgentBuff Co-Founder menjalankan generasi dokumen melalui **agen CLI dalam mode headless** di dalam *worker* tersandbox — bukan satu pemanggilan LLM tunggal. Rujuk dok Gemini CLI (§12.12).

**Mengapa agen CLI, bukan sekadar `generateContent`:** agen CLI dapat **diberi konteks utuh**, **berpikir/merencanakan**, **menulis berkas**, dan **mengeksekusi shell** (menjalankan Chromium→PDF) secara mandiri — sehingga ia memutuskan template/komponen yang tepat dan memverifikasi hasilnya, bukan sekadar memuntahkan teks. Kapabilitas Gemini CLI yang dimanfaatkan:
- **Headless mode** — dijalankan non-interaktif/terprogram dari worker server.
- **Project context (`GEMINI.md`)** — worker menulis `GEMINI.md` berisi *brand tokens, angka final dari Financial Engine, ringkasan riset (+sumber), dan aturan dokumen* sebagai konteks persisten yang "diingat" agen.
- **Agent Skills** — *skill* "build-proposal" & "build-pitch-deck" berisi template HTML/CSS, aturan Paged.js, dan checklist kualitas (mengikuti pola skill: folder praktik terbaik yang dibaca agen sebelum bekerja).
- **Shell execution + Sandboxing** — agen merender HTML→PDF sendiri di lingkungan tersandbox (aman, terisolasi).
- **MCP client** — bila perlu, agen menarik *resource* dari AgentBuff Agent Gateway (mis. `agentbuff://project/{id}/financials`) sehingga angka selalu dari sumber kebenaran.
- **Model routing / Plan mode / Token caching** — efisiensi token & langkah.

> ⚠️ **Keputusan tahan-masa-depan (WAJIB dibaca, lihat §12.12 & §12.13):** Dokumentasi Gemini CLI mengumumkan **transisi ke Antigravity CLI** (untuk tier *unpaid*/Google One, per ~18 Juni 2026). Karena AgentBuff Co-Founder bersifat BYOK dan akan dibangun setelah tanggal tersebut, **lapisan generator dokumen harus CLI-agnostik**: bungkus pemanggilan agen di balik *adapter* (`DocAgentRunner`) sehingga dapat menargetkan **Gemini CLI sekarang dan Antigravity CLI sebagai penerus** tanpa merombak modul. Verifikasi nama paket, perintah, dan flag terbaru di dokumentasi resmi sebelum implementasi.

### 9.5.3 Arsitektur Generasi — "Template-Constrained Generation"
Untuk keandalan enterprise, **bukan** "minta LLM bikin dokumen bebas", melainkan:
```
1. SELECT TEMPLATE
   - Pilih template proposal/deck (beberapa gaya: Minimalis, Korporat, Kreatif). 
   - Template = struktur HTML + slot konten + CSS yang membaca design tokens Brand Kit.
2. ASSEMBLE CONTENT (LLM, structured output)
   - LLM mengisi SLOT konten (judul, paragraf, bullet, isi slide) dalam bentuk JSON terstruktur 
     sesuai schema template — BUKAN HTML mentah bebas.
   - Angka ditarik dari BusinessPlan.financials (binding), bukan dikarang.
3. RENDER
   - Engine menyuntik JSON konten + design tokens ke template HTML/CSS → HTML final.
   - (Opsional) LLM boleh menghasilkan HTML untuk elemen kreatif tertentu, divalidasi & disanitasi.
4. CONVERT
   - HTML final → PDF via headless Chromium + paged media.
5. POST-PROCESS
   - Tambah metadata PDF, kompres gambar, simpan ke storage, buat expiring share URL.
```
Keuntungan: konsistensi visual, angka akurat, brand-aligned, minim risiko HTML rusak.

### 9.5.4 Standar Konten yang Ditanamkan
- **Business Proposal** mengikuti struktur formal (§2.4): Exec Summary → Latar Belakang → Solusi/Usaha → Analisis Pasar → Strategi Pemasaran → Operasional → Tim → Rencana Keuangan (tabel + KPI) → Risiko & Mitigasi → Roadmap → Penutup/Lampiran. Dengan daftar isi & nomor halaman.
- **Pitch Deck** mengikuti struktur kanonik investor (§2.4): Cover → Problem → Solution → Why Now → Market (TAM/SAM/SOM) → Product → Business Model → GTM/Traction → Competition/Moat → Team → Financials → The Ask. Kaidah **1 ide/slide, font besar, visual dominan, teks minimal**.

### 9.5.5 Integrasi Gemini (dieksekusi via DocAgentRunner — §12.12)
- **Content assembly & rendering** dijalankan oleh **agen CLI** (Gemini CLI/Antigravity CLI, headless) yang diberi `GEMINI.md` + Agent Skills (lihat §9.5.2.1). Agen mengisi slot template (Structured Output/JSON sesuai schema), **bukan** HTML bebas, lalu merender ke PDF via shell.
- **Binding angka**: semua nilai finansial ditarik dari `BusinessPlan.financials` (atau resource `agentbuff://project/{id}/financials`) — **tidak dikarang** agen.
- **Model**: agen memakai model kuat untuk penalaran layout (mis. Gemini 3.x Pro / Flash dengan `thinking_level` MEDIUM) sesuai model routing CLI; untuk deck, hasilkan *headline + supporting points* ringkas.
- **Caching**: Project State (riset + plan + brand) di-context-cache & dimuat sebagai konteks agen; menghemat token besar saat merakit dua dokumen sekaligus (rujuk dok Context Caching, §12.7).
- **Konsistensi brand**: design tokens dari Brand Kit menentukan warna/tipografi; gambar dari Brand Kit (logo/moodboard) disisipkan.
- **Cost control**: gunakan Batch API untuk regenerasi non-urgent (rujuk dok Batch API, §12.7); satu sesi agen menghasilkan struktur lengkap, hindari banyak round-trip; semua via **key user (BYOK)**.

### 9.5.6 Fitur
- **Pratinjau langsung** (preview HTML sebelum PDF) dengan toggle Proposal/Deck.
- **Regenerate per-section/per-slide** tanpa membongkar seluruh dokumen.
- **Pilih template & tema** (3+ gaya).
- **Edit ringan inline** (ubah teks slot, urutan slide).
- **Unduh PDF** + **share link** (expiring).
- **Speaker notes** opsional untuk deck.

### 9.5.7 Data Model
```
Document {
  id, project_id, type('proposal'|'pitch_deck'), template_id, theme,
  content_json{ sections[]|slides[] },   // slot-filled, schema-validated
  brand_tokens_ref, asset_refs[],
  render{ html_ref, pdf_ref(storage_url), page_count, status },
  stale: bool, version, generated_at
}
```

### 9.5.8 Edge Cases
- **Data project belum lengkap** (mis. brand belum dibuat) → izinkan generate dengan placeholder + peringatan, atau sarankan lengkapi dulu.
- **PDF rendering gagal** → retry; fallback ke client print; simpan HTML agar tidak hilang.
- **Konten terlalu panjang untuk satu slide** → engine auto-split / ringkas (jaga 1 ide/slide).
- **Gambar besar** → kompres; jaga ukuran PDF wajar.
- **Stale data** → badge "Dokumen memakai data lama; perbarui?".

### 9.5.9 States
- **Loading (assembly)**: stepper "Menyusun konten… → Menerapkan brand… → Merender PDF…" + preview parsial.
- **Loading (render PDF)**: progress + estimasi; jalankan sebagai async job bila berat.
- **Empty**: pilih jenis dokumen + template.
- **Error**: pesan + retry; artefak parsial tersimpan.
- **Success**: preview + tombol Unduh/Bagikan yang dominan.

---

## 9.6 MODUL 6 — MCP / AGENTIC INTEGRATION ("AgentBuff Agent Gateway")

> **Nama fitur profesional:** **AgentBuff Agent Gateway** — menjadikan seluruh engine AgentBuff Co-Founder dapat dipanggil *headless* oleh agen AI eksternal (Claude, ChatGPT, Cursor, OpenClaw, Hermes, orchestrator kustom) melalui **Model Context Protocol (MCP)**.

### 9.6.1 Tujuan & Prinsip
- **Headless-equal-to-UI**: setiap kapabilitas inti (riset, plan, brand, dokumen) yang ada di UI tersedia sebagai **MCP tools/resources/prompts**.
- **Single Engine, Two Adapters**: logika bisnis tinggal di **Service/Engine layer**; **UI (REST/tRPC)** dan **MCP server** hanya dua adapter di atasnya. Tidak ada duplikasi logika. (Pola yang direkomendasikan industri: expose logika yang sama via REST untuk web app **dan** via MCP untuk agen.)
- **BYOK tetap berlaku**: panggilan MCP yang men-trigger Gemini memakai **key user** (terenkripsi) yang terikat pada identitas token MCP.

### 9.6.2 Spesifikasi Protokol (Target)
- **Protokol**: MCP over **JSON-RPC 2.0**.
- **Transport**: **Streamable HTTP** (remote, multi-client; HTTP POST + opsi SSE untuk streaming). Stdio hanya relevan untuk dev lokal.
- **Versi spec**: mengikuti spec MCP terbaru yang stabil (date-versioned, dinegosiasikan saat `initialize`); arsitektur **stateless-ready** mengikuti arah spec 2026 (mendukung header routing `Mcp-Method`/`Mcp-Name`, caching `ttlMs`/`cacheScope` untuk `tools/list`, propagasi W3C Trace Context di `_meta`).
- **Auth**: **OAuth 2.1** (PKCE). AgentBuff Co-Founder MCP server berperan sebagai **OAuth Resource Server**; meng-*advertise* lokasi authorization server via **`.well-known`** endpoints. Per-client consent.
- **Capability negotiation**: server mengumumkan dukungan `tools`, `resources`, `prompts`, dan apakah mendukung perubahan daftar dinamis (list changed notifications).
- **Discovery/Distribution**: dapat didaftarkan ke MCP registry agar mudah ditemukan klien.
- **Tooling**: dapat diuji dengan **MCP Inspector** sebelum dihubungkan ke klien.

### 9.6.3 Tiga Primitive MCP yang Diekspos

#### A) TOOLS (aksi yang dapat dieksekusi)
Tiap tool punya skema input/output (JSON Schema) yang ketat. Tools utama:

| Tool | Deskripsi | Input (ringkas) | Output (ringkas) |
|---|---|---|---|
| `agentbuff.list_projects` | Daftar project milik user | `{}` | `projects[]` |
| `agentbuff.create_project` | Buat project baru dari ide | `{ idea, sector?, geography? }` | `{ project_id }` |
| `agentbuff.get_project` | Ambil state lengkap project | `{ project_id }` | `ProjectState` |
| `agentbuff.validate_idea` | Jalankan Research & Validator (grounded) | `{ project_id \| idea, params }` | `ResearchReport` + `validation_score` |
| `agentbuff.run_market_research` | Riset pasar/kompetitor terfokus | `{ query, geography }` | `{ findings[], sources[] }` |
| `agentbuff.generate_business_plan` | Susun plan + financial engine | `{ project_id, financial_inputs }` | `BusinessPlan` |
| `agentbuff.calculate_financials` | Hitung finansial deterministik saja | `{ financial_inputs }` | `financials{...}` |
| `agentbuff.generate_brand_concept` | Brand strategy + tokens (teks) | `{ project_id }` | `BrandKit(teks)` |
| `agentbuff.generate_brand_assets` | Generate gambar (Nano Banana) | `{ project_id, asset_types[] }` | `assets[]{image_url}` |
| `agentbuff.create_proposal_pdf` | Render PDF proposal | `{ project_id, template?, theme? }` | `{ pdf_url, page_count }` |
| `agentbuff.create_pitch_deck_pdf` | Render PDF pitch deck | `{ project_id, template?, theme? }` | `{ pdf_url }` |
| `agentbuff.export_brand_kit` | Ekspor brand kit | `{ project_id }` | `{ brand_kit }` |

Catatan: tool yang menjalankan LLM (`validate_idea`, `generate_business_plan`, dll.) mengonsumsi **kuota Gemini user**; `calculate_financials` murni deterministik (tanpa LLM).

#### B) RESOURCES (data read-only sebagai konteks)
Agen dapat membaca artefak project sebagai resource (URI berskema):
- `agentbuff://projects/{id}` → ProjectState
- `agentbuff://projects/{id}/research` → ResearchReport
- `agentbuff://projects/{id}/plan` → BusinessPlan
- `agentbuff://projects/{id}/brand` → BrandKit
- `agentbuff://projects/{id}/documents/{doc_id}` → Document (metadata + pdf url)
Resources mendukung `list` & `read`, dengan caching (`ttlMs`/`cacheScope`) per arah spec 2026.

#### C) PROMPTS (template alur siap pakai)
Prompt reusable yang memandu agen menjalankan alur AgentBuff Co-Founder secara benar:
- `validate_my_idea` — alur validasi end-to-end.
- `build_full_business` — orkestrasi: validasi → plan → brand → dokumen.
- `investor_pitch` — fokus menghasilkan pitch deck dari project yang ada.
- `financial_quickcheck` — hitung HPP/BEP/ROI cepat dari input.

### 9.6.4 Alur Eksekusi MCP (Contoh: "build full business")
```
External Agent (e.g., Claude)
  └─ OAuth 2.1 handshake → akses token terikat user AgentBuff Co-Founder
  └─ initialize (negotiate capabilities, version)
  └─ tools/list (cacheable)
  └─ call: agentbuff.create_project { idea }           → project_id
  └─ call: agentbuff.validate_idea { project_id }       → ResearchReport (pakai Gemini key user, grounded)
  └─ call: agentbuff.generate_business_plan {…}          → BusinessPlan (engine deterministik + narasi)
  └─ call: agentbuff.generate_brand_concept { project_id }
  └─ call: agentbuff.create_pitch_deck_pdf { project_id } → pdf_url
  └─ resources/read agentbuff://projects/{id}            → state lengkap untuk ringkasan agen
```
Hasil sama persis dengan yang akan diperoleh lewat UI, karena memanggil Engine yang sama.

### 9.6.5 Keamanan & Tata Kelola MCP
- **OAuth 2.1 + PKCE**, scope granular per tool (mis. `research:run`, `plan:write`, `docs:render`, `brand:assets`).
- **Per-client consent** & **audit log** tiap pemanggilan (siapa, tool apa, kapan, biaya kuota estimasi).
- **Rate limiting** per token/klien (mencegah penyalahgunaan kuota user). Header routing memudahkan rate-limit di gateway.
- **BYOK guardrail**: tool yang men-trigger Gemini memeriksa status key user; jika invalid/limit → kembalikan error MCP yang jelas (bukan gagal diam).
- **Human-in-the-loop opsional**: untuk aksi berbiaya (generate banyak gambar / render PDF besar), dukung pola konfirmasi (elicitation) bila klien mendukung.
- **Isolasi data**: token hanya mengakses project milik user pemilik token.

### 9.6.6 Hubungan dengan A2A & Web Search
- **A2A (Agent-to-Agent)** bersifat komplementer: MCP menghubungkan agen↔tools (AgentBuff Co-Founder), A2A menghubungkan agen↔agen. AgentBuff Co-Founder fokus sebagai **MCP server (tool provider)**.
- **Grounding** di dalam tool AgentBuff Co-Founder tetap memakai *grounding with Google Search* via key user — agen eksternal mendapat hasil tersitasi tanpa perlu mengelola search sendiri.

### 9.6.7 Data Model (MCP-side)
```
McpClient { id, name, owner_user_id, oauth_client_id, scopes[], status, created_at }
McpAuditLog { id, client_id, user_id, tool, args_hash, result_status, quota_estimate, ts }
McpToken { id, client_id, user_id, scopes[], exp, ... } // dikelola OAuth server
```

### 9.6.8 Edge Cases
- **Token kedaluwarsa/dicabut** → 401 MCP + arahan re-auth (klien menampilkan ulang consent).
- **Key user invalid saat tool LLM dipanggil** → error MCP terstruktur `BYOK_KEY_INVALID`.
- **Tool dipanggil pada project yang tidak dimiliki** → `FORBIDDEN`.
- **Long-running tool** (riset/plan/PDF) → kembalikan job handle + dukung polling/stream status (SSE) agar agen tidak blocking.
- **Versi spec klien lebih lama** → negotiate ke versi yang didukung; jika tak kompatibel, tolak dengan pesan jelas.

### 9.6.9 States (untuk klien/agen)
- **Auth required** → kembalikan tantangan OAuth.
- **In-progress** → status job (queued/running/done/failed) via stream/poll.
- **Quota-limited** → error spesifik + saran (coba lagi nanti / gunakan tool non-LLM).
- **Success** → hasil terstruktur sesuai schema tool.

---

# 10. SYSTEM ARCHITECTURE & TECH STACK

## 10.1 Prinsip Arsitektur
1. **Single Engine, Multi-Adapter**: logika bisnis di *Engine/Service layer*; UI (REST/tRPC), MCP server, dan Webhook adalah adapter di atasnya.
2. **Deterministic core, AI at the edges**: financial engine & validasi skor deterministik; LLM untuk pemahaman bahasa, riset, dan generasi.
3. **Async-first untuk tugas berat**: riset, plan, brand, PDF → job queue + streaming/polling.
4. **BYOK isolation**: key user dikelola di *Key Vault Service* terpisah, dipakai *just-in-time*.
5. **Stateless-friendly**: services horizontal-scalable; MCP transport stateless-ready.

## 10.2 High-Level Architecture (Konseptual)
```
┌──────────────────────────────────────────────────────────────────────┐
│ CLIENTS                                                                │
│  • Web App / PWA (mobile-first, responsive)                            │
│  • External AI Agents (Claude, ChatGPT, Cursor, OpenClaw, Hermes, …)   │
│  • Partner Web/App (SSO/Webhook)                                       │
└───────────────┬───────────────────────────┬──────────────────────────┘
                │ HTTPS (REST/tRPC + SSE)    │ MCP over Streamable HTTP (JSON-RPC, OAuth 2.1)
        ┌───────▼───────┐            ┌────────▼─────────┐         ┌────────────────┐
        │  Web BFF/API  │            │ AgentBuff Co-Founder Agent       │         │ Federation/SSO │
        │  (Next.js)    │            │ Gateway (MCP)    │         │ Webhook Endpt  │
        └───────┬───────┘            └────────┬─────────┘         └───────┬────────┘
                │                              │                          │
                └──────────────┬───────────────┴──────────────┬──────────┘
                               ▼                               ▼
                  ┌───────────────────────────┐      ┌──────────────────┐
                  │  ENGINE / SERVICE LAYER    │      │  Auth Service     │
                  │  • ProjectService          │      │  (Google OIDC,    │
                  │  • ResearchService         │      │   OAuth2.1 server,│
                  │  • FinancialEngine (det.)  │      │   sessions)       │
                  │  • PlannerService          │      └──────────────────┘
                  │  • BrandService            │
                  │  • DocsService (HTML→PDF)  │
                  │  • AI Orchestration Layer  │◄────► BYOK Key Vault (KMS envelope)
                  └───────────┬────────────────┘
                              │
        ┌─────────────────────┼───────────────────────────────────────────┐
        ▼                     ▼                  ▼                ▼         ▼
  ┌───────────┐       ┌──────────────┐   ┌────────────┐  ┌──────────┐ ┌─────────┐
  │ PostgreSQL│       │ Redis (cache │   │ Job Queue   │  │ Object   │ │ Gemini  │
  │ (primary) │       │ + sessions)  │   │ (BullMQ)    │  │ Storage  │ │ API     │
  └───────────┘       └──────────────┘   │ + Workers   │  │ (PDF/img)│ │ (BYOK)  │
                                          └─────┬───────┘  └──────────┘ └─────────┘
                                                ▼
                                       ┌──────────────────┐
                                       │ PDF Renderer       │
                                       │ (headless Chromium │
                                       │  + Paged.js)       │
                                       └──────────────────┘
```

## 10.3 Tech Stack (Rekomendasi & Rasional)

| Layer | Pilihan | Rasional |
|---|---|---|
| **Frontend** | Next.js (React) + TypeScript, Tailwind CSS, shadcn/ui, PWA | SSR/RSC untuk performa & SEO landing; mobile-first; installable tanpa native app |
| **State/UX** | TanStack Query, streaming UI (SSE), optimistic updates | Responsif untuk tugas AI yang lama |
| **API (web)** | Next.js Route Handlers / tRPC (TS) | Type-safe end-to-end dengan frontend |
| **Engine/Service** | Node.js/TypeScript service (atau NestJS) | Satu bahasa dengan adapter; logika terpusat |
| **AI Orchestration** | Library internal + Gemini SDK (REST `generateContent`/Interactions API) | Model routing, structured output, grounding, caching |
| **MCP Server** | Official MCP SDK (TypeScript) — `@modelcontextprotocol/sdk` (alternatif FastMCP/Python) | Streamable HTTP + OAuth 2.1; berbagi Engine layer |
| **Auth** | Auth.js/NextAuth (Google OIDC) + OAuth 2.1 server (mis. Ory/Keycloak/custom) untuk MCP | Google-only login; OAuth resource server untuk agen |
| **Database** | PostgreSQL (Neon/Supabase) + Prisma/Drizzle ORM | Relasional, JSONB untuk artefak fleksibel |
| **Cache** | Redis (Upstash) | Sesi, rate-limit, cache hasil; pasangan dengan context caching Gemini |
| **Queue/Workers** | BullMQ (Redis) atau cloud queue | Job riset/plan/brand/PDF async |
| **Object Storage** | S3-compatible (R2/GCS) | Simpan PDF & gambar dengan expiring URLs |
| **PDF Rendering** | Headless Chromium (Puppeteer/Playwright) + Paged.js; fallback client print | Pagination & kualitas tinggi |
| **Secrets/KMS** | Cloud KMS / Vault (envelope encryption) | Enkripsi BYOK key |
| **Hosting** | Frontend di edge (Vercel); services & workers di container (Cloud Run/Fly/Railway) | Skala & biaya hemat |
| **Region/Data Residency** | Pertimbangkan region Jakarta/Singapura (mis. GCP `asia-southeast2`) | Latensi & kepatuhan UU PDP |
| **Observability** | OpenTelemetry, Sentry, structured logging (redaksi rahasia) | Trace lintas adapter & MCP (W3C Trace Context) |
| **CI/CD** | GitHub Actions, IaC (Terraform) | Rilis aman & reproducible |

## 10.4 AI Provider Integration Layer / Provider Abstraction Layer (Teknis)

**Provider Abstraction Layer (PAL)** menjadi satu-satunya pintu Engine ke LLM (lihat §12.14). Engine memanggil antarmuka `LLMProvider` netral; adapter konkret menerjemahkan ke API tiap vendor. Ini memperluas prinsip "Single Engine, Multi-Adapter" ke sisi model.

**Adapter Gemini:**
- **Endpoint**: Gemini API (`generateContent`) dan/atau **Interactions API** (`/v1beta/interactions`, header `Api-Revision`) sesuai fitur.
- **Header auth**: `x-goog-api-key: <USER_KEY>` (didekripsi in-memory per call).
- **Fitur**: `response_format`/`responseSchema` (Structured Outputs), tools `google_search`/`url_context`, function calling, `code_execution`, `thinking_level`, context caching, Batch API, Nano Banana/Imagen (image), Deep Research agent. Thought Signatures (3.1+) untuk koherensi multi-turn.

**Adapter OpenAI (baru — detail §12.15):**
- **Endpoint**: **Responses API** `POST https://api.openai.com/v1/responses`. Header `Authorization: Bearer <USER_KEY>`. Multi-turn via `previous_response_id`.
- **Fitur**: Structured Outputs `text.format` (json_schema, strict), tool `web_search` (→ `url_citation`), `o3-deep-research`/`o4-mini-deep-research` (background), tool `image_generation` / Image API (`gpt-image-2`), vision, `file_search`/`input_file` (dokumen), tool `mcp`, Prompt Caching + Batch API. Kontrol `reasoning.effort` & `text.verbosity`.

**Adapter Codex (auth & CLI — detail §12.16):** Sign in with ChatGPT (OAuth/device-code) atau API key; dipakai terutama untuk DocAgentRunner & mode lanjutan/desktop.

**Normalisasi & ketahanan:**
- **Tipe `Citation` netral** (url, title, start/end index) — diisi identik dari `url_citation` Gemini & OpenAI.
- **Capability detection** (§12.14.4) menyesuaikan fitur & routing per kredensial.
- **Model deprecation awareness (dua vendor)**: konfigurasi model **config-driven**; **jangan hardcode** nama model; pantau halaman Deprecations Gemini & Models OpenAI (§12.13, §12.15). Pilihan CLI agnostik (Gemini/Antigravity/Codex).

## 10.5 MCP Implementation Detail
- **Transport**: Streamable HTTP (single endpoint `/mcp`), HTTP POST untuk request, SSE untuk streaming/notifications.
- **Stateless-ready**: dukung header `Mcp-Method`/`Mcp-Name` (routing di load balancer), `ttlMs`/`cacheScope` untuk hasil `tools/list`/resource read, propagasi `traceparent`/`tracestate`/`baggage` di `_meta`.
- **Auth**: OAuth 2.1 (PKCE); `.well-known/oauth-protected-resource` & `.well-known/oauth-authorization-server` untuk discovery; scope granular.
- **Shared logic**: handler MCP memanggil Engine layer yang sama dengan web API. Tidak ada duplikasi.
- **Testing**: MCP Inspector untuk debug; kontrak schema diuji otomatis.
- **Versioning**: negosiasi versi date-string saat `initialize`; jaga kompatibilitas mundur sebisa mungkin.

## 10.6 Reliability & Scaling
- Services stateless → horizontal scale di belakang load balancer.
- Workers terpisah untuk job berat (riset/plan/PDF/gambar) → tidak memblok request web.
- Backpressure & retry dengan idempotency keys.
- Circuit breaker terhadap Gemini (handle 429/5xx) + exponential backoff.

---

# 11. DATA MODEL & SCHEMA

## 11.1 Entitas Inti & Relasi
```
User 1───* Project 1───1 ResearchReport
                  1───1 BusinessPlan
                  1───1 BrandKit
                  1───* Document
User 1───1 ByokCredential
User 1───1 OnboardingProfile
User 1───* McpClient 1───* McpAuditLog
Partner 1───* (federated Users)
```

## 11.2 Project (Aggregate Root / Project State)
```
Project {
  id, owner_user_id, title, idea_text, sector, geography, stage, primary_goal,
  status('draft'|'researching'|'planning'|'branding'|'documenting'|'complete'),
  current_step, 
  refs{ research_report_id?, business_plan_id?, brand_kit_id?, document_ids[] },
  context_cache_id?,        // id context-cache Gemini untuk hemat token
  created_at, updated_at
}
```
`ProjectState` (komposit untuk MCP `get_project` & context binding) = Project + artefak tertaut (research, plan, brand, documents) dalam satu objek read-only.

## 11.3 Skema Artefak
(Mengacu pada §9.2.7, §9.3.10, §9.4.6, §9.5.7.) Disimpan sebagai baris relasional + kolom **JSONB** untuk struktur fleksibel (financials.monthly[], narrative, dll.), sehingga query cepat namun skema dapat berevolusi.

## 11.4 Audit, Cost, & Quota Tracking
```
UsageEvent { id, user_id, project_id?, source('ui'|'mcp'), operation, model_used, 
             tokens_in?, tokens_out?, grounded_queries?, images_generated?, 
             est_cost_band, ts }
```
Dipakai untuk transparansi pemakaian kuota Gemini user (dashboard "Pemakaian AI-mu") & analitik internal (agregat, non-PII).

## 11.5 Versioning & Soft Delete
- Artefak memiliki `version`; perubahan besar membuat versi baru (riwayat dasar v1).
- *Soft delete* (kolom `deleted_at`) + lifecycle policy menghapus aset storage lama (PDF/gambar) sesuai kebijakan retensi.

---

# 12. AI ORCHESTRATION LAYER

## 12.1 Tanggung Jawab
Lapisan tunggal yang mengelola: pemilihan model (routing), penyusunan prompt, structured output, grounding, caching, retry, dan **cost control BYOK**. Dipakai oleh semua service & MCP.

## 12.2 Model Routing (Config-Driven)
Pemetaan kelas tugas → model (dapat diubah tanpa rilis besar). **Nama model = ambil dari halaman Models resmi (§12.7); jangan hardcode** — tabel ini menunjukkan *kelas* model, bukan janji string tetap.

| Kelas tugas | Model/mekanisme default | Alasan | Dok (§12.7) |
|---|---|---|---|
| Klasifikasi/parsing input awam, saran cepat, normalisasi | Flash-Lite (Gemini 3.x) | Murah, cepat, sering masuk free tier | Models |
| Riset mendalam (validasi) | **Deep Research agent** (`deep-research-preview-04-2026`) via Interactions API | Perencanaan+sintesis multi-langkah + citations | §12.8 |
| Riset grounded ringan/cepat (Jalur B) | Flash + `google_search`/`url_context` | Seimbang + grounding native + anotasi sumber | §12.9 |
| Penalaran berat (narasi plan, sintesis strategi, pitch) | Pro **atau** Flash dengan `thinking_level` MEDIUM/HIGH | Kualitas penalaran; Flash+thinking untuk hemat | Thinking |
| Generasi gambar (moodboard/logo/interior/kemasan) | Nano Banana / Nano Banana Pro (BYOK) | Teks-akurat, integrasi logo, grounding gambar | §12.10 |
| Hero shot fotorealistis (opsional) | Imagen (SynthID) | Fotorealistis high-fidelity | §12.10 |
| Pemahaman gambar/dokumen (input) | `generateContent` multimodal | OCR/vision/QA; parsing PDF≤1000 hlm | §12.10–12.11 |
| Generasi dokumen HTML→PDF | **Agen CLI** (Gemini CLI/Antigravity CLI) via DocAgentRunner | Penalaran agentik + eksekusi render | §12.12 |
| Perhitungan finansial | **Tidak pakai LLM** (Deterministic Engine) | Akurasi & auditability | — |

**Fallback chain**: jika model utama 429/limit → coba model lebih murah/non-grounded → jika tetap gagal, kembalikan error ramah + opsi tunda. Deep Research agent → fallback ke custom pipeline (Jalur B). Agen CLI → fallback ke Template-Constrained Generation non-agen.

## 12.3 Prompt Architecture
- **Layered prompts**: System (peran & aturan: "LLM proposes, code disposes"; nada suportif; Bahasa Indonesia) + Context (Project State via cache) + Task (instruksi spesifik + schema) + Few-shot (contoh berkualitas) bila perlu.
- **Structured output wajib** untuk semua data yang dikonsumsi engine/dokumen (JSON Schema; properti diberi nama jelas; hindari skema terlalu dalam—API bisa menolak skema sangat besar/dalam, jadi pecah bila perlu).
- **Grounding policy**: aktif hanya di tugas yang butuh data live; simpan & tampilkan sitasi.
- **Guardrails**: instruksi menolak memfasilitasi hal ilegal/berbahaya; tidak mengarang angka; tidak meniru brand nyata; sertakan disclaimer hukum (merek dagang, perizinan).
- **Prompt library** dikelola sebagai aset (versioned) — lihat Appendix §20.

## 12.4 Cost Control & BYOK Stewardship
AgentBuff Co-Founder berkewajiban menjaga kuota Gemini user (uang user). Mekanisme:
- **Context caching** untuk konteks berulang (Project State) → hemat hingga ~90% token prompt.
- **Batch API** (~50% diskon) untuk job non-urgent (mis. regenerasi dokumen massal).
- **thinking_level** disetel sesuai kebutuhan (MINIMAL untuk validasi key/parsing; lebih tinggi hanya saat perlu).
- **Grounding budget** per operasi (batasi jumlah query) agar tetap dalam free tier (±5.000 grounded prompt/bulan).
- **Image generation gating**: default jumlah kecil; aksi "buat lagi" eksplisit.
- **Estimasi & transparansi**: tampilkan perkiraan pemakaian sebelum operasi besar; dashboard pemakaian.
- **Idempotency & dedupe**: hindari pemanggilan ganda akibat retry.

## 12.5 Reliabilitas AI
- Retry dengan backoff untuk 429/5xx; circuit breaker.
- **Schema validation** atas output LLM; jika tidak valid → repair-prompt sekali, lalu fallback.
- **Streaming** token ke UI bila memungkinkan (transparansi & terasa cepat).
- **Partial results**: simpan hasil parsial pipeline agar kegagalan tidak menghapus progres.

## 12.6 Evaluasi & Quality Assurance AI
- **Golden test set**: kumpulan ide bisnis contoh untuk regресi kualitas riset/plan/dokumen.
- **Financial engine unit tests**: kasus tepi (margin negatif, BEP tak tercapai, jasa tanpa COGS).
- **Citation audit**: pastikan klaim pasar tersitasi.
- **Human review loop** pada beta untuk kalibrasi nada & akurasi.

## 12.7 Pemetaan Fitur → Gemini API & Dokumentasi (WAJIB DIBACA SEBELUM CODING)

> Bagian ini adalah **kontrak teknis** AgentBuff Co-Founder dengan Gemini. Tujuannya tunggal: **mencegah halusinasi** AI/engineer pada nama model, endpoint, header, bentuk request/response, dan perintah CLI. Sebelum mengimplementasikan setiap fitur, **baca dokumentasi resmi yang ditautkan**. Bila dokumentasi berbeda dari PRD (karena API diperbarui), **dokumentasi resmi menang** — lalu perbarui PRD. Daftar lengkap tautan ada juga di **Appendix §20.6**.

| Fitur AgentBuff Co-Founder | Kapabilitas Gemini | API/Mekanisme | Dokumentasi resmi (sumber kebenaran) |
|---|---|---|---|
| Deep Research & Validator (riset mendalam) | Deep Research Agent | **Interactions API** (`interactions.create`, `background=true`) | https://ai.google.dev/gemini-api/docs/interactions/deep-research |
| Validasi + **sumber clickable** | Grounding with Google Search (anotasi `url_citation`) | tool `google_search` (Interactions/`generateContent`) | https://ai.google.dev/gemini-api/docs/interactions/google-search |
| Membaca situs/listing kompetitor (URL spesifik) | URL Context | tool `url_context` | https://ai.google.dev/gemini-api/docs/url-context |
| Brand Studio — gambar (logo, moodboard, kemasan, interior, mockup) | Nano Banana / Nano Banana Pro | image generation (multimodal) | https://ai.google.dev/gemini-api/docs/image-generation |
| Brand Studio — *hero shot* fotorealistis | Imagen (watermark SynthID) | Imagen API | https://ai.google.dev/gemini-api/docs/imagen |
| Analisis gambar unggahan & QA aset | Image Understanding (vision) | `generateContent` multimodal | https://ai.google.dev/gemini-api/docs/image-understanding |
| Import dokumen (pre-fill wizard) & parsing PDF | Document Understanding (vision, ≤1000 hlm) | `generateContent` + Files API | https://ai.google.dev/gemini-api/docs/document-processing |
| Generasi dokumen HTML→PDF (proposal & deck) | Agen CLI headless (DocAgentRunner) | **Gemini CLI / Antigravity CLI** | https://geminicli.com/docs/ |
| Output type-safe (semua modul) | Structured Outputs (JSON Schema) | `response`/`response_format` + schema | https://ai.google.dev/gemini-api/docs/structured-output |
| Tool/agentic internal | Function Calling | function declarations | https://ai.google.dev/gemini-api/docs/function-calling |
| Hemat token konteks berulang | Context Caching | cached content | https://ai.google.dev/gemini-api/docs/caching |
| Job massal non-urgent (~50% hemat) | Batch API | batch jobs | https://ai.google.dev/gemini-api/docs/batch-api |
| Kontrol kedalaman penalaran | Thinking / `thinking_level` + Thought Signatures | parameter thinking | https://ai.google.dev/gemini-api/docs/thinking · https://ai.google.dev/gemini-api/docs/thought-signatures |
| Pemilihan model & harga | Models & Pricing | — | https://ai.google.dev/gemini-api/docs/models · https://ai.google.dev/gemini-api/docs/pricing |
| Batas kuota (BYOK) | Rate limits | — | https://ai.google.dev/gemini-api/docs/rate-limits |
| **Perubahan & penghentian** | Deprecations & Breaking changes | — | https://ai.google.dev/gemini-api/docs/deprecations · https://ai.google.dev/gemini-api/docs/interactions-breaking-changes-may-2026 |
| Kunci API & autentikasi | API Keys | header `x-goog-api-key` | https://ai.google.dev/gemini-api/docs/api-key |

**Aturan emas implementasi:** (1) Jangan menebak nama model — ambil dari halaman Models. (2) Jangan menebak endpoint/header — Interactions API memakai `/v1beta/interactions` + `x-goog-api-key` + `Api-Revision`; `generateContent` memakai jalurnya sendiri. (3) Selalu validasi output LLM terhadap JSON Schema. (4) Pisahkan pemanggilan ke balik *adapter* (lihat §10) agar pergantian model/endpoint = ubah config.

> 🔀 **Multi-provider:** tabel di atas memetakan jalur **Gemini**. Untuk **OpenAI** (Responses API, Deep Research `o3-deep-research`, `web_search`, `gpt-image-2`, vision/dokumen) lihat **§12.15**; untuk **Codex auth & CLI** lihat **§12.16**; pemetaan kapabilitas Gemini↔OpenAI ada di **§12.14.3**; daftar dokumentasi OpenAI/Codex di **Appendix §20.7**. Adapter (`LLMProvider`) menyembunyikan perbedaan ini dari logika bisnis.

## 12.8 Deep Research via Interactions API (Detail Implementasi)

Rujuk: https://ai.google.dev/gemini-api/docs/interactions/deep-research

- **Akses**: **hanya** via Interactions API — `client.interactions.create(...)` (Python/JS) atau `POST https://generativelanguage.googleapis.com/v1beta/interactions` (REST). **Tidak** tersedia lewat `generateContent`.
- **Header REST**: `x-goog-api-key: <KEY_USER>`, `Content-Type: application/json`, dan `Api-Revision` (mis. `2026-05-20` — **verifikasi nilai terbaru di dok**).
- **Agen**:
  - `deep-research-preview-04-2026` — cepat & efisien, ideal di-*stream* ke UI klien (default AgentBuff Co-Founder untuk "Riset Cepat").
  - `deep-research-max-preview-04-2026` — komprehensivitas maksimum (opsi "Riset Mendalam Maksimal").
- **Eksekusi asinkron (wajib)**: tugas berjalan beberapa menit. Set `background=true`, lalu **poll** `interactions.get(id)` → cek `status` (`completed`/`failed`), baca `output_text` atau `error`. Atau gunakan streaming update. Ini dipetakan ke arsitektur **async job + progress + notifikasi** AgentBuff Co-Founder (lihat §9.2.9, §15.1).
- **Perencanaan kolaboratif**: `agent_config = { type: "deep-research", thinking_summaries: "auto", collaborative_planning: true }`. Interaksi pertama mengembalikan **rencana riset** (bukan laporan). Pengguna menyempurnakan via `previous_interaction_id` (multi-turn). AgentBuff Co-Founder memakai ini agar pemula bisa **mengarahkan fokus riset** sebelum kuota dipakai untuk eksekusi penuh.
- **Fitur lanjutan**: dukungan **MCP** (agen riset memanggil tool eksternal), **visualisasi** (diagram/grafik dalam laporan), dan **input dokumen** langsung (sinergi dengan Import §9.3.4.1).
- **Output**: laporan tersintesis **dengan citations** → dipetakan ke `ResearchReport.citations[]` & `sources[]` (clickable). `interaction_id` disimpan untuk audit/lanjutan.
- **Status preview**: fitur ini berstatus *preview* — **pantau perubahan** (lihat §12.13) dan sediakan **fallback Jalur B** (custom pipeline) bila agen tidak tersedia bagi key tertentu.

## 12.9 Grounding Google Search & Sumber Clickable (Detail Implementasi)

Rujuk: https://ai.google.dev/gemini-api/docs/interactions/google-search

- **Aktivasi**: sertakan tool `{"type": "google_search"}` (Interactions API) atau padanannya di `generateContent`. Model otomatis memutuskan kapan menelusuri, menyusun query, mengeksekusi, dan mensintesis jawaban tergrounding.
- **Bentuk respons** (kunci untuk fitur clickable): rangkaian `steps` berisi —
  - `google_search_call` → berisi `queries` yang dieksekusi (tampilkan opsional sebagai "AgentBuff Co-Founder mencari: …").
  - `google_search_result` → berisi `search_suggestions` (snippet HTML/CSS) yang **wajib dirender sesuai [Terms of Service](https://ai.google.dev/gemini-api/terms#grounding-with-google-search)**.
  - `model_output` → `text` dengan **`annotations`**. Setiap anotasi bertipe **`url_citation`** memuat `url`, `title`, `start_index`, `end_index`.
- **Mekanisme clickable (implementasi UI)**: petakan tiap `url_citation` ke **segmen teks** `[start_index, end_index)` lalu bungkus segmen tersebut sebagai tautan/superscript ke `url` (buka tab baru). Kumpulkan seluruh `url` unik menjadi daftar **"Semua Sumber"**. Simpan semuanya ke `ResearchReport.citations[]`/`sources[]`. **Inilah yang menghapus keraguan pengguna** ("data ini benar tidak?") — mereka bisa klik dan verifikasi sendiri.
- **Klaim tanpa anotasi** → tandai **"estimasi"** (badge), jangan disajikan sebagai fakta.
- **Bahasa**: grounding bekerja untuk semua bahasa (termasuk Indonesia).
- **Biaya/kuota**: grounding dihitung pada kuota key pengguna; batasi jumlah query per operasi (lihat §12.4). Free tier Gemini 3 ±5.000 grounded prompt/bulan; di atasnya berbayar (verifikasi tarif di halaman Pricing).

## 12.10 Image Stack — Nano Banana, Imagen, Image Understanding (Detail)

Rujuk: https://ai.google.dev/gemini-api/docs/image-generation · https://ai.google.dev/gemini-api/docs/imagen · https://ai.google.dev/gemini-api/docs/image-understanding

- **Nano Banana / Nano Banana Pro (default brand assets)** — model image-generation multimodal Gemini. Keunggulan yang dieksploitasi AgentBuff Co-Founder: **rendering teks akurat di dalam gambar** (nama brand pada kemasan/signage/moodboard), **preservasi detail & integrasi logo** ke mockup, **style transfer**, **product/commercial mockups**, dan **grounding via Google Image Search** untuk referensi visual akurat. Dipanggil dengan **key user (BYOK)**.
- **Imagen (opsional, fotorealistis)** — model image generation high-fidelity; **semua output ber-watermark SynthID** (cantumkan ke pengguna bila relevan). Gunakan untuk *hero shot* realistis; untuk teks/edit/logo, pilih Nano Banana.
- **Pemilihan model = config-driven** (§12.2). **Verifikasi nama & ketersediaan model di halaman Models/Deprecations** sebelum coding (riwayat menunjukkan model image dapat berganti/di-*deprecate*; jangan hardcode asumsi).
- **Image Understanding (input vision)** — via `generateContent` multimodal: **OCR**, deteksi objek/atribut, **visual Q&A**, captioning. Dipakai untuk (a) menganalisis unggahan pengguna (logo lama, etalase, produk kompetitor), (b) **QA aset hasil generasi** (pastikan teks terbaca/benar) sebelum ditampilkan.
- **Penyimpanan & kuota**: gambar adalah operasi termahal → selalu di-antri (worker), diberi indikator pemakaian kuota, dan disimpan dengan *expiring URL* (lihat §15.6).

## 12.11 Document Understanding — Import & Parsing (Detail)

Rujuk: https://ai.google.dev/gemini-api/docs/document-processing

- **Kapabilitas**: native vision atas **PDF hingga 1000 halaman** — memahami teks, gambar, **diagram, grafik, dan tabel**; ekstrak ke **Structured Output**; meringkas; Q&A; bahkan **transkripsi ke HTML mempertahankan layout**.
- **Metode input**: dokumen kecil → *inline* (base64) pada `generateContent`; dokumen besar / dipakai multi-turn → **Files API** (latency & bandwidth lebih baik). Rujuk dok File input/Files API (§20.6).
- **Pemakaian di AgentBuff Co-Founder**:
  - **Import → pre-fill wizard** (§9.3.4.1): ekstrak `price_list[]`, `cost_items[]`, `fixed_costs[]` dari daftar harga/invoice/catatan keuangan → pemetaan ke field intake (human-in-the-loop, angka final tetap di engine).
  - **Q&A atas materi pengguna** (mis. proposal lama) untuk menyempurnakan output.
- **Catatan**: dokumen non-PDF diperlakukan sebagai teks biasa (kehilangan konteks tabel/format) → sarankan PDF. Untuk *scan* buram, tandai field berkeyakinan rendah agar diperiksa.

## 12.12 Gemini CLI / Antigravity CLI untuk Generasi Dokumen (Detail — DocAgentRunner)

Rujuk: https://geminicli.com/docs/ (lihat juga Headless, GEMINI.md, Skills, MCP, Sandboxing)

- **Peran**: lapisan **DocAgentRunner** menjalankan agen CLI **headless** di worker tersandbox untuk merakit & merender dokumen (§9.5.2.1). Agen *berpikir* memilih template/komponen, menulis HTML/CSS, lalu mengeksekusi konversi HTML→PDF.
- **Instalasi/runtime**: paket CLI (mis. `@google/gemini-cli`) di-*provision* pada image worker; autentikasi memakai **key user (BYOK)** yang di-*inject* aman per-job (tidak pernah ditulis ke disk/log — lihat §13.1).
- **Konteks via `GEMINI.md`**: worker menulis `GEMINI.md` berisi **brand tokens, angka final dari Financial Engine, ringkasan riset + sumber, dan aturan dokumen** → menjadi konteks persisten yang dibaca agen (project context).
- **Agent Skills**: skill `build-proposal` & `build-pitch-deck` (folder berisi template HTML/CSS, aturan Paged.js, checklist kualitas) yang dibaca agen sebelum bekerja — analog dengan pola *skills* (best-practice folders).
- **Eksekusi & keamanan**: jalankan dalam **Sandbox** CLI; aktifkan hanya tool yang diperlukan; batasi akses jaringan/file. Agen melakukan **shell execution** untuk menjalankan Chromium→PDF.
- **MCP**: agen CLI dapat bertindak sebagai **MCP client** untuk menarik resource `agentbuff://project/{id}/financials` — menjamin angka dari sumber kebenaran.
- **Efisiensi**: manfaatkan **model routing**, **plan mode**, dan **token caching** CLI.
- ⚠️ **Transisi Gemini CLI → Antigravity CLI**: dokumentasi resmi menyatakan Gemini CLI akan **digantikan Antigravity CLI** (untuk tier *unpaid* & Google One, per ~18 Juni 2026; lihat blog transisi & dok Antigravity Agent: https://ai.google.dev/gemini-api/docs/antigravity-agent). **Konsekuensi desain (wajib):** `DocAgentRunner` harus **CLI-agnostik** (antarmuka stabil, implementasi dapat ditukar) sehingga AgentBuff Co-Founder dapat menargetkan **Antigravity CLI** sebagai penerus tanpa merombak modul dokumen. Verifikasi nama paket/perintah/flag terbaru sebelum coding.
- **Fallback**: bila agen CLI tak tersedia di lingkungan tertentu, gunakan jalur **Template-Constrained Generation** non-agen (LLM mengisi slot JSON → server merender via Chromium+Paged.js) sebagaimana §9.5.3.

## 12.13 Breaking Changes & Deprecations yang Harus Dipantau

> Karena AgentBuff Co-Founder bergantung pada API yang berevolusi cepat, **memantau perubahan adalah aktivitas rutin**, bukan sekali-jalan. Engineer wajib memeriksa halaman berikut tiap siklus rilis.

- **Interactions API breaking changes (Mei 2026)**: https://ai.google.dev/gemini-api/docs/interactions-breaking-changes-may-2026 — relevan karena Deep Research & sebagian fitur memakai Interactions API (perhatikan header `Api-Revision`).
- **Deprecations resmi**: https://ai.google.dev/gemini-api/docs/deprecations — pantau penghentian/penggantian model (mis. perubahan pada keluarga model image Imagen/Nano Banana; penghentian model lama). Jangan hardcode nama model.
- **Gemini CLI → Antigravity CLI** (~18 Juni 2026, tier unpaid/Google One): lihat §12.12; pengaruh ke DocAgentRunner.
- **Mitigasi struktural**: (1) **config-driven model routing** (§12.2) — ganti model lewat config; (2) **adapter/abstraksi provider & CLI** (§10) — endpoint/CLI dapat ditukar; (3) **eval set** (§12.6) dijalankan setiap ganti model untuk cegah regresi; (4) **pin versi** + jalur migrasi terdokumentasi. Risiko ini terdaftar di §17 (R5, R-CLI).

## 12.14 Arsitektur Multi-Provider (Provider Abstraction Layer / "LLM Gateway")

> **Tujuan:** AgentBuff Co-Founder tidak terkunci ke satu vendor. Pengguna dapat membawa **Gemini API key**, **OpenAI API key**, atau **Codex (Sign in with ChatGPT)**. Riset (yang saya lakukan terhadap dokumentasi resmi kedua vendor) menunjukkan **konvergensi kuat** sehingga abstraksi sangat layak: keduanya punya API interaksi async (`background=true`), Structured Outputs berbasis JSON Schema, web search yang mengembalikan **anotasi `url_citation`** (url, title, start/end index), model **Deep Research** khusus, image-gen dengan rendering teks akurat, dukungan **MCP**, dan agen **CLI** (Gemini CLI ↔ Codex CLI) dengan auth langganan-atau-key.

### 12.14.1 Prinsip
- **Single capability interface, multi adapter.** Engine bicara ke antarmuka `LLMProvider` yang netral; adapter konkret (`GeminiAdapter`, `OpenAIAdapter`, dan kelak `AnthropicAdapter`, dll.) menerjemahkan ke API masing-masing. (Pola yang sama dengan "Single Engine, Multi-Adapter" pada §9.6/§10 — kini diperluas ke sisi provider.)
- **Determinisme & sumber clickable tetap provider-agnostik.** Financial Engine **tidak** memakai LLM sama sekali → identik lintas provider. Mandat sumber clickable bekerja sama persis karena **kedua provider menghasilkan `url_citation`** → dinormalisasi ke `ResearchReport.citations[]` yang sama (§9.2.7).
- **Capability detection, bukan asumsi.** Saat key divalidasi (§9.1), AgentBuff Co-Founder mendeteksi kapabilitas aktual (lihat matriks §12.14.4) dan menyesuaikan fitur yang ditawarkan + model routing.
- **Provider-aware routing.** Config memetakan `(kelas_tugas × provider)` → model spesifik (§12.2 diperbarui di §12.14.5).

### 12.14.2 Antarmuka `LLMProvider` (Konsep)
Metode netral yang wajib diimplementasikan tiap adapter (nama konseptual):
```
interface LLMProvider {
  validateCredential(cred): { ok, capabilities[], detail }
  generateStructured(prompt, jsonSchema, opts): TypedJSON      // Structured Outputs
  groundedSearch(query, opts): { text, citations[], sources[] } // web search + url_citation
  runDeepResearch(brief, opts): { reportId, status, citations[], sources[] } // async/background
  generateImage(prompt, opts): { imageRef }                    // brand assets
  understandImage(image, prompt): TypedJSON                    // vision/OCR/QA
  understandDocument(file, jsonSchema): TypedJSON              // parsing PDF → field
  runDocAgent(context, skill): { artifactRef }                 // CLI agent (opsional)
  getUsageHints(): { caching, batch, async }                   // hemat biaya
}
```
Tipe **`Citation`** dinormalisasi (karena keduanya identik): `{ claim_text, start_index, end_index, source_url, source_title, confidence }`.

### 12.14.3 Pemetaan Kapabilitas: Gemini ↔ OpenAI (hasil riset dokumentasi)

| Kapabilitas | Gemini (lihat §12.7–§12.13) | OpenAI (lihat §12.15–§12.16) |
|---|---|---|
| API utama | Interactions API + `generateContent` | **Responses API** (`/v1/responses`) |
| Auth header | `x-goog-api-key` | `Authorization: Bearer <key>` |
| Async job panjang | `background=true` → poll `interactions.get` | `background=true` → poll/`previous_response_id` |
| Deep Research | agen `deep-research-preview-04-2026` | model `o3-deep-research` / `o4-mini-deep-research` |
| Grounded search + **sumber clickable** | tool `google_search` → `url_citation` | tool `web_search` → `url_citation` (+ `sources`) |
| Structured Output | JSON Schema (`response_format`/`responseSchema`) | `text.format = {type:"json_schema", strict:true, schema}` |
| Image generation | Nano Banana / Nano Banana Pro / Imagen | `gpt-image-2` (+ `gpt-image-1.5/1/mini`) |
| Image understanding | vision `generateContent` | vision (GPT-5.x multimodal) |
| Document understanding | vision PDF ≤1000 hlm + Files API | file input (`input_file`) / `file_search` + vector store |
| Agen dokumen (CLI) | Gemini CLI / Antigravity CLI | **Codex CLI** (`gpt-5.x-codex`) |
| MCP (sebagai client) | didukung | tool `{type:"mcp", server_url, ...}` di Responses API |
| Hemat biaya | Context Caching + Batch API | Prompt Caching + Batch API |
| Kontrol penalaran | `thinking_level` (MIN…HIGH) | `reasoning.effort` (low/med/high/xhigh) + `text.verbosity` |

> **Implikasi:** karena pemetaan ini hampir 1:1, AgentBuff Co-Founder bisa menawarkan **paritas fitur** lintas provider. Perbedaan ditangani di adapter (mis. cara memuat input PDF, format gambar base64 vs ref), bukan di logika bisnis.

### 12.14.4 Matriks Kapabilitas per Kredensial (untuk Capability Detection)
Karena pengguna membawa key/akun berbeda (dan tier berbeda), AgentBuff Co-Founder mendeteksi & menampilkan kapabilitas. Contoh aturan degradasi:

| Kapabilitas | Gemini API key | OpenAI API key | Codex (ChatGPT sign-in) |
|---|---|---|---|
| Teks + Structured Output | ✅ | ✅ | ✅ (via Codex/Responses) |
| Grounded search + sumber clickable | ✅ (`google_search`) | ✅ (`web_search`) | ✅ (tool web search) |
| Deep Research | ✅ (agen) | ✅ (`o3/o4-mini-deep-research`) | ⚠️ tergantung akses akun |
| Image generation | ✅ (Nano Banana) | ⚠️ **butuh Org Verification** untuk GPT Image | ⚠️ tergantung akun/plan |
| Document understanding | ✅ | ✅ | ✅ |
| Agen dokumen (CLI) | ✅ (Gemini/Antigravity CLI) | ✅ (Codex CLI) | ✅ (Codex, native plan) |
| Biaya | kuota key (free tier dermawan) | usage-based Platform | **termasuk di langganan ChatGPT** (limit plan) |

Bila sebuah kapabilitas tak tersedia (mis. OpenAI key belum org-verified untuk image), AgentBuff Co-Founder **menyembunyikan/menonaktifkan** fitur terkait dengan penjelasan ramah + cara mengaktifkan, dan **menyarankan menambah provider lain** (mis. tambah Gemini key khusus untuk gambar). Pengguna boleh menautkan >1 provider dan memilih default per-kelas-tugas.

### 12.14.5 Model Routing Provider-Aware (memperluas §12.2)
Config `(kelas_tugas × provider) → model`. Contoh:

| Kelas tugas | Gemini | OpenAI |
|---|---|---|
| Parsing/normalisasi cepat | Flash-Lite (3.x) | GPT-5.x mini/nano |
| Riset mendalam | `deep-research-preview-04-2026` | `o3-deep-research` (atau `o4-mini-deep-research` hemat) |
| Grounded search ringan | Flash + `google_search` | GPT-5.x + `web_search` |
| Penalaran berat (plan/pitch) | Pro / Flash+thinking | GPT-5.5 (`reasoning.effort`=high) |
| Generasi gambar | Nano Banana / Imagen | `gpt-image-2` |
| Vision / dokumen | `generateContent` vision | GPT-5.x vision / `file_search` |
| Generasi dokumen (agen) | Gemini/Antigravity CLI | Codex CLI |
| Perhitungan finansial | **bukan LLM** (engine) | **bukan LLM** (engine) |

**Fallback lintas-provider:** bila provider aktif gagal/limit (429), dan pengguna menautkan provider lain, tawarkan *failover* (dengan izin pengguna, agar tetap sadar-biaya). Bila tidak, degrade/tunda dengan pesan ramah.

## 12.15 Integrasi OpenAI (Detail Implementasi — rujuk dok resmi)

Rujuk: https://developers.openai.com/api/docs/ (Responses API, tools, models)

- **API utama = Responses API.** Endpoint `POST https://api.openai.com/v1/responses`, header `Authorization: Bearer <OPENAI_API_KEY>`, `Content-Type: application/json`. SDK: `client.responses.create(...)`. Multi-turn via `previous_response_id`; untuk *stateless*/ZDR kirim kembali output items. (Chat Completions masih ada, tetapi Responses API adalah jalur yang direkomendasikan untuk reasoning/tool-calling/multi-turn.) Dok: https://developers.openai.com/api/docs/guides/latest-model
- **Model (per 30 Mei 2026 — verifikasi di halaman Models):** flagship **GPT-5.5** (`gpt-5.5-2026-04-23`), **GPT-5.5 Pro** (tugas berat, dukung **background mode** karena bisa beberapa menit), **GPT-5.4 mini/nano** (cepat/murah). Kontrol: `reasoning.effort` ∈ {low, medium, high, xhigh}; `text.verbosity` ∈ {low, medium, high}. Dok: https://developers.openai.com/api/docs/models
- **Structured Outputs** (rujuk https://developers.openai.com/api/docs/guides/structured-outputs): di Responses API gunakan `text: { format: { type: "json_schema", name, strict: true, schema } }` (parameter lama `response_format` dipakai di Chat Completions). `strict: true` + `additionalProperties: false` + seluruh field `required` → output **dijamin** sesuai schema (constrained decoding). Tangani field `refusal` bila model menolak. Ini menggantikan peran "responseSchema" Gemini di adapter.
- **Grounded Web Search + sumber clickable** (rujuk https://developers.openai.com/api/docs/guides/tools-web-search): aktifkan tool `{"type": "web_search"}` di `tools`. Output berisi `web_search_call` (dengan `action`: `search`/`open_page`/`find_in_page`) dan pesan dengan **`annotations` bertipe `url_citation`** (memuat `url`, `title`, `start_index`, `end_index`). Selain itu ada field **`sources`** (daftar lengkap URL yang dikonsultasi, biasanya > jumlah citation). **ToS OpenAI mewajibkan inline citation ditampilkan jelas & clickable** — ini **identik** dengan kebutuhan AgentBuff Co-Founder, jadi adapter memetakan `url_citation` OpenAI ke `Citation` netral yang sama dengan Gemini. Opsi `search_context_size` & lokasi pengguna (country/city/region/timezone) tersedia.
- **Deep Research** (rujuk https://developers.openai.com/api/docs/models/o3-deep-research & guide deep research): model `o3-deep-research` (kualitas) / `o4-mini-deep-research` (hemat) via Responses API. **Wajib menyertakan ≥1 sumber data**: `web_search`, remote **MCP**, atau `file_search` (vector store); boleh tambah `code_interpreter`. Jalankan **`background=true`** untuk async (catatan: ada batasan historis "background tak bisa dipakai bersama MCP tools" — verifikasi status terbaru). Output array memuat `web_search_call`, `mcp_tool_call`, `file_search_call`, `code_interpreter_call` + laporan bercitasi. Pola disarankan (mirip perencanaan kolaboratif Gemini): pakai model kecil untuk **klarifikasi intent → rewrite prompt → jalankan deep research**. Estimasi tarif (verifikasi di Pricing): o3-deep-research ~$10/$40 per 1M; o4-mini ~$2/$8.
- **Image generation** (rujuk https://developers.openai.com/api/docs/guides/image-generation): model **`gpt-image-2`** (SOTA; juga `gpt-image-1.5`, `gpt-image-1`, `gpt-image-1-mini`). Dua jalur: **Image API** (`images.generate` / `images.edit` / variations) untuk gambar tunggal; atau **Responses API tool** `{"type": "image_generation"}` untuk alur percakapan/iteratif. Keunggulan relevan brand: **rendering teks akurat**, edit, world knowledge, instruction-following. Output **base64**; opsi `quality` (low/med/high), `output_format` (png/jpeg/webp), `background` (auto/transparent), `output_compression`, `n` (1–10). **Catatan penting:** GPT Image **butuh API Organization Verification**; DALL·E 3 sudah *retired* (4 Mar 2026). Ini setara peran Nano Banana di adapter.
- **Image understanding / vision** (rujuk https://developers.openai.com/api/docs/guides/images-vision): GPT-5.x/4.1 multimodal menerima gambar via URL atau base64 → OCR, analisis, Q&A. Dipakai untuk analisis unggahan & QA aset (setara Image Understanding Gemini).
- **Document understanding**: kirim PDF sebagai `input_file` (via Files API) ke Responses API, atau pakai `file_search` + vector store untuk korpus. Dipakai untuk Import (§9.3.4.1) pada adapter OpenAI.
- **MCP sebagai client**: Responses API menerima tool `{"type": "mcp", "server_label", "server_url", "require_approval"}` → model OpenAI bisa memanggil **AgentBuff Agent Gateway** (atau MCP lain). Berguna agar agen OpenAI menarik resource `agentbuff://project/{id}/financials`.
- **Hemat biaya**: **Prompt Caching** (otomatis untuk prefix berulang) + **Batch API** (job non-urgent). Selaras dengan strategi cost-control §12.4 (versi OpenAic).
- **Parsing output**: **selalu telusuri `output` array berdasarkan `type`** (mis. `message`, `web_search_call`, `reasoning`, `image_generation_call`) — jangan berasumsi posisi indeks.

## 12.16 Codex Auth & Lapisan Agentik OpenAI (Detail — DocAgentRunner lintas-CLI)

Rujuk: https://developers.openai.com/codex/ dan https://developers.openai.com/codex/auth

- **Dua kontrak autentikasi Codex** (penting untuk model BYOK):
  1. **Sign in with ChatGPT** (OAuth): memakai langganan **ChatGPT** pengguna (Plus/Pro/Team/Edu/Enterprise) — termasuk *included limits/credits* & fitur seperti *fast mode*. Default CLI saat belum ada sesi: membuka browser → mengembalikan **access token**. Untuk **headless**, gunakan **device-code** (`--device-code`) atau token via stdin: `printenv CODEX_ACCESS_TOKEN | codex login --with-access-token`. Codex **cloud** mewajibkan ChatGPT sign-in.
  2. **API key**: billing usage-based via **OpenAI Platform** (`codex login` dengan API key; kredensial di `~/.codex/auth.json`). **Direkomendasikan untuk workflow terprogram/CI-CD.**
- **Model Codex:** keluarga `gpt-5.x-codex` (mis. **GPT-5.3-Codex**) — agen coding paling kapabel; sebagian varian (mis. `*-codex-spark`) hanya tersedia via katalog langganan Codex, bukan API-key langsung. Verifikasi di dok Codex/Models.
- **Peran di AgentBuff Co-Founder — `DocAgentRunner` lintas-CLI:** generator dokumen (§9.5.2.1) menjadi **CLI-agnostik penuh**: dapat menargetkan **Gemini CLI / Antigravity CLI** *atau* **Codex CLI**, di balik antarmuka `DocAgentRunner` yang sama. Pengguna OpenAI yang sudah punya langganan ChatGPT bisa memakai Codex untuk merakit & merender dokumen HTML→PDF (dengan Skills + konteks proyek), tanpa membayar token API terpisah.
- **⚠️ Batasan & keamanan untuk produk hosted (WAJIB dipahami):**
  - **OpenAI memperingatkan: "jangan mengekspos eksekusi Codex di lingkungan tidak tepercaya/publik."** Karena AgentBuff Co-Founder adalah web app multi-tenant, **menjalankan Codex server-side dengan ChatGPT-sign-in per pengguna itu rumit & berisiko** (alur OAuth interaktif/device-code, kebijakan retensi mengikuti workspace ChatGPT, ada quirk auto-pembuatan API key).
  - **Keputusan desain:** untuk jalur **hosted default**, gunakan **API key** (Gemini *atau* OpenAI) — ini paling sesuai untuk eksekusi server tanpa friksi. **Codex Sign-in with ChatGPT** ditawarkan terutama untuk: (a) **pengguna lanjutan / persona Dimas** yang menjalankan agen di lingkungannya sendiri; (b) **mode desktop/lokal** AgentBuff Co-Founder di masa depan; (c) sebagai opsi DocAgentRunner bagi yang memilihnya secara sadar. Semuanya tetap di balik adapter, dengan token diperlakukan sebagai kredensial sensitif (§13.1) dan **tidak pernah** ditulis ke log.
  - **Headless di server**: bila dipakai, andalkan **device-code** / `CODEX_ACCESS_TOKEN` yang disuntik aman per-job di sandbox; batasi tool & jaringan; jangan jalankan di lingkungan publik bersama.
- **Hubungan dengan diskusi "CLI vs Skill" (§9.5):** rekomendasi tetap — **default = pipeline deterministik berbasis Skill (provider-netral)**; **agen CLI (Gemini CLI / Codex CLI) = mode lanjutan/fallback/self-healing**. Multi-provider memperkuat alasan ini: Skill bersifat *portable* lintas executor & lintas vendor, sedangkan CLI/auth berbeda-beda dan berubah (transisi Antigravity, batasan Codex hosted).

---

# 13. SECURITY, PRIVACY & COMPLIANCE

## 13.1 Penanganan BYOK API Key (Paling Kritis)
- **Envelope encryption**: key dienkripsi dengan DEK; DEK dienkripsi oleh master key di **KMS/Vault**. Plaintext hanya hidup *in-memory* selama panggilan ke Gemini, lalu dibuang.
- **Never logged**: key & turunannya tidak pernah masuk log, error, atau analytics. Logging memiliki *redaction filter* otomatis.
- **Fingerprint, bukan plaintext**: simpan `key_fingerprint` (hash) untuk deteksi perubahan/duplikat tanpa menyimpan asli.
- **Akses minim**: hanya AI Orchestration Layer yang dapat meminta dekripsi, melalui Key Vault Service dengan otorisasi ketat.
- **Rotasi & pencabutan**: pengguna dapat mengganti/menghapus key kapan saja; penghapusan langsung menghapus ciphertext.
- **Transport**: seluruh komunikasi TLS; tidak ada key di URL/query string.

## 13.2 Keamanan Aplikasi Umum
- Sesi `httpOnly/secure/sameSite`; proteksi CSRF; rate limiting; input validation & output sanitization (khusus HTML yang akan dirender PDF → sanitasi untuk cegah injeksi).
- Otorisasi berbasis kepemilikan (user hanya mengakses project miliknya) di **setiap** adapter (UI & MCP).
- Dependency scanning, secrets scanning di CI, principle of least privilege pada infra.
- PDF/HTML rendering pada worker tersandbox (cegah SSRF/eksekusi tak diinginkan dari konten LLM).

## 13.3 Keamanan MCP/Agentic
- OAuth 2.1 + PKCE; scope granular per tool; per-client consent; token exp pendek + refresh.
- Audit log tiap pemanggilan tool (untuk akuntabilitas & deteksi anomali).
- Rate limit per klien/token; deteksi pola abuse (mis. spam image generation menghabiskan kuota user).
- Validasi bahwa instruksi yang datang via konten (resource) tidak menjadi *prompt injection* yang mem-bypass kebijakan — perlakukan konten eksternal sebagai data, bukan perintah tepercaya.

## 13.4 Privasi & Kepatuhan (Indonesia)
- **UU PDP (UU No. 27/2022)**: AgentBuff Co-Founder memproses data pribadi (identitas Google, isi project). Terapkan prinsip: dasar pemrosesan jelas (consent), minimisasi data, hak subjek data (akses, koreksi, hapus), retensi terbatas, keamanan memadai, dan notifikasi insiden.
- **Data residency**: pertimbangkan region Indonesia/Singapura untuk penyimpanan.
- **Transparansi data ke pihak ketiga**: jelaskan bahwa prompt/konteks dikirim ke Google Gemini (memakai key user) saat fitur AI dipakai; tautkan kebijakan Google.
- **Privacy by design**: incognito/ephemeral project (opsional roadmap), kontrol penghapusan project & artefak.
- **Tidak menjual data, tanpa iklan.**
- **Konten anak/sensitif**: AgentBuff Co-Founder tidak ditujukan untuk anak; kebijakan konten menolak ide bisnis ilegal/berbahaya.

## 13.5 Disclaimer Produk (di-surface ke pengguna)
- Output finansial = estimasi berbasis asumsi; bukan jaminan; bukan nasihat finansial/hukum profesional.
- Hasil riset = ringkasan dari sumber publik; pengguna disarankan verifikasi.
- Konsep brand/nama = ide awal; verifikasi ketersediaan merek (DJKI) & perizinan secara legal.

---

# 14. DETAILED UI/UX GUIDELINES

> Bagian ini preskriptif: navigasi, layout, **penempatan tombol**, **state loading AI**, microcopy, dan responsivitas — dirancang untuk pemula berliterasi-digital rendah, mobile-first.

## 14.1 Design Philosophy
- **Calm, guided, encouraging.** Satu fokus per layar. Hindari kepadatan & jargon.
- **Opinionated defaults.** AgentBuff Co-Founder selalu menyarankan langkah/pilihan; pengguna menyetujui/mengubah.
- **Show the work.** Saat AI bekerja, tampilkan *apa* yang sedang dilakukan (transparansi mengurangi kecemasan & churn).
- **Never lose progress.** Auto-save di mana-mana; resume mulus.
- **Mobile-first, thumb-friendly.** Target sentuh ≥44px; aksi utama dalam jangkauan ibu jari.

## 14.2 Design System (Token-Driven)
- **Tokens**: warna (primary brand AgentBuff Co-Founder, semantic success/warning/error/info, neutral scale), tipografi (skala heading/body, font legible mendukung bahasa Indonesia), spacing scale, radius, shadow, motion durations.
- **Komponen** (shadcn/ui + Tailwind): Button (primary/secondary/ghost/destructive), Card, Stepper, Wizard, Form fields (dengan inline help), Tooltip/Popover (glossary), Toast, Modal/Sheet, Progress (linear + stepped), Skeleton, EmptyState, ErrorState, Tabs, Accordion, Table (finansial), Chart, ImageGallery/Asset card, PDF preview, AppShell (top bar + side/bottom nav).
- **Mode**: light default; dark mode roadmap. **Reduced motion** dihormati.

## 14.3 Navigation & Information Architecture
- **App Shell**:
  - **Desktop/Tablet**: top bar (logo, nama project aktif, status key/kuota, menu akun) + **left sidebar** berisi *stepper* modul (Validasi → Plan → Brand → Dokumen) + akses Project list & Pengaturan.
  - **Mobile**: top bar ringkas + **bottom navigation** (Beranda/Projects, Langkah Aktif, Buat, Pemakaian, Akun); stepper tampil sebagai *horizontal scroller* di atas konten.
- **Primary navigation = the Journey stepper.** Modul ditampilkan sebagai langkah berurutan dengan indikator status (belum/aktif/selesai/perlu diperbarui).
- **Breadcrumb sederhana** di desktop; tombol "Kembali" konsisten di mobile.
- **Global "Lanjutkan"**: tombol kontekstual yang selalu menunjukkan langkah berikutnya yang disarankan.

## 14.4 Button Placement & Hierarchy (Preskriptif)
- **Satu Primary Action per layar.** Tombol primer dominan, warna brand, ditempatkan:
  - Mobile: **sticky di bawah** (di atas bottom-nav) agar mudah dijangkau, label aksi-spesifik ("Validasi Ide Saya", "Hitung Keuangan", "Buat Pitch Deck") — bukan "Submit".
  - Desktop: kanan-bawah area konten atau akhir alur, sejajar pola baca.
- **Secondary actions** (Kembali, Simpan draf, Ubah) sebagai tombol sekunder/ghost, tidak menyaingi primer.
- **Destructive actions** (Hapus project/aset) warna destructive + konfirmasi modal.
- **AI-trigger buttons** diberi penanda jelas + ikon percikan (✦) dan, untuk aksi berbiaya, micro-hint "memakai kuota Gemini-mu". Contoh: "✦ Buat Konsep Logo".
- **Disabled vs enabled**: tombol primer nonaktif sampai prasyarat terpenuhi, dengan tooltip alasan ("Lengkapi harga jual dulu").

## 14.5 AI Loading & Processing States (Sangat Detail)
Tugas AI bisa lama (riset 20–120 dtk; plan/dokumen lebih). Aturan ketat:

1. **Tidak pernah spinner kosong.** Selalu ada konteks tekstual tentang langkah saat ini.
2. **Stepped progress bermakna**: tampilkan tahap nyata pipeline.
   - Contoh Riset: `Menganalisis permintaan pasar… → Memeriksa kompetitor… → Membandingkan harga… → Menilai risiko… → Menyusun laporan…` (centang per tahap selesai).
3. **Streaming output**: untuk narasi (plan/dokumen), streaming teks token demi token dengan skeleton pada bagian yang belum tiba.
4. **Estimasi waktu** ("± 30–60 detik") + **progress bar** indeterminate→determinate bila bisa.
5. **Hasil parsial progresif**: tampilkan komponen yang sudah jadi (mis. kompetitor sudah muncul sementara harga masih diproses).
6. **Cancelable**: tombol "Batalkan" pada job panjang; progres parsial tetap tersimpan.
7. **Background + notifikasi**: jika >ambang (mis. 60–90 dtk) atau pengguna menavigasi pergi, jalankan di latar & beri toast/badge saat selesai ("Laporan validasimu siap ✓"). Untuk job sangat panjang, halaman status job khusus.
8. **Gambar (Nano Banana)**: per-slot placeholder *shimmer* dengan label "Membuat konsep visual…"; munculkan satu per satu; jangan blok layar.
9. **Skeleton screens** untuk struktur dokumen/financial table sebelum data tiba.
10. **Cost-aware confirm**: sebelum operasi besar/berbiaya (mis. generate 4 gambar atau render deck penuh), tampilkan konfirmasi ringan + estimasi pemakaian kuota.
11. **Error mid-flight**: tampilkan apa yang berhasil + tombol "Coba lagi bagian yang gagal" tanpa mengulang semuanya.
12. **Latency masking**: optimistic UI untuk aksi ringan; animasi transisi halus (hormati reduced-motion).

## 14.6 Onboarding UX (Frictionless)
- **Progress 3 titik** di atas; tiap langkah satu layar.
- **Langkah Validasi Key**: kartu panduan bergambar + tombol "Buka Google AI Studio" (tab baru) + field paste besar (auto-mask) + status real-time (Validating → Valid ✓/Error spesifik) + jaminan keamanan (ikon gembok). Microcopy menenangkan soal biaya.
- **Profil**: pertanyaan tap (chip), bukan dropdown panjang.
- **Ide pertama**: textarea ramah + contoh + opsi "Bantu saya temukan ide".
- **Selesai → langsung Dashboard** dengan langkah pertama ter-*highlight* dan CTA "Mulai Validasi".

## 14.7 Empty, Error & Edge States
- **Empty state** tiap modul: ilustrasi + 1 kalimat manfaat + 1 CTA + (opsional) "Apa ini?" link.
- **Error state**: bahasa manusia ("Sepertinya koneksi ke AI bermasalah") + penyebab ringkas + tombol "Coba lagi" + jalan keluar; **tidak ada kode error mentah/stack trace**.
- **BYOK error banner** (key invalid/limit): banner kuning persisten + "Perbarui key" → Pengaturan; job di-*pause* gracefully.
- **Stale data badge**: pada artefak hilir saat upstream berubah ("Data berubah — perbarui dokumen?").

## 14.8 Microcopy & Tone (Bahasa Indonesia)
- Hangat, jelas, suportif, ringkas. Memakai "kamu". Hindari jargon; jika perlu istilah, beri tautan glossary.
- **Definisi just-in-time**: tap istilah (HPP, BEP, margin, TAM) → popover singkat + contoh angka.
- **Encouragement jujur**: rayakan milestone ("Mantap! Business plan-mu sudah jadi 🎉") tanpa berlebihan; saat skor rendah, sampaikan suportif + langkah konkret.
- **Error**: tanpa menyalahkan pengguna; fokus solusi.
- **Label tombol = aksi spesifik** (lihat 14.4).

## 14.9 Glossary & Education Layer
- Komponen Tooltip/Popover konsisten untuk istilah teknis.
- "Mode Belajar" opsional: penjelasan ringkas mengapa tiap langkah penting (untuk membangun literasi, bukan menggurui).

## 14.10 Responsiveness Specifics
- **Breakpoints**: base 360px (mobile), ≥768px (tablet), ≥1024px (desktop), ≥1440px (wide).
- **Financial tables**: di mobile → kartu/ringkasan + tabel *horizontally scrollable* dengan kolom bulan; grafik adaptif. Jangan paksa tabel lebar utuh di layar kecil.
- **Wizard**: satu pertanyaan/kelompok per layar di mobile; multi-kolom di desktop.
- **PDF preview**: di mobile tampilkan thumbnail + tombol "Buka pratinjau penuh"; deck landscape ditampilkan sebagai *carousel* slide.
- **Brand gallery**: grid 1-kolom (mobile) → multi-kolom (desktop).
- **Sticky primary CTA** di mobile; hindari menutupi konten penting.

## 14.11 Accessibility (a11y)
- Kontras WCAG AA; target sentuh ≥44px; fokus keyboard terlihat; ARIA pada komponen interaktif & state loading (announce progress untuk screen reader); `prefers-reduced-motion`; teks alternatif untuk gambar konsep; bahasa konten `lang="id"`.

## 14.12 Dashboard/Project View
- **Kartu Project** dengan progress ring (mis. 3/4 langkah selesai), status terakhir, dan tombol "Lanjutkan".
- **Panel ringkas** menampilkan: status key/kuota, artefak yang siap (badge Unduh), dan langkah berikutnya yang disarankan.
- **Riwayat versi** dasar pada tiap artefak.

---

# 15. NON-FUNCTIONAL REQUIREMENTS (NFR)

NFR menetapkan *kualitas* sistem, bukan fitur. Karena AgentBuff Co-Founder bersifat BYOK dan banyak pekerjaan bersifat AI-bound (latency ditentukan Gemini), target dipisah antara **App-Controlled** (yang sepenuhnya kendali AgentBuff Co-Founder) dan **AI-Bound** (bergantung Gemini/jaringan pengguna).

## 15.1 Performance & Latency

**Prinsip:** AgentBuff Co-Founder tidak menjanjikan latency LLM (di luar kendali), tetapi *menjamin* responsivitas shell aplikasi dan transparansi progres untuk semua tugas panjang.

| Kelas Tugas | Target (p95) | Sifat | Catatan |
|---|---|---|---|
| App shell load (PWA, repeat visit) | ≤ 1.5 dtk | App-Controlled | Cache PWA, code-splitting, RSC streaming |
| First Contentful Paint (4G mid-tier) | ≤ 2.5 dtk | App-Controlled | Penting karena mobile-first (~33% adopsi digital) |
| Navigasi antar-halaman (client) | ≤ 300 ms | App-Controlled | Prefetch + optimistic UI |
| API CRUD (read project, list) | ≤ 400 ms | App-Controlled | Index DB, query teroptimasi |
| **Financial Engine** (HPP→BEP→proyeksi 36 bln) | ≤ 200 ms | App-Controlled | Deterministik, murni komputasi — TIDAK memanggil LLM |
| Validasi API Key Gemini | ≤ 4 dtk | AI-Bound | 1 probe call ringan; ada loading state khusus |
| Idea Validation (single, grounded) | 10–40 dtk | AI-Bound | Streaming + progress; nilai akhir dihitung kode |
| Deep Market Research (6-stage pipeline) | 1–4 menit | AI-Bound | Async job + progress per-stage + email/in-app notif |
| Business Plan generation (end-to-end) | 1–5 menit | AI-Bound | Async; angka dari engine, narasi dari LLM |
| Brand concept (teks: strategi/naming/voice) | 20–60 dtk | AI-Bound | Streaming |
| Brand asset (Nano Banana, per gambar) | 5–25 dtk | AI-Bound | Antri; tampilkan skeleton per-slot gambar |
| **PDF render** (Proposal/Deck, server) | ≤ 8 dtk | App-Controlled | Chromium headless + Paged.js; di luar waktu LLM mengisi konten |

**Mekanisme penjamin:** semua tugas AI-Bound **wajib** berjalan sebagai async job (BullMQ) dengan event progres, sehingga p95 latency UI shell tetap terpenuhi walau LLM lambat. Tidak ada request HTTP sinkron yang menahan UI > 10 detik.

## 15.2 Scalability & Capacity

- **Stateless app tier**: horizontal scaling di belakang load balancer; tidak ada session afinitas (sesi via token, state via DB/Redis).
- **Worker tier terpisah & elastis**: pool worker untuk job AI/PDF di-scale independen dari web tier (PDF render = CPU/RAM-intensif; isolasi mencegah render menelan kapasitas web).
- **Beban Gemini = beban pengguna**: karena BYOK, throughput LLM ter-shard alami per-pengguna (kuota mereka), sehingga AgentBuff Co-Founder tidak menjadi bottleneck token tunggal. Ini keunggulan skalabilitas struktural dari model BYOK.
- **Target kapasitas v1 (Public Beta)**: 50.000 registered users, 5.000 MAU aktif, puncak 200 concurrent AI jobs, 500 PDF render/jam tanpa degradasi target p95.
- **Data growth**: artefak (JSON + PDF + gambar) tumbuh per-project; storage objek (S3-compatible) di-region Jakarta dengan lifecycle policy (lihat §15.6).

## 15.3 Availability & Reliability

- **Target uptime v1**: 99.5% bulanan untuk core API & web (≈ 3,6 jam/bln budget). Naik ke 99.9% di GA.
- **Graceful degradation**: bila Gemini pengguna gagal/limit → fitur AI masuk state error suportif, tetapi **fitur non-AI tetap hidup** (lihat/unduh artefak lama, edit data, navigasi). Aplikasi tidak "mati total" karena BYOK bermasalah.
- **PDF subsystem down** → tetap bisa lihat data & artefak; tombol unduh menampilkan status "sementara tidak tersedia", job di-retry.
- **Job durability**: job AI/PDF idempoten & resumable; retry dengan backoff; dead-letter queue untuk kegagalan permanen + notifikasi pengguna yang jelas.
- **Zero-data-loss pada artefak final**: artefak yang sudah jadi disimpan tahan lama; regenerasi bersifat opsional, bukan keharusan.

## 15.4 Maintainability & Extensibility

- **Single Engine, Multi-Adapter** (lihat §10): logika bisnis terpusat; menambah model Gemini baru / tool MCP baru = perubahan konfigurasi + adapter tipis, bukan rombak inti.
- **Config-driven model routing** (§12.2): deprecation model (mis. Gemini 2.0 Flash shutdown, Imagen deprecated) ditangani lewat ubah config, bukan refactor kode.
- **Versioned prompts & schemas**: prompt dan JSON Schema diberi versi; perubahan dapat di-rollback dan di-A/B test.
- **Test pyramid**: unit (wajib 100% untuk Financial Engine), integration (adapter Gemini di-mock), contract test untuk MCP tools (skema in/out), E2E untuk Golden Path.

## 15.5 Portability & Compatibility

- **Browser**: 2 versi terakhir Chrome, Edge, Safari, Firefox (desktop & mobile). Progressive enhancement.
- **PWA installable** (Android/desktop); iOS via Add-to-Home-Screen dengan keterbatasan diketahui.
- **Output PDF** patuh standar agar terbuka konsisten di Adobe/Preview/Chrome PDF viewer; font ter-embed.
- **MCP** patuh spec ber-versi tanggal (negotiated saat `initialize`), Streamable HTTP, OAuth 2.1 — interoperabel dengan klien agentic apa pun (Claude, OpenAI, dll).

## 15.6 Data Retention & Cost-of-Storage

- **Artefak teks/JSON**: disimpan selama akun aktif.
- **Gambar brand & PDF**: lifecycle policy — versi lama (non-final) dipindah ke storage dingin / dihapus setelah N hari sesuai kebijakan, untuk menekan biaya storage yang ditanggung AgentBuff Co-Founder.
- **Penghapusan akun**: hard-delete data pengguna dalam SLA (lihat §13.4), termasuk objek storage & key terenkripsi.

## 15.7 Observability (ringkas; detail di §16)

- **Logging terstruktur** (tanpa PII sensitif, **tanpa API key** — lihat §13.1), **metrics** (latency, error rate, job queue depth), **tracing** (W3C Trace Context, selaras kesiapan MCP 2026 RC).
- **SLO dashboard** internal untuk p95 per kelas tugas, success rate job, dan kesehatan subsistem PDF/AI.

---

# 16. ANALYTICS & INSTRUMENTATION

Analitik AgentBuff Co-Founder melayani dua tujuan: (1) mengukur **North Star "Activated Founders/week"** dan funnel AARRR+BYOK (§5), (2) menjaga **kualitas & kepercayaan AI** (deteksi halusinasi, kepuasan output). Semua tunduk pada privasi (§13.4): event di-anonymize sedapat mungkin, tanpa menyimpan konten bisnis sensitif di pihak ketiga, **tanpa API key**, dan dengan basis hukum yang sah (UU PDP).

## 16.1 Prinsip Instrumentasi

- **Privacy-by-design**: default minimal; konten dokumen TIDAK dikirim ke analytics pihak ketiga. Yang dilacak = *peristiwa & properti agregat* (jenis tindakan, status, durasi, kelas hasil), bukan isi business plan.
- **Event taxonomy konsisten**: `area.object_action` (mis. `auth.google_succeeded`, `planner.financials_computed`).
- **Schema-versioned events**: tiap event punya versi & properti terdokumentasi.
- **Self-hostable**: prioritaskan analytics yang dapat di-host di region Jakarta (mis. PostHog self-host) demi kepatuhan & kontrol data.

## 16.2 Event Taxonomy (Inti)

**Acquisition & Activation**
- `landing.viewed`, `auth.google_started`, `auth.google_succeeded`, `auth.federated_login_succeeded` {source}
- `onboarding.started`, `onboarding.key_input_viewed`, `onboarding.key_validation_started`, `onboarding.key_validated` {capabilities_detected}, `onboarding.key_failed` {reason_class}
- `onboarding.completed` → **kandidat sinyal Activation tahap-1**

**Core Value Events (mengarah ke North Star)**
- `research.idea_validation_started` / `_completed` {score_band: low|med|high, grounded: bool}
- `research.deep_research_started` / `_stage_completed` {stage} / `_completed` {duration_ms}
- `planner.intake_completed`, `planner.financials_computed` {bep_reached: bool} (event engine deterministik), `planner.plan_generated`
- `brand.concept_generated` {subfeatures[]}, `brand.assets_generated` {count}
- `docs.proposal_generated`, `docs.pitchdeck_generated`, `artifact.downloaded` {type: proposal|deck|brandkit} → **definisi inti "Activated Founder"** (mis. menghasilkan ≥1 artefak unduhan)

**Retention & Habit**
- `project.created`, `project.resumed`, `project.completed_all_steps`
- `session.started`, `weekly_active` (derived)

**Agentic / MCP**
- `mcp.oauth_authorized`, `mcp.tool_called` {tool_name, status}, `mcp.session_started`
- Memungkinkan analisis "headless adoption" (persona Dimas) terpisah dari UI.

**Guardrail & Trust**
- `ai.output_flagged_low_confidence`, `ai.regeneration_requested` {feature}
- `ai.user_feedback` {rating, feature} (thumbs up/down pada output)
- `error.ai_call_failed` {class}, `error.pdf_render_failed`, `byok.quota_blocked`

## 16.3 Funnel & Dashboard Utama

1. **BYOK Activation Funnel**: `landing.viewed` → `auth.google_succeeded` → `onboarding.key_validated` → `onboarding.completed`. Mengukur friksi terbesar produk (memasukkan API key). Drop-off di `key_input_viewed`→`key_validated` = sinyal perlu perbaikan UX panduan key.
2. **Value Funnel (North Star)**: `onboarding.completed` → `research.*_completed` → `planner.plan_generated` → `artifact.downloaded`. Konversi ke "Activated Founder".
3. **Module Completion Rates**: % proyek yang menuntaskan tiap modul; identifikasi modul yang "menyangkut".
4. **AI Quality Dashboard**: rasio thumbs-up, tingkat regenerasi per fitur, tingkat low-confidence flag, distribusi ValidationScore — proksi kualitas & deteksi dini regresi prompt/model.
5. **BYOK Health**: tingkat key invalid/limit, distribusi kapabilitas terdeteksi (apakah banyak user pakai key tanpa grounding?), agar dukungan & onboarding diarahkan.
6. **Agentic Dashboard**: jumlah tool MCP call, tool terpopuler, rasio sukses, retensi power user.

## 16.4 Eksperimentasi

- **Feature flags** untuk rollout bertahap (lihat §18) dan kill-switch per fitur AI.
- **A/B test** pada: copy onboarding key, urutan wizard finansial, template default deck — diukur terhadap konversi funnel & kepuasan output.
- **Eval offline AI** (§12.6) memberi sinyal kualitas sebelum rilis; analitik produksi memberi sinyal sesudah.

---

# 17. RISKS & MITIGATIONS

Risiko diberi peringkat **Impact × Likelihood** dan dipetakan ke mitigasi konkret yang sudah tertanam di desain. Risiko terbesar AgentBuff Co-Founder bukan teknis murni, melainkan **friksi BYOK** dan **kepercayaan terhadap output AI**.

| # | Risiko | Impact | Likelihood | Mitigasi (sudah di desain) |
|---|---|---|---|---|
| R1 | **Friksi onboarding BYOK** — pengguna pemula menyerah saat diminta API key Gemini | Tinggi | Tinggi | Panduan langkah-demi-langkah bergambar untuk membuat key gratis; validasi & capability-detection instan (§9.1); copy menenangkan; "mode jelajah" terbatas sebelum key (lihat R1-detail); ukur funnel key (§16.3) & iterasi |
| R2 | **Halusinasi angka finansial** — LLM mengarang HPP/ROI/proyeksi yang salah → keputusan bisnis buruk | Kritis | Sedang | Prinsip **"LLM Proposes, Code Disposes"**: semua angka dari **Deterministic Financial Engine** (§9.3), bukan LLM; LLM hanya menarasikan angka yang sudah dihitung; angka di PDF *bound* dari engine (§9.5) |
| R3 | **Halusinasi riset/fakta pasar** | Tinggi | Sedang | Wajib **Grounding with Google Search** untuk klaim faktual + **sumber clickable** (anotasi `url_citation`) agar pengguna verifikasi sendiri (§9.2.1, §12.9); tandai klaim tak tergrounding sebagai "estimasi"; opsi **Deep Research agent** untuk riset bercitasi (§12.8) |
| R4 | **Kuota/biaya Gemini pengguna habis** di tengah pekerjaan | Sedang | Tinggi | Estimasi biaya pra-eksekusi; context caching (~90% hemat) & Batch API (~50%); thinking_level adaptif; job pause-gracefully + resume; banner kuota jelas (§9.1, §12.4) |
| R5 | **Deprecation/keusangan model** (model image/teks berganti; mis. transisi keluarga Imagen↔Nano Banana, penghentian model lama) | Sedang | Tinggi (pasti terjadi berkala) | **Config-driven model routing** (§12.2): ganti model via config; abstraksi provider; pin versi + jalur migrasi; **pantau halaman Deprecations** (§12.13); uji eval sebelum tukar. **Jangan hardcode nama model.** |
| R6 | **Biaya PDF render & storage** ditanggung AgentBuff Co-Founder membengkak | Sedang | Sedang | Worker PDF terpisah & elastis (§15.2); lifecycle/storage policy (§15.6); render on-demand + cache hasil; region Jakarta |
| R7 | **Penyalahgunaan MCP / abuse agentic** (scripted abuse, biaya, scraping) | Sedang | Sedang | OAuth 2.1 + PKCE, scope per-tool, rate-limit & quota per-token, audit log, kill-switch tool (§9.6, §13.3); BYOK membatasi biaya LLM ke kuota pelaku |
| R8 | **Keamanan API key BYOK** (kebocoran = kerugian finansial pengguna) | Kritis | Rendah (dengan kontrol) | **Envelope encryption** via KMS, **tidak pernah di-log**, tidak ditampilkan utuh, fingerprint only, dekripsi in-memory sesaat (§13.1) |
| R9 | **Kepatuhan UU PDP No. 27/2022** (data pribadi & bisnis pengguna) | Tinggi | Sedang | Data residency Jakarta; minimisasi data; konsen & hak subjek data; DPA dengan vendor; hard-delete SLA (§13.4) |
| R10 | **Kualitas output AI tidak konsisten** antar pengguna/model | Sedang | Sedang | Structured Outputs (JSON Schema) + Template-Constrained Generation (§9.5); layered prompts berversi; eval & guardrail (§12.6, §16.2) |
| R11 | **Adopsi pasar lambat** / pemula tak paham nilai produk | Tinggi | Sedang | Golden Path terpandu (§8); bahasa Indonesia hangat + glossary just-in-time (§14); "quick win" cepat (validasi ide < 1 menit) sebelum minta komitmen besar |
| R12 | **Over-reliance / ekspektasi keliru** — pengguna anggap output = jaminan sukses | Sedang | Sedang | Disclaimer produk yang jujur (§13.5): AgentBuff Co-Founder = co-pilot & alat bantu keputusan, bukan jaminan; dorong literasi via "Mode Belajar" |
| R13 | **Federated SSO/webhook** salah konfigurasi → risiko auth | Tinggi | Rendah | OIDC standar + signed JWT handoff bervalidasi (§9.1); allowlist partner; rotasi kunci; audit |
| R14 | **Vendor lock-in (Gemini/OpenAI)** | Rendah | Rendah | **Sudah dimitigasi by design**: Provider Abstraction Layer (§12.14) + multi-provider BYOK (Gemini/OpenAI/Codex). Menambah provider baru = adapter tipis. |
| R15 | **Lonjakan biaya grounding** (paid $14/1k queries di atas free tier) | Sedang | Sedang | Karena BYOK, biaya grounding masuk akun pengguna; AgentBuff Co-Founder beri budget grounding & caching agar hemat (§12.4); transparansi pemakaian |
| R16 (R-CLI) | **Transisi Gemini CLI → Antigravity CLI** (~18 Jun 2026, tier unpaid/Google One) memutus pipeline dokumen | Tinggi | Tinggi (diumumkan resmi) | **DocAgentRunner CLI-agnostik** (adapter) — target Antigravity CLI sebagai penerus tanpa rombak modul (§9.5.2.1, §12.12); fallback Template-Constrained non-agen; verifikasi paket/perintah terbaru sebelum coding |
| R17 | **Breaking changes Interactions API (Mei 2026)** memengaruhi Deep Research/fitur berbasis Interactions | Sedang | Sedang | Pantau halaman breaking changes & `Api-Revision` (§12.13); pin revisi; fallback custom pipeline (§9.2.5 Jalur B); abstraksi adapter (§10) |
| R18 | **Ketergantungan fitur *preview*** (Deep Research agent berstatus preview) berubah/ditarik | Sedang | Sedang | Sediakan **fallback Jalur B** (custom grounded pipeline) yang selalu tersedia; tandai fitur preview di config; uji ketersediaan per-key |
| R19 | **Codex Sign-in-with-ChatGPT sulit/berisiko di server hosted** (OAuth interaktif, "jangan ekspos di lingkungan publik", quirk auto-key) | Sedang | Sedang | **Default hosted = API key** (Gemini/OpenAI); Codex sign-in untuk mode lanjutan/desktop/DocAgentRunner saja; headless via device-code/`CODEX_ACCESS_TOKEN` di sandbox; token sebagai kredensial sensitif (§12.16, §13.1) |
| R20 | **Divergensi kapabilitas antar-provider** (mis. OpenAI image butuh Org Verification; tier berbeda) → pengalaman tidak seragam | Sedang | Sedang | **Capability detection** saat validasi (§12.14.4); nonaktifkan/ sembunyikan fitur tak tersedia + saran tambah provider; uji paritas via adapter |
| R21 | **Normalisasi biaya & estimasi lintas-provider** membingungkan pengguna | Sedang | Sedang | Tampilkan estimasi & label biaya **sesuai provider** (free-tier Google / usage-based OpenAI / langganan ChatGPT); jangan klaim "gratis" universal; transparansi pemakaian per provider |
| R22 | **Schema/format Structured Output berbeda** (Gemini `responseSchema` vs OpenAI `text.format`) menimbulkan bug parsing | Rendah | Sedang | Normalisasi di adapter; satu set **JSON Schema kanonik** (Appendix §20.4) dipetakan per provider; contract test per adapter (§12.6) |

**R1-detail (mitigasi friksi BYOK, paling kritis):** sediakan *guided key creation* (tautan langsung + tangkapan layar AI Studio), validasi real-time dengan pesan ramah, deteksi kapabilitas (grounding/JSON/image) lalu sesuaikan fitur yang ditawarkan, dan **"Coba sebelum komit"** — tampilkan 1 contoh validasi ide demo (read-only, ditanggung kuota AgentBuff Co-Founder terbatas) agar pengguna merasakan nilai sebelum memasukkan key.

---

# 18. RELEASE PLAN & ROADMAP

Strategi rilis bertingkat (selaras §7.3) memprioritaskan **menutup Golden Path end-to-end** lebih dulu (validasi → plan → brand → dokumen), karena nilai inti AgentBuff Co-Founder muncul saat pengguna memegang artefak siap-pakai (proposal/deck). MCP dirilis setelah engine inti stabil agar agen eksternal mewarisi logika yang sudah teruji.

## 18.1 Prinsip Roadmap
- **Vertical slices**, bukan layer horizontal: tiap fase mengantar nilai utuh yang bisa dipakai.
- **Engine sebelum Adapter**: Financial Engine & Orchestration matang dulu; UI dan MCP adalah adapter di atasnya.
- **Trust sebelum skala**: guardrail (determinisme angka, grounding) dianggap *blocking* untuk GA.
- **Feature flags** untuk merilis bertahap & kill-switch (lihat §16.4).
- **Penahapan multi-provider:** bangun **Provider Abstraction Layer (PAL)** sejak awal, tetapi rilis provider bertahap untuk mengelola kompleksitas: **(a) Gemini lebih dulu** (jalur paling ramah pemula, free tier) di Fase 0–2; **(b) OpenAI API key** ditambah di Fase 2–3 (adapter Responses API, paritas fitur); **(c) Codex Sign-in-with-ChatGPT** menyusul (mode lanjutan/DocAgentRunner/desktop) karena batasan hosted (§12.16). PAL memastikan penambahan provider = adapter tipis, bukan rombak inti.

## 18.2 Fase Rilis

### Fase 0 — Foundation (Internal Alpha)
**Tujuan:** fondasi aman & deterministik.
- Auth Google-only + sesi; skeleton PWA & design system token (§14.2).
- **Deterministic Financial Engine** lengkap + unit test 100% (HPP, margin, BEP, proyeksi, payback, ROI/NPV/IRR).
- Integrasi Gemini dasar (Structured Outputs + 1 model routing config); penyimpanan BYOK key terenkripsi (envelope/KMS) + validasi key.
- Telemetri inti & logging tanpa-PII/tanpa-key.
**Exit:** engine akurat & teruji; key BYOK aman; login jalan.

### Fase 1 — Core Value (Closed Beta, undangan)
**Tujuan:** tutup Golden Path teks-sentris.
- Onboarding frictionless + guided key creation (mitigasi R1).
- **Deep Research & Validator** (grounded, 6-stage) + ValidationScore deterministik.
- **Master Business Planner** (Financial Intake Wizard + narasi plan dari engine).
- **Deck & Docs Engine**: Proposal PDF + Pitch Deck PDF (Template-Constrained Generation, Chromium+Paged.js).
- Dashboard & project view; states loading AI (§14.5).
**Exit:** pengguna undangan bisa menempuh ide → plan → **unduh** proposal & deck. NSM "Activated Founder" mulai diukur.

### Fase 2 — Creative & Polish (Public Beta)
**Tujuan:** identitas brand & kesiapan publik.
- **Brand Forge Studio** (strategi, naming, voice, palette/typografi token, moodboard, ide logo, interior, kemasan) via Nano Banana BYOK.
- Brand Kit export; konsistensi token brand mengalir ke deck/proposal.
- Penguatan a11y (WCAG AA), responsif penuh (360/768/1024/1440), microcopy & glossary.
- Cost control matang: context caching, Batch API, thinking_level adaptif, budget grounding.
- Eksperimentasi (A/B) pada funnel key & wizard.
**Exit:** alur lengkap 4 modul; stabil untuk publik luas; biaya BYOK efisien.

### Fase 3 — Agentic / MCP (GA Track)
**Tujuan:** buka mesin untuk agen eksternal.
- **AgentBuff Agent Gateway (MCP)**: Streamable HTTP, OAuth 2.1+PKCE, Tools/Resources/Prompts (katalog §9.6), kontrak skema = logika UI.
- Rate-limit/scope/audit per-token; MCP Inspector untuk QA; kesiapan header routing & W3C Trace Context (selaras RC 2026).
- Federated SSO/Webhook (OIDC + signed JWT) untuk partner ekosistem.
**Exit:** Claude/OpenAI/klien MCP lain dapat menjalankan riset/plan/dokumen headless dengan paritas hasil UI.

### Fase 4 — GA (General Availability)
- SLO dinaikkan (99.9%), hardening keamanan & kepatuhan UU PDP penuh, dokumentasi publik, dukungan, observability lengkap.
- Semua guardrail trust terpenuhi (blocking): determinisme angka, grounding, disclaimer.

## 18.3 Roadmap Pasca-GA (Vision Backlog, non-v1)
- **Kolaborasi multi-user** per proyek (peran owner/editor/viewer; komentar).
- **Mode Mentor/Inkubator (multi-tenant)**: dashboard pembina memantau banyak founder (persona Pendukung); berbasis fondasi federasi.
- **Marketplace template** (deck/proposal/industri) & template per-vertikal (F&B, fashion, jasa, digital).
- **Integrasi lembaga pembiayaan** (KUR/UMi/PNM/investor): ekspor proposal sesuai format pemberi dana; jalur "Ajukan".
- **i18n English** (membuka ekspansi; ingat ekspor UMKM baru ~15,7% → ada ruang go-global).
- **Integrasi operasional**: hubungkan plan ke QRIS/akuntansi/marketplace untuk menutup loop "rencana → jalankan → ukur".
- **Dukungan multi-LLM** (manfaat abstraksi §12/§14-R14) bila relevan.

## 18.4 Definition of Done (lintas fitur)
Sebuah fitur "selesai" hanya jika: punya UI (responsif + a11y) **dan** paritas MCP bila relevan; angka (jika ada) dari engine deterministik; klaim faktual tergrounding; punya loading/empty/error state; ter-instrumen (event §16); ada eval/QA AI (§12.6); aman (key/PII tak bocor); dan terdokumentasi.

---

# 19. OPEN QUESTIONS

Pertanyaan terbuka yang perlu keputusan produk/teknis/bisnis sebelum atau selama implementasi. Masing-masing diberi **owner** indikatif dan **kapan harus diputuskan**.

| # | Pertanyaan Terbuka | Owner | Diputuskan Saat |
|---|---|---|---|
| Q1 | **Definisi presisi "Activated Founder"** — apakah = unduh ≥1 artefak, atau menuntaskan business plan? Ambang ini menentukan North Star. | Product/Data | Sebelum Closed Beta (Fase 1) |
| Q2 | **"Coba sebelum komit"** — apakah AgentBuff Co-Founder menanggung kuota demo terbatas (1 validasi ide) sebelum key dimasukkan? Berapa biaya & batas abuse-nya? | Product/Finance | Fase 1 (mitigasi R1) |
| Q3 | **Model default & fallback** per kelas tugas (mis. Gemini 3.5 Flash vs 3.1 Pro vs 2.5 Flash-Lite) — tuning kualitas vs biaya pengguna. | AI/Eng | Fase 0–1, lalu iteratif |
| Q4 | **Kebijakan retensi gambar/PDF** (§15.6) — berapa hari versi non-final disimpan sebelum cold/hapus, demi biaya AgentBuff Co-Founder? | Eng/Finance | Fase 2 |
| Q5 | **Standar partner Federated SSO** — protokol & proses onboarding partner (allowlist, kontrak, rotasi kunci). | Eng/BD | Fase 3 |
| Q6 | **Lisensi & kepemilikan output** — apakah logo/brand asset hasil Nano Banana diberi disclaimer IP/lisensi tertentu kepada pengguna? | Legal/Product | Fase 2 |
| Q7 | **Lokalisasi format finansial & pajak** — sejauh mana engine memodelkan PPN/PPh/pajak UMKM Indonesia dalam proyeksi? | Product/Domain | Fase 1 (cakupan), iteratif |
| Q8 | **Monetisasi masa depan** (§6.4) — fitur premium apa yang tidak melanggar semangat "gratis + BYOK"? (mis. kolaborasi, marketplace, storage besar) | Business | Pasca-GA |
| Q9 | **Tingkat keterlibatan "Mentor/Inkubator"** di v1 — apakah hanya persona tervalidasi atau sudah ada fitur ringan? | Product | Pasca-GA (backlog) |
| Q10 | **Kebijakan konten & moderasi** untuk ide bisnis sensitif/ilegal — guardrail penolakan di level produk. | Trust/Legal | Fase 1 |
| Q11 | **Strategi caching grounding** — bagaimana menyeimbangkan kesegaran data pasar vs biaya query grounding ($14/1k)? | AI/Eng | Fase 2 |
| Q12 | **Paritas fitur UI↔MCP** — apakah SEMUA fitur wajib punya tool MCP, atau ada subset (mis. asset generation berat) yang ditahan? | Product/Eng | Fase 3 |
| Q13 | **Dukungan multi-LLM** — kapan (jika) membuka provider selain Gemini, mengingat BYOK saat ini Gemini-spesifik? | Product/AI | Pasca-GA |

---

# 20. APPENDIX

## 20.1 Glossary (Istilah untuk Pemula & Tim)

| Istilah | Penjelasan singkat (bahasa pemula) |
|---|---|
| **BYOK (Bring Your Own Key)** | Pengguna memakai API key Gemini miliknya sendiri agar biaya AI ditanggung pengguna; aplikasi gratis. |
| **HPP (Harga Pokok Penjualan / COGS)** | Total biaya membuat/mengadakan satu produk (bahan + tenaga langsung + overhead terkait). Dasar menentukan harga jual. |
| **Margin Kontribusi** | Harga jual dikurangi biaya variabel per unit; "sisa" untuk menutup biaya tetap & laba. |
| **Margin Laba (Profit Margin)** | Persentase laba terhadap penjualan. |
| **BEP (Break-Even Point / Titik Impas)** | Jumlah penjualan agar tidak rugi & tidak untung (semua biaya tertutup). |
| **Modal Awal (CapEx + modal kerja)** | Uang yang dibutuhkan untuk memulai sebelum bisnis menghasilkan. |
| **ROI (Return on Investment)** | Ukuran seberapa besar keuntungan dibanding modal yang ditanam. |
| **Payback Period** | Berapa lama modal kembali dari laba. |
| **NPV / IRR** | Ukuran kelayakan investasi mempertimbangkan nilai waktu uang (lanjutan; ditampilkan opsional). |
| **TAM / SAM / SOM** | Ukuran pasar: total (TAM), yang bisa dilayani (SAM), yang realistis diraih (SOM). |
| **Funnel / Funneling** | Tahapan calon pelanggan dari kenal → tertarik → beli → loyal. |
| **Pitch Deck** | Presentasi singkat (gaya slide landscape) untuk meyakinkan investor. |
| **Business Proposal** | Dokumen formal & terstruktur yang menjelaskan rencana bisnis secara lengkap. |
| **Grounding (Google Search)** | Kemampuan Gemini mengambil fakta terkini dari pencarian & menyertakan sumber, mengurangi karangan. |
| **Structured Output (JSON Schema)** | Memaksa AI menjawab dalam format data terstruktur agar bisa diproses kode dengan andal. |
| **MCP (Model Context Protocol)** | Protokol standar agar agen AI eksternal memakai fitur aplikasi secara headless (tanpa UI). |
| **Tool / Resource / Prompt (MCP)** | Tiga primitif MCP: aksi yang bisa dipanggil (Tool), data yang bisa dibaca (Resource), template instruksi (Prompt). |
| **Nano Banana** | Model image-generation Gemini (pengganti Imagen yang di-deprecate) untuk aset visual brand. |
| **"LLM Proposes, Code Disposes"** | Prinsip AgentBuff Co-Founder: AI mengusulkan narasi/ide, tetapi semua angka final dihitung oleh kode deterministik. |

## 20.2 Prompt Library (Contoh, Layered & Berversi)

> Catatan: prompt disimpan berversi (§12.3). Semua prompt finansial **tidak** meminta LLM menghitung angka; angka di-*inject* dari Financial Engine, LLM hanya menarasikan. Klaim faktual mewajibkan grounding.

**P-RESEARCH-01 — Idea Validation (grounded, structured)**
```
[SYSTEM] Kamu analis bisnis untuk pasar Indonesia. Gunakan Google Search grounding untuk klaim faktual & sertakan sumber. JANGAN mengarang angka pasar; tandai estimasi sebagai "estimasi". Jawab HANYA dalam JSON sesuai schema.
[CONTEXT] Ide bisnis: {idea}. Lokasi/target: {market}. Bahasa: Indonesia.
[TASK] Identifikasi: ringkasan permintaan pasar, indikasi kompetisi, segmen pelanggan, sumber daya/kanal, dan risiko awal. Beri sinyal (rendah/sedang/tinggi) untuk: demand, kompetisi, diferensiasi. Sertakan kutipan sumber per klaim faktual.
[OUTPUT] JSON: lihat schema research_signals (20.4).
```

**P-PLAN-NARRATE-01 — Narasi Business Plan dari angka engine**
```
[SYSTEM] Kamu penulis business plan profesional berbahasa Indonesia yang hangat & jelas untuk pemula. Angka finansial bersifat FINAL & sudah dihitung; JANGAN mengubah/menghitung ulang. Rujuk angka persis seperti diberikan.
[CONTEXT] Profil bisnis: {profile}. Angka finansial terhitung: {financials_json_from_engine}. Hasil riset: {research_summary}.
[TASK] Susun narasi bagian: Ringkasan Eksekutif, Solusi, Pasar (pakai angka pasar tergrounding), Operasional, Pemasaran & Funnel, Rencana Keuangan (narasikan HPP/BEP/proyeksi/ROI dari angka diberikan), Risiko, Roadmap.
[OUTPUT] JSON per-section (slot) untuk Template-Constrained Generation (20.4).
```

**P-BRAND-STRATEGY-01 — Strategi & Naming**
```
[SYSTEM] Kamu brand strategist. Output ringkas, actionable, berbahasa Indonesia. JSON only.
[CONTEXT] Bisnis: {profile}. Nilai & audiens: {values_audience}.
[TASK] Hasilkan: positioning statement, 3 alternatif nama (+rasional & cek ketersediaan domain sebagai estimasi via grounding), brand voice (3 sifat + do/don't), arahan palet warna (token) & tipografi, kata kunci moodboard.
[OUTPUT] JSON: brand_concept schema (20.4).
```

**P-BRAND-IMAGE-01 — Prompt untuk Nano Banana (asset visual)**
```
[IMAGE PROMPT] Konsep {asset_type} untuk brand "{brand_name}" — gaya {style_tokens}, palet {palette}, nuansa {mood}, konteks Indonesia, komposisi {composition}. Hindari teks pada gambar logo. Hasilkan variasi {n}.
```

**P-DECK-SLOTS-01 — Pitch Deck (Template-Constrained, slot JSON)**
```
[SYSTEM] Kamu pakar pitch deck (gaya Sequoia/YC). Satu ide kuat per slide, kalimat pendek & menjual, berbahasa Indonesia. Angka dari data finansial diberikan—jangan ubah. JSON only sesuai daftar slide.
[CONTEXT] {profile}, {financials_json}, {research_summary}, {brand_tokens}.
[TASK] Isi slot teks untuk slide: Cover, Problem, Solution, Why Now, Market (TAM/SAM/SOM), Product, Business Model, GTM/Traction, Competition/Moat, Team, Financials (dari angka), The Ask.
[OUTPUT] JSON slot per slide (20.4) → di-render ke HTML→PDF landscape 16:9.
```

## 20.3 MCP Tool Catalog (JSON Schema Ringkas)

> Kontrak input/output tool = logika yang sama dengan UI (Single Engine, Multi-Adapter). Semua tool tunduk OAuth 2.1 scope, rate-limit, dan BYOK guardrails (§9.6, §13.3). `project_id` mengikuti URI resource `agentbuff://project/{id}`.

**Tool: `agentbuff.validate_idea`**
```json
{
  "name": "agentbuff.validate_idea",
  "description": "Validasi ide bisnis dengan riset tergrounding; mengembalikan sinyal & ValidationScore deterministik (0-100).",
  "inputSchema": {
    "type": "object",
    "required": ["idea"],
    "properties": {
      "idea": { "type": "string", "description": "Deskripsi ide bisnis" },
      "market": { "type": "string", "description": "Target pasar/lokasi (mis. 'Jakarta, F&B')" },
      "project_id": { "type": "string", "description": "Opsional; kaitkan ke proyek" }
    }
  },
  "outputSchema": {
    "type": "object",
    "required": ["validation_score", "signals", "sources"],
    "properties": {
      "validation_score": { "type": "number", "minimum": 0, "maximum": 100 },
      "score_breakdown": {
        "type": "object",
        "properties": {
          "demand": { "type": "number" }, "margin": { "type": "number" },
          "competition": { "type": "number" }, "differentiation": { "type": "number" }
        }
      },
      "signals": {
        "type": "object",
        "properties": {
          "demand": { "enum": ["low", "medium", "high"] },
          "competition": { "enum": ["low", "medium", "high"] },
          "differentiation": { "enum": ["low", "medium", "high"] }
        }
      },
      "summary": { "type": "string" },
      "sources": { "type": "array", "items": { "type": "object",
        "properties": { "title": {"type":"string"}, "url": {"type":"string"} } } }
    }
  }
}
```

**Tool: `agentbuff.calculate_financials`** (deterministik, tanpa LLM)
```json
{
  "name": "agentbuff.calculate_financials",
  "description": "Hitung HPP, margin, BEP, proyeksi, payback, ROI secara deterministik. Tidak memanggil LLM.",
  "inputSchema": {
    "type": "object",
    "required": ["pricing", "costs"],
    "properties": {
      "pricing": { "type": "object", "properties": {
        "unit_price": {"type":"number"}, "currency": {"type":"string","default":"IDR"} } },
      "costs": { "type": "object", "properties": {
        "variable_cost_per_unit": {"type":"number"},
        "fixed_costs_monthly": {"type":"number"},
        "initial_capex": {"type":"number"},
        "working_capital": {"type":"number"} } },
      "assumptions": { "type": "object", "properties": {
        "monthly_volume": {"type":"number"},
        "growth_rate_monthly": {"type":"number"},
        "horizon_months": {"type":"integer","default":36},
        "discount_rate_annual": {"type":"number"} } }
    }
  },
  "outputSchema": { "$ref": "#/schemas/financials_result" }
}
```

**Tool: `agentbuff.generate_business_plan`**
```json
{
  "name": "agentbuff.generate_business_plan",
  "description": "Hasilkan business plan end-to-end (narasi dari LLM + angka dari engine).",
  "inputSchema": {
    "type": "object",
    "required": ["project_id"],
    "properties": {
      "project_id": {"type":"string"},
      "include_sections": {"type":"array","items":{"type":"string"}}
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "plan_id": {"type":"string"},
      "resource_uri": {"type":"string","description":"agentbuff://artifact/{id}"},
      "sections": {"type":"object"}
    }
  }
}
```

**Tool: `agentbuff.create_pitch_deck_pdf`**
```json
{
  "name": "agentbuff.create_pitch_deck_pdf",
  "description": "Render Pitch Deck PDF landscape 16:9 dari konten terstruktur (Template-Constrained).",
  "inputSchema": {
    "type": "object",
    "required": ["project_id"],
    "properties": {
      "project_id": {"type":"string"},
      "template": {"type":"string","enum":["sequoia_classic","modern_minimal"],"default":"sequoia_classic"},
      "brand_tokens_uri": {"type":"string"}
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "artifact_uri": {"type":"string","description":"agentbuff://artifact/{id}"},
      "download_url": {"type":"string","description":"URL unduh sementara (signed)"},
      "page_count": {"type":"integer"}
    }
  }
}
```

**Resources (read-only) & Prompts**
```json
{
  "resources": [
    { "uriTemplate": "agentbuff://project/{id}", "description": "State proyek (profil, status modul)" },
    { "uriTemplate": "agentbuff://project/{id}/financials", "description": "Hasil Financial Engine terkini" },
    { "uriTemplate": "agentbuff://artifact/{id}", "description": "Artefak (plan/proposal/deck/brandkit) + metadata" }
  ],
  "prompts": [
    { "name": "agentbuff.kickoff_business", "description": "Template alur lengkap: validasi → plan → brand → dokumen",
      "arguments": [ {"name":"idea","required":true}, {"name":"market","required":false} ] }
  ]
}
```

> Tool tambahan (paritas UI, ringkas): `agentbuff.list_projects`, `agentbuff.create_project`, `agentbuff.get_project`, `agentbuff.run_market_research`, `agentbuff.generate_brand_concept`, `agentbuff.generate_brand_assets`, `agentbuff.create_proposal_pdf`, `agentbuff.export_brand_kit`. Semua mengikuti pola input `project_id` + parameter spesifik, dan output `*_uri` ke resource.

## 20.4 Contoh JSON Schemas Inti

**`financials_result`** (output Financial Engine — sumber kebenaran angka)
```json
{
  "schemas": {
    "financials_result": {
      "type": "object",
      "required": ["currency", "unit_economics", "break_even", "projections"],
      "properties": {
        "currency": { "type": "string", "default": "IDR" },
        "unit_economics": {
          "type": "object",
          "properties": {
            "unit_price": {"type":"number"},
            "variable_cost_per_unit": {"type":"number"},
            "hpp_per_unit": {"type":"number"},
            "contribution_margin_per_unit": {"type":"number"},
            "contribution_margin_ratio": {"type":"number"},
            "gross_margin_ratio": {"type":"number"}
          }
        },
        "break_even": {
          "type": "object",
          "properties": {
            "bep_units": {"type":"number"},
            "bep_revenue": {"type":"number"},
            "bep_month_estimate": {"type":"integer"}
          }
        },
        "capital": {
          "type": "object",
          "properties": {
            "initial_capex": {"type":"number"},
            "working_capital": {"type":"number"},
            "total_initial_investment": {"type":"number"}
          }
        },
        "projections": {
          "type": "array",
          "description": "Per bulan hingga horizon",
          "items": {
            "type": "object",
            "properties": {
              "month": {"type":"integer"},
              "units": {"type":"number"},
              "revenue": {"type":"number"},
              "variable_costs": {"type":"number"},
              "fixed_costs": {"type":"number"},
              "profit": {"type":"number"},
              "cumulative_profit": {"type":"number"}
            }
          }
        },
        "returns": {
          "type": "object",
          "properties": {
            "payback_period_months": {"type":"number"},
            "roi_annualized": {"type":"number"},
            "npv": {"type":"number"},
            "irr": {"type":"number"}
          }
        },
        "computed_at": {"type":"string","format":"date-time"},
        "engine_version": {"type":"string"}
      }
    },

    "research_signals": {
      "type": "object",
      "required": ["signals", "sources"],
      "properties": {
        "demand_summary": {"type":"string"},
        "competition_summary": {"type":"string"},
        "customer_segments": {"type":"array","items":{"type":"string"}},
        "channels": {"type":"array","items":{"type":"string"}},
        "risks": {"type":"array","items":{"type":"string"}},
        "signals": {
          "type":"object",
          "properties": {
            "demand": {"enum":["low","medium","high"]},
            "competition": {"enum":["low","medium","high"]},
            "differentiation": {"enum":["low","medium","high"]}
          }
        },
        "sources": {"type":"array","items":{
          "type":"object","properties":{
            "claim":{"type":"string"}, "title":{"type":"string"}, "url":{"type":"string"}
          }}}
      }
    },

    "brand_concept": {
      "type": "object",
      "properties": {
        "positioning": {"type":"string"},
        "name_options": {"type":"array","items":{
          "type":"object","properties":{
            "name":{"type":"string"}, "rationale":{"type":"string"},
            "domain_available_estimate":{"type":"boolean"} }}},
        "voice": {"type":"object","properties":{
          "traits":{"type":"array","items":{"type":"string"}},
          "do":{"type":"array","items":{"type":"string"}},
          "dont":{"type":"array","items":{"type":"string"}} }},
        "palette_tokens": {"type":"object","additionalProperties":{"type":"string"}},
        "typography_tokens": {"type":"object","additionalProperties":{"type":"string"}},
        "moodboard_keywords": {"type":"array","items":{"type":"string"}}
      }
    },

    "deck_slot_content": {
      "type": "object",
      "description": "Slot teks per slide untuk Template-Constrained Generation (di-render ke HTML→PDF).",
      "properties": {
        "cover": {"type":"object","properties":{"title":{"type":"string"},"tagline":{"type":"string"}}},
        "problem": {"type":"object","properties":{"headline":{"type":"string"},"points":{"type":"array","items":{"type":"string"}}}},
        "solution": {"type":"object"},
        "why_now": {"type":"object"},
        "market": {"type":"object","properties":{"tam":{"type":"string"},"sam":{"type":"string"},"som":{"type":"string"},"note":{"type":"string"}}},
        "product": {"type":"object"},
        "business_model": {"type":"object"},
        "gtm_traction": {"type":"object"},
        "competition_moat": {"type":"object"},
        "team": {"type":"object"},
        "financials": {"type":"object","description":"Angka dari financials_result; LLM hanya menyusun kalimat"},
        "the_ask": {"type":"object","properties":{"amount":{"type":"string"},"use_of_funds":{"type":"array","items":{"type":"string"}}}}
      }
    }
  }
}
```

## 20.5 Glossary Tambahan (Istilah Teknis v1.1)

| Istilah | Penjelasan |
|---|---|
| **Interactions API** | API Gemini generasi baru (`/v1beta/interactions`) untuk interaksi kompleks/agentik (mis. Deep Research). Berbeda dari `generateContent`; memakai header `Api-Revision`. |
| **Deep Research Agent** | Agen Gemini yang merencanakan→menelusuri→mensintesis laporan multi-langkah bercitasi; async (`background=true`). |
| **`url_citation`** | Anotasi pada teks tergrounding berisi `url`, `title`, `start_index`, `end_index` — dasar **sumber clickable**. |
| **Grounding (Google Search)** | Menautkan jawaban ke hasil pencarian real-time + sitasi; mengurangi halusinasi. |
| **`search_suggestions`** | Snippet HTML dari hasil grounding yang **wajib dirender** sesuai Terms of Service Google. |
| **Nano Banana / Nano Banana Pro** | Model image-generation multimodal Gemini (teks-akurat, integrasi logo, grounding gambar). |
| **Imagen** | Model image-generation high-fidelity; output ber-**watermark SynthID**. |
| **SynthID** | Watermark tak-kasat-mata penanda konten hasil AI (pada output Imagen). |
| **Document Understanding** | Kemampuan vision memahami PDF (≤1000 hlm): teks, tabel, grafik → structured output/HTML. |
| **Gemini CLI / Antigravity CLI** | Agen baris-perintah Gemini (headless, `GEMINI.md`, Skills, MCP, sandbox). Gemini CLI bertransisi ke Antigravity CLI (tier unpaid, ~18 Jun 2026). |
| **`GEMINI.md`** | Berkas konteks proyek yang dibaca agen CLI sebagai memori/aturan persisten. |
| **DocAgentRunner** | Lapisan adapter AgentBuff Co-Founder yang menjalankan agen CLI untuk generasi dokumen (CLI-agnostik). |
| **Structured Output** | Output LLM yang dipaksa mengikuti JSON Schema agar type-safe & dapat diproses kode. |
| **`thinking_level`** | Parameter kedalaman penalaran Gemini (mis. MINIMAL→HIGH) untuk menyeimbangkan kualitas vs biaya. |
| **Context Caching** | Cache konteks berulang (Project State) untuk menghemat token (~90%). |
| **Batch API** | Eksekusi job massal non-urgent dengan diskon (~50%). |
| **Provider Abstraction Layer (PAL)** | Lapisan netral (`LLMProvider`) yang menyembunyikan perbedaan Gemini/OpenAI dari logika bisnis. |
| **Responses API (OpenAI)** | API utama OpenAI untuk reasoning/tool-calling/multi-turn (`/v1/responses`); `previous_response_id`, `background=true`. |
| **`text.format` (OpenAI)** | Cara men-set Structured Outputs (json_schema, `strict`) di Responses API. |
| **`web_search` (OpenAI)** | Tool pencarian web OpenAI; mengembalikan `url_citation` + `sources`; wajib clickable. |
| **`o3-deep-research` / `o4-mini-deep-research`** | Model Deep Research OpenAI (Responses API, `background`, citation-rich). |
| **`gpt-image-2`** | Model image-generation OpenAI (teks akurat, edit); butuh Org Verification; output base64. |
| **`reasoning.effort` / `text.verbosity`** | Kontrol kedalaman penalaran & panjang output pada model OpenAI (GPT-5.x). |
| **Codex** | Agen coding OpenAI (CLI/IDE/cloud); auth via Sign in with ChatGPT atau API key. |
| **Sign in with ChatGPT** | Auth Codex berbasis langganan ChatGPT (OAuth/device-code) — alternatif API key. |
| **Org Verification (OpenAI)** | Verifikasi organisasi yang diperlukan untuk memakai model GPT Image. |
| **`url_citation`** *(berlaku Gemini & OpenAI)* | Anotasi sumber clickable (url, title, start/end index) — dinormalisasi ke tipe `Citation`. |

## 20.6 Referensi Dokumentasi Resmi (Gemini API & Gemini CLI) — WAJIB DIBACA AI/ENGINEER

> **Instruksi tegas untuk AI atau engineer yang membangun AgentBuff Co-Founder:** Baca dokumentasi di bawah **sebelum** menulis kode untuk fitur terkait. Tujuannya mencegah halusinasi pada nama model, endpoint, header, bentuk request/response, parameter, dan perintah CLI. **Dokumentasi resmi adalah satu-satunya sumber kebenaran.** Bila isi PRD berbeda dari dokumentasi (karena API diperbarui), **ikuti dokumentasi resmi**, lalu perbarui PRD. Sebagian besar tautan mendukung bahasa Indonesia dengan menambah `?hl=id`.

**Inti fitur (dipetakan ke §12.7):**
- **Deep Research Agent** — https://ai.google.dev/gemini-api/docs/interactions/deep-research
- **Grounding with Google Search** (sumber clickable / `url_citation`) — https://ai.google.dev/gemini-api/docs/interactions/google-search
- **Pembuatan Gambar (Nano Banana)** — https://ai.google.dev/gemini-api/docs/image-generation
- **Pemahaman Gambar (Image Understanding)** — https://ai.google.dev/gemini-api/docs/image-understanding
- **Pemahaman/Pemrosesan Dokumen** — https://ai.google.dev/gemini-api/docs/document-processing
- **Pembuatan Gambar dengan Imagen** — https://ai.google.dev/gemini-api/docs/imagen
- **Gemini CLI (generasi dokumen)** — https://geminicli.com/docs/

**Pendukung & fondasi:**
- **Interactions API (overview)** — https://ai.google.dev/gemini-api/docs/interactions
- **Interactions breaking changes (Mei 2026)** — https://ai.google.dev/gemini-api/docs/interactions-breaking-changes-may-2026
- **Structured Outputs** — https://ai.google.dev/gemini-api/docs/structured-output
- **Function Calling** — https://ai.google.dev/gemini-api/docs/function-calling
- **URL Context** — https://ai.google.dev/gemini-api/docs/url-context
- **Code Execution** — https://ai.google.dev/gemini-api/docs/code-execution
- **Thinking** — https://ai.google.dev/gemini-api/docs/thinking
- **Thought Signatures** — https://ai.google.dev/gemini-api/docs/thought-signatures
- **Context Caching** — https://ai.google.dev/gemini-api/docs/caching
- **Batch API** — https://ai.google.dev/gemini-api/docs/batch-api
- **Files API / File input** — https://ai.google.dev/gemini-api/docs/files
- **Long Context** — https://ai.google.dev/gemini-api/docs/long-context
- **Models (daftar & string model)** — https://ai.google.dev/gemini-api/docs/models
- **Pricing** — https://ai.google.dev/gemini-api/docs/pricing
- **Rate Limits** — https://ai.google.dev/gemini-api/docs/rate-limits
- **Deprecations** — https://ai.google.dev/gemini-api/docs/deprecations
- **API Keys** — https://ai.google.dev/gemini-api/docs/api-key
- **Terms (Grounding)** — https://ai.google.dev/gemini-api/terms

**Gemini CLI (detail untuk DocAgentRunner):**
- **CLI Overview** — https://geminicli.com/docs/
- **Headless mode** — https://geminicli.com/docs/cli/headless/
- **Project context (`GEMINI.md`)** — https://geminicli.com/docs/cli/gemini-md/
- **Agent Skills** — https://geminicli.com/docs/cli/skills/
- **MCP server/client** — https://geminicli.com/docs/tools/mcp-server/
- **Sandboxing** — https://geminicli.com/docs/cli/sandbox/
- **Model routing** — https://geminicli.com/docs/cli/model-routing/
- **Token caching** — https://geminicli.com/docs/cli/token-caching/
- **Antigravity Agent (penerus)** — https://ai.google.dev/gemini-api/docs/antigravity-agent

**Catatan versi (per 30 Mei 2026, verifikasi ulang saat implementasi):** Deep Research agent = `deep-research-preview-04-2026` / `deep-research-max-preview-04-2026` (preview, Interactions API, `Api-Revision: 2026-05-20`); image = Nano Banana / Nano Banana Pro (+ Imagen ber-SynthID); Gemini CLI = `@google/gemini-cli` (transisi ke Antigravity CLI ~18 Jun 2026 untuk tier unpaid/Google One). **Selalu konfirmasi string model & perintah terbaru di halaman Models/Deprecations/CLI sebelum produksi.**

## 20.7 Referensi Dokumentasi Resmi (OpenAI API & Codex) — WAJIB DIBACA AI/ENGINEER

> Sama seperti §20.6, **baca dokumentasi resmi OpenAI/Codex sebelum coding** adapter OpenAI. Dokumentasi resmi = sumber kebenaran; verifikasi nama model, endpoint, parameter, dan perintah CLI. Dokumentasi OpenAI kini berada di **developers.openai.com** (sebagian juga di platform.openai.com).

**Inti (dipetakan ke §12.15–§12.16 & §12.14.3):**
- **Responses API (panduan model terbaru)** — https://developers.openai.com/api/docs/guides/latest-model
- **Referensi Responses API (create)** — https://developers.openai.com/api/reference/resources/responses/methods/create
- **Structured Outputs** — https://developers.openai.com/api/docs/guides/structured-outputs
- **Web Search tool (url_citation + sources)** — https://developers.openai.com/api/docs/guides/tools-web-search
- **Deep Research (guide)** — https://platform.openai.com/docs/guides/deep-research
- **Model `o3-deep-research`** — https://developers.openai.com/api/docs/models/o3-deep-research
- **Image generation (guide)** — https://developers.openai.com/api/docs/guides/image-generation
- **Images & vision** — https://developers.openai.com/api/docs/guides/images-vision
- **Create image (reference)** — https://developers.openai.com/api/reference/python/resources/images/methods/generate
- **Models (daftar & string model)** — https://developers.openai.com/api/docs/models
- **Migrate to Responses API** — https://platform.openai.com/docs/guides/migrate-to-responses

**Codex (auth & CLI — DocAgentRunner):**
- **Codex (overview)** — https://developers.openai.com/codex/
- **Codex Authentication (ChatGPT sign-in vs API key, device-code)** — https://developers.openai.com/codex/auth
- **Model release notes (Codex/GPT-5.x)** — https://help.openai.com/en/articles/9624314-model-release-notes

**Fondasi lain (verifikasi di portal):** Pricing, Rate limits, Prompt Caching, Batch API, Files API (`input_file`), File search / vector stores, Organization Verification (prasyarat GPT Image), MCP tool di Responses API.

**Catatan versi OpenAI (per 30 Mei 2026, verifikasi ulang):** flagship **GPT-5.5** (`gpt-5.5-2026-04-23`) + **GPT-5.5 Pro** (background mode untuk tugas panjang); cepat/murah **GPT-5.4 mini/nano**; **Deep Research** = `o3-deep-research` / `o4-mini-deep-research` (Responses API, `background=true`, wajib ≥1 sumber data); **image** = `gpt-image-2` (+ `gpt-image-1.5/1/mini`; DALL·E 3 *retired* 4 Mar 2026; **butuh Org Verification**); **Codex** = keluarga `gpt-5.x-codex` (mis. GPT-5.3-Codex); auth Codex = **Sign in with ChatGPT** (OAuth/device-code) atau **API key**. **Structured Outputs di Responses API** = `text.format` (json_schema, `strict: true`); **web search** mengembalikan **`url_citation`** (url, title, start/end index) + `sources` — **wajib clickable** per ToS OpenAI. **Selalu konfirmasi di halaman Models/guide sebelum produksi.**

---

## PENUTUP DOKUMEN

PRD ini mendefinisikan **AgentBuff Co-Founder** — anggota suite **AgentBuff** — sebagai *AI Co-Founder* berbasis Web App (PWA), gratis dengan model **BYOK Gemini**, dan **MCP-native** sehingga seluruh kapabilitasnya dapat diakses baik melalui UI, oleh agen AI eksternal, maupun oleh produk AgentBuff lain (AgentBuff POS, AgentBuff Absent, Agentic AgentBuff). Empat pilar yang membuat AgentBuff Co-Founder tahan uji:

1. **Trust Moat — "LLM Proposes, Code Disposes":** setiap angka finansial dihitung mesin deterministik (dan kelak dapat berbasis data nyata dari AgentBuff POS/Absent). Ini membedakan AgentBuff Co-Founder dari sekadar "pembungkus chatbot".
2. **Verifiable by Default — sumber clickable:** setiap klaim faktual tergrounding via Google Search dan dapat **diklik untuk diverifikasi** ke sumber aslinya (`url_citation`), menghapus keraguan pengguna. Riset mendalam memakai Deep Research agent bercitasi.
3. **Frictionless untuk Pemula:** Golden Path terpandu, bahasa Indonesia yang hangat, glossary just-in-time, dan UX loading AI yang transparan menurunkan rasa takut & kebingungan — pain points utama solopreneur Indonesia.
4. **Single Engine, Multi-Adapter, Multi-Provider & Future-Proof:** satu logika inti melayani UI dan MCP, dan dapat ditenagai oleh **Gemini *atau* OpenAI** (BYOK) lewat **Provider Abstraction Layer**. Pilihan model/CLI/provider bersifat config-driven & berbasis adapter, sehingga tahan terhadap evolusi API (deprecation model lintas vendor, transisi Gemini CLI → Antigravity CLI, breaking changes Interactions/Responses API) dan bebas lock-in. Implementasi **wajib bersandar pada dokumentasi resmi** (§12.7–§12.16, §20.6–§20.7) untuk mencegah halusinasi.

Dokumen ini siap menjadi rujukan lintas fungsi (Product, Engineering, Design, AI, Security, BD) untuk membawa AgentBuff Co-Founder dari Foundation hingga GA dan seterusnya.

*— Akhir Dokumen —*
