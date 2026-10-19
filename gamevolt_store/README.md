# GAMEVOLT — Game Digital Store

Starter project toko game digital dengan desain responsif, katalog produk, Supabase Auth, SQL schema, checkout QRIS manual, konfirmasi WhatsApp admin, pelacakan pesanan untuk pemilik akun, dan endpoint AI server-side.

## Fitur yang sudah ada
- Tampilan storefront responsif dengan produk contoh.
- Katalog produk yang membaca `public.products` dari Supabase jika tabel tersedia.
- Login/daftar via Supabase Auth.
- SQL untuk produk, profil, pesanan, event pesanan, pengaturan, dan RLS.
- Checkout QRIS manual; tombol WhatsApp membuka chat admin dengan rincian pesanan.
- AI chat memakai API server-side jika `OPENAI_API_KEY` dikonfigurasi.
- Rate limiting dasar dan Helmet di Express.

## Hal yang perlu diketahui
- Produk contoh yang tampil tanpa koneksi Supabase adalah mode preview dan tidak persisten.
- SQL sengaja tidak memberi hak insert/update order secara langsung kepada browser. Endpoint backend `/api/orders` memvalidasi token login dan mengambil harga dari database. Isi `SUPABASE_SERVICE_ROLE_KEY` hanya di `.env` server untuk mengaktifkan checkout database.
- Panel owner/admin penuh (CRUD produk, maintenance, verifikasi pembayaran, laporan) belum diaktifkan dalam starter ini. Jangan menganggap fitur yang belum ada sebagai sudah berfungsi.
- Pembayaran QRIS bersifat manual: bukti dikirim ke WhatsApp dan admin harus memverifikasi mutasi sebelum status diubah menjadi paid. Website tidak dapat memastikan pembayaran hanya dari screenshot.
- QRIS image harus benar-benar milik/diizinkan oleh pemilik toko. Pastikan gambar di `public/assets/qris.jpg` adalah QRIS yang ingin dipakai.
- Jangan simpan Supabase service role key atau AI secret di `public/config.js`.

## Cara menjalankan lokal
1. Instal Node.js versi LTS.
2. Ekstrak ZIP, buka terminal di folder proyek.
3. Jalankan `npm install`.
4. Salin `.env.example` menjadi `.env`.
5. Isi `SUPABASE_ANON_KEY` dengan publishable key proyek kamu, `SUPABASE_SERVICE_ROLE_KEY` dengan secret server-only dari Supabase, dan `OPENAI_API_KEY` jika ingin AI asli. Jangan bagikan service role key.
6. Di `public/config.js`, isi `supabasePublishableKey` dengan publishable key yang sama.
7. Di Supabase Dashboard > SQL Editor, jalankan seluruh `supabase/schema.sql`.
8. Jalankan `npm start`.
9. Buka `http://localhost:3000`.

## Konfigurasi Supabase
- Project URL: `https://pjdfjwlajplaurozuqki.supabase.co`
- Publishable key boleh ada di frontend jika RLS benar.
- Aktifkan Email provider pada Authentication jika ingin login/daftar.
- Atur Site URL dan Redirect URLs sesuai domain lokal/hosting.
- Setelah schema dijalankan, cek tabel `products` berisi seed products.
- Untuk order produksi, tambahkan endpoint backend yang memverifikasi bearer token menggunakan Supabase Auth, membaca harga dari tabel, lalu memasukkan order. Jangan gunakan nilai harga dari browser sebagai sumber kebenaran.

## Konfigurasi AI
- Tambahkan `OPENAI_API_KEY` di `.env` pada server saja.
- Jangan pernah memasukkan AI API key ke `public/config.js`.
- Jika API key kosong, AI akan menjelaskan bahwa AI belum diaktifkan.

## Deploy
Deploy Node.js ke hosting yang mendukung server Node (misalnya Render, Railway, atau VPS). Atur environment variables di dashboard hosting. Hosting statis saja tidak cukup untuk endpoint AI server-side.


## Deploy Netlify (tanpa GitHub, manual upload)

Proyek ini memiliki `netlify.toml` dan fungsi di `netlify/functions/` untuk AI, health check, dan pembuatan pesanan. Netlify manual deploy dapat mengunggah folder hasil build, tetapi **upload drag-and-drop biasa tidak selalu membangun/deploy Functions dari source**. Cara paling andal adalah deploy via Netlify CLI atau menghubungkan Git repository. Jika menggunakan CLI: jalankan `npm install`, install Netlify CLI, lalu `netlify deploy` dari folder proyek; untuk production gunakan `netlify deploy --prod`.

Atur Environment variables di Netlify (Site configuration → Environment variables): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, dan `OPENAI_API_KEY` (opsional untuk AI). Jangan menaruh service-role key atau OpenAI key di file publik. `SUPABASE_SERVICE_ROLE_KEY` adalah secret server-side dan tidak boleh dikirim ke chat atau dimasukkan ke `public/config.js`. `SUPABASE_URL` sudah diketahui dari project. Setelah mengubah environment variables, redeploy site.

Catatan: checkout membutuhkan pengguna login dan produk aktif yang ada di tabel `products`. Pembayaran QRIS manual belum otomatis diverifikasi; admin tetap harus mengecek bukti pembayaran.
