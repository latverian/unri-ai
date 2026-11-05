"""Endpoint admin: login, kelola dokumen, insights, contoh pertanyaan."""
import logging
import re
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app import db
from app.core import config
from app.core.security import create_token, require_admin, verify_password
from app.rag import ingest, store

router = APIRouter(prefix="/admin")
log = logging.getLogger(__name__)


def err(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status, detail={"code": code, "message": message})


# ---------- Login ----------
class LoginIn(BaseModel):
    username: str = Field(max_length=100)
    password: str = Field(max_length=200)


@router.post("/login")
def login(body: LoginIn):
    if not config.ADMIN_PASSWORD_HASH:
        raise err(503, "ADMIN_DISABLED", "Login admin belum diatur (ADMIN_PASSWORD_HASH kosong di .env).")
    if body.username != config.ADMIN_USERNAME or not verify_password(body.password, config.ADMIN_PASSWORD_HASH):
        raise err(401, "INVALID_CREDENTIALS", "Nama pengguna atau kata sandi salah.")
    token, expires = create_token(body.username)
    return {"access_token": token, "expires_in": expires}


# ---------- Dokumen ----------
def safe_name(name: str) -> str:
    name = Path(name).name
    stem, ext = Path(name).stem, Path(name).suffix.lower()
    stem = re.sub(r"[^\w\-. ]+", "_", stem).strip(" .")[:120] or "dokumen"
    return f"{stem}{ext}"


def run_ingest(doc_id: str) -> None:
    doc = db.one("SELECT * FROM documents WHERE id=?", (doc_id,))
    if not doc:
        return
    db.execute("UPDATE documents SET status='processing', error=NULL WHERE id=?", (doc_id,))
    try:
        res = ingest.ingest_file(Path(doc["stored_path"]), doc_id, doc["filename"])
        db.execute("UPDATE documents SET status='ready', pages=?, chunks=? WHERE id=?",
                   (res["pages"], res["chunks"], doc_id))
    except ingest.IngestError as e:
        db.execute("UPDATE documents SET status='failed', chunks=0, error=? WHERE id=?", (str(e), doc_id))
    except Exception as e:
        log.exception("ingest gagal: %s", doc_id)
        db.execute("UPDATE documents SET status='failed', error=? WHERE id=?",
                   (f"Gagal memproses dokumen: {type(e).__name__}", doc_id))


def doc_out(d: dict) -> dict:
    return {k: d[k] for k in ("id", "filename", "size_bytes", "pages", "chunks", "status", "error", "uploaded_at")}


@router.get("/documents", dependencies=[Depends(require_admin)])
def list_documents():
    docs = db.rows("SELECT * FROM documents ORDER BY uploaded_at DESC")
    return {"documents": [doc_out(d) for d in docs]}


@router.post("/documents", status_code=202, dependencies=[Depends(require_admin)])
async def upload_documents(background: BackgroundTasks, files: list[UploadFile] = File(...)):
    max_bytes = config.MAX_UPLOAD_MB * 1024 * 1024
    # Validasi semua file dulu supaya tidak ada yang tersimpan setengah jalan.
    payloads = []
    for f in files:
        name = safe_name(f.filename or "")
        if Path(name).suffix.lower() not in config.ALLOWED_EXTENSIONS:
            raise err(400, "UNSUPPORTED_TYPE", f"{f.filename}: hanya PDF, TXT, atau MD yang didukung.")
        data = await f.read(max_bytes + 1)
        if len(data) > max_bytes:
            raise err(413, "FILE_TOO_LARGE", f"{f.filename}: ukuran file maksimal {config.MAX_UPLOAD_MB} MB.")
        if not data:
            raise err(400, "EMPTY_FILE", f"{f.filename}: file kosong.")
        if name.endswith(".pdf") and not data.startswith(b"%PDF"):
            raise err(400, "UNSUPPORTED_TYPE", f"{f.filename}: bukan file PDF yang valid.")
        payloads.append((name, data))

    config.DOCS_DIR.mkdir(parents=True, exist_ok=True)
    created = []
    for name, data in payloads:
        doc_id = db.new_id("d")
        path = config.DOCS_DIR / f"{doc_id}_{name}"
        path.write_bytes(data)
        db.execute("INSERT INTO documents(id, filename, stored_path, size_bytes, status, uploaded_at) "
                   "VALUES (?,?,?,?, 'queued', ?)", (doc_id, name, str(path), len(data), db.now()))
        background.add_task(run_ingest, doc_id)
        created.append(doc_id)
    return {"doc_ids": created}


@router.delete("/documents/{doc_id}", dependencies=[Depends(require_admin)])
def delete_document(doc_id: str):
    doc = db.one("SELECT * FROM documents WHERE id=?", (doc_id,))
    if not doc:
        raise err(404, "NOT_FOUND", "Dokumen tidak ditemukan.")
    store.delete_doc(doc_id)
    Path(doc["stored_path"]).unlink(missing_ok=True)
    db.execute("DELETE FROM documents WHERE id=?", (doc_id,))
    return {"ok": True}


