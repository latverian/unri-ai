# PRD — UNRI GPT

| | |
|---|---|
| **Produk** | UNRI GPT: asisten akademik interaktif berbasis LLM untuk mahasiswa Universitas Riau |
| **Versi dokumen** | 1.0 (draf) |
| **Tanggal** | 4 November 2026 |
| **Status** | Draf, untuk dibahas |
| **Dokumen terkait** | [`requirements.md`](requirements.md) (kebutuhan teknis), [`design.md`](design.md) (desain antarmuka) |

---

## 1. Latar Belakang

Informasi akademik di kampus tersebar di banyak tempat: PDF buku pedoman, situs fakultas, pengumuman BAAK, dan grup WhatsApp angkatan. Akibatnya mahasiswa sering:

- Bertanya hal yang sama berulang kali ke dosen PA, staf akademik, atau kakak tingkat.
- Mendapat jawaban yang salah atau sudah kedaluwarsa dari sumber tidak resmi.
- Kesulitan mencari aturan spesifik di PDF ratusan halaman (misalnya syarat seminar proposal atau batas SKS).

Chatbot umum seperti ChatGPT tidak tahu aturan internal kampus dan cenderung **mengarang jawaban**. Karena itu dibutuhkan asisten yang menjawab **hanya dari dokumen kampus** dan **selalu menunjukkan sumbernya**.

## 2. Visi Produk

> *"Tanya sekali, langsung tahu dasarnya."*
> Asisten akademik yang ramah, cepat, dan dapat dipercaya karena setiap jawabannya bisa dilacak ke dokumen sumber.

## 3. Tujuan dan Non-Tujuan

### Tujuan
1. Mahasiswa mendapat jawaban atas pertanyaan akademik umum dalam **< 10 detik**, lengkap dengan sumbernya.
2. Mengurangi jawaban yang salah: sistem **menolak menjawab** jika informasinya tidak ada di dokumen.
3. Admin (pengelola project atau staf) bisa **memperbarui dokumen tanpa menyentuh kode**.
4. Seluruh sistem bisa berjalan dengan **biaya Rp0** (model lokal atau free tier).

### Non-Tujuan (di luar cakupan)
- Mengakses data pribadi mahasiswa (nilai, KHS, status UKT per individu) atau terhubung ke SIAKAD.
- Menggantikan layanan resmi kampus atau mengambil keputusan administratif.
- Menjawab pertanyaan umum di luar konteks akademik (misalnya mengerjakan tugas atau menulis esai).
- Menjadi layanan resmi Universitas Riau, kecuali di kemudian hari ada kerja sama resmi.

## 4. Pengguna (Persona)

### 🎓 Persona 1: Rani, mahasiswa baru (semester 1)
- **Kebutuhan:** memahami cara isi KRS, kalender akademik, dan arti istilah seperti PA, SKS, dan IPS.
- **Masalah:** malu bertanya berulang kali dan tidak tahu harus bertanya ke siapa.
- **Perangkat:** HP Android dengan kuota terbatas.

### 📚 Persona 2: Dimas, mahasiswa tingkat akhir (semester 7)
- **Kebutuhan:** syarat seminar proposal, sidang, yudisium, dan wisuda.
- **Masalah:** aturannya ada di PDF panjang dan ia takut salah langkah karena bisa terlambat lulus.
- **Perangkat:** laptop dan HP.

### 🛠️ Persona 3: Admin (pengembang atau staf akademik)
- **Kebutuhan:** mengunggah atau menghapus dokumen, melihat pertanyaan yang gagal dijawab, dan memantau kualitas jawaban.
- **Masalah:** tidak ingin setiap pembaruan dokumen harus lewat terminal.

## 5. User Stories

Prioritas memakai metode **MoSCoW**: **M** = Must, **S** = Should, **C** = Could, **W** = Won't (untuk saat ini).

| ID | Sebagai… | Saya ingin… | Supaya… | Prioritas |
|---|---|---|---|---|
| US-01 | Mahasiswa | Bertanya dengan bahasa sehari-hari | Tidak perlu membaca PDF panjang | **M** |
| US-02 | Mahasiswa | Melihat jawaban muncul bertahap (*streaming*) | Tidak menunggu tanpa kepastian | **M** |
| US-03 | Mahasiswa | Melihat sumber (nama dokumen dan halaman) di setiap jawaban | Bisa memastikan kebenarannya | **M** |
| US-04 | Mahasiswa | Mendapat pesan jujur kalau info tidak ditemukan | Tidak tertipu jawaban karangan | **M** |
| US-05 | Mahasiswa | Melihat contoh pertanyaan di layar awal | Tahu apa saja yang bisa ditanyakan | **M** |
| US-06 | Mahasiswa | Memakai aplikasi dengan nyaman di HP | Bisa bertanya kapan saja | **M** |
| US-07 | Mahasiswa | Mengajukan pertanyaan lanjutan ("kalau IPS-nya 2,8?") | Percakapan terasa alami | **S** |
| US-08 | Mahasiswa | Memberi 👍/👎 pada jawaban | Kualitas sistem terus membaik | **S** |
| US-09 | Mahasiswa | Membuka kembali riwayat percakapan | Tidak perlu bertanya ulang | **S** |
| US-10 | Mahasiswa | Menyalin jawaban dengan satu klik | Mudah dibagikan ke teman | **S** |
| US-11 | Mahasiswa | Memilih mode gelap | Nyaman dipakai di malam hari | **C** |
| US-12 | Mahasiswa | Membuka cuplikan isi dokumen sumber | Membaca konteks aslinya | **C** |
| US-13 | Admin | Login ke halaman admin | Hanya saya yang bisa mengubah data | **M** |
| US-14 | Admin | Mengunggah dan menghapus dokumen PDF/TXT/MD lewat browser | Tidak perlu terminal | **M** |
| US-15 | Admin | Melihat status pemrosesan dokumen (antre, diproses, selesai, gagal) | Tahu dokumen sudah siap dipakai | **S** |
| US-16 | Admin | Melihat daftar pertanyaan yang tidak terjawab dan yang diberi 👎 | Tahu dokumen apa yang perlu ditambah | **S** |
| US-17 | Admin | Menjalankan evaluasi otomatis dari dashboard | Mengukur akurasi tanpa terminal | **C** |
| US-18 | Mahasiswa | Login dengan akun kampus (SSO) | — | **W** |
| US-19 | Mahasiswa | Bertanya lewat suara | — | **W** |

