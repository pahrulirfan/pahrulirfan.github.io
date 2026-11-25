# api-mahasiswa

REST API untuk mata kuliah Pemrograman Web Lanjut. Project ini adalah hasil akhir Pertemuan 4–10
dan dipakai sebagai backend pada Pertemuan 12 (integrasi front end).

- Express 5, dengan struktur berlapis: routes → controllers → services → data
- Prisma 7 + MySQL (migrasi dan seed sudah disediakan)
- Login dengan JWT, role `admin`, `dosen`, dan `mahasiswa`
- Validasi dengan Joi, error terpusat, helmet, CORS, dan pembatas login
- Paginasi, filter, dan pengurutan pada `GET /mahasiswa`
- Pendaftaran kelas dengan transaksi (kuota berkurang bersamaan dengan pendaftaran)

Daftar lengkap endpoint ada di [API.md](API.md). Kumpulan permintaan siap pakai ada di [requests.http](requests.http).

> Sudah punya `api-mahasiswa` buatan sendiri dari Pertemuan 4–10? Project ini tidak perlu dipakai.
> Gunakan hanya bila project kalian belum berjalan, atau sebagai pembanding. Jangan menimpa folder
> milik sendiri, dan jangan memakai nama database yang sama dengan database lama kalian
> (lihat langkah 4).

## Yang Perlu Disiapkan

| Kebutuhan | Keterangan |
|---|---|
| Node.js 22.18 atau lebih baru | Materi memakai Node 24. Cek dengan `node -v`. |
| MySQL 8 atau lebih baru | Bisa dari Laravel Herd, XAMPP, atau Laragon. Server harus aktif. |
| phpMyAdmin atau terminal `mysql` | Untuk membuat database kosong. |
| Git | Hanya bila memilih cara download B. |
| Postman atau ekstensi REST Client di VS Code | Untuk mencoba endpoint. |

## 1. Download

Pilih salah satu. Hasilnya sama: sebuah folder `api-mahasiswa`.

**Cara A: `degit` (paling ringkas).** Hanya mengambil folder project ini, tanpa riwayat Git.

```bash
npx degit pahrulirfan/pahrulirfan.github.io/pwl/back-end/api-mahasiswa api-mahasiswa
```

**Cara B: Git, hanya folder yang dibutuhkan.**

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/pahrulirfan/pahrulirfan.github.io.git
cd pahrulirfan.github.io
git sparse-checkout set pwl/back-end/api-mahasiswa
cd pwl/back-end/api-mahasiswa
```

**Cara C: ZIP.** Buka <https://github.com/pahrulirfan/pahrulirfan.github.io>, klik **Code → Download ZIP**,
ekstrak, lalu ambil folder `pwl/back-end/api-mahasiswa`. Letakkan di samping folder
`belajar-frontend` (bukan di dalamnya), misalnya:

```
pwl26/
├── api-mahasiswa/
└── belajar-frontend/
    ├── vue-mahasiswa/
    └── react-mahasiswa/
```

## 2. Install

Masuk ke folder project, lalu pasang dependency:

```bash
cd api-mahasiswa
npm install
```

`npm install` sekaligus menjalankan `prisma generate`, yaitu membuat kode client Prisma di folder
`generated/`. Folder itu tidak ikut Git dan dibuat ulang setiap kali install.

## 3. Isi File `.env`

Salin contohnya:

```bash
cp .env.example .env          # Windows (Command Prompt): copy .env.example .env
```

Buka `.env` di editor, lalu periksa tiga hal:

1. **`DATABASE_URL`**: sesuaikan dengan MySQL di komputer kalian.
   Tanpa password: `mysql://root@localhost:3306/api_mahasiswa`.
   Dengan password: `mysql://root:passwordku@localhost:3306/api_mahasiswa`.
2. **`JWT_SECRET`**: ganti dengan nilai acak. Minta Node membuatkan:
   ```bash
   node -p "require('node:crypto').randomBytes(32).toString('hex')"
   ```
   Tempel hasilnya setelah `JWT_SECRET=`. Server menolak berjalan bila nilainya kosong.
