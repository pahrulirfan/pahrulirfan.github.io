# API Mahasiswa

Dokumentasi endpoint. Alamat dasar: `http://localhost:3000` (ubah lewat `PORT` di `.env`).

Semua jawaban berbentuk JSON. Yang berhasil dibungkus `{ "data": ... }`. Yang gagal selalu berbentuk:

```json
{ "error": { "pesan": "Token diperlukan", "kode": "TOKEN_DIPERLUKAN" } }
```

Kecuali `GET /`, setiap endpoint memerlukan token, kecuali `POST /auth/register` dan `POST /auth/login`. Kirim token lewat header:

```
Authorization: Bearer <token>
```

## Ringkasan

| Method | Path | Akses | Berhasil |
|---|---|---|---|
| GET | `/` | Terbuka | 200 teks |
| POST | `/auth/register` | Terbuka | 201 |
| POST | `/auth/login` | Terbuka | 200 |
| GET | `/auth/saya` | Login | 200 |
| GET | `/mahasiswa` | Login | 200 |
| GET | `/mahasiswa/:id` | Login | 200 |
| POST | `/mahasiswa` | `admin` atau `dosen` | 201 |
| PUT | `/mahasiswa/:id` | `admin` atau `dosen` | 200 |
| DELETE | `/mahasiswa/:id` | `admin` | 204 |
| GET | `/pendaftaran` | Login | 200 |
| POST | `/pendaftaran` | Login | 201 |

## Daftar kode error

| Status | Kode | Arti |
|---|---|---|
| 400 | `ID_TIDAK_VALID` | `:id` bukan bilangan bulat |
| 400 | `QUERY_TIDAK_VALID` | nilai `urutkan` tidak diizinkan |
| 400 | `REQUEST_ERROR` | kesalahan umum dari klien, misalnya JSON rusak |
| 401 | `TOKEN_DIPERLUKAN` | header `Authorization` tidak ada |
| 401 | `TOKEN_TIDAK_VALID` | token rusak atau sudah kedaluwarsa (berlaku 2 jam) |
| 401 | `LOGIN_GAGAL` | email atau password salah |
| 403 | `DILARANG` | sudah login, tetapi role tidak berhak |
| 404 | `NOT_FOUND` | mahasiswa tidak ada |
| 404 | `MAHASISWA_NOT_FOUND`, `KELAS_NOT_FOUND` | pada `POST /pendaftaran` |
| 404 | `ROUTE_NOT_FOUND` | alamat tidak dikenal |
| 409 | `NIM_DUPLIKAT` | NIM sudah dipakai mahasiswa lain |
| 409 | `EMAIL_DUPLIKAT` | email sudah terdaftar |
| 409 | `SUDAH_TERDAFTAR` | mahasiswa sudah ada di kelas itu |
| 409 | `KUOTA_PENUH` | kuota kelas habis |
| 409 | `MASIH_TERDAFTAR` | mahasiswa masih punya pendaftaran kelas, tidak bisa dihapus |
| 422 | `VALIDATION_ERROR` | isi body tidak memenuhi aturan |
| 429 | `TERLALU_BANYAK_PERCOBAAN` | terlalu banyak login gagal dari satu IP |
| 500 | `INTERNAL_ERROR` | kesalahan di server (detail hanya di terminal server) |

---

## POST /auth/register

Membuat akun baru. Role selalu `mahasiswa`; field lain, termasuk `role`, ditolak.

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `email` | string | ya | format email, maksimal 100 karakter |
| `password` | string | ya | 8 sampai 72 karakter |

**201**

```json
{ "data": { "id": 4, "email": "baru@unram.ac.id", "role": "mahasiswa" } }
```

**409** `EMAIL_DUPLIKAT` · **422** `VALIDATION_ERROR`

## POST /auth/login

Body sama seperti register.

**200**

```json
{ "data": { "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." } }
```

**401** `LOGIN_GAGAL` · **422** `VALIDATION_ERROR` · **429** `TERLALU_BANYAK_PERCOBAAN`

Hanya login yang **gagal** yang dihitung: 5 kali per IP dalam 15 menit (ubah lewat `LOGIN_MAX_GAGAL`).
Token memuat `id` dan `role`. Role dibaca dari token, jadi perubahan role baru terasa setelah login ulang.

## GET /auth/saya

Isi token milik pengirim.

**200**

