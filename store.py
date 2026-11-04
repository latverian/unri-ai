"""Embedding + vector database (Chroma). Semuanya lokal dan gratis."""
from functools import lru_cache

import chromadb

import config


@lru_cache(maxsize=1)
def _model():
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(config.EMBED_MODEL)


# Model e5 butuh awalan "passage: " / "query: " supaya hasilnya optimal.
def embed_passages(texts):
    return _model().encode([f"passage: {t}" for t in texts], normalize_embeddings=True).tolist()


def embed_query(text):
    return _model().encode([f"query: {text}"], normalize_embeddings=True).tolist()[0]


@lru_cache(maxsize=1)
def _client():
    config.DB_DIR.mkdir(parents=True, exist_ok=True)
    return chromadb.PersistentClient(path=str(config.DB_DIR))


def get_collection():
    return _client().get_or_create_collection(config.COLLECTION, metadata={"hnsw:space": "cosine"})


def reset_collection():
    try:
        _client().delete_collection(config.COLLECTION)
    except Exception:
        pass


def search(query: str, k: int = config.TOP_K):
    """Kembalikan list of dict: text, source, page, score (0..1, makin besar makin mirip)."""
    res = get_collection().query(query_embeddings=[embed_query(query)], n_results=k)
    hits = []
    for doc, meta, dist in zip(res["documents"][0], res["metadatas"][0], res["distances"][0]):
        hits.append({"text": doc, "source": meta["source"], "page": meta["page"], "score": 1 - dist})
    return hits