@router.post("/documents/{doc_id}/reindex", status_code=202, dependencies=[Depends(require_admin)])
def reindex_document(doc_id: str, background: BackgroundTasks):
    if not db.one("SELECT id FROM documents WHERE id=?", (doc_id,)):
        raise err(404, "NOT_FOUND", "Dokumen tidak ditemukan.")
    db.execute("UPDATE documents SET status='queued', error=NULL WHERE id=?", (doc_id,))
    background.add_task(run_ingest, doc_id)
    return {"ok": True}


# ---------- Insights ----------
@router.get("/insights", dependencies=[Depends(require_admin)])
def insights(date_from: str | None = None, date_to: str | None = None):
    where, params = "1=1", []
    if date_from:
        where += " AND m.created_at >= ?"
        params.append(date_from)
    if date_to:
        where += " AND m.created_at < date(?, '+1 day')"
        params.append(date_to)
    stats = db.one(f"""SELECT COUNT(*) AS total, COALESCE(SUM(found),0) AS answered,
                       AVG(latency_ms) AS avg_latency FROM messages m WHERE {where}""", params)
    fb = db.one(f"""SELECT COALESCE(SUM(f.rating=1),0) AS up, COALESCE(SUM(f.rating=-1),0) AS down
                    FROM feedback f JOIN messages m ON m.id=f.message_id WHERE {where}""", params)
    unanswered = db.rows(f"""SELECT question, COUNT(*) AS count, MAX(created_at) AS last_asked
                             FROM messages m WHERE {where} AND found=0
                             GROUP BY lower(question) ORDER BY count DESC, last_asked DESC LIMIT 100""", params)
    negative = db.rows(f"""SELECT m.id AS message_id, m.question, m.answer, f.comment, f.created_at
                           FROM feedback f JOIN messages m ON m.id=f.message_id
                           WHERE {where} AND f.rating=-1 ORDER BY f.created_at DESC LIMIT 100""", params)
    return {"stats": {**stats, **fb}, "unanswered": unanswered, "negative": negative}


# ---------- Pengguna ----------
@router.get("/users", dependencies=[Depends(require_admin)])
def list_users(q: str | None = None):
    where, params = "", []
    if q and q.strip():
        where, params = "WHERE lower(u.email) LIKE ? OR lower(u.name) LIKE ?", [f"%{q.lower()}%"] * 2
    users = db.rows(f"""SELECT u.id, u.email, u.name, u.fakultas, u.disabled, u.created_at, u.last_login_at,
                        (SELECT COUNT(*) FROM conversations c WHERE c.user_id=u.id) AS conversations
                        FROM users u {where} ORDER BY u.created_at DESC LIMIT 500""", params)
    for u in users:
        u["disabled"] = bool(u["disabled"])
    return {"users": users, "total": db.one("SELECT COUNT(*) AS n FROM users")["n"]}


class UserPatch(BaseModel):
    disabled: bool


@router.patch("/users/{user_id}", dependencies=[Depends(require_admin)])
def update_user(user_id: str, body: UserPatch):
    if not db.one("SELECT id FROM users WHERE id=?", (user_id,)):
        raise err(404, "NOT_FOUND", "Pengguna tidak ditemukan.")
    # Menonaktifkan juga mengakhiri semua sesinya.
    db.execute("UPDATE users SET disabled=?, token_version=token_version+? WHERE id=?",
               (int(body.disabled), int(body.disabled), user_id))
    return {"ok": True}


@router.post("/users/{user_id}/reset-link", dependencies=[Depends(require_admin)])
def user_reset_link(user_id: str):
    from app.api.auth import RESET_HOURS, create_reset_link
    if not db.one("SELECT id FROM users WHERE id=?", (user_id,)):
        raise err(404, "NOT_FOUND", "Pengguna tidak ditemukan.")
    return {"link": create_reset_link(user_id), "expires_hours": RESET_HOURS}


@router.delete("/users/{user_id}", dependencies=[Depends(require_admin)])
def delete_user(user_id: str):
    from app.api.auth import delete_user_data
    if not db.one("SELECT id FROM users WHERE id=?", (user_id,)):
        raise err(404, "NOT_FOUND", "Pengguna tidak ditemukan.")
    delete_user_data(user_id)
    return {"ok": True}


# ---------- Contoh pertanyaan ----------
class SuggestionsIn(BaseModel):
    suggestions: list[str] = Field(min_length=1, max_length=12)


@router.put("/suggestions", dependencies=[Depends(require_admin)])
def update_suggestions(body: SuggestionsIn):
    items = [s.strip()[:200] for s in body.suggestions if s.strip()]
    if not items:
        raise err(400, "VALIDATION_ERROR", "Minimal satu contoh pertanyaan.")
    with db.conn() as c:
        c.execute("DELETE FROM suggestions")
        c.executemany("INSERT INTO suggestions(text, position) VALUES (?,?)", [(t, i) for i, t in enumerate(items)])
    return {"suggestions": items}
