"""Pemanggilan LLM secara streaming: Ollama (lokal) atau Gemini (free tier)."""
import json
from collections.abc import Iterator

import requests

from app.core import config

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"


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
    try:
        r = requests.post(
            f"{GEMINI_BASE}/models/{model or config.GEMINI_MODEL}:streamGenerateContent",
            params={"alt": "sse"}, headers={"x-goog-api-key": config.GEMINI_API_KEY},
            stream=True, timeout=(5, 120),
            json={"systemInstruction": {"parts": [{"text": system}]}, "contents": contents,
                  "generationConfig": {"temperature": config.LLM_TEMPERATURE}})
        r.raise_for_status()
    except requests.RequestException as e:
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


PROVIDERS = {"ollama": stream_ollama, "gemini": stream_gemini}
DEFAULT_MODEL = {"ollama": lambda: config.OLLAMA_MODEL, "gemini": lambda: config.GEMINI_MODEL}
LABELS = {"gemini": "Gemini", "ollama": "Lokal (Ollama)"}


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
