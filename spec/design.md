# Design — UNRI GPT

Panduan desain antarmuka UNRI GPT: **hijau UNRI dengan nuansa Melayu Riau**. Dokumen ini mencakup konsep, warna, tipografi, motif, komponen, tata letak, *microcopy*, dan aksesibilitas.

- Fitur dan prioritas: [`prd.md`](prd.md)
- Kebutuhan teknis dan API: [`requirements.md`](requirements.md)

---

## 1. Konsep: *"Balai Ilmu"*

Balai dalam budaya Melayu adalah tempat orang berkumpul, bertanya, dan bermusyawarah. UNRI GPT dirancang sebagai **balai ilmu digital**: tenang, terbuka, dan berwibawa, tetapi tetap ramah untuk mahasiswa.

**Tiga prinsip:**
1. **Terpercaya dulu, baru cantik.** Sumber jawaban selalu terlihat jelas. Ornamen tidak boleh mengganggu keterbacaan.
2. **Melayu yang halus.** Nuansa budaya hadir lewat warna, garis motif, dan bahasa, bukan lewat hiasan yang ramai. Ornamen hanya di tepi (header, layar sambutan, pembatas), **tidak pernah** di dalam area baca jawaban.
3. **Ringan untuk HP.** Motif berupa SVG kecil yang bisa diulang, bukan gambar besar.

**Sumber inspirasi visual:**
| Unsur | Asal | Dipakai sebagai |
|---|---|---|
| **Pucuk rebung** | Motif segitiga tunas bambu pada songket dan tenun Siak | Garis pembatas header dan footer, pola latar layar sambutan |
| **Selembayung** | Ornamen bersilang di puncak atap rumah Melayu Riau | Bentuk dasar ikon dan logo aplikasi |
| **Kuning keemasan** | Warna diraja Melayu, juga warna *Lancang Kuning* | Warna aksen (sorotan, ikon aktif, garis ornamen) |
| **Hijau** | Identitas kampus dan alam Riau | Warna utama |
| **Kain tenun** | Tekstur benang | Latar krem lembut seperti kertas atau kain |

> ⚠️ **Logo resmi Universitas Riau tidak dipakai** tanpa izin tertulis. Gunakan logo buatan sendiri (lihat §6).

## 2. Warna

### 2.1 Palet utama

| Token | Hex | Pemakaian |
|---|---|---|
| `--hijau-900` | `#073B26` | Header, teks judul di latar terang |
| `--hijau-700` | `#0B5D3B` | **Warna utama**: tombol primer, bubble pengguna, tautan |
| `--hijau-500` | `#1F8A5B` | *Hover*, ikon, fokus |
| `--hijau-100` | `#DCEFE4` | Latar chip, kartu sumber, sorotan lembut |
| `--emas-500` | `#C9A227` | Aksen ornamen, garis pucuk rebung, ikon aktif. **Bukan untuk teks** di latar terang |
| `--emas-700` | `#7A5C0A` | Teks aksen emas di latar terang (kontras aman) |
| `--emas-100` | `#F6EBC8` | Latar badge "Sumber" dan sorotan kutipan |
| `--krem-50` | `#FBF7EE` | Latar halaman (nuansa kain atau kertas) |
| `--putih` | `#FFFFFF` | Bubble asisten, kartu |
| `--tinta-900` | `#1B2620` | Teks utama |
| `--tinta-600` | `#4A5A51` | Teks sekunder, keterangan |
| `--garis` | `#E4DECF` | Border, pembatas |
| `--merah-600` | `#B42318` | Error |
| `--kuning-600` | `#B54708` | Peringatan |

### 2.2 Mode gelap ("Malam di Sungai Siak")

| Token | Hex |
|---|---|
| `--bg` | `#0E1712` |
| `--surface` | `#16231C` |
| `--surface-2` | `#1E2F25` |
| `--primary` | `#3FBF7F` |
| `--emas` | `#E3BE4F` |
| `--teks` | `#E8EFE9` |
| `--teks-2` | `#A7B8AD` |
| `--garis` | `#2A3B31` |

