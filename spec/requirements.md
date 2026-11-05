# Requirements — Balai Ilmu

Dokumen ini menjabarkan **kebutuhan fungsional dan non-fungsional**, arsitektur, dan kontrak API untuk membangun Balai Ilmu sebagai aplikasi web dengan **frontend** dan **backend** terpisah.

- Latar belakang dan prioritas fitur: [`prd.md`](prd.md)
- Tampilan dan gaya visual: [`design.md`](design.md)

---

## 1. Arsitektur

```
┌──────────────────────────┐        HTTPS / SSE        ┌───────────────────────────────┐
│  FRONTEND (React + Vite) │ ────────────────────────► │  BACKEND (FastAPI, Python)    │
│  - Halaman chat          │ ◄──────────────────────── │  /api/chat  (streaming)       │
│  - Halaman admin         │       JSON / text/event   │  /api/documents, /api/admin   │
└──────────────────────────┘                           │                               │
                                                       │  ┌─────────┐   ┌───────────┐  │
                                                       │  │ RAG     │──►│ LLM       │  │
                                                       │  │ (rag.py)│   │ Ollama /  │  │
                                                       │  └────┬────┘   │ Gemini    │  │
                                                       │       │        └───────────┘  │
                                                       │  ┌────▼────┐   ┌───────────┐  │
                                                       │  │ Chroma  │   │ SQLite    │  │
                                                       │  │ vektor  │   │ metadata, │  │
                                                       │  └─────────┘   │ feedback  │  │
                                                       │                └───────────┘  │
                                                       └───────────────────────────────┘
```

Pipeline RAG ditempatkan di modul tersendiri (`backend/app/rag/`) supaya bisa diuji terpisah dari lapisan API, dan nantinya bisa dipakai juga oleh klien lain seperti bot Telegram.

## 2. Teknologi (semua gratis / open-source)

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Frontend | **React 18 + Vite + TypeScript** | Ringan, cepat, banyak tutorial |
| Styling | **Tailwind CSS** dengan token warna dari `design.md` | Konsisten dengan sistem desain |
| Render Markdown | `react-markdown` + `remark-gfm` | Jawaban LLM berformat Markdown (daftar, tabel) |
| Ikon | `lucide-react` | Gratis, gaya garis yang bersih |
| Backend | **FastAPI** + Uvicorn | Async, mendukung streaming, dokumentasi otomatis di `/docs` |
| Vector DB | Chroma | Lokal, berbasis file |
| Database metadata | **SQLite** (`sqlite3` bawaan Python) | Tanpa server; cukup untuk skala project |
| Embedding | `intfloat/multilingual-e5-small` | Lokal, bagus untuk bahasa Indonesia |
| LLM | Ollama (`qwen2.5:3b`) / Gemini free tier | Gratis |
| Auth admin | JWT (`PyJWT`) + password di-hash (`bcrypt`) | Sederhana |
| Deploy (opsional) | Frontend: Vercel/Netlify · Backend: Hugging Face Spaces (Docker) | Free tier |

## 3. Struktur Repo (target)

```
unri-ai/
├── backend/
│   ├── app/
│   │   ├── main.py            # inisialisasi FastAPI, CORS, router
│   │   ├── api/
│   │   │   ├── chat.py        # /api/chat
│   │   │   ├── documents.py   # /api/documents
│   │   │   ├── feedback.py    # /api/feedback
│   │   │   └── admin.py       # /api/admin/*
│   │   ├── core/              # config.py, security.py (JWT), rate_limit.py
│   │   ├── rag/               # store.py (embedding + Chroma), ingest.py, rag.py
│   │   └── db.py              # model SQLite
│   ├── data/                  # docs/, chroma/, app.db  (di-.gitignore kecuali contoh)
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/        # ChatBubble, SourceCard, Composer, Sidebar, ...
│   │   ├── pages/             # ChatPage, AdminLogin, AdminDocuments, AdminInsights
│   │   ├── lib/api.ts         # klien API + parser SSE
│   │   └── styles/            # tokens.css, pola songket SVG
│   ├── public/
│   └── package.json
├── eval/
├── spec/                    # prd.md, requirements.md, design.md
└── README.md
```

