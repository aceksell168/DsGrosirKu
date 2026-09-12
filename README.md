# GrosirKu — Dashboard Manajemen Toko Grosir

Dashboard front-end untuk mengelola produk, stok, harga, penjualan, restock supplier, dan analisis keuntungan toko grosir. Dibangun murni dengan HTML, CSS, dan JavaScript (tanpa build tool, tanpa backend) sehingga bisa langsung dihosting sebagai situs statis.

## Struktur proyek

```
index.html    halaman utama (login + dashboard)
style.css     semua styling & tema terang/gelap (sudah dioptimasi)
app.js        seluruh logika aplikasi
README.md     dokumentasi
```

## Menjalankan secara lokal

Cukup buka `index.html` langsung di browser, atau jalankan server statis sederhana:

```bash
python3 -m http.server 8000
# lalu buka http://localhost:8000
```

## Akun demo

| Username | Password     | Role          |
|----------|--------------|---------------|
| admin    | admin123     | Administrator |
| manager  | manager123   | Manager       |
| kasir1   | kasir123     | Kasir         |

## Fitur utama

- Login + role-based access
- Manajemen produk (CRUD)
- Input penjualan + grafik 30 hari
- Analisis keuntungan & margin
- Restock supplier + riwayat
- History penjualan
- Whitelist IP (keamanan)
- Dark / Light mode
- Backup & restore data (localStorage)
- Ekspor CSV

Data disimpan di `localStorage` browser.