### 2.3 Kontras (WCAG AA)
| Kombinasi | Rasio | Status |
|---|---|---|
| `--tinta-900` di `--krem-50` | 14,6 : 1 | ✅ |
| Teks putih di `--hijau-700` | 7,9 : 1 | ✅ |
| `--hijau-700` di `--krem-50` | 7,4 : 1 | ✅ |
| `--hijau-700` di `--hijau-100` (chip) | 6,6 : 1 | ✅ |
| `--emas-700` di `--putih` | 6,2 : 1 | ✅ |
| `--emas-700` di `--emas-100` (chip sitasi) | 5,2 : 1 | ✅ |
| `--tinta-600` di `--putih` | 7,3 : 1 | ✅ |
| `--emas-500` di `--putih` | 2,4 : 1 | ❌ hanya untuk ornamen atau ikon dekoratif |
| Mode gelap: `--teks` di `--bg` | 15,6 : 1 | ✅ |
| Mode gelap: `--primary` di `--bg` | 7,8 : 1 | ✅ |
| Mode gelap: `--emas` di `--emas-soft` | 7,1 : 1 | ✅ |

Angka dihitung dengan rumus WCAG 2.1. Jika warna diubah, hitung ulang (misalnya dengan WebAIM Contrast Checker).

### 2.4 Token CSS

```css
:root {
  --bg: #FBF7EE;  --surface: #FFFFFF;  --surface-2: #F4EFE3;
  --primary: #0B5D3B;  --primary-strong: #073B26;  --primary-hover: #1F8A5B;
  --primary-soft: #DCEFE4;
  --emas: #C9A227;  --emas-teks: #7A5C0A;  --emas-soft: #F6EBC8;
  --teks: #1B2620;  --teks-2: #4A5A51;  --garis: #E4DECF;
  --error: #B42318;  --warning: #B54708;
  --radius-sm: 8px;  --radius: 14px;  --radius-lg: 20px;
  --shadow: 0 1px 2px rgb(7 59 38 / .06), 0 4px 16px rgb(7 59 38 / .06);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0E1712;  --surface: #16231C;  --surface-2: #1E2F25;
    --primary: #3FBF7F;  --primary-strong: #A8E6C6;  --primary-hover: #5FD69A;
    --primary-soft: #1E3A2B;
    --emas: #E3BE4F;  --emas-teks: #E3BE4F;  --emas-soft: #3A3218;
    --teks: #E8EFE9;  --teks-2: #A7B8AD;  --garis: #2A3B31;
  }
}
:root[data-theme="dark"] { /* salin nilai mode gelap di atas */ }
```

Di `tailwind.config.ts`, petakan token ini, misalnya `colors: { primary: 'var(--primary)', emas: 'var(--emas)', ... }`, supaya kelas seperti `bg-primary` dan `text-emas-teks` otomatis mengikuti tema.

## 3. Tipografi

| Peran | Font | Alasan |
|---|---|---|
| **Judul / display** | **Noto Serif** (serif, 600) | Serif klasik yang berwibawa, cocok dengan nuansa naskah Melayu (mengikuti desain Stitch) |
| **Teks / UI** | **Plus Jakarta Sans** (400, 500, 600) | Dirancang di Indonesia, sangat terbaca di layar kecil |
| **Kode / angka teknis** | JetBrains Mono | Untuk kode mata kuliah atau nomor surat |

Keduanya tersedia gratis di Google Fonts. Gunakan `font-display: swap`.

| Token | Ukuran / tinggi baris | Pemakaian |
|---|---|---|
| `display` | 32 / 40 (HP: 26 / 34), Noto Serif | Judul layar sambutan |
| `h1` | 24 / 32, Noto Serif | Judul halaman admin |
| `h2` | 18 / 26, Plus Jakarta 600 | Judul bagian, judul kartu |
| `body` | 16 / 26, Plus Jakarta 400 | **Isi jawaban**: jangan lebih kecil dari ini |
| `small` | 14 / 20 | Keterangan, kartu sumber |
| `caption` | 12 / 16, 500, huruf kapital, spasi huruf 0,04em | Label badge ("SUMBER") |

