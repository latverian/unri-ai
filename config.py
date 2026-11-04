"""Konfigurasi UNRI GPT. Semua nilai bisa diubah lewat file .env."""
import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

BASE_DIR = Path(__file__).parent
DOCS_DIR = Path(os.getenv("DOCS_DIR", BASE_DIR / "data" / "docs"))
DB_DIR = Path(os.getenv("DB_DIR", BASE_DIR / "data" / "chroma"))
COLLECTION = os.getenv("COLLECTION", "unri_docs")

# Embedding gratis & multilingual (bagus untuk bahasa Indonesia).
# "small" ringan untuk laptop; ganti ke intfloat/multilingual-e5-base kalau mau lebih akurat.
EMBED_MODEL = os.getenv("EMBED_MODEL", "intfloat/multilingual-e5-small")

CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", 800))       # karakter per potongan
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", 150))
TOP_K = int(os.getenv("TOP_K", 4))                   # jumlah potongan yang diambil
MIN_SCORE = float(os.getenv("MIN_SCORE", 0.75))      # di bawah ini dianggap tidak relevan

# LLM: "ollama" (lokal, gratis) atau "gemini" (free tier, butuh API key)
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
