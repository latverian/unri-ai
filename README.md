# 🎓 Balai Ilmu

Asisten tanya-jawab akademik berbasis dokumen, dengan **studi kasus Universitas Riau (UNRI)**. Dibangun dengan **LLM + RAG (Retrieval-Augmented Generation)**. Asisten ini menjawab **hanya dari dokumen kampus** dan **selalu menyertakan sumbernya**. Jika informasinya tidak ada di dokumen, asisten akan mengatakannya dengan jujur dan tidak mengarang jawaban.

> 🚧 **Status: MVP (Rilis 1) sedang dibangun.** Backend dan frontend sudah bisa dijalankan.

> ⚠️ Proyek mahasiswa, bukan layanan resmi Universitas Riau.

## Fitur

**Untuk mahasiswa**
- Chat dengan jawaban *streaming*, sitasi `[1]` yang bisa diklik, dan kartu sumber (nama dokumen, halaman, cuplikan)
- Penolakan jujur jika informasi tidak ada di dokumen (LLM tidak dipanggil sama sekali)
- Contoh pertanyaan di layar awal, pertanyaan lanjutan, tombol berhenti, salin, ulangi, dan 👍/👎
- Riwayat percakapan tersimpan di browser (tanpa akun)
- Mode terang dan gelap, nyaman dipakai di HP

**Untuk admin** (`/admin`)
- Login, unggah dokumen PDF/TXT/MD (*drag-and-drop*), status pemrosesan, proses ulang, hapus
- *Insights*: pertanyaan yang tidak terjawab, jawaban yang dinilai kurang, dan pengaturan contoh pertanyaan

## Teknologi (semuanya gratis)

| Lapisan | Teknologi |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Backend | FastAPI (Python) |
| Embedding | `intfloat/multilingual-e5-small` (lokal) atau Gemini |
| Vector DB | Chroma |
| LLM | Ollama (`qwen2.5:3b`, lokal) atau Gemini free tier |
| Database | SQLite |

## Menjalankan di Laptop

Butuh **Python 3.11+** dan **Node.js 20+**.

### 1. Backend

```bash
cd backend
```
```bash
python -m venv .venv
```
Aktifkan venv: `source .venv/bin/activate` (Mac/Linux) atau `.venv\Scripts\activate` (Windows).
```bash
pip install -r requirements.txt
```
Salin konfigurasi (Windows: `copy .env.example .env`):
```bash
cp .env.example .env
```
Lalu buka `backend/.env` dan isi tiga hal:
1. **`GEMINI_API_KEY`**: ambil gratis di https://aistudio.google.com (menu *Get API key*).
2. **`ADMIN_PASSWORD_HASH`**: hasil dari perintah di bawah.
   ```bash
   python -m app.core.security hash "passwordmu"
   ```
3. **`JWT_SECRET`**: string acak panjang, misalnya hasil dari:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

Cek apakah semuanya siap. Perintah ini juga mendeteksi spesifikasi laptop dan mencoba bertanya ke LLM:
```bash
python -m app.check
```
Jalankan server (dokumentasi API otomatis ada di http://localhost:8000/docs):
```bash
uvicorn app.main:app --reload
```

**Mau gratis penuh dan offline?** Install [Ollama](https://ollama.com/download), lalu di `.env` ubah `LLM_PROVIDER=ollama` dan `EMBED_PROVIDER=local`, kemudian:
```bash
pip install -r requirements-local-embed.txt
```
```bash
python -m app.check --pull
```
`python -m app.check` akan menyarankan model yang cocok dengan RAM laptop Anda. Dengan `LLM_FALLBACK=ollama` (default), Ollama juga otomatis dipakai sebagai cadangan saat Gemini gagal.

### 2. Frontend (terminal baru)

```bash
cd frontend
```
```bash
npm install
```
```bash
npm run dev
```
Buka http://localhost:5173. Masuk ke http://localhost:5173/admin untuk mengunggah dokumen, misalnya buku pedoman akademik dari situs fakultas.

### Tes

```bash
cd backend && pip install -r requirements-dev.txt && pytest
```
```bash
cd frontend && npm run lint && npm run build
```

## Dokumen Rujukan Tidak Disimpan di GitHub

PDF yang diunggah lewat halaman admin tersimpan di `backend/data/` di komputer atau server yang menjalankan backend. Folder itu masuk `.gitignore`, jadi **tidak pernah ikut ter-commit**. Alasannya:
- Repo ini publik, sedangkan hak cipta dokumen ada pada kampus. Cukup tautkan ke sumber resminya.
- File PDF besar membuat repo berat.
- Vektor dan database bisa dibuat ulang kapan saja dari PDF-nya.

Supaya hasilnya bisa diulang (penting untuk laporan atau skripsi), catat dokumen yang dipakai di [`spec/sumber-dokumen.md`](spec/sumber-dokumen.md): judul, tahun, dan tautan resmi.

## Pengaturan Penting (`backend/.env`)

| Variabel | Fungsi |
|---|---|
| `MIN_SCORE` | Ambang kemiripan. Terlalu sering "tidak ditemukan"? Turunkan. Sering mengarang? Naikkan. |
| `LLM_FALLBACK` | Provider cadangan jika yang utama gagal, misalnya `gemini` |
| `TOP_K`, `CHUNK_SIZE`, `CHUNK_OVERLAP` | Parameter RAG, cocok dijadikan bahan eksperimen |

Mengganti `EMBED_PROVIDER` atau `EMBED_MODEL` berarti vektor lama tidak cocok lagi. Hapus `backend/data/chroma/`, lalu proses ulang dokumen dari halaman admin.

## Struktur Repo

```
unri-ai/
├── backend/
│   ├── app/
│   │   ├── api/       # chat (SSE), publik (health, suggestions, feedback), admin
│   │   ├── core/      # config, keamanan (JWT), rate limit
│   │   ├── rag/       # store (embedding + Chroma), ingest, llm, rag
│   │   ├── db.py      # SQLite
│   │   └── main.py
│   └── tests/
├── frontend/
│   └── src/
│       ├── components/  # Brand, Sidebar, Welcome, MessageView, Composer, Toast
│       ├── pages/       # ChatPage, AdminLogin, AdminDocuments, AdminInsights
│       └── lib/         # api (klien + parser SSE), useChat, storage, theme
└── spec/                # prd.md, requirements.md, design.md, stitch/
```

## Spesifikasi

| Dokumen | Isi |
|---|---|
| [`spec/prd.md`](spec/prd.md) | Latar belakang, tujuan, persona, user stories, rencana rilis, metrik keberhasilan, dan risiko |
| [`spec/requirements.md`](spec/requirements.md) | Arsitektur, kebutuhan fungsional/non-fungsional, kontrak API, model data, dan rencana kerja |
| [`spec/design.md`](spec/design.md) | Sistem desain "Balai Ilmu": hijau UNRI dengan nuansa Melayu |
| [`spec/stitch/`](spec/stitch/) | Desain 7 layar dari Stitch (screenshot + HTML) |
