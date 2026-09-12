# GrosirKu — Dashboard Manajemen Toko Grosir

Dashboard front-end untuk mengelola produk, stok, harga, penjualan, restock supplier, dan analisis keuntungan toko grosir. Dibangun murni dengan HTML, CSS, dan JavaScript (tanpa build tool, tanpa backend) sehingga bisa langsung dihosting sebagai situs statis.

## Struktur proyek

```
index.html            halaman utama (login + dashboard)
assets/css/style.css   semua styling & tema terang/gelap
assets/js/app.js       seluruh logika aplikasi
```

## Menjalankan secara lokal

Cukup buka `index.html` langsung di browser, atau jalankan server statis sederhana:

```bash
python3 -m http.server 8000
# lalu buka http://localhost:8000
```

## Hosting ke GitHub Pages

1. Buat repository baru di GitHub, lalu push seluruh isi folder ini ke branch `main`.
2. Buka **Settings → Pages** pada repository.
3. Pada **Source**, pilih branch `main` dan folder `/root`, lalu simpan.
4. Situs akan tersedia di `https://<username>.github.io/<nama-repo>/` dalam beberapa menit.

## Akun demo

| Username  | Password    | Peran         | Kewenangan                          |
|-----------|-------------|---------------|--------------------------------------|
| admin     | admin123    | Administrator | Akses penuh                         |
| manager   | manager123  | Manager       | Kelola produk, harga, restock, IP   |
| kasir1    | kasir123    | Kasir         | Input penjualan saja                 |

## Data & penyimpanan

Seluruh data (produk, penjualan, riwayat harga, riwayat restock, whitelist IP) disimpan di **localStorage** browser masing-masing perangkat — tidak ada server/database. Konsekuensinya:

- Data **tidak sinkron** antar perangkat atau antar browser.
- Data bisa hilang jika pengguna membersihkan cache/data situs di browser.
- Gunakan menu **Pengaturan → Cadangkan & Pulihkan Data** untuk mengekspor data ke file JSON secara berkala, dan mengimpornya kembali saat diperlukan (mis. saat pindah perangkat).

## ⚠️ Catatan penting soal keamanan

Login dan whitelist IP pada aplikasi ini adalah **fitur tampilan/demo, bukan keamanan sungguhan**:

- Semua logika (termasuk daftar username/password) berjalan di browser dan ada di dalam `assets/js/app.js`. Setelah dihosting di GitHub Pages, source code ini **terbuka untuk umum** dan bisa dibaca siapa saja.
- Pengecekan IP dilakukan lewat API publik (`ipify.org`) dari sisi klien, sehingga bisa dilewati dengan mudah (mis. lewat DevTools browser).
- Jangan gunakan aplikasi ini untuk menyimpan data benar-benar rahasia/sensitif tanpa menambahkan backend (server + database + autentikasi sungguhan).

Untuk kebutuhan produksi yang lebih serius (multi-pengguna, data tersinkron, keamanan nyata), aplikasi ini perlu dihubungkan ke backend (API + database) — silakan beri tahu jika Anda ingin bantuan merancang arsitektur tersebut.

## Fitur

- Login berbasis peran (Admin, Manager, Kasir) dengan hak akses berbeda.
- Dashboard ringkasan stok, nilai stok, dan keuntungan, lengkap dengan grafik penjualan 30 hari.
- Manajemen produk: tambah, hapus, ubah harga jual, ubah harga modal, restock.
- Riwayat perubahan harga & riwayat restock supplier.
- Analisis keuntungan per produk beserta margin dan ekspor CSV.
- History penjualan dengan pencarian, badge transaksi kedaluwarsa (>30 hari), dan pembersihan otomatis.
- Struk penjualan yang bisa dicetak setelah transaksi.
- Whitelist IP (lihat catatan keamanan di atas).
- Mode terang/gelap.
- Cadangkan (export) dan pulihkan (import) seluruh data sebagai file JSON.
- Notifikasi & dialog konfirmasi kustom (tidak lagi memakai `alert()`/`confirm()` bawaan browser).
- Responsif untuk mobile, tablet, dan desktop.
