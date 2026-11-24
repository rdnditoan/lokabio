# LokaBio

Platform **BioLink** modern full-stack untuk kreator, profesional, dan UMKM. Dilengkapi kustomisasi tema *real-time* dengan pratinjau ponsel interaktif, analitik klik & sumber trafik, blok produk/galeri/embed, QRIS & kontak cepat, injeksi SEO dinamis per profil, serta panel **Super Admin** untuk kurasi, moderasi, verifikasi, dan pengawasan platform.

---

## Daftar Isi

1. [Fitur Utama](#fitur-utama)
2. [Tech Stack](#tech-stack)
3. [Arsitektur Sistem](#arsitektur-sistem)
4. [Struktur Proyek](#struktur-proyek)
5. [Skema Database PostgreSQL](#skema-database-postgresql)
6. [Daftar API Endpoints](#daftar-api-endpoints)
7. [Panduan Instalasi Lokal (Step-by-Step)](#panduan-instalasi-lokal-step-by-step)
8. [Skrip NPM](#skrip-npm)
9. [Panduan Deploy ke Hosting / Produksi](#panduan-deploy-ke-hosting--produksi)
10. [Troubleshooting Umum](#troubleshooting-umum)

---

## Fitur Utama

### 1. Halaman Publik & Eksplorasi (`/`, `/:username`)
* **Landing Page Terkurasi:** Menampilkan etalase profil aktif yang dikurasi langsung oleh Super Admin (`isFeatured = true` & `isSuspended = false`).
* **Halaman Profil Dinamis (`/:username`):**
  * **6 Tipe Blok Tautan:** `standard`, `header` (pemisah bagian), `featured` (kartu sorotan), `embed` (YouTube / Spotify / lainnya), `product` (katalog harga & badge), dan `gallery` (korsel/grid foto).
  * **Perlindungan PIN & Penjadwalan:** Tautan dapat dikunci dengan PIN dan dijadwalkan tayang otomatis (`publishAt` & `expireAt`).
  * **Kontak Cepat & Monetesasi:** Tombol WhatsApp otomatis, unduh kartu kontak **vCard**, modal donasi/pembayaran **QRIS**, blok berlangganan **Newsletter**, serta formulir **Pesan / Kerja Sama**.
  * **Pelaporan Profil:** Pengunjung dapat melaporkan profil bermasalah lewat modal **Laporkan** di footer.
  * **Dynamic SEO & Social Share Cards:** Server menyuntikkan `<title>`, meta description, OpenGraph, Twitter Card, canonical URL, dan JSON-LD `ProfilePage` secara dinamis per username, serta menyediakan `/sitemap.xml` dan `/robots.txt`.

### 2. Studio Kreator (`/dashboard`)
* **Editor & Live Preview Ponsel:** Perubahan tema, warna, gradien, gambar latar (*blur* & *overlay*), bentuk tombol, font, dan urutan tautan (*drag/reorder*) langsung terlihat pada `PhoneMockupFrame`.
* **Mode Pratinjau Dukungan (*Support Preview* Read-Only):** Super Admin dapat membuka `/dashboard?previewUserId=<id>` untuk melihat tampilan Studio milik kreator secara langsung tanpa mengubah data asli.
* **Paket Free vs Pro, Kupon Promo & Kuota Tautan:** Menampilkan lencana paket aktif (`FREE` / `PRO`), indikator kuota blok tautan paket Free sesuai batas yang diatur Super Admin, form **Tukar Kupon Promo** di tab `SEO & QR`, serta opsi Pro untuk menyembunyikan branding footer (`hideBranding`).
* **Preset Tema Global Resmi** yang dikurasi Super Admin + kustomisasi mendalam (termasuk tema eksklusif berlabel `PRO`).
* **Analitik Kreator:** Ringkasan *profile views*, total klik, CTR, distribusi perangkat (`Mobile`/`Desktop`), sumber *referrer*, dan performa per tautan.
* **Manajemen Audiens:** Daftar *subscribers* newsletter, kotak masuk *inquiries* (tandai sudah dibaca / hapus), generator **QR Code**, dan pengajuan **Lencana Terverifikasi** (`verification_requests`).
* **Pengumuman Global & Peringatan Khusus:** Menampilkan banner pengumuman global serta notifikasi/peringatan khusus dari Super Admin (`adminWarning`) yang dapat ditutup kreator.

### 3. Panel Super Admin (`/admin`)
* **Overview, Aksi Massal, Sorting & Pagination:** Statistik platform global (termasuk total pengguna Pro dan akun *dormant*), pencarian pengguna, filter paket `Pro`, pengurutan (`Terbaru`, `Views`, `Klik`, `Tautan`, `Terlama Tidak Aktif`), pagination, serta aksi massal (*verify*, *suspend*, *featured*, *set_pro*, *set_free*, hapus).
* **Tambah Akun User, Ubah Data Lengkap & Reset Password:** Super Admin dapat menambahkan akun user baru (dengan password Firebase Auth langsung maupun mode pra-registrasi email), mengubah seluruh data profil pengguna (`username`, `displayName`, `email`, `bio`, `avatarUrl`, `whatsappNumber`, `contactEmail`, `seoTitle`, `seoDescription`, `hideBranding`), serta membuat tautan **Reset Password** sekali klik dari modal **Ubah & Kelola**.
* **Kelola & Tambah Tautan Langsung + Mode Pratinjau Studio:** Selain menonaktifkan/menghapus tautan, Super Admin dapat langsung menambah atau mengedit tautan milik user dari modal **Ubah & Kelola**, serta membuka Studio kreator dalam mode pratinjau *read-only* (`Pratinjau Studio`).
* **Manajemen Kupon Promo & Riwayat Upgrade Pro:** Membuat kupon promo berbatas kuota & masa berlaku (termasuk durasi `0` untuk Pro selamanya), memantau pemakaian kupon, serta melihat log riwayat perubahan/klaim paket Pro (`pro_subscriptions_log`).
* **Kurasi Template Tema Global Resmi:** Mengelola katalog template tema global di tab **Kupon & Tema** (menambah, mengubah warna/gradasi/tombol/font dengan live swatch preview, mengaktifkan/menonaktifkan, dan menandai tema khusus Paket Pro).
* **Manajemen Paket & Peringatan per Akun:** Mengatur paket `Free` / `Pro` lengkap dengan tanggal kedaluwarsa (`planExpiresAt`), serta mengirim atau menghapus peringatan khusus (`adminWarning`) ke Studio pengguna tertentu.
* **Keamanan Tautan Otomatis (*SafeLink Domain Blocklist*):** Mengelola daftar domain/pola URL terlarang (`blockedDomains`) yang otomatis memblokir penyimpanan tautan berbahaya sekaligus menandai tautan mencurigakan (`flaggedReason`) di modal inspeksi.
* **Kontrol Operasional Darurat & Backup/Restore JSON:** Mengaktifkan *Maintenance Mode*, membuka/menutup pendaftaran akun baru (`registrationOpen`), mengatur kuota maksimal tautan paket Free (`freeLinkLimit`), serta mengunduh dan memulihkan **Backup Konfigurasi Platform (JSON)**.
* **Kurasi Etalase Landing Page & Antrean:** Mengatur urutan tampil profil unggulan (`featuredOrder`), meninjau pengajuan verifikasi centang biru, dan menangani laporan penyalahgunaan.
* **Analitik Global, Akun *Dormant*, Pemeliharaan DB & Ekspor Audit Log:** Grafik tren kunjungan/klik harian, ekspor CSV pengguna, daftar kreator tidak aktif (> 30 hari), pemangkasan log `click_events` lama (> 30/90/180 hari), serta filter & ekspor Audit Log ke format **CSV** dan **JSON**.

---

## Tech Stack

| Lapisan | Teknologi |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`) |
| **Animasi & Ikon** | Framer Motion (`motion/react`), Lucide React, `qrcode` |
| **Backend Server** | Node.js (v22+ ESM), Express 4 (`server.ts`), `tsx` (dev runner) |
| **Database & ORM** | PostgreSQL, `pg` (`node-postgres`), Drizzle ORM, `drizzle-kit` |
| **Autentikasi** | Firebase Authentication (Client SDK) & Firebase Admin SDK (`firebase-admin`) |
| **Keamanan & SEO** | Bearer JWT verification middleware, Dynamic HTML Meta/JSON-LD injection |

---

## Arsitektur Sistem

```text
+-------------------------------------------------------------------+
|                        Browser / Client SPA                       |
|  React 19 + AuthContext (Firebase SDK) + History API Router       |
|  Pages: / (Landing) | /login | /dashboard | /admin | /:username   |
+---------------------------------+---------------------------------+
                                  | HTTP / REST API + Bearer Token
                                  v
+-------------------------------------------------------------------+
|                   Express Server (server.ts)                      |
|  - Dev : Vite Middleware Mode (HMR & TSX transform on the fly)    |
|  - Prod: Serve static dist/ + Dynamic SEO HTML Injection          |
|  - Routes:                                                        |
|      * /api/public/*      (Publik, tracking view/click, report)   |
|      * /api/admin/*       (Dilindungi requireAuth)                |
|      * /api/superadmin/*  (Dilindungi requireAuth +               |
|                            requireSuperAdmin)                     |
|      * /sitemap.xml, /robots.txt                                  |
+----------------+----------------------------------+---------------+
                 |                                  |
                 v                                  v
+--------------------------------+   +------------------------------+
|     Firebase Admin SDK         |   |    Drizzle ORM + pg Pool     |
|  Verifikasi ID Token (JWT)     |   |    src/db/queries.ts         |
+--------------------------------+   +--------------+---------------+
                                                    |
                                                    v
                                     +------------------------------+
                                     |      PostgreSQL Database     |
                                     |  (12 Tabel Terelasi Drizzle) |
                                     +------------------------------+
```

### Alur Autentikasi & RBAC
1. Pengguna login di browser menggunakan **Google Sign-In** atau **Email/Password** melalui Firebase Authentication (`src/context/AuthContext.tsx`).
2. Setiap request ke `/api/admin/*` atau `/api/superadmin/*` menyertakan header `Authorization: Bearer <Firebase ID Token>`.
3. Middleware `requireAuth` (`src/middleware/auth.ts`) memverifikasi token menggunakan `firebase-admin`.
4. Middleware `requireSuperAdmin` memastikan akun di tabel `users` memiliki `role = 'admin'` dan `isSuspended = false`.
5. **Bootstrap Super Admin:** Email yang terdaftar pada `DEFAULT_ADMIN_EMAILS` di `src/db/queries.ts` atau variabel lingkungan `ADMIN_EMAILS` otomatis dipromosikan menjadi `role = 'admin'` saat pertama kali login.

---

## Struktur Proyek

```text
.
├── firebase-applet-config.json   # Konfigurasi proyek Firebase (Client & Admin projectId)
├── index.html                    # Entry HTML + meta tag default
├── metadata.json                 # Metadata identitas aplikasi LokaBio
├── package.json                  # Daftar dependensi & skrip npm
├── server.ts                     # Server Express utama, API routes, SEO injection & Vite/static handler
├── tsconfig.json                 # Konfigurasi TypeScript
├── vite.config.ts                # Konfigurasi Vite + Tailwind v4 + copy src/assets ke dist/
├── .env.example                  # Template variabel lingkungan
├── public/                       # Aset statis publik
└── src/
    ├── App.tsx                   # Router SPA ringan berbasis History API
    ├── main.tsx                  # Entry point React DOM
    ├── index.css                 # Konfigurasi Tailwind CSS v4 & token desain global
    ├── assets/                   # Gambar bawaan (avatar, thumbnail, ilustrasi)
    ├── shared/
    │   └── themes.ts             # Konstanta preset tema, tipe DTO, validasi username & penjadwalan
    ├── lib/
    │   ├── firebase.ts           # Inisialisasi Firebase Client SDK (Auth + GoogleProvider)
    │   └── firebase-admin.ts     # Inisialisasi Firebase Admin SDK (pembacaan config JSON aman ESM)
    ├── context/
    │   └── AuthContext.tsx       # Provider autentikasi global, state sesi, login/register/logout
    ├── middleware/
    │   └── auth.ts               # Middleware Express: requireAuth & requireSuperAdmin
    ├── db/
    │   ├── drizzle.config.ts     # Konfigurasi drizzle-kit untuk push/migrasi skema
    │   ├── index.ts              # Inisialisasi pg Pool & instance Drizzle db
    │   ├── schema.ts             # Definisi 12 tabel PostgreSQL & relasi Drizzle
    │   └── queries.ts            # Seluruh query database, analitik, moderasi, dan audit log
    ├── components/
    │   ├── BioLinkRenderer.tsx   # Renderer halaman profil publik (tautan, embed, galeri, QRIS, modal)
    │   ├── IconMapper.tsx        # Pemetaan nama ikon Lucide & ikon media sosial
    │   ├── PhoneMockupFrame.tsx  # Bingkai pratinjau ponsel interaktif di Studio & Landing
    │   └── QrCodeCard.tsx        # Generator & unduh kartu QR Code profil
    └── pages/
        ├── LandingPage.tsx       # Halaman utama LokaBio & etalase profil aktif
        ├── AuthPage.tsx          # Halaman masuk & daftar (Google / Email)
        ├── DashboardPage.tsx     # Studio Kreator (editor tautan, tema, analitik, kupon, preview mode)
        ├── AdminPage.tsx         # Panel Super Admin (manajemen user, kupon, tema global, audit & backup)
        └── PublicProfilePage.tsx # Kontainer halaman profil publik /:username
```

---

## Skema Database PostgreSQL

Didefinisikan di `src/db/schema.ts`:

1. **`users`** — Data akun, role (`user`/`admin`), paket (`planTier`, `planExpiresAt`, `hideBranding`), status (`isVerified`, `isSuspended`, `isFeatured`, `featuredOrder`, `lastActiveAt`), peringatan admin (`adminWarning`, `adminWarningAt`), kustomisasi tema lengkap, kontak cepat (WhatsApp, email, vCard), QRIS, newsletter, form inquiry, dan pengaturan SEO/UTM.
2. **`links`** — Daftar blok tautan milik pengguna (`standard`, `header`, `featured`, `embed`, `product`, `gallery`), galeri gambar (`jsonb`), kode PIN, jadwal (`publishAt`, `expireAt`), urutan posisi, dan jumlah klik.
3. **`click_events`** — Log event kunjungan profil (`view`) dan klik tautan (`click`) beserta *referrer* dan tipe perangkat (`Mobile`/`Desktop`).
4. **`subscribers`** — Daftar pelanggan newsletter per kreator.
5. **`inquiries`** — Pesan / tawaran kerja sama yang masuk dari halaman profil publik.
6. **`admin_audit_logs`** — Jejak audit seluruh tindakan Super Admin (aksi, target username, detail, timestamp).
7. **`profile_reports`** — Laporan penyalahgunaan profil dari pengunjung (`pending`, `resolved`, `dismissed`).
8. **`verification_requests`** — Antrean pengajuan lencana terverifikasi dari kreator (`pending`, `approved`, `rejected`).
9. **`platform_settings`** — Pengaturan global platform (`key = 'global'`), banner pengumuman global, *reserved usernames*, kontrol *maintenance mode* (`maintenanceMode`, `maintenanceMessage`), status pendaftaran (`registrationOpen`), kuota Free (`freeLinkLimit`), dan daftar *SafeLink blocklist* (`blockedDomains`).
10. **`promo_coupons`** — Kode kupon promo upgrade Paket Pro beserta durasi (`durationDays`), kuota (`maxUses`, `usedCount`), status aktif, dan tanggal kedaluwarsa (`expiresAt`).
11. **`pro_subscriptions_log`** — Riwayat upgrade/perubahan Paket Pro dari kupon maupun tindakan Super Admin (`source`, `couponCode`, `planTier`, `actorEmail`, `note`).
12. **`theme_templates`** — Katalog preset tema global resmi yang dikurasi Super Admin (otomatis terisi preset bawaan saat pertama dibaca, mendukung penandaan eksklusif Pro).

---

## Daftar API Endpoints

### Public Routes
* `GET /api/public/featured` — Mengambil daftar profil etalase yang aktif & terkurasi.
* `GET /api/public/themes` — Mengambil daftar template tema global resmi yang aktif.
* `GET /api/public/platform-status` — Mengecek status *maintenance mode*, status pendaftaran akun baru, dan batas kuota tautan paket Free.
* `GET /api/public/profiles/:username` — Mengambil profil publik & tautan aktif berdasarkan username (mengembalikan `503` saat *maintenance mode* aktif).
* `POST /api/public/profiles/:username/view` — Mencatat kunjungan profil.
* `POST /api/public/links/:id/click` — Mencatat klik tautan.
* `POST /api/public/links/:id/unlock` — Membuka tautan terkunci PIN.
* `POST /api/public/profiles/:username/subscribe` — Berlangganan newsletter profil.
* `POST /api/public/profiles/:username/inquiry` — Mengirim pesan/kerja sama ke kreator.
* `POST /api/public/profiles/:username/report` — Melaporkan profil ke Super Admin.
* `GET /api/public/username-check` — Cek ketersediaan username.
* `GET /sitemap.xml` & `GET /robots.txt` — Peta situs dinamis seluruh profil aktif.

### Authenticated Studio Routes (`Authorization: Bearer <token>`)
* `GET /api/admin/workspace` — Memuat data profil, tautan, subscribers, inquiries, pengajuan verifikasi, katalog tema resmi, dan notifikasi platform.
* `POST /api/admin/warning/dismiss` — Menutup banner peringatan khusus Super Admin di Studio kreator.
* `POST /api/admin/coupons/redeem` — Menukarkan kode kupon promo menjadi aktivasi/perpanjangan Paket Pro secara atomik.
* `PUT /api/admin/profile` — Memperbarui profil, tema, QRIS, SEO (termasuk `hideBranding` untuk Pro), dan kontak cepat.
* `GET /api/admin/analytics` — Mengambil data analitik kreator.
* `GET /api/admin/username-check` — Cek ketersediaan username saat ingin mengganti handle.
* `POST /api/admin/links`, `PUT /api/admin/links/:id`, `DELETE /api/admin/links/:id`, `PATCH /api/admin/links/reorder`, `POST /api/admin/links/:id/duplicate` — CRUD, duplikasi, penegakan kuota Free & SafeLink blocklist, serta urutan tautan.
* `POST /api/admin/verification-request` — Mengajukan verifikasi akun.
* `DELETE /api/admin/subscribers/:id`, `PATCH /api/admin/inquiries/:id`, `DELETE /api/admin/inquiries/:id` — Mengelola audiens & pesan masuk.

### Super Admin Routes (`Authorization: Bearer <token>` + `role === 'admin'`)
* `GET /api/superadmin/overview` — Statistik platform (termasuk Pro & *dormant*), daftar pengguna, dan pengaturan global.
* `GET /api/superadmin/analytics` — Analitik pertumbuhan, kreator teraktif, daftar kreator *dormant*, dan total baris `click_events`.
* `GET /api/superadmin/users/:id/detail` — Inspeksi detail pengguna dan semua tautannya (termasuk deteksi pelanggaran *SafeLink*).
* `GET /api/superadmin/users/:id/workspace-preview` — Memuat data workspace kreator dalam mode pratinjau *read-only* (*support preview*) dengan pencatatan audit log.
* `POST /api/superadmin/users/:id/reset-password` — Membuat tautan reset password Firebase Auth untuk akun target.
* `POST /api/superadmin/users` — Menambahkan akun user baru (membuat akun Firebase Auth jika password diisi, atau mode pra-registrasi `pre_<uuid>` jika kosong) beserta pilihan role & paket.
* `POST /api/superadmin/users/bulk` — Aksi massal terhadap banyak pengguna sekaligus (`verify`, `unverify`, `suspend`, `unsuspend`, `feature`, `unfeature`, `set_pro`, `set_free`, `delete`).
* `PATCH /api/superadmin/users/:id`, `DELETE /api/superadmin/users/:id` — Mengubah data lengkap profil (`displayName`, `email`, `bio`, `avatarUrl`, `whatsappNumber`, `contactEmail`, `seoTitle`, `seoDescription`, `hideBranding`, `newUsername`), role, paket (`planTier` & `planExpiresAt`), `adminWarning`, status verifikasi/suspend/featured, atau menghapus akun.
* `POST /api/superadmin/users/:id/links`, `PUT /api/superadmin/links/:linkId`, `PATCH /api/superadmin/links/:linkId`, `DELETE /api/superadmin/links/:linkId` — Tambah langsung, ubah detail, moderasi aktif/nonaktif, atau hapus tautan pengguna.
* `GET /api/superadmin/coupons`, `POST /api/superadmin/coupons`, `PATCH /api/superadmin/coupons/:id`, `DELETE /api/superadmin/coupons/:id` — CRUD kupon promo & riwayat upgrade Paket Pro.
* `GET /api/superadmin/themes`, `POST /api/superadmin/themes`, `PUT /api/superadmin/themes/:id`, `DELETE /api/superadmin/themes/:id` — Kurasi CRUD template tema global resmi.
* `PATCH /api/superadmin/featured-order` — Simpan urutan etalase landing page.
* `GET /api/superadmin/reports`, `PATCH /api/superadmin/reports/:id` — Tinjau & tindak lanjuti laporan profil.
* `GET /api/superadmin/verifications`, `PATCH /api/superadmin/verifications/:id` — Setujui atau tolak pengajuan verifikasi.
* `GET /api/superadmin/audit-logs` & `GET /api/superadmin/audit-logs/export` — Melihat, memfilter, dan mengekspor log aktivitas Super Admin ke format CSV/JSON.
* `GET /api/superadmin/backup` & `POST /api/superadmin/backup/restore` — Unduh arsip backup konfigurasi platform (JSON) dan pulihkan pengaturan/tema/kupon.
* `POST /api/superadmin/maintenance/cleanup-events` — Memangkas log `click_events` lama berdasarkan rentang hari.
* `PUT /api/superadmin/settings` — Memperbarui pengumuman global, *reserved usernames*, *maintenance mode*, izin pendaftaran, kuota Free, dan `blockedDomains`.

---

## Panduan Instalasi Lokal (Step-by-Step)

### 1. Prasyarat
Pastikan perangkat lunak berikut sudah terpasang di komputer Anda:
* **Node.js** versi **20 LTS** atau **22 LTS** (disarankan v22+)
* **PostgreSQL** (disarankan v15/v16/v17 beserta **pgAdmin 4**)
* **VS Code** atau editor kode pilihan Anda

### 2. Buat Database di PostgreSQL (pgAdmin 4)
1. Buka **pgAdmin 4** dan hubungkan ke server PostgreSQL lokal (`localhost`, port `5432`, user `postgres`).
2. Klik kanan **Databases → Create → Database...**
3. Beri nama **`lokabio`**, lalu klik **Save**.

### 3. Konfigurasi File `.env`
Di direktori root proyek (sejajar dengan `package.json`), buat file `.env` dan isi variabel berikut:

```env
PORT=3000
APP_URL=http://localhost:3000

# Koneksi Database untuk Aplikasi
SQL_HOST=localhost
SQL_DB_NAME=lokabio
SQL_USER=postgres
SQL_PASSWORD=PASSWORD_POSTGRES_ANDA

# Koneksi Database untuk Drizzle Kit (Push Schema)
SQL_ADMIN_USER=postgres
SQL_ADMIN_PASSWORD=PASSWORD_POSTGRES_ANDA

# Opsional: daftar email tambahan yang otomatis menjadi Super Admin (dipisah koma)
ADMIN_EMAILS=rdnditoan@gmail.com
```

### 4. Konfigurasi Firebase Authentication
1. Pastikan file `firebase-applet-config.json` berada di root proyek dengan konfigurasi Web App Firebase Anda (`projectId`, `apiKey`, `authDomain`, `appId`).
2. Buka **[Firebase Console](https://console.firebase.google.com/)** → pilih proyek Anda:
   * Masuk ke **Authentication → Sign-in method**, pastikan provider **Google** dan **Email/Password** berstatus **Enabled**.
   * Masuk ke **Authentication → Settings → Authorized domains**, pastikan **`localhost`** dan **`127.0.0.1`** terdaftar.

### 5. Install Dependensi & Buat Tabel Database
Buka terminal di root folder proyek, lalu jalankan:

```bash
# Install seluruh dependensi
npm install --legacy-peer-deps

# Terapkan skema tabel ke PostgreSQL
npx drizzle-kit push --config=src/db/drizzle.config.ts
```

> **Catatan khusus Windows (opsional):** Jika `http://localhost:3000` mengalami `ERR_CONNECTION_REFUSED` karena resolusi IPv6 Windows saat `server.ts` me-listen `'0.0.0.0'`, akses melalui `http://127.0.0.1:3000` atau ubah baris terakhir `server.ts` menjadi `app.listen(port, () => ...)`.

### 6. Jalankan Server Development
```bash
npm run dev
```
Buka browser dan kunjungi **`http://localhost:3000`**.

---

## Skrip NPM

| Perintah | Fungsi |
| :--- | :--- |
| `npm run dev` | Menjalankan server Express + Vite middleware dalam mode development (`tsx server.ts`) |
| `npm run build` | Mem-build frontend React ke folder `dist/` sekaligus menyalin `src/assets/` |
| `npm start` | Menjalankan server produksi dengan Node.js (`node server.ts`) |
| `npm run lint` | Menjalankan pengecekan tipe TypeScript (`tsc --noEmit`) |
| `npx drizzle-kit push --config=src/db/drizzle.config.ts` | Menyinkronkan `src/db/schema.ts` ke database PostgreSQL |

---

## Panduan Deploy ke Hosting / Produksi

Aplikasi ini menggunakan arsitektur **Node.js (Express) + PostgreSQL**, sehingga **membutuhkan lingkungan hosting yang mendukung Node.js dan PostgreSQL** (tidak berjalan di shared hosting PHP/MySQL konvensional).

### Opsi 1: Google Cloud Run / AI Studio Deploy (Direkomendasikan)
* Langsung jalankan **Deploy** dari workspace AI Studio; build menggunakan `npm run build` dan dijalankan dengan `NODE_ENV=production npm start` serta terhubung otomatis ke Cloud SQL PostgreSQL.

### Opsi 2: Platform PaaS (Railway / Render / Fly.io)
1. Push repositori proyek ke GitHub *(pastikan `.env` tidak ikut ter-commit; cek `.gitignore`)*.
2. Buat layanan **PostgreSQL** dan layanan **Web Service (Node.js)** di Railway/Render.
3. Atur **Build Command**:
   ```bash
   npm install --legacy-peer-deps && npm run build
   ```
4. Atur **Start Command**:
   ```bash
   NODE_ENV=production npm start
   ```
5. Tambahkan seluruh variabel lingkungan (`SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`, `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD`, `APP_URL=https://domain-anda.com`, `ADMIN_EMAILS`).
6. Jalankan push skema ke database produksi sekali saja (via shell platform atau dari lokal dengan `SQL_HOST` mengarah ke host DB produksi):
   ```bash
   npx drizzle-kit push --config=src/db/drizzle.config.ts
   ```
7. Tambahkan domain produksi Anda (contoh: `domain-anda.com`) ke **Firebase Console → Authentication → Settings → Authorized domains**.

### Opsi 3: VPS Linux (Ubuntu + PM2 + Nginx)
1. Install **Node.js v22**, **PostgreSQL**, **Nginx**, dan **PM2** (`npm install -g pm2`).
2. Clone proyek ke VPS, buat `.env` produksi, lalu jalankan:
   ```bash
   npm install --legacy-peer-deps
   npx drizzle-kit push --config=src/db/drizzle.config.ts
   npm run build
   NODE_ENV=production pm2 start npm --name "lokabio" -- start
   pm2 save
   ```
3. Konfigurasi **Nginx** sebagai *reverse proxy* dari port `80/443` ke `http://127.0.0.1:3000` dan pasang SSL gratis via **Certbot (Let's Encrypt)**.
4. Daftarkan domain VPS Anda ke **Firebase Authorized domains**.

---

## Troubleshooting Umum

* **`npm install` gagal dengan error `ERESOLVE` (`esbuild` vs `vite`):**
  Jalankan `npm install --legacy-peer-deps`.
* **Login gagal dengan `Firebase: Error (auth/unauthorized-domain)`:**
  Domain yang Anda buka (`localhost`, `127.0.0.1`, atau domain hosting) belum ditambahkan di **Firebase Console → Authentication → Settings → Authorized domains**.
* **Error database `relasi "users" tidak ada` (`code: 42P01`):**
  Tabel belum dibuat di database. Jalankan `npx drizzle-kit push --config=src/db/drizzle.config.ts`.
* **Error `ERR_ADDRESS_INVALID` atau `ERR_CONNECTION_REFUSED` di Windows:**
  Jangan membuka `http://0.0.0.0:3000` di browser Windows. Gunakan `http://localhost:3000` atau `http://127.0.0.1:3000`, dan pastikan terminal `npm run dev` masih aktif.
* **Variabel `.env` terbaca kosong oleh PostgreSQL Pool saat start:**
  Pastikan `import 'dotenv/config';` berada di baris paling atas `server.ts` dan `src/db/index.ts` agar `.env` dimuat sebelum evaluasi modul ESM menginisialisasi koneksi `pg.Pool`.
