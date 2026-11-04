# 🎓 UNRI GPT

Asisten tanya-jawab akademik berbasis **RAG (Retrieval-Augmented Generation)**. Asisten ini menjawab hanya dari dokumen yang Anda masukkan dan **selalu menyertakan sumbernya**. Semua komponennya **gratis**:

| Komponen | Yang dipakai | Biaya |
|---|---|---|
| LLM | Ollama + `qwen2.5:3b` (lokal) — atau Gemini free tier | Gratis |
| Embedding | `intfloat/multilingual-e5-small` (lokal) | Gratis |
| Vector DB | Chroma (file lokal) | Gratis |
| UI | Streamlit | Gratis |

> ⚠️ Ini bukan layanan resmi Universitas Riau. Gunakan dokumen publik saja dan jangan masukkan data pribadi mahasiswa.

## Alur kerja

```
PDF/TXT/MD ──► ingest.py ──► potong (chunk) ──► embedding ──► Chroma
                                                                 │
Pertanyaan ──► embedding ──► cari 4 chunk termirip ◄─────────────┘
                                   │ (skor < MIN_SCORE → "Maaf, tidak ditemukan")
                                   ▼
                    prompt + konteks ──► LLM ──► jawaban + [sumber, hal.]
```

## Cara menjalankan

**1. Install Python 3.10+ dan [Ollama](https://ollama.com/download)**, lalu unduh model (±2 GB):
```bash
ollama pull qwen2.5:3b
```

**2. Install dependensi:**
```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # Windows: copy .env.example .env
```

**3. Masukkan dokumen** ke `data/docs/` (PDF, TXT, atau MD), misalnya buku pedoman akademik, panduan skripsi, atau kalender akademik. File `CONTOH_FIKTIF_...md` hanya untuk uji coba; hapus kalau sudah punya dokumen asli.

**4. Proses dokumen** (ulangi setiap kali dokumen berubah):
```bash
python ingest.py
```

**5. Jalankan chat:**
```bash
streamlit run app.py
```

Uji cepat dari terminal:
```bash
python rag.py "Berapa SKS maksimal kalau IPS saya 3.2?"
python rag.py --retrieval-only "syarat cuti"     # lihat chunk yang ditemukan, tanpa LLM
```

## Laptop kurang kuat? Pakai Gemini (gratis)
Ambil API key di https://aistudio.google.com, lalu ubah `.env`:
```
LLM_PROVIDER=gemini
GEMINI_API_KEY=xxxx
```
Embedding tetap berjalan lokal, jadi yang dikirim ke Gemini hanya pertanyaan dan potongan dokumen yang relevan.

## Evaluasi (untuk laporan)
Isi `eval/questions.csv` dengan pertanyaan beserta kunci jawabannya, termasuk beberapa pertanyaan yang **memang tidak ada jawabannya** di dokumen untuk menguji apakah sistem menolak dan tidak mengarang. Lalu jalankan:
```bash
python eval/evaluate.py --retrieval-only    # akurasi pencarian
python eval/evaluate.py                     # akurasi jawaban
```

## Pengaturan (`.env`)
- `MIN_SCORE` (default 0.75): ambang kemiripan. Kalau terlalu sering menjawab "tidak ditemukan", turunkan ke 0.7. Kalau sering mengarang, naikkan.
- `TOP_K`: jumlah chunk konteks yang diambil.
- `CHUNK_SIZE` / `CHUNK_OVERLAP`: ukuran potongan dokumen. Ini bagus untuk dijadikan eksperimen di laporan.
- `EMBED_MODEL`: coba `intfloat/multilingual-e5-base` atau `BAAI/bge-m3` untuk perbandingan. Model e5 sudah otomatis diberi awalan `query:`/`passage:`; kalau ganti ke model non-e5, sesuaikan `store.py`.

## Ide pengembangan
- OCR untuk PDF hasil scan (`ocrmypdf`)
- Bot Telegram (`python-telegram-bot`) yang memanggil `rag.answer()`
- Perbandingan model embedding/LLM sebagai bab eksperimen
- Halaman admin untuk upload dokumen

## Struktur
```
config.py          pengaturan (dibaca dari .env)
store.py           embedding + Chroma
ingest.py          baca & potong dokumen → simpan ke Chroma
rag.py             cari konteks → prompt → LLM (Ollama/Gemini)
app.py             UI chat Streamlit
eval/              pertanyaan uji + skrip evaluasi
data/docs/         taruh dokumen di sini
```