Lebar baris jawaban maksimal **72ch**.

## 4. Motif dan Ornamen

### 4.1 Garis pucuk rebung (pembatas)
Deretan segitiga kecil berwarna emas di bawah header dan di atas footer, setinggi 8 px.

```html
<svg class="pucuk-rebung" width="100%" height="8" aria-hidden="true">
  <defs>
    <pattern id="rebung" width="16" height="8" patternUnits="userSpaceOnUse">
      <path d="M0 8 L8 0 L16 8" fill="none" stroke="var(--emas)" stroke-width="1.25"/>
      <path d="M4 8 L8 4 L12 8" fill="var(--emas)" opacity=".55"/>
    </pattern>
  </defs>
  <rect width="100%" height="8" fill="url(#rebung)"/>
</svg>
```

### 4.2 Pola latar layar sambutan
Pola belah ketupat dan pucuk rebung dengan **opasitas 4–6%** di atas `--bg`, hanya di area atas layar sambutan, memudar ke bawah (`mask-image: linear-gradient(...)`). Tidak dipakai di area chat setelah percakapan dimulai.

### 4.3 Aturan pemakaian
- ✅ Header, layar sambutan, pembatas, halaman login admin, state kosong.
- ❌ Di belakang teks jawaban, di dalam bubble, atau di tabel admin.
- Maksimal **satu** ornamen yang menonjol per layar.

## 5. Ikonografi
- `lucide-react`, garis 1,75 px, ukuran 20 px (UI) atau 16 px (di dalam teks).
- Ikon kunci: `Send`, `Square` (berhenti), `BookOpen` (sumber), `Copy`, `RotateCcw`, `ThumbsUp`, `ThumbsDown`, `Plus` (chat baru), `Upload`, `FileText`, `Trash2`, `Moon` / `Sun`.

## 6. Logo dan Avatar Asisten
- **Ikon:** dua garis bersilang seperti **selembayung** yang membentuk huruf "U" atau "V" terbuka, dengan titik emas di puncaknya (melambangkan ilmu atau cahaya). Bentuk geometris sederhana supaya tetap jelas di ukuran 24 px.
- **Wordmark:** "UNRI" (Noto Serif 600, `--primary-strong`) + "GPT" (Plus Jakarta 600, `--emas-teks`).
- **Avatar asisten** di bubble: ikon selembayung putih di lingkaran `--primary`, 32 px.
- Simpan sebagai SVG di `frontend/public/logo.svg` dan buat favicon dari ikon yang sama.

## 7. Tata Letak

### 7.1 Desktop (≥ 1024 px)
```
┌─────────────┬──────────────────────────────────────────────────────┐
│ ⟨⟩ UNRI GPT │  Percakapan: Batas SKS                       ☾  ⋯    │  ← header 64px
│             │▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲│  ← garis pucuk rebung
│ [+ Chat baru]│                                                     │
│             │              ┌──────────────────────────────┐        │
│ HARI INI    │              │ Berapa SKS maksimal kalau    │ 🧑     │  ← bubble pengguna (kanan)
│ • Batas SKS │              │ IPS saya 3,2?                │        │
│ • Cuti      │              └──────────────────────────────┘        │
│             │  ◈  ┌─────────────────────────────────────────┐      │
│ KEMARIN     │     │ Dengan IPS 3,2, kamu boleh mengambil    │      │  ← bubble asisten (kiri)
│ • Wisuda    │     │ maksimal **24 SKS** [1].                │      │
│             │     │                                         │      │
│             │     │ 📖 SUMBER                               │      │
│             │     │ ┌[1] pedoman_akademik.pdf · hal. 14 ┐   │      │  ← kartu sumber
│             │     │ └ "Mahasiswa dengan IPS minimal…"  ─┘   │      │
│             │     │ 👍 👎  ⧉ Salin  ↻ Ulangi                 │      │
│             │     └─────────────────────────────────────────┘      │
│             │                                                      │
│ ─────────── │  ┌────────────────────────────────────────────┐ [➤]  │  ← composer (menempel di bawah)
│ ⚙ Tentang   │  │ Tanya soal KRS, cuti, skripsi, wisuda…     │      │
│             │  └────────────────────────────────────────────┘      │
│             │  Proyek mahasiswa, bukan layanan resmi Universitas Riau. │
└─────────────┴──────────────────────────────────────────────────────┘
  sidebar 280px          area chat: maks. 760px, di tengah
```

