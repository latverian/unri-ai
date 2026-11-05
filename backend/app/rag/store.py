"""Embedding + vector database (Chroma)."""
import hashlib
import re
import threading
from functools import lru_cache

import chromadb
import requests

from app.core import config

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"


# ---------- Embedding ----------
class LocalEmbedder:
    """sentence-transformers. Model e5 butuh awalan 'query: ' / 'passage: '."""

    def __init__(self, model: str):
        from sentence_transformers import SentenceTransformer  # import berat, hanya saat dipakai
        self.model = SentenceTransformer(model)
        self.e5 = "e5" in model.lower()

    def _enc(self, texts, prefix):
        texts = [f"{prefix}: {t}" for t in texts] if self.e5 else list(texts)
        return self.model.encode(texts, normalize_embeddings=True).tolist()

    def passages(self, texts):
        return self._enc(texts, "passage")

    def query(self, text):
        return self._enc([text], "query")[0]


class GeminiEmbedder:
    def __init__(self, model: str):
        if not config.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY belum diisi untuk EMBED_PROVIDER=gemini")
        self.model = model

    def _embed(self, texts, task):
        out = []
        for i in range(0, len(texts), 100):  # batas batch API
            batch = texts[i:i + 100]
            r = requests.post(
                f"{GEMINI_BASE}/models/{self.model}:batchEmbedContents",
                headers={"x-goog-api-key": config.GEMINI_API_KEY}, timeout=120,
                json={"requests": [{"model": f"models/{self.model}", "taskType": task,
                                    "content": {"parts": [{"text": t}]}} for t in batch]})
            if not r.ok:
                from app.rag.llm import google_error
                raise RuntimeError(f"Embedding Gemini gagal: {google_error(requests.HTTPError(response=r))}")
            out += [e["values"] for e in r.json()["embeddings"]]
        return out

    def passages(self, texts):
        return self._embed(list(texts), "RETRIEVAL_DOCUMENT")

    def query(self, text):
        return self._embed([text], "RETRIEVAL_QUERY")[0]


class HashEmbedder:
    """Bag-of-words ter-hash. Tanpa model & tanpa internet, HANYA untuk tes otomatis."""

    dim = 512

    def _vec(self, text):
        v = [0.0] * self.dim
        for w in re.findall(r"\w+", text.lower()):
            v[int(hashlib.md5(w.encode()).hexdigest(), 16) % self.dim] += 1.0
        n = sum(x * x for x in v) ** 0.5 or 1.0
        return [x / n for x in v]

    def passages(self, texts):
        return [self._vec(t) for t in texts]

    def query(self, text):
        return self._vec(text)


_embed_lock = threading.Lock()


@lru_cache(maxsize=1)
def embedder():
    with _embed_lock:
        if config.EMBED_PROVIDER == "gemini":
            return GeminiEmbedder(config.GEMINI_EMBED_MODEL)
        if config.EMBED_PROVIDER == "hash":
            return HashEmbedder()
        return LocalEmbedder(config.EMBED_MODEL)


# ---------- Chroma ----------
@lru_cache(maxsize=1)
def _client():
    config.CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    return chromadb.PersistentClient(path=str(config.CHROMA_DIR))


def collection():
    return _client().get_or_create_collection(
        config.COLLECTION, metadata={"hnsw:space": "cosine"}, embedding_function=None)


def add_chunks(doc_id: str, source: str, chunks: list[tuple[int, str]]) -> None:
    """chunks = [(halaman, teks), ...]"""
    if not chunks:
        return
    texts = [t for _, t in chunks]
    collection().add(
        ids=[f"{doc_id}:{i}" for i in range(len(chunks))],
        documents=texts,
        embeddings=embedder().passages(texts),
        metadatas=[{"doc_id": doc_id, "source": source, "page": p} for p, _ in chunks])


def delete_doc(doc_id: str) -> None:
    collection().delete(where={"doc_id": doc_id})


def count() -> int:
    return collection().count()


def search(query: str, k: int | None = None) -> list[dict]:
    """Daftar chunk termirip: text, doc_id, source, page, score (0..1, makin besar makin mirip)."""
    col = collection()
    n = col.count()
    if n == 0:
        return []
    res = col.query(query_embeddings=[embedder().query(query)], n_results=min(k or config.TOP_K, n))
    return [
        {"text": doc, "doc_id": m["doc_id"], "source": m["source"], "page": m["page"], "score": round(1 - d, 4)}
        for doc, m, d in zip(res["documents"][0], res["metadatas"][0], res["distances"][0], strict=True)
    ]
