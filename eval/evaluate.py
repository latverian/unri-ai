"""Evaluasi sederhana untuk laporan/skripsi.

Isi eval/questions.csv dengan kolom: question, expected_source, keywords
- expected_source : nama file yang seharusnya jadi sumber (kosongkan kalau jawabannya memang tidak ada)
- keywords        : kata kunci wajib di jawaban, pisahkan dengan "|" (contoh: 24 SKS|IPK 3,00)

    python eval/evaluate.py                 # retrieval + jawaban LLM
    python eval/evaluate.py --retrieval-only
"""
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import config  # noqa: E402
from rag import answer, NOT_FOUND  # noqa: E402
from store import search  # noqa: E402

retrieval_only = "--retrieval-only" in sys.argv
rows = list(csv.DictReader(open(Path(__file__).parent / "questions.csv", encoding="utf-8")))
hit = kw_ok = 0
for r in rows:
    found = [h for h in search(r["question"]) if h["score"] >= config.MIN_SCORE]
    sources = {h["source"] for h in found}
    exp = r["expected_source"].strip()
    ok_ret = (exp in sources) if exp else not found
    hit += ok_ret
    line = f"[{'OK ' if ok_ret else 'X  '}] retrieval | {r['question']}"
    if not retrieval_only:
        text, _ = answer(r["question"])
        kws = [k.strip().lower() for k in r["keywords"].split("|") if k.strip()]
        ok_kw = all(k in text.lower() for k in kws) if exp else text == NOT_FOUND or "maaf" in text.lower()
        kw_ok += ok_kw
        line += f"\n      jawaban {'OK' if ok_kw else 'X '}: {text[:150].replace(chr(10), ' ')}"
    print(line)

n = len(rows)
print(f"\nRetrieval benar : {hit}/{n} ({hit / n:.0%})")
if not retrieval_only:
    print(f"Jawaban benar   : {kw_ok}/{n} ({kw_ok / n:.0%})")