### 7.2 HP (< 768 px)
```
┌──────────────────────────┐
│ ☰   ⟨⟩ UNRI GPT     ☾   │  ← sidebar menjadi drawer
│▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲│
│                          │
│      ┌────────────────┐  │
│      │ Berapa SKS...  │  │
│      └────────────────┘  │
│ ◈ ┌────────────────────┐ │
│   │ Dengan IPS 3,2...  │ │
│   │ 📖 2 sumber    ▾   │ │  ← sumber dilipat, ketuk untuk buka
│   │ 👍 👎 ⧉ ↻           │ │
│   └────────────────────┘ │
├──────────────────────────┤
│ ┌──────────────────┐ [➤] │  ← composer menempel di bawah,
│ └──────────────────┘     │     aman untuk keyboard dan safe-area iOS
└──────────────────────────┘
  gutter samping 16px
```

### 7.3 Layar sambutan (belum ada percakapan)
```
            ◈  (logo selembayung, 56px)

        Selamat datang di UNRI GPT
   Tanya aturan akademik, dapat jawaban beserta sumbernya.

   ┌─────────────────────┐ ┌─────────────────────┐
   │ 📝 Cara mengisi KRS? │ │ 🎓 Syarat seminar    │   ← chip contoh pertanyaan
   └─────────────────────┘ │    proposal?         │     (grid 2 kolom; 1 kolom di HP)
   ┌─────────────────────┐ └─────────────────────┘
   │ ⏸ Aturan cuti        │ ┌─────────────────────┐
   │    akademik?         │ │ 🏅 Predikat cum laude?│
   └─────────────────────┘ └─────────────────────┘

   ─ ▲▲▲▲ ─  Dari Pekanbaru ke Bengkalis,
             singgah sebentar membeli kopi;
             tanyalah apa yang ingin ditulis,
             UNRI GPT siap menemani.          (Noto Serif italic, --teks-2)
```

### 7.4 Grid dan jarak
- Skala jarak berbasis 4 px: `4, 8, 12, 16, 24, 32, 48, 64`.
- *Breakpoint*: `sm 640`, `md 768`, `lg 1024`, `xl 1280`.
- Gutter samping minimal **16 px** di HP. Tidak boleh ada scroll horizontal.

## 8. Komponen

| Komponen | Spesifikasi |
|---|---|
| **Bubble pengguna** | Latar `--primary`, teks putih, `radius-lg` dengan sudut kanan-bawah 6 px, rata kanan, lebar maks. 80%. |
| **Bubble asisten** | Latar `--surface`, border 1 px `--garis`, `shadow`, sudut kiri-atas 6 px, avatar di kiri. Isi dirender sebagai Markdown. Angka penting **tebal**. |
| **Penanda sitasi** `[1]` | *Superscript* chip kecil, latar `--emas-soft`, teks `--emas-teks`. Bisa diklik untuk menggulir dan menyorot kartu sumber terkait. |
| **Kartu sumber** | Latar `--surface-2`, garis kiri 3 px `--emas`. Baris 1: ikon `FileText`, nama file, "hal. X". Baris 2: cuplikan 2 baris dengan elipsis. Kanan: indikator relevansi (3 titik terisi atau kosong, bukan angka mentah). |
| **Indikator mengetik** | Tiga belah ketupat kecil berwarna `--emas` yang berdenyut bergantian (bukan titik bulat biasa). Disertai teks "Mencari di dokumen…" lalu "Menyusun jawaban…". |
| **Composer** | Textarea yang tumbuh otomatis (1–6 baris), `radius`, border `--garis`, fokus 2 px `--primary-hover`. `Enter` untuk kirim, `Shift+Enter` untuk baris baru. Penghitung karakter muncul setelah 800/1000. Tombol kirim berubah menjadi tombol **Berhenti** (■) saat streaming. |
| **Chip saran** | Latar `--surface`, border `--garis`, *hover* latar `--primary-soft` + border `--primary`. Emoji di kiri. |
| **Tombol primer** | Latar `--primary`, teks putih, tinggi 44 px (target sentuh), *hover* `--primary-hover`. |
| **Tombol sekunder** | Transparan, border `--garis`, teks `--teks`. |
| **Tombol ikon** | 36×36 px (desktop), 44×44 px (HP); `aria-label` wajib. |
| **Toast** | Kanan bawah (desktop) atau atas (HP). Contoh: "Jawaban disalin ✓". Hilang setelah 3 detik. |
| **Banner disclaimer** | Teks `small` di bawah composer: *"Proyek mahasiswa, bukan layanan resmi Universitas Riau. Selalu konfirmasi ke bagian akademik."* |

