"""Baca dokumen -> bersihkan -> potong (chunk) -> simpan ke Chroma, per dokumen."""
import re
from pathlib import Path

from app.core import config
from app.rag import store


class IngestError(Exception):
    pass


def read_pages(path: Path) -> list[tuple[int, str]]:
    """[(nomor_halaman, teks)]. File teks dianggap satu 'halaman' bernomor 0."""
    if path.suffix.lower() == ".pdf":
        from pypdf import PdfReader
        try:
            reader = PdfReader(str(path))
            return [(i, p.extract_text() or "") for i, p in enumerate(reader.pages, start=1)]
        except Exception as e:  # PDF rusak / terenkripsi
            raise IngestError(f"PDF tidak bisa dibaca: {e}") from e
    return [(0, path.read_text(encoding="utf-8", errors="ignore"))]


def clean(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def chunk(text: str, size: int = config.CHUNK_SIZE, overlap: int = config.CHUNK_OVERLAP) -> list[str]:
    """Gabungkan paragraf sampai ~size karakter; chunk berikutnya diawali ekor chunk sebelumnya."""
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    buf = ""

    def tail(s: str) -> str:
        if not overlap or not s:
            return ""
        t = s[-overlap:]
        return t[t.find(" ") + 1:] if " " in t else t  # mulai di awal kata

    for p in paras:
        while len(p) > size:  # paragraf sangat panjang: potong paksa di batas kata
            if buf:
                chunks.append(buf)
                buf = ""
            cut = p.rfind(" ", 0, size)
            cut = cut if cut > size // 2 else size
            chunks.append(p[:cut].strip())
            p = (tail(p[:cut]) + " " + p[cut:].strip()).strip()
        if not buf:
            buf = p
        elif len(buf) + len(p) + 2 <= size:
            buf = f"{buf}\n\n{p}"
        else:
            chunks.append(buf)
            t = tail(buf)
            buf = f"{t}\n\n{p}" if t else p
    if buf:
        chunks.append(buf)
    return chunks


def ingest_file(path: Path, doc_id: str, source: str) -> dict:
    """Proses satu dokumen. Mengembalikan {"pages": n, "chunks": n}."""
    pages = read_pages(path)
    chunks = [(page, c) for page, raw in pages for c in chunk(clean(raw))]
    if not chunks:
        raise IngestError("Tidak ada teks yang bisa dibaca. Kemungkinan PDF hasil scan, perlu OCR dulu.")
    store.delete_doc(doc_id)  # aman untuk proses ulang
    store.add_chunks(doc_id, source, chunks)
    return {"pages": len(pages) if path.suffix.lower() == ".pdf" else 1, "chunks": len(chunks)}
