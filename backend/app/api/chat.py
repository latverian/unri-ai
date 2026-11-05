"""POST /api/chat: jawaban streaming lewat Server-Sent Events.

Tamu: percakapan hanya disimpan di browser. Pengguna login: percakapan disimpan di server
(bisa diedit/diulang lewat `replace_from`, tersinkron antarperangkat).
"""
import json
import logging
import re
import time
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from app import db
from app.api.attachments import load_for_user
from app.core import config
from app.core.rate_limit import check_rate_limit
from app.core.security import optional_user
from app.rag import llm, rag

router = APIRouter()
log = logging.getLogger(__name__)


class Turn(BaseModel):
    role: str
    content: str = Field(max_length=20000)


class ChatRequest(BaseModel):
    message: str
    history: list[Turn] = []
    conversation_id: str | None = Field(default=None, max_length=64)
    mode: Literal["dokumen", "umum"] = "dokumen"
    model: str | None = Field(default=None, max_length=120)
    attachment_ids: list[str] = Field(default=[], max_length=5)
    replace_from: str | None = Field(default=None, max_length=64)  # id pesan pertama yang diganti (edit/ulangi)

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
    return {"doc_id": h["doc_id"], "source": h["source"], "page": h["page"], "attachment": bool(h.get("attachment")),
            "snippet": snippet[:220] + ("…" if len(snippet) > 220 else ""), "score": h["score"]}


def title_from(text: str) -> str:
    t = " ".join(text.split())
    return t if len(t) <= 60 else t[:59] + "…"


def prepare_conversation(req: ChatRequest, user: dict | None) -> tuple[str | None, bool]:
    """Pastikan percakapan milik pengguna & terapkan edit/ulangi. Mengembalikan (conv_id, baru_dibuat)."""
    if not user or not req.conversation_id:
        return None, False
    conv = db.one("SELECT * FROM conversations WHERE id=?", (req.conversation_id,))
    if conv and conv["user_id"] != user["id"]:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Percakapan tidak ditemukan."})
    if not conv:
        now = db.now()
        db.execute("INSERT INTO conversations(id, user_id, title, created_at, updated_at) VALUES (?,?,?,?,?)",
                   (req.conversation_id, user["id"], title_from(req.message), now, now))
        return req.conversation_id, True
    if req.replace_from:
        row = db.one("SELECT seq FROM chat_messages WHERE id=? AND conversation_id=?",
                     (req.replace_from, req.conversation_id))
        if row:
            db.execute("DELETE FROM chat_messages WHERE conversation_id=? AND seq>=?",
                       (req.conversation_id, row["seq"]))
    return req.conversation_id, False


@router.post("/chat", dependencies=[Depends(check_rate_limit)])
def chat(req: ChatRequest, user: dict | None = Depends(optional_user)):
    conv_id, created = prepare_conversation(req, user)
    attachments = load_for_user(req.attachment_ids, user)
    att_meta = [{"id": a["id"], "filename": a["filename"]} for a in attachments]
    general_allowed = req.mode == "umum" and config.ALLOW_GENERAL_MODE
    user_msg_id, message_id = db.new_id("q"), db.new_id("m")
    state = {"answer": "", "found": False, "general": False, "sources": [], "saved": False}

    def persist(status: str, cited: list[int], latency: int) -> None:
        if state["saved"]:
            return
        state["saved"] = True
        try:
            used = [s for i, s in enumerate(state["sources"], start=1) if i in cited]
            db.save_message(message_id, conv_id, req.message, state["answer"], state["found"], latency,
                            [s for s in used if not s["attachment"]])
            if conv_id:
                now = db.now()
                with db.conn() as c:
                    c.execute("INSERT INTO chat_messages(id, conversation_id, role, content, attachments, created_at) "
                              "VALUES (?,?,?,?,?,?)",
                              (user_msg_id, conv_id, "user", req.message, json.dumps(att_meta), now))
                    c.execute("INSERT INTO chat_messages(id, conversation_id, role, content, sources, cited, found, "
                              "general, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
                              (message_id, conv_id, "assistant", state["answer"], json.dumps(state["sources"]),
                               json.dumps(cited), int(state["found"]), int(state["general"]), status, now))
                    c.execute("UPDATE conversations SET updated_at=? WHERE id=?", (now, conv_id))
        except Exception:
            log.exception("gagal menyimpan pesan")

    def events():
        t0 = time.monotonic()
        try:
            hits = (rag.attachment_hits(req.message, attachments) if attachments else []) + rag.retrieve(req.message)
            state["sources"] = [public_source(h) for h in hits]
            yield sse("sources", {"sources": state["sources"]})
            history = [t.model_dump() for t in req.history]
            if hits:
                state["found"] = True
                stream = rag.answer_stream(req.message, history, hits, req.model)
            elif general_allowed:
                state["general"] = True
                yield sse("mode", {"general": True})
                stream = rag.general_stream(req.message, history, req.model)
            else:
                # Tidak ada dokumen relevan & mode Dokumen: LLM tidak dipanggil sama sekali.
                stream = iter([rag.NOT_FOUND])
            for tok in stream:
                state["answer"] += tok
                yield sse("token", {"t": tok})
        except GeneratorExit:  # pengguna menekan "Berhenti" / koneksi putus: simpan jawaban sebagian
            persist("stopped", [], int((time.monotonic() - t0) * 1000))
            raise
        except llm.LLMError as e:
            log.warning("LLM error: %s", e)
            yield sse("error", {"code": "LLM_UNAVAILABLE", "message": "Layanan AI sedang tidak tersedia."})
            return
        except Exception:
            log.exception("chat gagal")
            yield sse("error", {"code": "INTERNAL", "message": "Terjadi kesalahan. Coba lagi sebentar ya."})
            return
        # Jawaban dianggap "ditemukan" hanya jika LLM benar-benar mengutip sumber [n].
        n = len(state["sources"])
        cited = sorted({int(x) for x in re.findall(r"\[(\d{1,2})\]", state["answer"]) if 1 <= int(x) <= n})
        if state["found"] and not cited:
            state["found"] = False
        latency = int((time.monotonic() - t0) * 1000)
        persist("done", cited, latency)
        done = {"message_id": message_id, "user_message_id": user_msg_id, "found": state["found"],
                "general": state["general"], "cited": cited, "latency_ms": latency}
        if conv_id:
            done.update(conversation_id=conv_id, created=created, title=title_from(req.message) if created else None)
        yield sse("done", done)

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