### State khusus
| State | Tampilan |
|---|---|
| **Tidak ditemukan** | Bubble asisten dengan ikon `SearchX`, garis kiri `--emas`, pesan baku, dan tombol "Lihat dokumen yang tersedia". |
| **Error / offline** | Bubble dengan garis kiri `--error`, ikon `CloudOff`, tombol "Coba lagi". |
| **Memuat pertama kali** | *Skeleton* untuk chip saran; logo berdenyut pelan. |

## 9. Halaman Admin

Gaya lebih "kantor": ornamen hanya di halaman login, sisanya bersih.

- **Login:** kartu di tengah, latar pola pucuk rebung (opasitas 6%), logo, field username dan password, tombol primer "Masuk".
- **Dokumen:** area *drag-and-drop* (border putus-putus `--primary`, teks "Tarik PDF ke sini atau klik untuk memilih"), lalu tabel di bawahnya:

```
┌──────────────────────────────┬────────┬───────┬────────┬────────────┬──────────┬────┐
│ Nama dokumen                 │ Ukuran │ Hal.  │ Chunk  │ Diunggah   │ Status   │    │
├──────────────────────────────┼────────┼───────┼────────┼────────────┼──────────┼────┤
│ 📄 pedoman_akademik_2025.pdf │ 3,2 MB │ 142   │ 418    │ 4 Nov 2026 │ ● Siap   │ ⋯  │
│ 📄 panduan_skripsi.pdf       │ 1,1 MB │ 38    │ —      │ 4 Nov 2026 │ ◌ Proses │ ⋯  │
│ 📄 scan_sk_rektor.pdf        │ 0,8 MB │ 4     │ 0      │ 3 Nov 2026 │ ▲ Gagal  │ ⋯  │
└──────────────────────────────┴────────┴───────┴────────┴────────────┴──────────┴────┘
```
  Badge status: Siap (`--primary-soft` / `--primary`), Proses (`--emas-soft` / `--emas-teks`, dengan animasi berputar), Gagal (merah muda / `--error`, *tooltip* alasan). Di HP, tabel berubah menjadi daftar kartu.
- **Insights:** dua tab, "Tidak terjawab" dan "Dinilai 👎". Setiap baris berisi pertanyaan, tanggal, dan jumlah kemunculan. Di atasnya ada tiga kartu statistik: total pertanyaan, persentase terjawab, dan persentase 👍.

## 10. Gerak dan Animasi
- Durasi 150–250 ms, *easing* `cubic-bezier(.2,.8,.2,1)`.
- Bubble baru: *fade* + geser naik 8 px.
- Token streaming muncul tanpa animasi per kata (supaya ringan); kursor berkedip `▍` warna `--emas` di akhir teks selama streaming.
- Gulir otomatis ke bawah **hanya** jika pengguna sudah berada di dekat bagian bawah. Jika pengguna sedang menggulir ke atas, tampilkan tombol "↓ Jawaban baru".
- Hormati `prefers-reduced-motion`: matikan semua animasi kecuali perubahan opasitas.

