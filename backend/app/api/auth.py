"""Akun pengguna: daftar, masuk, profil, ganti/lupa password, hapus akun."""
import re
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from app import db
from app.core import config, mailer
from app.core.rate_limit import limiter
from app.core.security import create_token, hash_password, require_user, sha256, verify_password

router = APIRouter(prefix="/auth")
me_router = APIRouter(prefix="/me")
auth_limit = limiter("auth", 10, "Terlalu banyak percobaan. Tunggu satu menit ya.")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
RESET_HOURS = 1


def err(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status, detail={"code": code, "message": message})


def check_password(v: str) -> str:
    if len(v) < 8:
        raise ValueError("Kata sandi minimal 8 karakter.")
    if len(v) > 128:
        raise ValueError("Kata sandi maksimal 128 karakter.")
    return v


def public_user(u: dict) -> dict:
    return {"id": u["id"], "email": u["email"], "name": u["name"], "fakultas": u["fakultas"],
            "created_at": u["created_at"]}


def session(u: dict) -> dict:
    token, expires = create_token(u["id"], "user", u["token_version"])
    return {"access_token": token, "expires_in": expires, "user": public_user(u)}


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(max_length=200)
    password: str
    fakultas: str | None = Field(default=None, max_length=120)

    @field_validator("email")
    @classmethod
    def _email(cls, v):
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("Format email tidak valid.")
        return v

    @field_validator("password")
    @classmethod
    def _pw(cls, v):
        return check_password(v)


class LoginIn(BaseModel):
    email: str = Field(max_length=200)
    password: str = Field(max_length=128)


@router.post("/register", status_code=201, dependencies=[Depends(auth_limit)])
def register(body: RegisterIn):
    if not config.ALLOW_REGISTRATION:
        raise err(403, "REGISTRATION_CLOSED", "Pendaftaran akun sedang ditutup.")
    if db.one("SELECT id FROM users WHERE email=?", (body.email,)):
        raise err(409, "EMAIL_TAKEN", "Email ini sudah terdaftar. Silakan masuk.")
    uid = db.new_id("u")
    db.execute("INSERT INTO users(id, email, name, password_hash, fakultas, created_at, last_login_at) "
               "VALUES (?,?,?,?,?,?,?)",
               (uid, body.email, body.name.strip(), hash_password(body.password),
                (body.fakultas or "").strip() or None, db.now(), db.now()))
    return session(db.one("SELECT * FROM users WHERE id=?", (uid,)))


@router.post("/login", dependencies=[Depends(auth_limit)])
def login(body: LoginIn):
    u = db.one("SELECT * FROM users WHERE email=?", (body.email.strip().lower(),))
    if not u or not verify_password(body.password, u["password_hash"]):
        raise err(401, "INVALID_CREDENTIALS", "Email atau kata sandi salah.")
    if u["disabled"]:
        raise err(403, "ACCOUNT_DISABLED", "Akun ini dinonaktifkan admin.")
    db.execute("UPDATE users SET last_login_at=? WHERE id=?", (db.now(), u["id"]))
    return session(u)


