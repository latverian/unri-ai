"""Inti RAG: cari dokumen relevan -> susun prompt -> tanya LLM.

Coba dari terminal:
    python rag.py "Berapa batas maksimal SKS per semester?"
    python rag.py --retrieval-only "syarat cuti akademik"   # tanpa LLM
"""
import sys

import requests

import config
from store import search

SYSTEM_PROMPT = """Kamu adalah UNRI GPT, asisten informasi akademik untuk mahasiswa Universitas Riau.
Aturan:
1. Jawab HANYA berdasarkan KONTEKS yang diberikan. Jangan mengarang aturan, angka, atau tanggal.
2. Jika jawabannya tidak ada di konteks, katakan: "Maaf, saya belum menemukan informasi itu di dokumen yang saya punya. Silakan cek ke bagian akademik/fakultas."
3. Selalu sebutkan sumber dalam format [nama_file, hal. X] di akhir kalimat yang relevan.
4. Jawab dalam bahasa Indonesia yang ringkas dan jelas.
5. Ini bukan layanan resmi kampus; untuk keputusan penting sarankan konfirmasi ke pihak terkait."""

NOT_FOUND = ("Maaf, saya belum menemukan informasi itu di dokumen yang saya punya. "
             "Silakan cek ke bagian akademik/fakultas.")


def format_source(h):
    return f"{h['source']}, hal. {h['page']}" if h["page"] else h["source"]


def build_prompt(question, hits):
    ctx = "\n\n".join(f"[{format_source(h)}]\n{h['text']}" for h in hits)
    return f"KONTEKS:\n{ctx}\n\nPERTANYAAN: {question}\n\nJAWABAN:"


def call_ollama(prompt, history):
    msgs = [{"role": "system", "content": SYSTEM_PROMPT}, *history, {"role": "user", "content": prompt}]
    r = requests.post(f"{config.OLLAMA_URL}/api/chat",
                      json={"model": config.OLLAMA_MODEL, "messages": msgs, "stream": False,
                            "options": {"temperature": 0.1}},
                      timeout=300)
    r.raise_for_status()
    return r.json()["message"]["content"]


def call_gemini(prompt, history):
    if not config.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY belum diisi di file .env")
    contents = [{"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
                for m in history]
    contents.append({"role": "user", "parts": [{"text": prompt}]})
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{config.GEMINI_MODEL}:generateContent"
    r = requests.post(url, params={"key": config.GEMINI_API_KEY}, timeout=120, json={
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.1},
    })
    r.raise_for_status()
    return r.json()["candidates"][0]["content"]["parts"][0]["text"]


PROVIDERS = {"ollama": call_ollama, "gemini": call_gemini}


def answer(question, history=None):
    """Kembalikan (jawaban, daftar_sumber). history = [{"role": "user"/"assistant", "content": ...}]"""
    hits = [h for h in search(question) if h["score"] >= config.MIN_SCORE]
    if not hits:  # tidak ada dokumen relevan -> jangan biarkan LLM mengarang
        return NOT_FOUND, []
    # history hanya berisi teks percakapan (tanpa konteks lama) supaya hemat token
    text = PROVIDERS[config.LLM_PROVIDER](build_prompt(question, hits), (history or [])[-6:])
    return text, hits


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)
    if args[0] == "--retrieval-only":
        for h in search(" ".join(args[1:])):
            print(f"\n--- {format_source(h)} (skor {h['score']:.3f}) ---\n{h['text'][:400]}")
    else:
        text, hits = answer(" ".join(args))
        print(text)
        if hits:
            print("\nSumber:", "; ".join(sorted({format_source(h) for h in hits})))