## 11. Microcopy (Bahasa)

Nada: **sopan, hangat, dan ringkas**, seperti kakak tingkat yang santun. Memakai "kamu" untuk mahasiswa. Sentuhan Melayu muncul di sambutan dan state kosong, bukan di setiap jawaban.

| Tempat | Teks |
|---|---|
| Placeholder composer | *Tanya soal KRS, cuti, skripsi, wisuda…* |
| Judul sambutan | *Selamat datang di UNRI GPT* |
| Subjudul sambutan | *Tanya aturan akademik, dapat jawaban beserta sumbernya.* |
| Memuat (tahap 1) | *Mencari di dokumen…* |
| Memuat (tahap 2) | *Menyusun jawaban…* |
| Tidak ditemukan | *Maaf, saya belum menemukan informasi itu di dokumen yang saya punya. Silakan cek ke bagian akademik atau fakultas.* |
| Error | *Layanan sedang tersendat. Coba lagi sebentar ya.* |
| Chat baru | *+ Chat baru* |
| Hapus riwayat (konfirmasi) | *Hapus semua riwayat percakapan di perangkat ini? Tindakan ini tidak bisa dibatalkan.* |
| Setelah 👎 | *Terima kasih, masukanmu membantu kami memperbaiki jawaban.* |

### Pantun (sentuhan budaya)
Ditampilkan acak di layar sambutan atau state kosong, dengan Noto Serif italic dan warna `--teks-2`. Pantun ini karya asli untuk proyek ini.

> **Sambutan**
> Dari Pekanbaru ke Bengkalis,
> singgah sebentar membeli kopi;
> tanyalah apa yang ingin ditulis,
> UNRI GPT siap menemani.

> **Memuat lama (> 6 detik)**
> Sampan kecil di Sungai Siak,
> dikayuh pelan sampai ke hulu;
> tunggu sebentar jangan beranjak,
> dokumen dibuka satu per satu.

> **Tidak ditemukan**
> Pucuk rebung di tepi taman,
> tumbuh sebatang di dekat perigi;
> maaf belum ada di catatan,
> tanyakan ke bagian akademik lagi.

> **Error**
> Angin kencang di Selatpanjang,
> perahu menepi menunggu reda;
> layanan tersendat jangan bimbang,
> coba sebentar lagi ya, saudara.

Pantun **tidak** menggantikan pesan fungsional. Pesan jelas tetap tampil di atasnya, dan pantun hanya pelengkap.

## 12. Aksesibilitas
- Seluruh fungsi bisa dipakai dengan keyboard. Urutan fokus: sidebar → area chat → composer. `Esc` menutup drawer atau modal.
- Cincin fokus terlihat: `outline: 2px solid var(--primary-hover); outline-offset: 2px`.
- Area pesan memakai `role="log"` dan `aria-live="polite"`. Umumkan "Jawaban selesai" saat streaming selesai, bukan setiap token.
- Ornamen SVG diberi `aria-hidden="true"`.
- Status tidak hanya dibedakan lewat warna: selalu ada ikon dan teks (● Siap, ◌ Proses, ▲ Gagal).
- Target sentuh minimal 44×44 px di HP.
- Teks bisa diperbesar sampai 200% tanpa layout rusak.

## 13. Checklist Serah-Terima Desain → Kode
- [ ] Token warna (§2.4) di `frontend/src/styles/tokens.css` dan dipetakan di Tailwind
- [ ] Font Noto Serif + Plus Jakarta Sans dimuat dari Google Fonts
- [ ] `logo.svg`, favicon, dan komponen `<PucukRebung />`
- [ ] Komponen: `ChatBubble`, `SourceCard`, `CitationChip`, `TypingIndicator`, `Composer`, `SuggestionChip`, `Sidebar`, `Toast`, `StatusBadge`
- [ ] Layar: Sambutan, Chat, Admin Login, Admin Dokumen, Admin Insights
- [ ] Mode terang dan gelap diuji
- [ ] Dicek di lebar 360 px, 768 px, dan 1280 px
- [ ] Lighthouse Accessibility ≥ 90
