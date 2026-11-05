"""Pemanggilan LLM secara streaming: Ollama (lokal) atau Gemini (free tier)."""
import json
import time
from collections.abc import Iterator

import requests

from app.core import config

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"
GEMINI_RETRIES = 3
RETRY_STATUS = {429, 500, 503}
RETRY_DELAYS = (1.5, 3, 6)  # detik


class LLMError(Exception):
    pass


def google_error(e: requests.RequestException) -> str:
    """Ambil pesan error asli dari respons Google (mis. 'API key not valid')."""
    resp = getattr(e, "response", None)
    if resp is not None:
        try:
            return f"{resp.status_code} {resp.json()['error']['message']}"
        except Exception:
            return f"{resp.status_code} {resp.reason}"
    return str(e)


def stream_ollama(system: str, messages: list[dict], model: str | None = None) -> Iterator[str]:
    try:
        r = requests.post(f"{config.OLLAMA_URL}/api/chat", stream=True, timeout=(5, 300), json={
            "model": model or config.OLLAMA_MODEL, "stream": True,
            "messages": [{"role": "system", "content": system}, *messages],
            "options": {"temperature": config.LLM_TEMPERATURE},
        })
        r.raise_for_status()
    except requests.RequestException as e:
        raise LLMError(f"Ollama tidak dapat dihubungi: {e}") from e
    with r:
        for line in r.iter_lines():
            if not line:
                continue
            data = json.loads(line)
            if data.get("error"):
                raise LLMError(data["error"])
            if text := data.get("message", {}).get("content"):
                yield text
            if data.get("done"):
                break