## 4. Kebutuhan Fungsional

### 4.1 Chat (mahasiswa, tanpa login)
| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-01 | Pengguna dapat mengirim pertanyaan teks, maksimal **1.000 karakter**. | M |
| FR-02 | Jawaban dikirim **bertahap (streaming)** melalui Server-Sent Events. | M |
| FR-03 | Setiap jawaban menyertakan **daftar sumber**: nama dokumen, nomor halaman, cuplikan ±200 karakter, dan skor relevansi. | M |
| FR-04 | Jika tidak ada chunk dengan skor ≥ `MIN_SCORE`, backend **tidak memanggil LLM** dan langsung mengembalikan pesan "tidak ditemukan" yang sudah baku. | M |
| FR-05 | Layar awal menampilkan **4–6 contoh pertanyaan** dari endpoint `/api/suggestions`. | M |
| FR-06 | Pertanyaan lanjutan memakai riwayat **maksimal 6 pesan terakhir** dari percakapan yang sama. | S |
| FR-07 | Riwayat percakapan disimpan di **`localStorage` browser** (tanpa akun) dan bisa dihapus pengguna. | S |
| FR-08 | Pengguna dapat memberi 👍/👎 beserta komentar opsional pada setiap jawaban. | S |
| FR-09 | Pengguna dapat **menghentikan** jawaban yang sedang di-stream (tombol "Berhenti"). | S |
| FR-10 | Tombol salin jawaban dan tombol "coba lagi" (regenerate). | S |
| FR-11 | Jika backend atau LLM error, tampilkan pesan yang ramah beserta tombol coba lagi; jangan tampilkan *stack trace*. | M |

### 4.2 Admin (login wajib)
| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-20 | Login dengan username dan password dari variabel lingkungan (`ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`); sesi memakai token JWT yang berlaku 8 jam. | M |
| FR-21 | Unggah dokumen **PDF/TXT/MD**, maksimal **20 MB per file**, bisa beberapa file sekaligus. | M |
| FR-22 | Dokumen yang diunggah diproses (ingest) **di latar belakang**; statusnya `queued → processing → ready / failed`. | S |
| FR-23 | Daftar dokumen: nama, ukuran, jumlah halaman, jumlah chunk, tanggal unggah, dan status. | M |
| FR-24 | Hapus dokumen, sekaligus menghapus semua chunk-nya dari Chroma. Ingest dilakukan **per dokumen**, tanpa mereset seluruh koleksi. | M |
| FR-25 | Peringatan jika PDF tidak mengandung teks (kemungkinan hasil scan). | S |
| FR-26 | Halaman *Insights*: daftar pertanyaan yang tidak terjawab dan yang diberi 👎, bisa difilter per tanggal. | S |
| FR-27 | Admin dapat mengatur contoh pertanyaan yang tampil di layar awal. | C |
| FR-28 | Tombol "Jalankan evaluasi" yang menjalankan `eval/evaluate.py` dan menampilkan hasilnya. | C |

## 5. Kontrak API

Base URL: `/api`. Semua respons berupa JSON kecuali `/api/chat`.

### `POST /api/chat`: kirim pertanyaan (SSE)
**Request**
```json
{
  "message": "Berapa SKS maksimal kalau IPS saya 3,2?",
  "history": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "conversation_id": "c_8f2a..."
}
```
**Response**: `Content-Type: text/event-stream`, urutan event:
```
event: sources
data: {"sources":[{"doc_id":"d_12","source":"pedoman_akademik_2025.pdf","page":14,"snippet":"Mahasiswa dengan IPS minimal 3,00...","score":0.86}]}

event: token
data: {"t":"Dengan IPS 3,2, "}

event: token
data: {"t":"kamu boleh mengambil maksimal 24 SKS "}

event: done
data: {"message_id":"m_77b1","found":true,"latency_ms":2310}
```
Jika tidak ditemukan: `sources` berisi daftar kosong, lalu satu event `token` berisi pesan baku, lalu `done` dengan `"found": false`.
Jika terjadi error: `event: error` dengan isi `{"code":"LLM_UNAVAILABLE","message":"Layanan AI sedang tidak tersedia."}`.

