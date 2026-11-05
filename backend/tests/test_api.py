import json
import time

from app.rag import ingest, llm
from tests.conftest import SAMPLE


def parse_sse(text: str) -> list[tuple[str, dict]]:
    out = []
    for block in text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        out.append((lines["event"], json.loads(lines["data"])))
    return out


def wait_ready(client, auth, doc_id, timeout=10):
    end = time.time() + timeout
    while time.time() < end:
        docs = {d["id"]: d for d in client.get("/api/admin/documents", headers=auth).json()["documents"]}
        if docs[doc_id]["status"] in ("ready", "failed"):
            return docs[doc_id]
        time.sleep(0.1)
    raise AssertionError("ingest tidak selesai")


def upload(client, auth, name, content, mime="text/markdown"):
    r = client.post("/api/admin/documents", headers=auth, files=[("files", (name, content, mime))])
    assert r.status_code == 202, r.text
    return r.json()["doc_ids"][0]


# ---------- publik ----------
def test_health_and_suggestions(client):
    assert client.get("/api/health").json()["status"] == "ok"
    s = client.get("/api/suggestions").json()["suggestions"]
    assert 4 <= len(s) <= 12


def test_chat_without_documents_says_not_found(client, fake_llm):
    events = parse_sse(client.post("/api/chat", json={"message": "Jam berapa kantin buka?"}).text)
    names = [e for e, _ in events]
    assert names[0] == "sources" and names[-1] == "done"
    assert events[-1][1]["found"] is False
    assert fake_llm == []  # LLM tidak dipanggil


def test_chat_validation(client):
    r = client.post("/api/chat", json={"message": "   "})
    assert r.status_code == 422 and r.json()["error"]["code"] == "VALIDATION_ERROR"
    r = client.post("/api/chat", json={"message": "a" * 1001})
    assert r.status_code == 422


