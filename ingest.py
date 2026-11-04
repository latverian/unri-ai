"""Baca dokumen di data/docs, potong jadi chunk, buat embedding, simpan ke Chroma.

Jalankan ulang setiap kali menambah/mengubah dokumen:
    python ingest.py
"""
import hashlib
import re
import sys
from pathlib import Path

import config
from store import get_collection, embed_passages, reset_collection


def read_pdf(path: Path):
    from pypdf import PdfReader
    reader = PdfReader(str(path))
    for i, page in enumerate(reader.pages, start=1):
        yield i, page.extract_text() or ""


def read_text(path: Path):
    yield None, path.read_text(encoding="utf-8", errors="ignore")


READERS = {".pdf": read_pdf, ".txt": read_text, ".md": read_text}


def clean(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def chunk(text: str, size: int, overlap: int):
    """Potong teks per paragraf, digabung sampai ~size karakter, dengan overlap."""
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks, buf = [], ""
    for p in paras:
        while len(p) > size:  # paragraf sangat panjang: potong paksa
            if buf:
                chunks.append(buf)
                buf = ""
            chunks.append(p[:size])
            p = p[size - overlap:]
        if len(buf) + len(p) + 2 <= size:
            buf = f"{buf}\n\n{p}" if buf else p
        else:
            if buf:
                chunks.append(buf)
            tail = buf[-overlap:] if buf and overlap else ""
            tail = tail[tail.find(" ") + 1:] if " " in tail else tail  # mulai di awal kata
            buf = f"{tail}\n\n{p}" if tail else p
    if buf:
        chunks.append(buf)
    return chunks


def main():
    files = sorted(f for f in config.DOCS_DIR.rglob("*") if f.suffix.lower() in READERS)
    if not files:
        print(f"Tidak ada dokumen di {config.DOCS_DIR}. Taruh file .pdf/.txt/.md di sana.")
        sys.exit(1)

    reset_collection()
    col = get_collection()
    total = 0
    for f in files:
        ids, docs, metas = [], [], []
        for page, raw in READERS[f.suffix.lower()](f):
            for j, c in enumerate(chunk(clean(raw), config.CHUNK_SIZE, config.CHUNK_OVERLAP)):
                uid = hashlib.md5(f"{f.name}|{page}|{j}|{c}".encode()).hexdigest()
                ids.append(uid)
                docs.append(c)
                metas.append({"source": f.name, "page": page or 0})
        if not docs:
            print(f"  ! {f.name}: tidak ada teks (PDF hasil scan? perlu OCR dulu)")
            continue
        col.add(ids=ids, documents=docs, metadatas=metas, embeddings=embed_passages(docs))
        total += len(docs)
        print(f"  + {f.name}: {len(docs)} chunk")
    print(f"Selesai. {total} chunk tersimpan di {config.DB_DIR}")


if __name__ == "__main__":
    main()
