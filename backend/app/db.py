"""Database metadata (SQLite, tanpa server). Satu koneksi per operasi supaya aman di banyak thread."""
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta

from app.core import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY, filename TEXT NOT NULL, stored_path TEXT NOT NULL,
    size_bytes INTEGER NOT NULL, pages INTEGER, chunks INTEGER,
    status TEXT NOT NULL, error TEXT, uploaded_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY, conversation_id TEXT, question TEXT NOT NULL, answer TEXT NOT NULL,
    found INTEGER NOT NULL, latency_ms INTEGER, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS message_sources (
    message_id TEXT NOT NULL, doc_id TEXT, source TEXT, page INTEGER, score REAL
);
CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT, message_id TEXT NOT NULL,
    rating INTEGER NOT NULL, comment TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, position INTEGER NOT NULL
);
"""

DEFAULT_SUGGESTIONS = [
    "Berapa SKS maksimal kalau IPS saya 3,2?",
    "Apa saja syarat seminar proposal skripsi?",
    "Bagaimana alur pengajuan cuti akademik?",
    "Apa syarat predikat cum laude?",
    "Kapan batas akhir perubahan KRS?",
    "Bagaimana prosedur pengajuan keringanan UKT?",
]


def now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


@contextmanager
def conn():
    c = sqlite3.connect(config.DB_PATH, timeout=10)
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    finally:
        c.close()


def init() -> None:
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    with conn() as c:
        c.executescript(SCHEMA)
        if c.execute("SELECT COUNT(*) FROM suggestions").fetchone()[0] == 0:
            c.executemany("INSERT INTO suggestions(text, position) VALUES (?, ?)",
                          [(t, i) for i, t in enumerate(DEFAULT_SUGGESTIONS)])
        # Privasi: log pertanyaan dihapus otomatis setelah LOG_RETENTION_DAYS hari.
        cutoff = (datetime.now(UTC) - timedelta(days=config.LOG_RETENTION_DAYS)).isoformat()
        old = "SELECT id FROM messages WHERE created_at < ?"
        c.execute(f"DELETE FROM message_sources WHERE message_id IN ({old})", (cutoff,))
        c.execute(f"DELETE FROM feedback WHERE message_id IN ({old})", (cutoff,))
        c.execute("DELETE FROM messages WHERE created_at < ?", (cutoff,))
        # Dokumen yang terputus prosesnya (server mati) ditandai gagal agar bisa diproses ulang.
        c.execute("UPDATE documents SET status='failed', error='Proses terhenti, silakan proses ulang.' "
                  "WHERE status IN ('queued','processing')")


def rows(sql: str, params=()) -> list[dict]:
    with conn() as c:
        return [dict(r) for r in c.execute(sql, params).fetchall()]


def one(sql: str, params=()) -> dict | None:
    r = rows(sql, params)
    return r[0] if r else None


def execute(sql: str, params=()) -> None:
    with conn() as c:
        c.execute(sql, params)


def save_message(message_id, conversation_id, question, answer, found, latency_ms, sources) -> None:
    with conn() as c:
        c.execute("INSERT INTO messages VALUES (?,?,?,?,?,?,?)",
                  (message_id, conversation_id, question, answer, int(found), latency_ms, now()))
        c.executemany("INSERT INTO message_sources VALUES (?,?,?,?,?)",
                      [(message_id, s["doc_id"], s["source"], s["page"], s["score"]) for s in sources])
