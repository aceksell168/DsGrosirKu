# Optimasi Performa CSS + Opsi Framework Modern

## Yang sudah dioptimasi (CSS)

- `@layer` untuk cascade yang lebih terprediksi
- `content-visibility` + `contain` pada view & tabel (skip render bagian yang tidak terlihat)
- `color-scheme` untuk native dark mode support
- Transisi hanya pada properti murah (transform, opacity, background-color, border-color)
- Font Awesome di-load non-blocking (`media="print" onload`)
- Script di-`defer`
- Preconnect ke domain eksternal
- `prefers-reduced-motion` dihormati
- Hover transform dimatikan di perangkat touch

## Integrasi Framework Modern (pilihan)

### 1. Paling ringan (disarankan jika ingin tetap simple)
**Alpine.js** — tambahkan 1 baris, bisa buat interaktivitas modern tanpa rewrite besar.

```html
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
```

### 2. Modern build (recommended untuk jangka panjang)
**Vite + Tailwind CSS + vanilla JS** atau **Vite + Vue 3**

```bash
npm create vite@latest grosirku -- --template vanilla
cd grosirku
npm install -D tailwindcss @tailwindcss/vite
```

Lalu pindahkan logika dari `app.js` ke `src/main.js` dan styling ke Tailwind classes.

### 3. Full SPA
- Vue 3 + Pinia (state management)
- React + Zustand
- SvelteKit (sangat ringan)

Karena aplikasi ini 100% client-side + localStorage, **Alpine.js** atau **Vite + Tailwind** adalah pilihan paling masuk akal tanpa over-engineering.