3. **`CORS_ORIGIN`**: biarkan `http://localhost:5173` (alamat front end Vue/React dari Vite).

Edit lewat editor, jangan lewat `echo ... >> .env`. Bila baris terakhir `.env` tidak diakhiri baris baru,
perintah itu menempelkan isinya di ujung baris sebelumnya dan merusak `DATABASE_URL`.

## 4. Buat Database Kosong

Cukup databasenya saja. Tabel dibuat otomatis di langkah berikutnya.

Lewat phpMyAdmin: tab **Databases**, isi nama `api_mahasiswa`, pilih collation `utf8mb4_unicode_ci`, klik **Create**.

Atau lewat terminal:

```bash
mysql -u root -p -e "CREATE DATABASE api_mahasiswa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
```

(Tanpa password, buang `-p`.)

Kalau sudah punya database `api_mahasiswa` dari Pertemuan 6 dan ingin menyimpannya, buat database dengan
nama lain, misalnya `api_mahasiswa_12`, lalu sesuaikan nama itu di `DATABASE_URL`.

## 5. Buat Tabel dan Isi Data Awal

```bash
npm run migrate      # setara: npx prisma migrate deploy
npm run seed         # setara: npx prisma db seed
```

`migrate` membuat empat tabel (`mahasiswa`, `kelas`, `pendaftaran`, `users`) dari folder `prisma/migrations`.
`seed` mengisi:

| Data | Isi |
|---|---|
| `mahasiswa` | 25 baris (lebih dari 10, supaya paginasi terlihat) |
| `kelas` | Pemrograman Web Lanjut (kuota 28) dan Basis Data (kuota 1) |
| `pendaftaran` | 2 baris |
| `users` | 3 akun contoh (tabel di bawah) |

Seed boleh dijalankan berulang kali. Setiap kali, data dikosongkan lalu diisi ulang dari awal, jadi gunakan
hanya di database pengembangan milik sendiri.

**Akun contoh** (khusus belajar; jangan dipakai di server sungguhan):

| Role | Email | Password |
|---|---|---|
| admin | `admin@unram.ac.id` | `admin12345` |
| dosen | `dosen@unram.ac.id` | `dosen12345` |
| mahasiswa | `mahasiswa@unram.ac.id` | `mahasiswa12345` |

Hak tiap role: semua yang login boleh melihat data. `admin` dan `dosen` boleh menambah dan mengubah
mahasiswa. Hanya `admin` yang boleh menghapus.

## 6. Jalankan

```bash
npm run dev
```

Terminal harus menampilkan:

```
Server jalan di http://localhost:3000
```

`npm run dev` memakai `node --watch`, sehingga server restart sendiri setiap file disimpan.
Hentikan dengan `Ctrl + C`. Untuk menjalankan tanpa restart otomatis: `npm start`.

## 7. Coba

Dari terminal lain:

```bash
# 1. Login, ambil token
curl -s http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@unram.ac.id","password":"admin12345"}'

# 2. Pakai token itu (ganti TOKEN)
curl -s "http://localhost:3000/mahasiswa?ukuran=3" -H "Authorization: Bearer TOKEN"
```

Respons kedua berisi `data` (3 mahasiswa) dan `meta` (`total: 25`, `totalHalaman: 9`).
Tanpa header `Authorization`, hasilnya `401 TOKEN_DIPERLUKAN`.

Untuk coba lebih banyak, buka [requests.http](requests.http) di VS Code (ekstensi REST Client),
atau impor permintaan yang sama ke Postman.

## 8. Dipakai oleh Front End (Pertemuan 12)

1. Jalankan API di terminal pertama (`npm run dev`, port 3000).
2. Jalankan front end di terminal kedua (`npm run dev` di `vue-mahasiswa` atau `react-mahasiswa`, port 5173).
3. Jalankan **salah satu** front end saja. Bila Vue dan React hidup bersamaan, yang kedua pindah ke
   port 5174 dan diblokir CORS, karena API hanya mengizinkan `http://localhost:5173`.
