# 🎓 UNRI GPT

Asisten tanya-jawab akademik untuk mahasiswa Universitas Riau, berbasis **LLM + RAG (Retrieval-Augmented Generation)**. Asisten ini menjawab **hanya dari dokumen kampus** dan **selalu menyertakan sumbernya**. Jika informasinya tidak ada di dokumen, asisten akan mengatakannya dengan jujur dan tidak mengarang jawaban.

> 🚧 **Status: tahap perencanaan.** Belum ada kode. Spesifikasi lengkap ada di folder [`spec/`](spec/).

> ⚠️ Proyek mahasiswa, bukan layanan resmi Universitas Riau.

## Spesifikasi

| Dokumen | Isi |
|---|---|
| [`spec/prd.md`](spec/prd.md) | Latar belakang, tujuan, persona, user stories, rencana rilis, metrik keberhasilan, dan risiko |
| [`spec/requirements.md`](spec/requirements.md) | Arsitektur, teknologi, kebutuhan fungsional/non-fungsional, kontrak API, model data, dan rencana kerja |
| [`spec/design.md`](spec/design.md) | Sistem desain "Balai Ilmu": hijau UNRI dengan nuansa Melayu, tipografi, komponen, layout, dan microcopy |
| [`spec/stitch/`](spec/stitch/) | Desain 7 layar dari Stitch (screenshot + HTML) |

## Gambaran Singkat

**Fitur utama (MVP)**
- Chat dengan jawaban *streaming* dan sitasi sumber (nama dokumen dan halaman)
- Penolakan jujur untuk pertanyaan yang tidak ada di dokumen
- Contoh pertanyaan di layar awal
- Halaman admin untuk mengunggah dan menghapus dokumen
- Tampilan responsif untuk HP

**Rencana teknologi (semuanya gratis)**

| Lapisan | Teknologi |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| Backend | FastAPI (Python) |
| Embedding | `intfloat/multilingual-e5-small` (lokal) |
| Vector DB | Chroma |
| LLM | Ollama (`qwen2.5:3b`, lokal) atau Gemini free tier |
| Database | SQLite |

**Alur RAG**
```
Dokumen PDF/TXT/MD ──► potong (chunk) ──► embedding ──► Chroma
                                                          │
Pertanyaan ──► embedding ──► cari chunk termirip ◄────────┘
                                   │ (tidak relevan → "Maaf, tidak ditemukan")
                                   ▼
                     prompt + konteks ──► LLM ──► jawaban + [sumber, hal.]
```

## Struktur Repo (rencana)
```
unri-ai/
├── backend/     # FastAPI + pipeline RAG
├── frontend/    # React + Vite
├── eval/        # set pertanyaan uji + skrip evaluasi
├── spec/        # prd.md, requirements.md, design.md
└── README.md
```