# ---------- Lupa / reset password ----------
def create_reset_link(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    expires = (datetime.now(UTC) + timedelta(hours=RESET_HOURS)).isoformat()
    db.execute("INSERT INTO password_resets(token_hash, user_id, expires_at) VALUES (?,?,?)",
               (sha256(token), user_id, expires))
    return f"{config.APP_URL}/reset-password?token={token}"


class ForgotIn(BaseModel):
    email: str = Field(max_length=200)


@router.post("/forgot", dependencies=[Depends(auth_limit)])
def forgot(body: ForgotIn):
    u = db.one("SELECT * FROM users WHERE email=?", (body.email.strip().lower(),))
    if u and not u["disabled"] and mailer.enabled():
        link = create_reset_link(u["id"])
        mailer.send(u["email"], "Atur ulang kata sandi Balai Ilmu",
                    f"Halo {u['name']},\n\nBuka tautan berikut untuk membuat kata sandi baru "
                    f"(berlaku {RESET_HOURS} jam):\n{link}\n\nAbaikan email ini jika kamu tidak memintanya.")
    # Jawaban selalu sama supaya tidak membocorkan email mana yang terdaftar.
    return {"ok": True, "email_enabled": mailer.enabled()}


class ResetIn(BaseModel):
    token: str = Field(max_length=200)
    password: str

    @field_validator("password")
    @classmethod
    def _pw(cls, v):
        return check_password(v)


@router.post("/reset", dependencies=[Depends(auth_limit)])
def reset(body: ResetIn):
    r = db.one("SELECT * FROM password_resets WHERE token_hash=?", (sha256(body.token),))
    if not r or r["used"] or r["expires_at"] < datetime.now(UTC).isoformat():
        raise err(400, "INVALID_TOKEN", "Tautan reset tidak valid atau sudah kedaluwarsa.")
    db.execute("UPDATE password_resets SET used=1 WHERE token_hash=?", (r["token_hash"],))
    db.execute("UPDATE users SET password_hash=?, token_version=token_version+1 WHERE id=?",
               (hash_password(body.password), r["user_id"]))
    return session(db.one("SELECT * FROM users WHERE id=?", (r["user_id"],)))


# ---------- Profil (/api/me) ----------
@me_router.get("")
def me(user: dict = Depends(require_user)):
    return {"user": public_user(user)}


class ProfileIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    fakultas: str | None = Field(default=None, max_length=120)


@me_router.patch("")
def update_me(body: ProfileIn, user: dict = Depends(require_user)):
    name = body.name.strip() if body.name is not None else user["name"]
    fakultas = (body.fakultas or "").strip() or None if body.fakultas is not None else user["fakultas"]
    db.execute("UPDATE users SET name=?, fakultas=? WHERE id=?", (name, fakultas, user["id"]))
    return {"user": public_user(db.one("SELECT * FROM users WHERE id=?", (user["id"],)))}


class PasswordIn(BaseModel):
    current_password: str = Field(max_length=128)
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _pw(cls, v):
        return check_password(v)


@me_router.post("/password", dependencies=[Depends(auth_limit)])
def change_password(body: PasswordIn, user: dict = Depends(require_user)):
    if not verify_password(body.current_password, user["password_hash"]):
        raise err(400, "WRONG_PASSWORD", "Kata sandi saat ini salah.")
    db.execute("UPDATE users SET password_hash=?, token_version=token_version+1 WHERE id=?",
               (hash_password(body.new_password), user["id"]))
    # Sesi lain otomatis keluar; sesi ini mendapat token baru.
    return session(db.one("SELECT * FROM users WHERE id=?", (user["id"],)))


@me_router.post("/logout-all")
def logout_all(user: dict = Depends(require_user)):
    db.execute("UPDATE users SET token_version=token_version+1 WHERE id=?", (user["id"],))
    return {"ok": True}


class DeleteIn(BaseModel):
    password: str = Field(max_length=128)


@me_router.post("/delete")
def delete_me(body: DeleteIn, user: dict = Depends(require_user)):
    if not verify_password(body.password, user["password_hash"]):
        raise err(400, "WRONG_PASSWORD", "Kata sandi salah.")
    delete_user_data(user["id"])
    return {"ok": True}


def delete_user_data(user_id: str) -> None:
    with db.conn() as c:
        c.execute("DELETE FROM chat_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id=?)",
                  (user_id,))
        c.execute("DELETE FROM conversations WHERE user_id=?", (user_id,))
        c.execute("DELETE FROM attachments WHERE user_id=?", (user_id,))
        c.execute("DELETE FROM password_resets WHERE user_id=?", (user_id,))
        c.execute("DELETE FROM users WHERE id=?", (user_id,))