```json
{ "data": { "id": 1, "role": "admin", "iat": 1795644783, "exp": 1795651983 } }
```

---

## GET /mahasiswa

Daftar mahasiswa dengan paginasi, filter, dan pengurutan. Akses: login.

| Parameter | Tipe | Bawaan | Keterangan |
|---|---|---|---|
| `halaman` | number | 1 | nomor halaman |
| `ukuran` | number | 10 | data per halaman, maksimal 100 |
| `semester` | number | - | hanya semester ini |
| `ipkMin` | number | - | hanya IPK sama dengan atau di atas nilai ini |
| `cari` | string | - | nama mengandung teks ini (huruf besar/kecil tidak dibedakan) |
| `urutkan` | string | `nama` | `nama`, `nim`, `ipk`, `semester`, atau `createdAt` |
| `arah` | string | `asc` | `asc` atau `desc` |

Contoh: `GET /mahasiswa?semester=6&urutkan=ipk&arah=desc&ukuran=5`

**200**

```json
{
  "data": [
    { "id": 1, "nim": "F1D021001", "nama": "Andi", "ipk": 3.75, "semester": 6,
      "createdAt": "2026-11-25T22:12:56.451Z", "email": null }
  ],
  "meta": { "halaman": 1, "ukuran": 10, "total": 25, "totalHalaman": 3 }
}
```

`meta.total` adalah jumlah data setelah difilter, bukan jumlah di halaman itu.

**400** `QUERY_TIDAK_VALID` · **401**

## GET /mahasiswa/:id

**200**

```json
{ "data": { "id": 1, "nim": "F1D021001", "nama": "Andi", "ipk": 3.75, "semester": 6,
            "createdAt": "2026-11-25T22:12:56.451Z", "email": null } }
```

**400** `ID_TIDAK_VALID` · **401** · **404** `NOT_FOUND`

## POST /mahasiswa

Akses: `admin` atau `dosen`.

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `nim` | string | ya | tepat 9 karakter, tidak boleh kembar |
| `nama` | string | ya | 3 sampai 100 karakter |
| `ipk` | number | tidak | 0 sampai 4, bawaan 0 |
| `semester` | number | tidak | bilangan bulat 1 sampai 14, bawaan 1 |

**201** data mahasiswa yang baru dibuat, dalam bentuk `{ "data": {...} }`.

**401** · **403** `DILARANG` · **409** `NIM_DUPLIKAT` · **422** `VALIDATION_ERROR`

Semua kesalahan validasi dilaporkan sekaligus dalam satu `pesan`, dipisah `;`.

## PUT /mahasiswa/:id

Mengganti seluruh data mahasiswa. Body dan aturannya sama dengan `POST /mahasiswa`. Mengirim ulang NIM milik sendiri diperbolehkan.

**200** data setelah diubah · **400** · **401** · **403** · **404** · **409** `NIM_DUPLIKAT` · **422**

## DELETE /mahasiswa/:id

Akses: `admin`.

**204** tanpa body · **400** · **401** · **403** · **404** · **409** `MASIH_TERDAFTAR`

---

## GET /pendaftaran

Semua pendaftaran, lengkap dengan data mahasiswa dan kelasnya.

**200**

```json
{
  "data": [
    {
      "id": 1, "mahasiswaId": 1, "kelasId": 1,
      "tanggalDaftar": "2026-11-25T22:12:56.462Z",
      "mahasiswa": { "id": 1, "nim": "F1D021001", "nama": "Andi", "ipk": 3.75, "semester": 6, "email": null, "createdAt": "..." },
      "kelas": { "id": 1, "nama": "Pemrograman Web Lanjut", "kuota": 28 }
    }
  ]
}
```

## POST /pendaftaran

Mendaftarkan mahasiswa ke kelas. Membuat baris pendaftaran dan mengurangi kuota kelas satu angka, dalam satu transaksi: keduanya berhasil atau keduanya dibatalkan.

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `mahasiswaId` | number | ya | id mahasiswa |
| `kelasId` | number | ya | id kelas |

**201**

```json
{ "data": { "id": 3, "mahasiswaId": 3, "kelasId": 1, "tanggalDaftar": "2026-11-26T01:20:11.014Z" } }
```

**401** · **404** `MAHASISWA_NOT_FOUND` / `KELAS_NOT_FOUND` · **409** `SUDAH_TERDAFTAR` / `KUOTA_PENUH` · **422**