# ---------- admin ----------
def test_admin_requires_login(client):
    assert client.get("/api/admin/documents").status_code == 401
    r = client.post("/api/admin/login", json={"username": "admin", "password": "salah"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_upload_rejects_bad_files(client, auth):
    r = client.post("/api/admin/documents", headers=auth, files=[("files", ("x.exe", b"MZ", "application/octet-stream"))])
    assert r.status_code == 400
    r = client.post("/api/admin/documents", headers=auth, files=[("files", ("palsu.pdf", b"bukan pdf", "application/pdf"))])
    assert r.status_code == 400


def test_full_flow_upload_chat_feedback_delete(client, auth, fake_llm):
    doc_id = upload(client, auth, "pedoman.md", SAMPLE.encode())
    doc = wait_ready(client, auth, doc_id)
    assert doc["status"] == "ready" and doc["chunks"] >= 1

    r = client.post("/api/chat", json={
        "message": "Berapa SKS maksimal kalau IPS saya 3,2?",
        "history": [{"role": "user", "content": "halo"}, {"role": "assistant", "content": "Halo!"}],
        "conversation_id": "c_test"})
    events = parse_sse(r.text)
    sources = events[0][1]["sources"]
    assert sources and sources[0]["source"] == "pedoman.md" and sources[0]["doc_id"] == doc_id
    text = "".join(d["t"] for e, d in events if e == "token")
    assert "24 SKS" in text
    done = events[-1][1]
    assert done["found"] is True
    # riwayat ikut terkirim ke LLM, pertanyaan terakhir berisi KONTEKS
    assert fake_llm[0][0]["content"] == "halo" and "KONTEKS" in fake_llm[0][-1]["content"]

    assert client.post("/api/feedback", json={"message_id": done["message_id"], "rating": -1,
                                              "comment": "kurang lengkap"}).status_code == 201
    assert client.post("/api/feedback", json={"message_id": "m_tidakada", "rating": 1}).status_code == 404

    ins = client.get("/api/admin/insights", headers=auth).json()
    assert ins["stats"]["total"] >= 2 and ins["stats"]["down"] == 1
    assert any(n["comment"] == "kurang lengkap" for n in ins["negative"])
    assert any("kantin" in u["question"] for u in ins["unanswered"])

    assert client.delete(f"/api/admin/documents/{doc_id}", headers=auth).status_code == 200
    events = parse_sse(client.post("/api/chat", json={"message": "Berapa SKS maksimal kalau IPS 3,2?"}).text)
    assert events[0][1]["sources"] == []


def test_scanned_pdf_like_file_fails_gracefully(client, auth):
    doc_id = upload(client, auth, "kosong.txt", b"   \n\n  ", "text/plain")
    doc = wait_ready(client, auth, doc_id)
    assert doc["status"] == "failed" and "OCR" in doc["error"]
    assert client.post(f"/api/admin/documents/{doc_id}/reindex", headers=auth).status_code == 202


def test_llm_error_event(client, auth, monkeypatch):
    doc_id = upload(client, auth, "pedoman2.md", SAMPLE.encode())
    wait_ready(client, auth, doc_id)

    def broken(system, messages, **kw):
        raise llm.LLMError("mati")
        yield  # pragma: no cover

    monkeypatch.setitem(llm.PROVIDERS, "ollama", broken)
    events = parse_sse(client.post("/api/chat", json={"message": "Berapa SKS maksimal IPS 3,2?"}).text)
    assert events[-1][0] == "error" and events[-1][1]["code"] == "LLM_UNAVAILABLE"
    client.delete(f"/api/admin/documents/{doc_id}", headers=auth)


def test_update_suggestions(client, auth):
    r = client.put("/api/admin/suggestions", headers=auth, json={"suggestions": ["A?", " ", "B?"]})
    assert r.json()["suggestions"] == ["A?", "B?"]
    assert client.get("/api/suggestions").json()["suggestions"] == ["A?", "B?"]


# ---------- unit ----------
def test_chunk_overlap_starts_at_word():
    text = "\n\n".join(f"Paragraf {i} " + "kata " * 60 for i in range(6))
    chunks = ingest.chunk(text, size=400, overlap=80)
    assert len(chunks) > 1 and all(len(c) <= 400 + 80 + 2 for c in chunks)
    assert all(not c[0].isspace() for c in chunks)


def test_fallback_provider(monkeypatch):
    from app.core import config

    def broken(system, messages, **kw):
        raise llm.LLMError("mati")
        yield  # pragma: no cover

    monkeypatch.setitem(llm.PROVIDERS, "ollama", broken)
    monkeypatch.setitem(llm.PROVIDERS, "gemini", lambda s, m, **kw: iter(["ok"]))
    monkeypatch.setattr(config, "LLM_FALLBACK", "gemini")
    assert "".join(llm.stream("sys", [])) == "ok"


def test_check_recommendation():
    from app.check import recommend
    assert recommend(None, None)[0] == "gemini"
    assert recommend(8, None)[0] == "gemini"
    assert recommend(16, None) == ("ollama", recommend(16, None)[1]) and "3b" in recommend(16, None)[1]
    assert "7b" in recommend(32, "Apple Silicon")[1]


def test_refusal_without_citation_is_not_found(client, auth, monkeypatch):
    doc_id = upload(client, auth, "pedoman3.md", SAMPLE.encode())
    wait_ready(client, auth, doc_id)
    monkeypatch.setitem(llm.PROVIDERS, "ollama", lambda s, m, **kw: iter(["Maaf, informasi UKT belum ada di dokumen."]))
    events = parse_sse(client.post("/api/chat", json={"message": "Berapa SKS maksimal kalau IPS saya 3,2?"}).text)
    done = events[-1][1]
    assert events[0][1]["sources"] and done["found"] is False and done["cited"] == []
    client.delete(f"/api/admin/documents/{doc_id}", headers=auth)


def test_gemini_retries_on_503(monkeypatch):
    import requests

    from app.core import config

    class Resp:
        def __init__(self, status):
            self.status_code, self.reason = status, "x"

        def raise_for_status(self):
            if self.status_code >= 400:
                raise requests.HTTPError(response=self)

        def json(self):
            return {"error": {"message": "high demand"}}

        def iter_lines(self, decode_unicode=False):
            return iter(['data: {"candidates":[{"content":{"parts":[{"text":"halo"}]}}]}'])

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    calls = []
    monkeypatch.setattr(config, "GEMINI_API_KEY", "x")
    monkeypatch.setattr(llm, "RETRY_DELAYS", (0, 0, 0))
    monkeypatch.setattr(requests, "post", lambda *a, **k: calls.append(1) or Resp(503 if len(calls) < 3 else 200))
    assert "".join(llm.stream_gemini("sys", [])) == "halo" and len(calls) == 3

    calls.clear()
    monkeypatch.setattr(requests, "post", lambda *a, **k: calls.append(1) or Resp(400))
    try:
        list(llm.stream_gemini("sys", []))
        raise AssertionError("harus gagal")
    except llm.LLMError as e:
        assert "high demand" in str(e) and len(calls) == 1  # 400 tidak dicoba ulang


def test_openai_compatible_router_stream(monkeypatch):
    import requests

    from app.core import config

    lines = [": keep-alive", 'data: {"choices":[{"delta":{"role":"assistant"}}]}',
             'data: {"choices":[{"delta":{"content":"24 "}}]}', 'data: {"choices":[{"delta":{"content":"SKS [1]."}}]}',
             "data: [DONE]"]
    seen = {}

    class Resp:
        status_code = 200

        def raise_for_status(self):
            pass

        def iter_lines(self, decode_unicode=False):
            return iter(lines)

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    def post(url, **kw):
        seen.update(url=url, **kw)
        return Resp()

    monkeypatch.setattr(config, "OPENAI_API_KEY", "kunci")
    monkeypatch.setattr(config, "LLM_MODELS", "openai:qwen/qwen3-32b:free=Qwen,gemini:gemini-3.8-flash=Gemini")
    monkeypatch.setattr(requests, "post", post)
    assert [m["id"] for m in llm.available_models()] == ["openai:qwen/qwen3-32b:free", "gemini:gemini-3.8-flash"]
    assert "".join(llm.stream("sys", [{"role": "user", "content": "halo"}], "openai:qwen/qwen3-32b:free")) == "24 SKS [1]."
    assert seen["url"].endswith("/chat/completions") and seen["json"]["model"] == "qwen/qwen3-32b:free"
    assert seen["headers"]["Authorization"] == "Bearer kunci" and seen["json"]["messages"][0]["role"] == "system"


def test_think_filter_strips_reasoning_across_chunks():
    f = llm.ThinkFilter()
    chunks = ["<thi", "nk>hitung dulu", " IPS...</th", "ink>\n\nDengan", " ", "IPS 3,2", "\n\n", "boleh 24 SKS [1].", " a < b"]
    out = "".join(f.feed(c) for c in chunks) + f.flush()
    assert out == "Dengan IPS 3,2\n\nboleh 24 SKS [1]. a < b"
    g = llm.ThinkFilter()  # tanpa blok think: spasi & baris baru utuh
    assert "".join(g.feed(c) for c in ["Halo", " ", "dunia", "\n\n", "- satu"]) + g.flush() == "Halo dunia\n\n- satu"


def test_gemini_retries_on_timeout(monkeypatch):
    import requests

    from app.core import config

    class Ok:
        status_code = 200

        def raise_for_status(self):
            pass

        def iter_lines(self, decode_unicode=False):
            return iter(['data: {"candidates":[{"content":{"parts":[{"text":"oke"}]}}]}'])

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    calls = []

    def post(*a, **k):
        calls.append(1)
        if len(calls) == 1:
            raise requests.ReadTimeout("Read timed out.")
        return Ok()

    monkeypatch.setattr(config, "GEMINI_API_KEY", "x")
    monkeypatch.setattr(llm, "RETRY_DELAYS", (0, 0, 0))
    monkeypatch.setattr(requests, "post", post)
    assert "".join(llm.stream_gemini("sys", [])) == "oke" and len(calls) == 2
