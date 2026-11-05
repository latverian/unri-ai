"""Riwayat percakapan milik akun: daftar, cari, ganti nama, sematkan, hapus, bagikan, impor."""
import json
import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app import db
from app.core.security import require_user

router = APIRouter()


def err(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status, detail={"code": code, "message": message})


def conv_out(c: dict) -> dict:
    return {"id": c["id"], "title": c["title"], "pinned": bool(c["pinned"]), "shared": bool(c["share_token"]),
            "share_token": c["share_token"], "created_at": c["created_at"], "updated_at": c["updated_at"]}


def msg_out(m: dict) -> dict:
    return {"id": m["id"], "role": m["role"], "content": m["content"],
            "sources": json.loads(m["sources"]) if m["sources"] else [],
            "cited": json.loads(m["cited"]) if m["cited"] else None,
            "found": None if m["found"] is None else bool(m["found"]),
            "general": bool(m["general"]), "status": m["status"] or "done",
            "attachments": json.loads(m["attachments"]) if m["attachments"] else [],
            "created_at": m["created_at"]}


def owned(conv_id: str, user: dict) -> dict:
    c = db.one("SELECT * FROM conversations WHERE id=? AND user_id=?", (conv_id, user["id"]))
    if not c:
        raise err(404, "NOT_FOUND", "Percakapan tidak ditemukan.")
    return c


def messages_of(conv_id: str) -> list[dict]:
    return [msg_out(m) for m in db.rows("SELECT * FROM chat_messages WHERE conversation_id=? ORDER BY seq", (conv_id,))]


@router.get("/conversations")
def list_conversations(q: str | None = None, user: dict = Depends(require_user)):
    if q and q.strip():
        like = f"%{q.strip().lower()}%"
        rows = db.rows("""SELECT DISTINCT c.* FROM conversations c
                          LEFT JOIN chat_messages m ON m.conversation_id = c.id
                          WHERE c.user_id=? AND (lower(c.title) LIKE ? OR lower(m.content) LIKE ?)
                          ORDER BY c.pinned DESC, c.updated_at DESC LIMIT 200""", (user["id"], like, like))
    else:
        rows = db.rows("SELECT * FROM conversations WHERE user_id=? ORDER BY pinned DESC, updated_at DESC LIMIT 500",
                       (user["id"],))
    return {"conversations": [conv_out(c) for c in rows]}


@router.get("/conversations/{conv_id}")
def get_conversation(conv_id: str, user: dict = Depends(require_user)):
    c = owned(conv_id, user)
    return {"conversation": conv_out(c), "messages": messages_of(conv_id)}


class ConvPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    pinned: bool | None = None


@router.patch("/conversations/{conv_id}")
def update_conversation(conv_id: str, body: ConvPatch, user: dict = Depends(require_user)):
    c = owned(conv_id, user)
    title = body.title.strip() if body.title else c["title"]
    pinned = int(body.pinned) if body.pinned is not None else c["pinned"]
    db.execute("UPDATE conversations SET title=?, pinned=? WHERE id=?", (title, pinned, conv_id))
    return {"conversation": conv_out(owned(conv_id, user))}


@router.delete("/conversations/{conv_id}")
def delete_conversation(conv_id: str, user: dict = Depends(require_user)):
    owned(conv_id, user)
    with db.conn() as c:
        c.execute("DELETE FROM chat_messages WHERE conversation_id=?", (conv_id,))
        c.execute("DELETE FROM conversations WHERE id=?", (conv_id,))
    return {"ok": True}


@router.delete("/conversations")
def delete_all(user: dict = Depends(require_user)):
    with db.conn() as c:
        c.execute("DELETE FROM chat_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id=?)",
                  (user["id"],))
        c.execute("DELETE FROM conversations WHERE user_id=?", (user["id"],))
    return {"ok": True}


@router.post("/conversations/{conv_id}/share")
def share(conv_id: str, user: dict = Depends(require_user)):
    c = owned(conv_id, user)
    token = c["share_token"] or secrets.token_urlsafe(12)
    db.execute("UPDATE conversations SET share_token=? WHERE id=?", (token, conv_id))
    return {"share_token": token}


@router.delete("/conversations/{conv_id}/share")
def unshare(conv_id: str, user: dict = Depends(require_user)):
    owned(conv_id, user)
    db.execute("UPDATE conversations SET share_token=NULL WHERE id=?", (conv_id,))
    return {"ok": True}


@router.get("/shared/{token}")
def shared(token: str):
    """Tampilan baca-saja untuk tautan yang dibagikan. Tidak memuat identitas pemilik."""
    c = db.one("SELECT * FROM conversations WHERE share_token=?", (token,))
    if not c:
        raise err(404, "NOT_FOUND", "Tautan tidak ditemukan atau sudah tidak dibagikan.")
    keys = ("role", "content", "sources", "cited", "found", "general")
    msgs = [{k: m[k] for k in keys} for m in messages_of(c["id"])]
    return {"title": c["title"], "updated_at": c["updated_at"], "messages": msgs}


# ---------- Impor riwayat lama dari browser ----------
class ImportMsg(BaseModel):
    role: str
    content: str = Field(max_length=20000)
    sources: list[dict] = []
    cited: list[int] | None = None
    found: bool | None = None


class ImportConv(BaseModel):
    title: str = Field(max_length=120)
    created_at: int | None = None
    messages: list[ImportMsg] = Field(max_length=400)


class ImportIn(BaseModel):
    conversations: list[ImportConv] = Field(max_length=100)


@router.post("/conversations/import")
def import_conversations(body: ImportIn, user: dict = Depends(require_user)):
    n = 0
    with db.conn() as c:
        for conv in body.conversations:
            msgs = [m for m in conv.messages if m.role in ("user", "assistant") and m.content.strip()]
            if not msgs:
                continue
            cid, now = db.new_id("c"), db.now()
            c.execute("INSERT INTO conversations(id, user_id, title, created_at, updated_at) VALUES (?,?,?,?,?)",
                      (cid, user["id"], conv.title.strip() or "Percakapan", now, now))
            for m in msgs:
                c.execute("INSERT INTO chat_messages(id, conversation_id, role, content, sources, cited, found, "
                          "created_at) VALUES (?,?,?,?,?,?,?,?)",
                          (db.new_id("m" if m.role == "assistant" else "q"), cid, m.role, m.content,
                           json.dumps(m.sources[:10]), json.dumps(m.cited) if m.cited is not None else None,
                           None if m.found is None else int(m.found), now))
            n += 1
    return {"imported": n}