## 6. Fitur dan Cakupan Rilis

### 🟢 Rilis 1: MVP (target 4 minggu)
- Halaman chat dengan *streaming*, sitasi sumber, dan penolakan jawaban jika info tidak ditemukan (US-01 s.d. US-06).
- Contoh pertanyaan di layar awal.
- Backend API (FastAPI) yang membungkus pipeline RAG yang sudah ada.
- Halaman admin sederhana: login, unggah, hapus, dan daftar dokumen (US-13, US-14).
- Tema hijau UNRI dengan nuansa Melayu, responsif untuk HP.

### 🟡 Rilis 2 (+3 minggu)
- Percakapan berkelanjutan (US-07), riwayat chat (US-09), salin jawaban (US-10).
- Umpan balik 👍/👎 (US-08) dan dashboard pertanyaan gagal (US-16).
- Status pemrosesan dokumen (US-15).

### 🔵 Rilis 3 (opsional)
- Mode gelap (US-11), pratinjau dokumen sumber (US-12), evaluasi otomatis dari dashboard (US-17).
- Bot Telegram yang memakai API yang sama.
- OCR untuk PDF hasil scan.

## 7. Alur Pengguna Utama

```
Mahasiswa membuka situs
   └─► Layar sambutan + contoh pertanyaan
         └─► Ketik atau klik pertanyaan
               └─► Indikator "Sedang mencari di dokumen…"
                     ├─► [Dokumen relevan ditemukan]
                     │     └─► Jawaban streaming ─► kartu sumber ─► 👍/👎 / salin / tanya lanjut
                     └─► [Tidak ditemukan]
                           └─► Pesan jujur + saran menghubungi bagian akademik
```

## 8. Metrik Keberhasilan

| Metrik | Target MVP | Cara mengukur |
|---|---|---|
| Akurasi retrieval (dokumen sumber benar) | ≥ 85% | `eval/evaluate.py --retrieval-only` pada ≥ 100 pertanyaan uji |
| Akurasi jawaban (kata kunci benar) | ≥ 75% | `eval/evaluate.py` |
| Penolakan benar untuk pertanyaan di luar dokumen | ≥ 90% | Subset pertanyaan "jebakan" di set uji |
| Waktu sampai token pertama muncul | < 3 detik (Gemini) / < 8 detik (Ollama di CPU) | Log backend |
| Rasio 👍 dari seluruh umpan balik | ≥ 70% | Tabel `feedback` |
| Skor kepuasan uji pengguna (SUS) | ≥ 70 | Kuesioner ke 15–30 mahasiswa |

## 9. Asumsi dan Ketergantungan
- Dokumen yang dipakai adalah **dokumen publik** yang bisa diunduh dari situs resmi kampus atau fakultas.
- Server atau laptop pengembang cukup kuat menjalankan model embedding kecil (RAM ≥ 8 GB).
- Untuk demo publik, LLM memakai **Gemini free tier** karena model lokal butuh perangkat yang kuat. Kuota free tier bisa berubah sewaktu-waktu.

## 10. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| LLM mengarang jawaban (halusinasi) | Mahasiswa salah mengambil keputusan | Ambang skor kemiripan, prompt "jawab hanya dari konteks", sitasi wajib, disclaimer |
| Dokumen kedaluwarsa | Jawaban tidak lagi berlaku | Tampilkan tanggal unggah dokumen di kartu sumber; admin bisa mengganti dokumen dengan mudah |
| Kuota free tier habis | Layanan mati saat demo | *Fallback* ke Ollama, *rate limit* per pengguna, cache jawaban untuk pertanyaan yang sering muncul |
| Penggunaan nama dan identitas UNRI tanpa izin | Masalah etika atau hukum | Tidak memakai logo resmi; tampilkan label "proyek mahasiswa, bukan layanan resmi"; minta izin bila akan dipublikasikan luas |
| Penyalahgunaan (spam atau *prompt injection*) | Biaya atau jawaban melenceng | *Rate limit*, batas panjang input, *system prompt* yang ketat, dokumen hanya dari admin |
| PDF hasil scan tidak terbaca | Dokumen penting tidak masuk | Peringatan saat ingest; OCR di Rilis 3 |

## 11. Pertanyaan Terbuka
1. Fakultas atau unit mana yang dijadikan cakupan awal?
2. Apakah ada dosen pembimbing atau unit kampus yang bisa memberi izin dan validasi jawaban?
3. Demo publik memakai Gemini (cepat) atau Ollama di laptop (gratis penuh, tapi harus dinyalakan)?
4. Apakah riwayat chat cukup disimpan di browser, atau perlu akun?