def stream_gemini(system: str, messages: list[dict], model: str | None = None) -> Iterator[str]:
    if not config.GEMINI_API_KEY:
        raise LLMError("GEMINI_API_KEY belum diisi")
    contents = [{"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
                for m in messages]
    r = None
    for attempt in range(GEMINI_RETRIES + 1):
        try:
            r = requests.post(
                f"{GEMINI_BASE}/models/{model or config.GEMINI_MODEL}:streamGenerateContent",
                params={"alt": "sse"}, headers={"x-goog-api-key": config.GEMINI_API_KEY},
                stream=True, timeout=(5, 120),
                json={"systemInstruction": {"parts": [{"text": system}]}, "contents": contents,
                      "generationConfig": {"temperature": config.LLM_TEMPERATURE}})
            r.raise_for_status()
            break
        except requests.RequestException as e:
            status = getattr(getattr(e, "response", None), "status_code", None)
            # Server sibuk / kuota per menit: tunggu sebentar lalu coba lagi. Error lain langsung dilaporkan.
            if status in RETRY_STATUS and attempt < GEMINI_RETRIES:
                time.sleep(RETRY_DELAYS[attempt])
                continue
            raise LLMError(f"Gemini gagal: {google_error(e)}") from e
    with r:
        for line in r.iter_lines(decode_unicode=True):
            if not line or not line.startswith("data:"):
                continue
            data = json.loads(line[5:])
            for cand in data.get("candidates", []):
                for part in cand.get("content", {}).get("parts", []):
                    if text := part.get("text"):
                        yield text


def stream_openai(system: str, messages: list[dict], model: str | None = None) -> Iterator[str]:
    """API berformat OpenAI (/chat/completions): OpenRouter dan router sejenis yang menyediakan banyak model."""
    mdl = model or config.OPENAI_MODEL
    if not mdl:
        raise LLMError("OPENAI_MODEL belum diisi")
    headers = {"X-Title": "Balai Ilmu"}
    if config.OPENAI_API_KEY:
        headers["Authorization"] = f"Bearer {config.OPENAI_API_KEY}"
    r = None
    for attempt in range(GEMINI_RETRIES + 1):
        try:
            r = requests.post(f"{config.OPENAI_BASE_URL}/chat/completions", headers=headers, stream=True,
                              timeout=(5, 180), json={
                                  "model": mdl, "stream": True, "temperature": config.LLM_TEMPERATURE,
                                  "messages": [{"role": "system", "content": system}, *messages]})
            r.raise_for_status()
            break
        except requests.RequestException as e:
            status = getattr(getattr(e, "response", None), "status_code", None)
            if status in RETRY_STATUS and attempt < GEMINI_RETRIES:
                time.sleep(RETRY_DELAYS[attempt])
                continue
            raise LLMError(f"Router ({config.OPENAI_BASE_URL}) gagal: {google_error(e)}") from e
    think = ThinkFilter()
    with r:
        for line in r.iter_lines(decode_unicode=True):
            if not line or not line.startswith("data:"):
                continue  # baris kosong / komentar keep-alive
            payload = line[5:].strip()
            if payload == "[DONE]":
                break
            data = json.loads(payload)
            if data.get("error"):
                raise LLMError(str(data["error"].get("message", data["error"])))
            for choice in data.get("choices", []):
                # delta.reasoning / reasoning_content (proses berpikir model) sengaja diabaikan.
                if text := think.feed((choice.get("delta") or {}).get("content") or ""):
                    yield text
        if rest := think.flush():
            yield rest


class ThinkFilter:
    """Buang blok <think>…</think> yang diselipkan sebagian model reasoning di dalam jawaban (aman lintas potongan)."""

    OPEN, CLOSE = "<think>", "</think>"

    def __init__(self):
        self.buf, self.inside, self.started = "", False, False

    def feed(self, text: str) -> str:
        self.buf += text
        out = []
        while self.buf:
            tag = self.CLOSE if self.inside else self.OPEN
            i = self.buf.find(tag)
            if i >= 0:
                if not self.inside:
                    out.append(self.buf[:i])
                self.buf, self.inside = self.buf[i + len(tag):], not self.inside
                continue
            # Sisakan ekor yang mungkin awal sebuah tag yang terpotong.
            keep = next((k for k in range(min(len(tag) - 1, len(self.buf)), 0, -1) if tag.startswith(self.buf[-k:])), 0)
            if not self.inside:
                out.append(self.buf[:len(self.buf) - keep])
            self.buf = self.buf[len(self.buf) - keep:]
            break
        return self._emit("".join(out))

    def _emit(self, text: str) -> str:
        if not self.started:  # baris kosong sisa blok <think> di awal jawaban dibuang
            text = text.lstrip()
            self.started = bool(text)
        return text

    def flush(self) -> str:
        rest, self.buf = ("" if self.inside else self.buf), ""
        return self._emit(rest)


PROVIDERS = {"ollama": stream_ollama, "gemini": stream_gemini, "openai": stream_openai}
DEFAULT_MODEL = {"ollama": lambda: config.OLLAMA_MODEL, "gemini": lambda: config.GEMINI_MODEL,
                 "openai": lambda: config.OPENAI_MODEL}
LABELS = {"gemini": "Gemini", "ollama": "Lokal (Ollama)", "openai": "Router"}


def available_models() -> list[dict]:
    """Model yang bisa dipilih pengguna, dari LLM_MODELS ("provider:model=Label, ...")."""
    out = []
    for item in [x.strip() for x in config.LLM_MODELS.split(",") if x.strip()]:
        spec, _, label = item.partition("=")
        provider, _, model = spec.strip().partition(":")
        if provider in PROVIDERS and model:
            out.append({"id": f"{provider}:{model}", "provider": provider, "model": model,
                        "label": label.strip() or model})
    if not out:
        p = config.LLM_PROVIDER
        m = DEFAULT_MODEL.get(p, lambda: "")()
        out.append({"id": f"{p}:{m}", "provider": p, "model": m, "label": f"{LABELS.get(p, p)} · {m}"})
    return out


def resolve(model_id: str | None) -> tuple[str, str | None]:
    """(provider, model). Model tak dikenal => model default."""
    models = available_models()
    chosen = next((m for m in models if m["id"] == model_id), models[0])
    return chosen["provider"], chosen["model"]


def stream(system: str, messages: list[dict], model_id: str | None = None) -> Iterator[str]:
    """Coba model pilihan; kalau gagal SEBELUM token pertama, pindah ke LLM_FALLBACK (model default-nya)."""
    provider, model = resolve(model_id)
    order: list[tuple[str, str | None]] = [(provider, model)]
    if config.LLM_FALLBACK and config.LLM_FALLBACK != provider:
        order.append((config.LLM_FALLBACK, None))
    last: Exception | None = None
    for name, mdl in order:
        fn = PROVIDERS.get(name)
        if fn is None:
            last = LLMError(f"LLM_PROVIDER tidak dikenal: {name}")
            continue
        started = False
        try:
            for tok in fn(system, messages, model=mdl):
                started = True
                yield tok
            return
        except LLMError as e:
            if started:
                raise
            last = e
    raise last or LLMError("Tidak ada LLM yang tersedia")
