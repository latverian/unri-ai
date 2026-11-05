import os
import shutil
import tempfile

import pytest

# Harus diatur SEBELUM modul app diimpor (config dibaca saat import).
_tmp = tempfile.mkdtemp(prefix="unri-test-")
os.environ.update({
    "DATA_DIR": _tmp, "EMBED_PROVIDER": "hash", "MIN_SCORE": "0.2", "LLM_PROVIDER": "ollama",
    "LLM_FALLBACK": "", "ADMIN_USERNAME": "admin", "JWT_SECRET": "test-secret-yang-cukup-panjang-untuk-hs256", "RATE_LIMIT_PER_MIN": "1000",
})
import bcrypt  # noqa: E402

os.environ["ADMIN_PASSWORD_HASH"] = bcrypt.hashpw(b"rahasia123", bcrypt.gensalt(4)).decode()

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.rag import llm  # noqa: E402

SAMPLE = """# Pedoman Akademik (contoh untuk tes)

## Beban Studi
Mahasiswa dengan IPS minimal 3,00 boleh mengambil maksimal 24 SKS. Mahasiswa dengan IPS 2,50 sampai 2,99 boleh mengambil maksimal 21 SKS.

## Cuti Akademik
Mahasiswa dapat mengajukan cuti akademik paling lama dua semester selama masa studi.
"""


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c
    shutil.rmtree(_tmp, ignore_errors=True)


@pytest.fixture
def fake_llm(monkeypatch):
    calls = []

    def fake(system, messages):
        calls.append(messages)
        yield "Dengan IPS 3,2 kamu boleh mengambil "
        yield "maksimal 24 SKS [1]."

    monkeypatch.setitem(llm.PROVIDERS, "ollama", fake)
    return calls


@pytest.fixture(scope="session")
def token(client):
    r = client.post("/api/admin/login", json={"username": "admin", "password": "rahasia123"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def auth(token):
    return {"Authorization": f"Bearer {token}"}
