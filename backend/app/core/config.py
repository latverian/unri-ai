"""Pengaturan backend. Semua nilai dibaca dari environment / file .env."""
import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_DIR / ".env")


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


DATA_DIR = Path(_env("DATA_DIR", str(BACKEND_DIR / "data")))
DOCS_DIR = DATA_DIR / "docs"
CHROMA_DIR = DATA_DIR / "chroma"
DB_PATH = DATA_DIR / "app.db"
COLLECTION = _env("COLLECTION", "unri_docs")

# Embedding: local (sentence-transformers, gratis & offline) | gemini (free tier) | hash (hanya untuk tes)
EMBED_PROVIDER = _env("EMBED_PROVIDER", "local")
EMBED_MODEL = _env("EMBED_MODEL", "intfloat/multilingual-e5-small")
GEMINI_EMBED_MODEL = _env("GEMINI_EMBED_MODEL", "gemini-embedding-001")

CHUNK_SIZE = int(_env("CHUNK_SIZE", "800"))
CHUNK_OVERLAP = int(_env("CHUNK_OVERLAP", "150"))
TOP_K = int(_env("TOP_K", "4"))
MIN_SCORE = float(_env("MIN_SCORE", "0.75"))

# LLM: ollama | gemini. LLM_FALLBACK dipakai kalau provider utama gagal.
LLM_PROVIDER = _env("LLM_PROVIDER", "ollama")
LLM_FALLBACK = _env("LLM_FALLBACK", "")
LLM_TEMPERATURE = float(_env("LLM_TEMPERATURE", "0.1"))
LLM_READ_TIMEOUT = int(_env("LLM_READ_TIMEOUT", "60"))  # detik menunggu potongan jawaban berikutnya
OLLAMA_URL = _env("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = _env("OLLAMA_MODEL", "qwen2.5:3b")
GEMINI_API_KEY = _env("GEMINI_API_KEY")
GEMINI_MODEL = _env("GEMINI_MODEL", "gemini-3.8-flash")
# Router / layanan berformat OpenAI (OpenRouter, router lokal, LM Studio, Groq, dll.)
OPENAI_BASE_URL = _env("OPENAI_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
OPENAI_API_KEY = _env("OPENAI_API_KEY")
OPENAI_MODEL = _env("OPENAI_MODEL")

MAX_MESSAGE_CHARS = int(_env("MAX_MESSAGE_CHARS", "1000"))
MAX_HISTORY = int(_env("MAX_HISTORY", "6"))
MAX_UPLOAD_MB = int(_env("MAX_UPLOAD_MB", "20"))
RATE_LIMIT_PER_MIN = int(_env("RATE_LIMIT_PER_MIN", "20"))
LOG_RETENTION_DAYS = int(_env("LOG_RETENTION_DAYS", "90"))
CORS_ORIGINS = [o.strip() for o in _env("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

ADMIN_USERNAME = _env("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD_HASH = _env("ADMIN_PASSWORD_HASH")
JWT_SECRET = _env("JWT_SECRET")
JWT_HOURS = int(_env("JWT_HOURS", "8"))

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md"}

# --- Akun pengguna ---
ALLOW_REGISTRATION = _env("ALLOW_REGISTRATION", "true").lower() in ("1", "true", "yes")
USER_JWT_DAYS = int(_env("USER_JWT_DAYS", "30"))
APP_URL = _env("APP_URL", "http://localhost:5173").rstrip("/")  # untuk tautan reset password
SMTP_HOST = _env("SMTP_HOST")
SMTP_PORT = int(_env("SMTP_PORT", "587"))
SMTP_USER = _env("SMTP_USER")
SMTP_PASSWORD = _env("SMTP_PASSWORD")
SMTP_FROM = _env("SMTP_FROM") or SMTP_USER

# --- Chat ---
MAX_ATTACHMENT_MB = int(_env("MAX_ATTACHMENT_MB", "10"))
MAX_ATTACHMENT_CHARS = int(_env("MAX_ATTACHMENT_CHARS", "200000"))
ALLOW_GENERAL_MODE = _env("ALLOW_GENERAL_MODE", "true").lower() in ("1", "true", "yes")
# Daftar model yang bisa dipilih pengguna: "provider:model=Label, ...". Kosong = pakai LLM_PROVIDER.
LLM_MODELS = _env("LLM_MODELS")
