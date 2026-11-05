"""Rate limit sederhana di memori: N permintaan per menit per IP."""
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


def check_rate_limit(request: Request) -> None:
    now = time.monotonic()
    ip = client_ip(request)
    with _lock:
        q = _hits[ip]
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= config.RATE_LIMIT_PER_MIN:
            raise HTTPException(429, detail={"code": "RATE_LIMITED",
                                             "message": "Terlalu banyak pertanyaan. Tunggu sebentar ya."})
        q.append(now)


def reset() -> None:
    with _lock:
        _hits.clear()