### `GET /api/suggestions`
```json
{"suggestions": ["Bagaimana cara mengisi KRS?", "Apa syarat seminar proposal?", "..."]}
```

### `POST /api/feedback`
```json
{"message_id": "m_77b1", "rating": 1, "comment": "opsional"}
```
`rating`: `1` (👍) atau `-1` (👎). Respons `201`.

### `GET /api/health`
```json
{"status": "ok", "llm_provider": "gemini", "documents": 12, "chunks": 418}
```

### Admin (header `Authorization: Bearer <token>`)
| Method | Endpoint | Fungsi |
|---|---|---|
| `POST` | `/api/admin/login` | `{username, password}` → `{access_token, expires_in}` |
| `GET` | `/api/admin/documents` | Daftar dokumen beserta statusnya |
| `POST` | `/api/admin/documents` | Unggah dokumen (`multipart/form-data`, field `files`) → `202` dengan daftar `doc_id` |
| `DELETE` | `/api/admin/documents/{doc_id}` | Hapus dokumen dan chunk-nya |
| `POST` | `/api/admin/documents/{doc_id}/reindex` | Proses ulang satu dokumen |
| `GET` | `/api/admin/insights?from=&to=` | Pertanyaan tak terjawab dan umpan balik negatif |
| `PUT` | `/api/admin/suggestions` | Ubah contoh pertanyaan |

### Format error (semua endpoint JSON)
```json
{"error": {"code": "FILE_TOO_LARGE", "message": "Ukuran file maksimal 20 MB."}}
```

## 6. Model Data (SQLite)

```
documents      (id PK, filename, size_bytes, pages, chunks, status, error, uploaded_at)
conversations  (id PK, created_at)                         -- id dibuat di browser
messages       (id PK, conversation_id, role, content, found BOOL, latency_ms, created_at)
message_sources(message_id, doc_id, page, score)
feedback       (id PK, message_id FK, rating, comment, created_at)
suggestions    (id PK, text, order)
```
Metadata chunk di Chroma ditambah `doc_id` supaya bisa dihapus per dokumen.

## 7. Kebutuhan Non-Fungsional

| ID | Kategori | Kebutuhan |
|---|---|---|
| NFR-01 | Performa | Waktu sampai token pertama < 3 detik (Gemini) atau < 8 detik (Ollama di CPU). Retrieval < 500 ms. |
| NFR-02 | Performa | *Bundle* JS frontend < 250 KB (gzip). Halaman chat bisa dipakai dalam < 2 detik di koneksi 4G. |
| NFR-03 | Responsif | Nyaman dipakai dari lebar **360 px** (HP) sampai desktop. |
| NFR-04 | Aksesibilitas | Mengikuti WCAG 2.1 AA: kontras teks ≥ 4,5:1, bisa dioperasikan dengan keyboard, label ARIA, dan menghormati `prefers-reduced-motion`. |
| NFR-05 | Keamanan | *Rate limit* 20 pertanyaan per menit per IP; CORS hanya untuk domain frontend; validasi tipe dan ukuran file; nama file disanitasi. |
| NFR-06 | Keamanan | Rahasia (API key, hash password admin, secret JWT) hanya di `.env` atau secrets hosting, **tidak pernah** di repo. |
| NFR-07 | Keandalan | Jika Gemini gagal (kuota habis atau timeout), otomatis *fallback* ke Ollama bila tersedia; jika tidak ada, kirim `event: error`. |
| NFR-08 | Privasi | Tidak mengumpulkan data pribadi. Log pertanyaan disimpan anonim (tanpa IP) dan otomatis dihapus setelah 90 hari. |
| NFR-09 | Keakuratan | LLM dijalankan dengan `temperature ≤ 0.2`; *system prompt* mewajibkan sitasi dan penolakan bila konteks tidak cukup. |
| NFR-10 | Biaya | Seluruh stack bisa berjalan dengan biaya **Rp0**. |
| NFR-11 | Bahasa | Seluruh antarmuka dan pesan error berbahasa Indonesia. |
| NFR-12 | Kualitas kode | Backend: `ruff` + `pytest` (cakupan ≥ 60% untuk modul RAG dan API). Frontend: ESLint + Prettier + TypeScript `strict`. |