4. Alamat API di front end: `http://localhost:3000`.

Untuk percobaan di Section 2 Pertemuan 12 (melihat error CORS), beri komentar pada baris
`app.use(cors(...))` di `index.js`, simpan, lalu kembalikan.

## Struktur Folder

```
api-mahasiswa/
├── index.js                 helmet, CORS, parser JSON, logger, rute, penangan error
├── package.json
├── prisma.config.js         lokasi skema, database, perintah seed
├── .env.example             contoh isi .env (.env sendiri tidak ikut Git)
├── API.md                   dokumentasi endpoint
├── requests.http            permintaan uji untuk REST Client
├── prisma/
│   ├── schema.prisma        model: Mahasiswa, Kelas, Pendaftaran, User
│   ├── migrations/          riwayat migrasi (ikut Git)
│   └── seed.js              data awal, bisa dijalankan ulang
└── src/
    ├── lib/prisma.js        koneksi database
    ├── routes/              peta URL + middleware      (auth, mahasiswa, pendaftaran)
    ├── controllers/         req → res
    ├── services/            aturan bisnis, melempar AppError
    ├── data/                akses database lewat Prisma
    ├── validators/          skema Joi
    ├── middleware/          logger, auth (butuhLogin, butuhRole), validasi, batasLogin, notFound, errorHandler
    └── utils/AppError.js
```

## Bila Ada Masalah

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| `JWT_SECRET belum diisi` saat `npm run dev` | `.env` belum dibuat atau `JWT_SECRET` kosong | Ulangi langkah 3 |
| `Can't reach database server` atau `ECONNREFUSED` | MySQL belum aktif, atau port bukan 3306 | Nyalakan MySQL; cek port di `DATABASE_URL` |
| `Access denied for user 'root'` | Password di `DATABASE_URL` salah | Perbaiki `root:password@` |
| `Unknown database 'api_mahasiswa'` | Database belum dibuat | Langkah 4 |
| `Cannot find module '../../generated/prisma/client.ts'` | Client Prisma belum dibuat | `npx prisma generate` |
| `Unknown file extension ".ts"` | Node terlalu lama | Pakai Node 22.18+ (`node -v`) |
| `EADDRINUSE: address already in use :::3000` | Port 3000 dipakai server lain | Hentikan yang lama, atau `PORT=3001 npm run dev` |
| Front end: error CORS di Console | Front end tidak di port 5173, atau API belum di-restart | Lihat bagian 8 |
| `429 TERLALU_BANYAK_PERCOBAAN` | Lebih dari 5 login gagal dalam 15 menit | Tunggu, atau restart API (hitungan ada di memori) |
| `npm install` melaporkan *high severity vulnerabilities* | Temuan audit ada di rantai dependency CLI Prisma (`effect`), bukan di kode yang melayani request | Abaikan. Jangan menjalankan `npm audit fix --force`: ia menurunkan Prisma ke versi 6 dan merusak project |
| `P3005` (database tidak kosong) atau pesan *drift* dari Prisma | Database sudah berisi tabel yang bukan dari migrasi ini | Pakai database kosong baru (langkah 4) |

## Mulai dari Awal

Untuk mengembalikan database ke kondisi awal, buat ulang databasenya (kosong), lalu ulangi langkah 5:

```bash
mysql -u root -p -e "DROP DATABASE api_mahasiswa; CREATE DATABASE api_mahasiswa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
npm run migrate && npm run seed
```

Perintah `DROP DATABASE` menghapus semua data di database itu. Pastikan nama databasenya benar.

## Yang Tidak Disertakan

GraphQL (Pertemuan 4, Section 8) dan refresh token (Pertemuan 9, Section 5) bersifat tambahan dan tidak
dipakai front end, jadi tidak ada di project ini.
