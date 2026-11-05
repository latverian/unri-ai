"""Lampiran chat: pengguna melampirkan PDF/TXT/MD untuk ditanyakan di percakapan."""
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app import db
from app.core import config
from app.core.rate_limit import limiter
from app.core.security import require_user
from app.rag import ingest

router = APIRouter()


def err(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status, detail={"code": code, "message": message})


@router.post("/attachments", status_code=201, dependencies=[Depends(limiter("attach", 20))])
async def upload_attachment(file: UploadFile = File(...), user: dict = Depends(require_user)):
    name = Path(file.filename or "lampiran").name[:120]
    ext = Path(name).suffix.lower()
    if ext not in config.ALLOWED_EXTENSIONS:
        raise err(400, "UNSUPPORTED_TYPE", "Lampiran harus PDF, TXT, atau MD.")
    max_bytes = config.MAX_ATTACHMENT_MB * 1024 * 1024
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise err(413, "FILE_TOO_LARGE", f"Ukuran lampiran maksimal {config.MAX_ATTACHMENT_MB} MB.")
    if ext == ".pdf" and not data.startswith(b"%PDF"):
        raise err(400, "UNSUPPORTED_TYPE", "Bukan file PDF yang valid.")
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / f"lampiran{ext}"
        path.write_bytes(data)
        try:
            text = ingest.clean("\n\n".join(t for _, t in ingest.read_pages(path)))
        except ingest.IngestError as e:
            raise err(400, "UNREADABLE", str(e)) from e
    if not text:
        raise err(400, "UNREADABLE", "Teks lampiran tidak terbaca. Kemungkinan PDF hasil scan.")
    truncated = len(text) > config.MAX_ATTACHMENT_CHARS
    text = text[:config.MAX_ATTACHMENT_CHARS]
    aid = db.new_id("a")
    db.execute("INSERT INTO attachments(id, user_id, filename, size_bytes, text, created_at) VALUES (?,?,?,?,?,?)",
               (aid, user["id"], name, len(data), text, db.now()))
    return {"id": aid, "filename": name, "size_bytes": len(data), "chars": len(text), "truncated": truncated}


def load_for_user(ids: list[str], user: dict | None) -> list[dict]:
    if not ids or not user:
        return []
    marks = ",".join("?" * len(ids))
    return db.rows(f"SELECT id, filename, text FROM attachments WHERE user_id=? AND id IN ({marks})",
                   (user["id"], *ids))