## 8. Konfigurasi (`.env` backend)

```
LLM_PROVIDER=gemini            # gemini | ollama
LLM_FALLBACK=ollama            # opsional
GEMINI_API_KEY=
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:3b
EMBED_MODEL=intfloat/multilingual-e5-small
TOP_K=4
MIN_SCORE=0.75
MAX_UPLOAD_MB=20
RATE_LIMIT_PER_MIN=20
CORS_ORIGINS=http://localhost:5173
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=           # buat dengan: python -m app.core.security hash "passwordmu"
JWT_SECRET=                    # string acak panjang
```
Frontend: `VITE_API_URL=http://localhost:8000`.

## 9. Modul RAG yang Perlu Dibuat

1. **`store.py`**: embedding dengan model e5 (awalan `query:` / `passage:`), penyimpanan ke Chroma dengan `doc_id` di metadata setiap chunk, `search(query, k)`, dan `count()`.
2. **`ingest.py`**: `ingest_file(path, doc_id)` untuk membaca PDF/TXT/MD, membersihkan teks, memotong per paragraf dengan overlap, lalu menyimpan; serta `delete_doc(doc_id)`.
3. **`rag.py`**: `answer_stream(question, history)` yang menyaring hasil pencarian dengan `MIN_SCORE`, menyusun prompt beserta konteks, lalu menghasilkan token dari Ollama (`"stream": true`) atau Gemini (`:streamGenerateContent?alt=sse`).
4. **`eval/evaluate.py`**: menghitung akurasi retrieval dan jawaban dari `eval/questions.csv` (lihat target di `prd.md` §8).

## 10. Kriteria Penerimaan MVP

- [ ] `docker compose up` (atau dua perintah: backend dan frontend) menjalankan aplikasi lengkap secara lokal.
- [ ] Pertanyaan pada set uji mendapat jawaban streaming beserta sumber yang benar (memenuhi target di `prd.md` §8).
- [ ] Pertanyaan di luar dokumen mendapat pesan "tidak ditemukan" tanpa memanggil LLM.
- [ ] Admin bisa login, mengunggah PDF, melihat statusnya menjadi `ready`, lalu dokumen itu langsung bisa ditanyakan.
- [ ] Menghapus dokumen membuat isinya tidak lagi muncul di sumber.
- [ ] Lighthouse (mobile): Performance ≥ 85, Accessibility ≥ 90.
- [ ] Tidak ada rahasia di riwayat git.

## 11. Rencana Pengerjaan

| Minggu | Backend | Frontend |
|---|---|---|
| 1 | Struktur FastAPI, `/api/chat` streaming, `/api/health`, `/api/suggestions` | Setup Vite + Tailwind + token desain, layout chat, komponen bubble |
| 2 | SQLite, feedback, rate limit, refaktor ingest per dokumen | Parser SSE, kartu sumber, layar sambutan, state kosong dan error |
| 3 | Admin: login JWT, unggah, hapus, background ingest | Halaman admin: login, tabel dokumen, unggah *drag-and-drop* |
| 4 | Tes, Dockerfile, deploy | Riwayat chat, responsif, aksesibilitas, uji pengguna |
