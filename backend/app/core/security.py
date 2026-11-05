"""Login admin: hash password (bcrypt) dan token JWT.

Buat hash password untuk .env:
    python -m app.core.security hash "passwordmu"
"""
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
    log.warning("JWT_SECRET kosong: memakai secret acak, sesi admin hilang setiap server restart.")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def create_token(username: str) -> tuple[str, int]:
    expires = config.JWT_HOURS * 3600
    payload = {"sub": username, "exp": datetime.now(UTC) + timedelta(seconds=expires)}
    return jwt.encode(payload, _secret, algorithm="HS256"), expires


_bearer = HTTPBearer(auto_error=False)


def require_admin(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> str:
    if creds is None:
        raise HTTPException(401, detail={"code": "UNAUTHORIZED", "message": "Silakan masuk sebagai admin."})
    try:
        payload = jwt.decode(creds.credentials, _secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        detail = {"code": "TOKEN_EXPIRED", "message": "Sesi berakhir, silakan masuk lagi."}
        raise HTTPException(401, detail=detail) from None
    except jwt.InvalidTokenError:
        raise HTTPException(401, detail={"code": "UNAUTHORIZED", "message": "Token tidak valid."}) from None
    return payload["sub"]


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "hash":
        print(hash_password(sys.argv[2]))
    else:
        print('Pemakaian: python -m app.core.security hash "passwordmu"')
