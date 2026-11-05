"""Keamanan: hash password (bcrypt) dan token JWT untuk admin & pengguna.

Buat hash password admin untuk .env:
    python -m app.core.security hash "passwordmu"
"""
import hashlib
import logging
import secrets
import sys
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core import config

log = logging.getLogger(__name__)

_secret = config.JWT_SECRET
if not _secret:
    _secret = secrets.token_urlsafe(48)
    log.warning("JWT_SECRET kosong: memakai secret acak, semua sesi hilang setiap server restart.")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode()[:72], hashed.encode())
    except ValueError:
        return False


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def create_token(sub: str, role: str = "admin", ver: int = 0) -> tuple[str, int]:
    seconds = config.JWT_HOURS * 3600 if role == "admin" else config.USER_JWT_DAYS * 86400
    payload = {"sub": sub, "role": role, "ver": ver, "exp": datetime.now(UTC) + timedelta(seconds=seconds)}
    return jwt.encode(payload, _secret, algorithm="HS256"), seconds


def _unauth(code: str, message: str) -> HTTPException:
    return HTTPException(401, detail={"code": code, "message": message})


def decode(token: str) -> dict:
    try:
        return jwt.decode(token, _secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise _unauth("TOKEN_EXPIRED", "Sesi berakhir, silakan masuk lagi.") from None
    except jwt.InvalidTokenError:
        raise _unauth("UNAUTHORIZED", "Token tidak valid.") from None


_bearer = HTTPBearer(auto_error=False)


def require_admin(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> str:
    if creds is None:
        raise _unauth("UNAUTHORIZED", "Silakan masuk sebagai admin.")
    payload = decode(creds.credentials)
    if payload.get("role") != "admin":
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Khusus admin."})
    return payload["sub"]


def _load_user(payload: dict) -> dict:
    from app import db  # hindari import melingkar
    if payload.get("role") != "user":
        raise _unauth("UNAUTHORIZED", "Silakan masuk dengan akun mahasiswa.")
    user = db.one("SELECT * FROM users WHERE id=?", (payload["sub"],))
    if not user or user["token_version"] != payload.get("ver"):
        raise _unauth("TOKEN_EXPIRED", "Sesi berakhir, silakan masuk lagi.")
    if user["disabled"]:
        raise HTTPException(403, detail={"code": "ACCOUNT_DISABLED", "message": "Akun ini dinonaktifkan admin."})
    return user


def require_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> dict:
    if creds is None:
        raise _unauth("UNAUTHORIZED", "Silakan masuk terlebih dahulu.")
    return _load_user(decode(creds.credentials))


def optional_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> dict | None:
    """Pengguna yang login, atau None untuk tamu. Token admin/kedaluwarsa diperlakukan sebagai tamu."""
    if creds is None:
        return None
    try:
        return _load_user(decode(creds.credentials))
    except HTTPException as e:
        if e.status_code == 403 and e.detail.get("code") == "ACCOUNT_DISABLED":
            raise
        return None


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "hash":
        print(hash_password(sys.argv[2]))
    else:
        print('Pemakaian: python -m app.core.security hash "passwordmu"')
