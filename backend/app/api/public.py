"""Endpoint publik: health, suggestions, feedback."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from app import db
from app.core import config, mailer
from app.rag import llm, store

router = APIRouter()


@router.get("/health")
def health():
    try:
        chunks = store.count()
    except Exception:
        chunks = None
    docs = db.one("SELECT COUNT(*) AS n FROM documents WHERE status='ready'")["n"]
    return {"status": "ok", "llm_provider": config.LLM_PROVIDER, "embed_provider": config.EMBED_PROVIDER,
            "documents": docs, "chunks": chunks}


@router.get("/config")
def public_config():
    """Fitur yang aktif, untuk menyesuaikan tampilan frontend."""
    return {"models": llm.available_models(), "general_mode": config.ALLOW_GENERAL_MODE,
            "registration": config.ALLOW_REGISTRATION, "email_reset": mailer.enabled(),
            "max_attachment_mb": config.MAX_ATTACHMENT_MB}


@router.get("/suggestions")
def suggestions():
    return {"suggestions": [r["text"] for r in db.rows("SELECT text FROM suggestions ORDER BY position")]}


class FeedbackIn(BaseModel):
    message_id: str = Field(max_length=64)
    rating: int
    comment: str | None = Field(default=None, max_length=1000)

    @field_validator("rating")
    @classmethod
    def _rating(cls, v):
        if v not in (1, -1):
            raise ValueError("rating harus 1 atau -1")
        return v


@router.post("/feedback", status_code=201)
def feedback(fb: FeedbackIn):
    if not db.one("SELECT id FROM messages WHERE id=?", (fb.message_id,)):
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Pesan tidak ditemukan."})
    # Satu penilaian per pesan: penilaian baru menggantikan yang lama.
    db.execute("DELETE FROM feedback WHERE message_id=?", (fb.message_id,))
    db.execute("INSERT INTO feedback(message_id, rating, comment, created_at) VALUES (?,?,?,?)",
               (fb.message_id, fb.rating, (fb.comment or "").strip() or None, db.now()))
    return {"ok": True}
