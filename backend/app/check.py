"""Pemeriksa kesiapan LLM & embedding.

    python -m app.check          # cek laptop, koneksi LLM, embedding, lalu uji tanya-jawab singkat
    python -m app.check --pull   # sekalian unduh model Ollama yang disarankan jika belum ada
"""
import ctypes
import os
import platform
import shutil
import subprocess
import sys
import time

import requests

from app.core import config
from app.rag import llm

OK, FAIL, WARN = "✓", "✗", "!"


# ---------- Spesifikasi laptop ----------
def ram_gb() -> float | None:
    try:
        if sys.platform == "win32":
            class MemStatus(ctypes.Structure):
                _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
                            ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong),
                            ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
                            ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong),
                            ("sullAvailExtendedVirtual", ctypes.c_ulonglong)]
            m = MemStatus()
            m.dwLength = ctypes.sizeof(MemStatus)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m))
            return m.ullTotalPhys / 1024**3
        if sys.platform == "darwin":
            return int(subprocess.check_output(["sysctl", "-n", "hw.memsize"], text=True)) / 1024**3
        return os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES") / 1024**3
    except Exception:
        return None


def accelerator() -> str | None:
    if sys.platform == "darwin" and platform.machine() == "arm64":
        return "Apple Silicon"
    if shutil.which("nvidia-smi"):
        try:
            name = subprocess.check_output(["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
                                           text=True, timeout=5).strip().splitlines()
            return f"NVIDIA {name[0]}" if name else "NVIDIA"
        except Exception:
            return "NVIDIA"
    return None


def recommend(ram: float | None, accel: str | None) -> tuple[str, str]:
    """(provider, alasan). Untuk provider ollama, alasan diawali nama model."""
    if ram is None:
        return "gemini", "RAM tidak terdeteksi; Gemini paling aman."
    if accel and ram >= 15:
        return "ollama", f"qwen2.5:7b — ada {accel} dan RAM {ram:.0f} GB, model 7B akan lancar."
    if ram >= 12:
        return "ollama", f"qwen2.5:3b — RAM {ram:.0f} GB cukup untuk model 3B (CPU)."
    return "gemini", (f"RAM {ram:.0f} GB terlalu kecil untuk LLM lokal yang nyaman; "
                      "pakai Gemini (Ollama tetap bisa jadi cadangan).")


# ---------- Koneksi ----------
def ollama_models() -> list[str] | None:
    try:
        r = requests.get(f"{config.OLLAMA_URL}/api/tags", timeout=3)
        r.raise_for_status()
        return [m["name"] for m in r.json().get("models", [])]
    except requests.RequestException:
        return None


def ollama_has(model: str, models: list[str]) -> bool:
    want = model if ":" in model else f"{model}:latest"
    return want in models


def ollama_pull(model: str) -> bool:
    print(f"  Mengunduh {model} (bisa beberapa menit)…")
    try:
        with requests.post(f"{config.OLLAMA_URL}/api/pull", json={"name": model}, stream=True, timeout=(5, 3600)) as r:
            r.raise_for_status()
            last = ""
            for line in r.iter_lines():
                status = line.decode(errors="ignore")
                if '"status"' in status and status != last:
                    last = status
            return '"success"' in last
    except requests.RequestException as e:
        print(f"  {FAIL} Gagal mengunduh: {e}")
        return False


def status() -> dict:
    """Ringkasan cepat tanpa memanggil LLM (dipakai halaman admin)."""
    models = ollama_models()

    def describe(provider: str) -> dict:
        if provider == "gemini":
            ok = bool(config.GEMINI_API_KEY)
            return {"provider": "gemini", "model": config.GEMINI_MODEL, "ok": ok,
                    "detail": "API key terisi" if ok else "GEMINI_API_KEY belum diisi"}
        if provider == "ollama":
            if models is None:
                return {"provider": "ollama", "model": config.OLLAMA_MODEL, "ok": False,
                        "detail": f"Ollama tidak berjalan di {config.OLLAMA_URL}"}
            ok = ollama_has(config.OLLAMA_MODEL, models)
            return {"provider": "ollama", "model": config.OLLAMA_MODEL, "ok": ok,
                    "detail": "Model siap" if ok else f"Model belum diunduh: ollama pull {config.OLLAMA_MODEL}"}
        return {"provider": provider, "model": "", "ok": False, "detail": "Provider tidak dikenal"}

    out = {"llm": describe(config.LLM_PROVIDER), "embed_provider": config.EMBED_PROVIDER}
    if config.LLM_FALLBACK:
        out["fallback"] = describe(config.LLM_FALLBACK)
    return out


# ---------- Uji nyata ----------
def try_llm(provider: str) -> bool:
    fn = llm.PROVIDERS.get(provider)
    if fn is None:
        print(f"  {FAIL} Provider tidak dikenal: {provider}")
        return False
    t0 = time.monotonic()
    first = None
    text = ""
    try:
        for tok in fn("Jawab singkat dalam satu kalimat bahasa Indonesia.",
                      [{"role": "user", "content": "Apa kepanjangan SKS dalam perkuliahan?"}]):
            first = first or time.monotonic()
            text += tok
    except llm.LLMError as e:
        print(f"  {FAIL} {provider}: {e}")
        if provider == "gemini" and "404" in str(e):
            print(f"      → Model {config.GEMINI_MODEL} tidak tersedia. Ganti GEMINI_MODEL di backend/.env "
                  "dengan nama model yang disarankan pada pesan di atas.")
        return False
    total = time.monotonic() - t0
    print(f"  {OK} {provider} menjawab dalam {total:.1f} dtk (token pertama {first - t0:.1f} dtk):")
    print(f"      “{' '.join(text.split())[:160]}”")
    return True


def try_embed() -> bool:
    from app.rag import store
    if config.EMBED_PROVIDER == "hash":
        print(f"  {FAIL} EMBED_PROVIDER=hash hanya untuk tes otomatis. Gunakan gemini atau local.")
        return False
    t0 = time.monotonic()
    try:
        v = store.embedder().query("syarat seminar proposal")
    except ImportError:
        print(f"  {FAIL} EMBED_PROVIDER=local butuh: pip install -r requirements-local-embed.txt")
        return False
    except Exception as e:
        print(f"  {FAIL} Embedding gagal: {e}")
        return False
    print(f"  {OK} Embedding {config.EMBED_PROVIDER} siap ({len(v)} dimensi, {time.monotonic() - t0:.1f} dtk).")
    return True


def main() -> int:
    pull = "--pull" in sys.argv
    print("\n== Laptop ==")
    ram, accel = ram_gb(), accelerator()
    print(f"  RAM: {f'{ram:.1f} GB' if ram else 'tidak terdeteksi'} · Akselerator: {accel or 'tidak ada (CPU saja)'}")
    rec, why = recommend(ram, accel)
    print(f"  Saran: {rec.upper()} — {why}")

    print("\n== Pengaturan saat ini (.env) ==")
    print(f"  LLM_PROVIDER={config.LLM_PROVIDER}  LLM_FALLBACK={config.LLM_FALLBACK or '-'}  "
          f"EMBED_PROVIDER={config.EMBED_PROVIDER}")

    used = [config.LLM_PROVIDER] + ([config.LLM_FALLBACK] if config.LLM_FALLBACK else [])
    if "ollama" in used or rec == "ollama":
        print("\n== Ollama ==")
        models = ollama_models()
        if models is None:
            print(f"  {FAIL} Ollama tidak berjalan di {config.OLLAMA_URL}. Install dari https://ollama.com/download")
        else:
            print(f"  {OK} Ollama berjalan. Model terpasang: {', '.join(models) or '(belum ada)'}")
            if not ollama_has(config.OLLAMA_MODEL, models):
                if pull and ollama_pull(config.OLLAMA_MODEL):
                    print(f"  {OK} {config.OLLAMA_MODEL} terunduh.")
                else:
                    print(f"  {WARN} Model {config.OLLAMA_MODEL} belum ada. Jalankan: ollama pull {config.OLLAMA_MODEL}"
                          "  (atau: python -m app.check --pull)")
    if "gemini" in used or rec == "gemini":
        print("\n== Gemini ==")
        if config.GEMINI_API_KEY:
            print(f"  {OK} GEMINI_API_KEY terisi (model {config.GEMINI_MODEL}).")
        else:
            print(f"  {WARN} GEMINI_API_KEY kosong. Ambil gratis di https://aistudio.google.com "
                  "lalu isi di backend/.env")

    print("\n== Uji tanya-jawab ==")
    results = {p: try_llm(p) for p in dict.fromkeys(used)}

    print("\n== Uji embedding ==")
    emb_ok = try_embed()

    ready = results.get(config.LLM_PROVIDER) or any(results.values())
    print("\n== Hasil ==")
    if ready and emb_ok:
        print(f"  {OK} Siap dipakai. Jalankan: uvicorn app.main:app --reload")
        return 0
    print(f"  {FAIL} Belum siap. Perbaiki tanda {FAIL} di atas, lalu jalankan ulang: python -m app.check")
    return 1


if __name__ == "__main__":
    sys.exit(main())
