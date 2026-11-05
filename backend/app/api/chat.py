"""POST /api/chat: jawaban streaming lewat Server-Sent Events."""
import json
import logging
import re
import time

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from app import db
from app.core import config
from app.core.rate_limit import check_rate_limit
from app.rag import llm, rag

router = APIRouter()
log = logging.getLogger(__name__)


class Turn(BaseModel):
    role: str
    content: str = Field(max_length=8000)


class ChatRequest(BaseModel):
    message: str
    history: list[Turn] = []
    conversation_id: str | None = Field(default=None, max_length=64)

    @field_validator("message")
    @classmethod
    def _msg(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Pertanyaan tidak boleh kosong.")
        if len(v) > config.MAX_MESSAGE_CHARS:
            raise ValueError(f"Pertanyaan maksimal {config.MAX_MESSAGE_CHARS} karakter.")
        return v


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def public_source(h: dict) -> dict:
    text = re.sub(r"(^|\n)\s*#{1,6}\s+", r"\1", h["text"])  # buang tanda judul Markdown
    text = re.sub(r"[*_`]{1,3}", "", text)
    snippet = " ".join(text.split())
    return {"doc_id": h["doc_id"], "source": h["source"], "page": h["page"],
            "snippet": snippet[:220] + ("…" if len(snippet) > 220 else ""), "score": h["score"]}


@router.post("/chat", dependencies=[Depends(check_rate_limit)])
def chat(req: ChatRequest):
    def events():
        t0 = time.monotonic()
        message_id = db.new_id("m")
        answer, found, sources = "", False, []
        try:
            hits = rag.retrieve(req.message)
            sources = [public_source(h) for h in hits]
            yield sse("sources", {"sources": sources})
            if not hits:
                # Tidak ada dokumen relevan: LLM tidak dipanggil sama sekali.
                answer = rag.NOT_FOUND
                yield sse("token", {"t": answer})
            else:
                found = True
                for tok in rag.answer_stream(req.message, [t.model_dump() for t in req.history], hits):
                    answer += tok
                    yield sse("token", {"t": tok})
        except llm.LLMError as e:
            log.warning("LLM error: %s", e)
            yield sse("error", {"code": "LLM_UNAVAILABLE", "message": "Layanan AI sedang tidak tersedia."})
            return
        except Exception:
            log.exception("chat gagal")
            yield sse("error", {"code": "INTERNAL", "message": "Terjadi kesalahan. Coba lagi sebentar ya."})
            return
        latency = int((time.monotonic() - t0) * 1000)
        try:
            db.save_message(message_id, req.conversation_id, req.message, answer, found, latency, sources)
        except Exception:
            log.exception("gagal menyimpan pesan")
        yield sse("done", {"message_id": message_id, "found": found, "latency_ms": latency})

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
