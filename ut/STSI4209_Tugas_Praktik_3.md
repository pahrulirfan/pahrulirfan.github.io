# STSI4209 – Tugas Praktik 3 (Vue.js)

## Tujuan Tugas
Membuat aplikasi website sederhana untuk pemesanan Bahan Ajar Universitas Terbuka menggunakan Vue.js dengan menerapkan:
- Vue Component
- Vue Template
- Data Binding
- Conditional Rendering
- Computed Property & Methods
- Watchers
- Array Processing (v-for)
- Filter Formatting

---

# Indikator Capaian

1. Menerapkan Vue Component dan Vue Template.
2. Menampilkan data menggunakan mustaches, v-text, dan directive lainnya.
3. Menerapkan conditional rendering (v-if, v-else, v-else-if, v-show).
4. Menerapkan data binding (v-bind, v-model), computed property, dan methods.
5. Menggunakan watcher.
6. Mengolah data array menggunakan v-for.
7. Menerapkan formatting teks menggunakan filter.
8. Menggunakan custom element, Vue Component, dan Property Template.

---

# Struktur Proyek

```text
tugas3-vue-ut/
├─ index.html
├─ assets/
│  ├─ css/
│  │  └─ style.css
│  └─ img/
├─ data/
│  └─ dataBahanAjar.json
├─ js/
│  ├─ app.js
│  ├─ components/
│  │  ├─ stock-table.js
│  │  ├─ do-tracking.js
│  │  ├─ order-form.js
│  │  ├─ status-badge.js
│  │  └─ app-modal.js
│  └─ services/
│     └─ api.js
└─ templates/
   ├─ stock-table.html
   ├─ do-tracking.html
   ├─ order-form.html
   ├─ status-badge.html
   └─ app-modal.html
```

## Catatan
- Gunakan penamaan file komponen dengan gaya **kebab-case**.
- Contoh:
  - `stock-table.js`
  - Registrasi: `Vue.component('ba-stock-table', ...)`
- Template ID dibuat konsisten, misalnya:
  - `tpl-stock`
  - `tpl-tracking`
- Routing cukup menggunakan state/tab pada root component.

Contoh:
```js
tab: 'stok' | 'tracking' | 'order'
```

---

# Soal Tugas

## 1. Halaman Stok Bahan Ajar

### Menampilkan Daftar Stok

Tampilkan data berikut:

| Field | Sumber Data |
|---------|---------|
| Kode Mata Kuliah | kode |
| Nama Mata Kuliah | judul |
| Kategori Mata Kuliah | kategori |
| UT Daerah | upbjj |
| Lokasi Rak | lokasiRak |
| Harga | harga |
| Jumlah Stok | qty |
| Safety Stock | safety |
| Status | hasil perhitungan |

### Formatting Data
- Harga → format mata uang `Rp`
- Qty → tambahkan satuan `buah`
- Safety → tambahkan satuan `buah`

### Catatan
Field `catatanHTML` ditampilkan saat hover pada kolom status dalam bentuk tooltip/preview.

### Fitur Edit
- Pengguna dapat mengedit data stok.

### Filter dan Sort

#### Filter berdasarkan:
1. UT-Daerah
2. Kategori Mata Kuliah

#### Filter khusus:
- Qty < Safety Stock
- Qty = 0

Digunakan untuk kebutuhan reorder.

#### Sort berdasarkan:
- Judul
- Stok
- Harga

#### Ketentuan
- Tersedia tombol reset filter.
- Jangan melakukan recompute data yang tidak diperlukan.
- Terapkan dependent options:
  - Pilih UT-Daerah terlebih dahulu.
  - Setelah itu baru tampil filter kategori.

### Status Stok

#### Aman
- Stok >= Safety Stock
- Warna hijau atau simbol aman.

#### Menipis
- Stok < Safety Stock
- Warna oranye atau simbol peringatan.

#### Kosong
- Stok = 0
- Warna merah atau simbol bahaya.

### Create Data

Fitur tambah bahan ajar baru:
- Menggunakan form kecil.
- Validasi sederhana.

Ketika tombol **Enter** ditekan:
- Data langsung disimpan.
- Daftar langsung diperbarui.

### Update Data

Fitur update bahan ajar:
- Menggunakan form kecil.
- Validasi sederhana.

Ketika tombol **Enter** ditekan:
- Data langsung diperbarui.

### Delete Data

Fitur hapus data:
- Menggunakan tombol/icon delete.
- Muncul konfirmasi sebelum penghapusan.

---

# 2. Tracking Delivery Order (DO)

### Pencarian

Cari berdasarkan:
- Nomor DO
- NIM

### Keyboard Shortcut
- Enter → submit pencarian
- Esc → reset pencarian

---

## Tambah Delivery Order Baru

### Field yang Diisi

#### Nomor DO
Generate otomatis:

Format:
```text
DO2025-001
DO2025-002
DO2025-003
...
```

Terdiri dari:
- Prefix DO
- Tahun berjalan
- Sequence number

#### NIM
Diisi manual.

#### Nama
Diisi manual.

#### Ekspedisi
Pilihan:
- JNE Regular
- JNE Express

#### Paket Bahan Ajar
- Menggunakan elemen `<select>`.
- Menampilkan kode paket dan nama paket.
- Setelah dipilih, tampil detail isi paket.

#### Tanggal Kirim
- Manual atau menggunakan Date.
- Format:

```text
25 Agustus 2025
```

#### Total Harga
Diambil dari data paket.

Format:
```text
Rp xxx.xxx
```

### Validasi
Buat validasi input sederhana.

---

## Progress Pengiriman

Fitur menambah progress perjalanan:

### Waktu
- Diambil dari local time menggunakan Date.

### Keterangan
- Diinput oleh pengguna.

---

# Kriteria Penilaian

| Komponen | Poin |
|-----------|------|
| Arsitektur dan Struktur Proyek Vue.js | 20 |
| Data Binding, Directive, Array, Filter | 10 |
| Conditional Rendering | 7 |
| Computed Property / Methods | 10 |
| Watchers (minimal 2 watcher) | 10 |
| Form Input, Validasi, Event Mouse & Keyboard | 20 |
| Kreativitas UI/UX | 8 |
| Penjelasan Video | 15 |

Total: **100 Poin**

---

# Ketentuan Video

- Durasi maksimal 15 menit.
- Menjelaskan proses pengerjaan.
- Menjelaskan alasan penggunaan fitur-fitur Vue.js.
- Menjelaskan implementasi seluruh indikator penilaian.

---

# Referensi

1. https://www.w3schools.com/howto/howto_css_modals.asp
2. https://www.w3schools.com/howto/howto_js_popup_form.asp
3. https://www.w3schools.com/js/js_popup.asp
4. https://www.w3schools.com/js/js_date_methods.asp

## Referensi Akademik

- Sufandi, U. U., Aprijani, D. A., & Pandiangan, P. (2021). Evaluasi dan hasil review desain user interface prototype aplikasi mobile SITTA Universitas Terbuka.
- Sufandi, U. U. (2022). Analisis Kebutuhan dan Dokumentasi Sistem Informasi Tiras dan Transaksi Bahan Ajar Universitas Terbuka.
