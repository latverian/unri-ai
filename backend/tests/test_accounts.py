"""Tes fitur akun, riwayat server, edit/ulangi, mode Umum, lampiran, berbagi, dan admin pengguna."""
import uuid

from app.rag import llm
from tests.conftest import SAMPLE
from tests.test_api import parse_sse, upload, wait_ready


def new_user(client, **kw):
    email = f"mhs-{uuid.uuid4().hex[:8]}@contoh.ac.id"
    r = client.post("/api/auth/register", json={"name": "Rani", "email": email, "password": "rahasia-123", **kw})
    assert r.status_code == 201, r.text
    data = r.json()
    return email, {"Authorization": f"Bearer {data['access_token']}"}, data["user"]


def chat(client, headers, **body):
    r = client.post("/api/chat", headers=headers, json=body)
    assert r.status_code == 200, r.text
    return parse_sse(r.text)


def test_register_login_profile_password(client):
    email, h, user = new_user(client, fakultas="FMIPA")
    assert user["fakultas"] == "FMIPA"
    assert client.post("/api/auth/register", json={"name": "X", "email": email, "password": "rahasia-123"}).status_code == 409
    assert client.post("/api/auth/register", json={"name": "X", "email": "bukan-email", "password": "rahasia-123"}).status_code == 422
    assert client.post("/api/auth/register", json={"name": "X", "email": "a@b.co", "password": "pendek"}).status_code == 422
    assert client.post("/api/auth/login", json={"email": email.upper(), "password": "salah-sekali"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": email.upper(), "password": "rahasia-123"}).status_code == 200

    assert client.get("/api/me", headers=h).json()["user"]["email"] == email
    assert client.patch("/api/me", headers=h, json={"name": "Rani Putri"}).json()["user"]["name"] == "Rani Putri"

    r = client.post("/api/me/password", headers=h, json={"current_password": "rahasia-123", "new_password": "baru-12345"})
    assert r.status_code == 200
    assert client.get("/api/me", headers=h).status_code == 401  # sesi lama otomatis berakhir
    h2 = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert client.get("/api/me", headers=h2).status_code == 200


def test_admin_token_is_not_user_and_vice_versa(client, auth):
    _, h, _ = new_user(client)
    assert client.get("/api/me", headers=auth).status_code == 401
    assert client.get("/api/admin/documents", headers=h).status_code == 403


def test_conversation_persist_edit_share_delete(client, auth, fake_llm):
    doc_id = upload(client, auth, "pedoman-akun.md", SAMPLE.encode())
    wait_ready(client, auth, doc_id)
    _, h, _ = new_user(client)
    cid = f"c_{uuid.uuid4().hex[:10]}"

    done = chat(client, h, message="Berapa SKS maksimal kalau IPS saya 3,2?", conversation_id=cid)[-1][1]
    assert done["created"] and done["conversation_id"] == cid and done["title"]
    chat(client, h, message="Kalau IPS 2,7?", conversation_id=cid)

    convs = client.get("/api/conversations", headers=h).json()["conversations"]
    assert [c["id"] for c in convs] == [cid]
    msgs = client.get(f"/api/conversations/{cid}", headers=h).json()["messages"]
    assert [m["role"] for m in msgs] == ["user", "assistant", "user", "assistant"]
    assert msgs[1]["sources"] and msgs[1]["cited"] == [1]

    # Edit pertanyaan kedua: semua pesan mulai dari situ diganti
    chat(client, h, message="Kalau IPS 2,9?", conversation_id=cid, replace_from=msgs[2]["id"])
    msgs = client.get(f"/api/conversations/{cid}", headers=h).json()["messages"]
    assert len(msgs) == 4 and msgs[2]["content"] == "Kalau IPS 2,9?"

    # Orang lain tidak bisa membaca / menulis percakapan ini
    _, other, _ = new_user(client)
    assert client.get(f"/api/conversations/{cid}", headers=other).status_code == 404
    assert client.post("/api/chat", headers=other, json={"message": "halo", "conversation_id": cid}).status_code == 404

    # Ganti nama, sematkan, cari
    client.patch(f"/api/conversations/{cid}", headers=h, json={"title": "Soal SKS", "pinned": True})
    found = client.get("/api/conversations", headers=h, params={"q": "ips 2,9"}).json()["conversations"]
    assert found[0]["title"] == "Soal SKS" and found[0]["pinned"]

    # Bagikan (baca-saja, tanpa identitas) lalu cabut
    token = client.post(f"/api/conversations/{cid}/share", headers=h).json()["share_token"]
    shared = client.get(f"/api/shared/{token}").json()
    assert shared["title"] == "Soal SKS" and len(shared["messages"]) == 4 and "user_id" not in shared
    client.delete(f"/api/conversations/{cid}/share", headers=h)
    assert client.get(f"/api/shared/{token}").status_code == 404

    assert client.delete(f"/api/conversations/{cid}", headers=h).status_code == 200
    assert client.get("/api/conversations", headers=h).json()["conversations"] == []
    client.delete(f"/api/admin/documents/{doc_id}", headers=auth)


def test_guest_chat_is_not_persisted(client, fake_llm):
    done = chat(client, {}, message="Jam berapa kantin buka?", conversation_id="c_tamu")[-1][1]
    assert "conversation_id" not in done


def test_general_mode(client, monkeypatch):
    calls = []

    def fake(system, messages, **kw):
        calls.append(system)
        yield "IPK adalah rata-rata nilai seluruh semester."

    monkeypatch.setitem(llm.PROVIDERS, "ollama", fake)
    ev = chat(client, {}, message="Apa itu IPK secara umum?", mode="dokumen")
    assert ev[-1][1]["general"] is False and calls == []  # mode Dokumen: tidak memanggil LLM
    ev = chat(client, {}, message="Apa itu IPK secara umum?", mode="umum")
    names = [e for e, _ in ev]
    assert "mode" in names and ev[-1][1]["general"] is True and ev[-1][1]["found"] is False
    assert "pengetahuan umum" in calls[0]


def test_attachment_answers_from_file(client, monkeypatch):
    _, h, _ = new_user(client)
    r = client.post("/api/attachments", headers=h, files={"file": ("silabus.md", b"# Silabus\n\nUjian akhir berbobot 40 persen.", "text/markdown")})
    assert r.status_code == 201, r.text
    att = r.json()
    seen = []

    def fake(system, messages, **kw):
        seen.append(messages[-1]["content"])
        yield "Ujian akhir berbobot 40 persen [1]."

    monkeypatch.setitem(llm.PROVIDERS, "ollama", fake)
    ev = chat(client, h, message="Berapa bobot ujian akhir?", attachment_ids=[att["id"]])
    assert ev[0][1]["sources"][0]["attachment"] is True and ev[-1][1]["found"] is True
    assert "Lampiran: silabus.md" in seen[0]
    # Lampiran milik orang lain diabaikan
    _, other, _ = new_user(client)
    ev = chat(client, other, message="Berapa bobot ujian akhir?", attachment_ids=[att["id"]])
    assert not any(s["attachment"] for s in ev[0][1]["sources"])
    assert client.post("/api/attachments", files={"file": ("a.md", b"x", "text/markdown")}).status_code == 401


def test_forgot_reset_via_admin_link_and_disable(client, auth):
    email, h, user = new_user(client)
    assert client.post("/api/auth/forgot", json={"email": email}).json()["ok"] is True
    link = client.post(f"/api/admin/users/{user['id']}/reset-link", headers=auth).json()["link"]
    token = link.split("token=")[1]
    assert client.post("/api/auth/reset", json={"token": token, "password": "sandi-baru-1"}).status_code == 200
    assert client.post("/api/auth/reset", json={"token": token, "password": "sandi-baru-2"}).status_code == 400  # sekali pakai
    assert client.post("/api/auth/login", json={"email": email, "password": "sandi-baru-1"}).status_code == 200

    users = client.get("/api/admin/users", headers=auth, params={"q": email}).json()["users"]
    assert users[0]["email"] == email
    client.patch(f"/api/admin/users/{user['id']}", headers=auth, json={"disabled": True})
    assert client.post("/api/auth/login", json={"email": email, "password": "sandi-baru-1"}).status_code == 403


def test_import_and_delete_account(client):
    _, h, _ = new_user(client)
    r = client.post("/api/conversations/import", headers=h, json={"conversations": [
        {"title": "Lama", "messages": [{"role": "user", "content": "halo"}, {"role": "assistant", "content": "Halo!"}]},
        {"title": "Kosong", "messages": []}]})
    assert r.json()["imported"] == 1
    assert len(client.get("/api/conversations", headers=h).json()["conversations"]) == 1
    assert client.post("/api/me/delete", headers=h, json={"password": "salah"}).status_code == 400
    assert client.post("/api/me/delete", headers=h, json={"password": "rahasia-123"}).status_code == 200
    assert client.get("/api/me", headers=h).status_code == 401


def test_public_config_lists_models(client):
    cfg = client.get("/api/config").json()
    assert cfg["models"] and cfg["models"][0]["id"].startswith("ollama:")
    assert cfg["general_mode"] is True and cfg["registration"] is True


def test_login_is_rate_limited(client):
    codes = [client.post("/api/auth/login", json={"email": "x@y.zz", "password": "salah-salah"}).status_code
             for _ in range(12)]
    assert codes[:10] == [401] * 10 and codes[-1] == 429
