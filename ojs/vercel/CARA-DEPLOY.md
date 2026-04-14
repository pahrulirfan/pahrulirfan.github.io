# Cara Deploy Monitoring OJS ke Vercel

## Cara Kerja Sistem Cache

Hasil pengecekan disimpan di **Vercel KV** (database gratis bawaan Vercel).
- Pengecekan pertama → cek semua URL → simpan hasil ke KV selama 1 jam
- User berikutnya dalam 1 jam → langsung dapat hasil cache, tidak trigger pengecekan baru
- Setelah 1 jam → pengecekan otomatis berjalan lagi saat ada yang buka website

---

## Persiapan

Pastikan kamu sudah punya:
- [Node.js](https://nodejs.org) terinstall di komputer
- Akun Vercel di [vercel.com](https://vercel.com) (daftar gratis, bisa pakai akun Google/GitHub)

---

## Langkah 1 — Install Vercel CLI

Buka terminal, jalankan:

```bash
npm install -g vercel
```

Cek apakah berhasil:

```bash
vercel --version
```

---

## Langkah 2 — Login ke Vercel

```bash
vercel login
```

Nanti akan muncul pilihan login:
```
? Log in to Vercel
  Continue with GitHub
  Continue with GitLab
  Continue with Bitbucket
  Continue with Email
```

Pilih salah satu, lalu ikuti instruksi di browser yang terbuka.
Setelah berhasil, terminal akan menampilkan: `Logged in as ...`

---

## Langkah 3 — Masuk ke Folder Project

```bash
cd ojs/vercel
```

Pastikan isi foldernya seperti ini:
```
vercel/
├── index.html
└── api/
    └── cek.js
```

---

## Langkah 4 — Deploy

```bash
vercel
```

Akan muncul beberapa pertanyaan, jawab seperti ini:

```
? Set up and deploy "~/path/vercel"? → Y (Enter)
? Which scope do you want to deploy to? → pilih akun kamu (Enter)
? Link to existing project? → N (Enter)
? What's your project's name? → monitoring-ojs (Enter, atau nama lain)
? In which directory is your code located? → ./ (Enter)
```

Tunggu proses upload selesai. Jika berhasil akan muncul:

```
✅ Production: https://monitoring-ojs-xxx.vercel.app
```

---

## Langkah 5 — Setup Vercel KV (Database Cache)

Ini wajib agar sistem cache berjalan.

1. Buka [vercel.com/dashboard](https://vercel.com/dashboard)
2. Pilih project `monitoring-ojs` yang sudah di-deploy
3. Klik tab **Storage**
4. Klik **Create Database** → pilih **KV**
5. Beri nama bebas, misal `monitoring-cache` → klik **Create**
6. Setelah dibuat, klik **Connect to Project** → pilih project kamu
7. Vercel otomatis menambahkan environment variable yang dibutuhkan

Setelah itu deploy ulang:
```bash
vercel --prod
```

---

## Langkah 6 — Buka di Browser

Salin URL yang muncul di terminal, buka di browser.
Contoh: `https://monitoring-ojs-xxx.vercel.app`

Klik **Mulai** untuk memulai monitoring.

---

## Update / Deploy Ulang

Setiap kali ada perubahan file, jalankan:

```bash
vercel --prod
```

Flag `--prod` memastikan deploy langsung ke URL utama (bukan URL preview).

---

## Troubleshooting

**Error: `vercel` command not found**
→ Pastikan Node.js sudah terinstall. Download di [nodejs.org](https://nodejs.org)

**Status semua "Error" setelah deploy**
→ Coba buka langsung: `https://nama-project.vercel.app/api/cek?url=https://google.com`
→ Jika muncul `{"status":200}` berarti backend jalan normal

**Ingin ganti nama domain**
→ Buka [vercel.com/dashboard](https://vercel.com/dashboard) → pilih project → tab **Settings** → **Domains**
→ Bisa tambah domain sendiri secara gratis
