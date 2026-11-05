"""Rate limit sederhana di memori: N permintaan per menit per IP, per kelompok endpoint."""
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from app.core import config

_hits: dict[str, deque] = defaultdict(deque)
_lock = threading.Lock()


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")


def limiter(bucket: str, per_min: int | None = None, message: str = "Terlalu banyak permintaan. Tunggu sebentar ya."):
    def dep(request: Request) -> None:
        limit = per_min if per_min is not None else config.RATE_LIMIT_PER_MIN
        now = time.monotonic()
        key = f"{bucket}:{client_ip(request)}"
        with _lock:
            q = _hits[key]
            while q and now - q[0] > 60:
                q.popleft()
            if len(q) >= limit:
                raise HTTPException(429, detail={"code": "RATE_LIMITED", "message": message})
            q.append(now)
    return dep


check_rate_limit = limiter("chat", message="Terlalu banyak pertanyaan. Tunggu sebentar ya.")


def reset() -> None:
    with _lock:
        _hits.clear()
