# Desain dari Stitch

Ekspor layar dari project Stitch **"Desain Proyek Kreatif"**. Ini acuan visual untuk frontend; aturan desainnya tetap mengikuti [`../design.md`](../design.md).

Setiap layar punya dua file: `.jpg` (screenshot, diperkecil) dan `.html` (kode Tailwind hasil Stitch, dipakai sebagai referensi struktur dan kelas, bukan disalin mentah).

| # | Layar | Screenshot | HTML |
|---|---|---|---|
| 1 | Balai Ilmu — Sambutan & Rekomendasi Tanya Jawab | [jpg](01-sambutan.jpg) | [html](01-sambutan.html) |
| 2 | Percakapan Aktif — Rujukan Batas SKS (Mode Gelap) | [jpg](02-percakapan-gelap.jpg) | [html](02-percakapan-gelap.html) |
| 3 | Percakapan Aktif — Tampilan Mobile (HP) | [jpg](03-percakapan-mobile.jpg) | [html](03-percakapan-mobile.html) |
| 4 | Masuk Pengelola — Portal Admin | [jpg](04-admin-login.jpg) | [html](04-admin-login.html) |
| 5 | Portal Kelola Dokumen Pedoman Akademik | [jpg](05-admin-dokumen.jpg) | [html](05-admin-dokumen.html) |
| 6 | Admin Insights & Evaluasi Layanan Akademik | [jpg](06-admin-insights.jpg) | [html](06-admin-insights.html) |
| 7 | Pengaturan Sistem — Tema Terang, Gelap & Preferensi | [jpg](07-pengaturan.jpg) | [html](07-pengaturan.html) |

## Catatan saat implementasi
- Gambar logo di HTML Stitch adalah placeholder dan tidak tampil. Buat `logo.svg` sendiri (ikon selembayung, lihat `design.md` §6).
- Logo dan nama aplikasi muncul dua kali (sidebar dan header). Cukup tampilkan di salah satu.
- HTML memuat Tailwind dari CDN dan gambar dari `lh3.googleusercontent.com`. Di aplikasi asli, gunakan Tailwind hasil build dan aset lokal.

## Memperbarui dari Stitch
Repo ini punya `.mcp.json` untuk server MCP Stitch. Agar tersambung, isi environment variable `STITCH_API_KEY` (jangan pernah menulis key di repo atau chat), lalu minta Claude mengunduh ulang layar yang berubah.
