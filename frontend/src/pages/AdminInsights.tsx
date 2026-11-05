import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Save, SearchX, ThumbsDown, Trash2 } from "lucide-react";
import { api, ApiError, type Insights } from "../lib/api";
import { useToast } from "../components/Toast";

function when(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AdminInsights() {
  const toast = useToast();
  const nav = useNavigate();
  const [data, setData] = useState<Insights | null>(null);
  const [tab, setTab] = useState<"unanswered" | "negative">("unanswered");
  const [sugs, setSugs] = useState<string[]>([]);

  const onError = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) nav("/admin/login", { replace: true });
    else toast((e as Error).message, "error");
  }, [nav, toast]);

  useEffect(() => {
    api.insights().then(setData).catch(onError);
    api.suggestions().then((r) => setSugs(r.suggestions)).catch(onError);
  }, [onError]);

  const save = async () => {
    try { const r = await api.saveSuggestions(sugs); setSugs(r.suggestions); toast("Contoh pertanyaan disimpan"); }
    catch (e) { onError(e); }
  };

  const s = data?.stats;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[26px] font-semibold text-primary-strong md:text-[32px]">Insights</h1>
        <p className="mt-1 text-teks-2">Lihat pertanyaan yang belum terjawab untuk mengetahui dokumen apa yang perlu ditambahkan.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Total pertanyaan", s ? String(s.total) : "–"],
          ["Terjawab", s ? pct(s.answered, s.total) : "–"],
          ["Dinilai membantu", s ? pct(s.up, s.up + s.down) : "–"],
          ["Rata-rata waktu", s?.avg_latency ? `${(s.avg_latency / 1000).toFixed(1).replace(".", ",")} dtk` : "–"],
        ].map(([k, v]) => (
          <div key={k} className="card p-4"><div className="label-caps text-teks-2">{k}</div><div className="mt-1 font-serif text-3xl font-semibold">{v}</div></div>
        ))}
      </div>

      <section className="card overflow-hidden">
        <div role="tablist" className="flex border-b border-garis">
          {([["unanswered", "Tidak terjawab", SearchX], ["negative", "Dinilai kurang", ThumbsDown]] as const).map(([key, label, Icon]) => (
            <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
              className={`flex min-h-[48px] flex-1 items-center justify-center gap-2 border-b-2 text-sm font-semibold sm:flex-none sm:px-6 ${tab === key ? "border-primary text-primary-strong" : "border-transparent text-teks-2 hover:text-teks"}`}>
              <Icon size={16} /> {label}
              <span className="rounded-full bg-surface2 px-2 text-xs">{data ? (key === "unanswered" ? data.unanswered.length : data.negative.length) : "…"}</span>
            </button>
          ))}
        </div>
        <div role="tabpanel">
          {!data ? <div className="h-32 animate-pulse bg-surface2/50" /> : tab === "unanswered" ? (
            data.unanswered.length === 0 ? <p className="p-6 text-center text-teks-2">Semua pertanyaan sudah terjawab. 🎉</p> : (
              <ul className="divide-y divide-garis">
                {data.unanswered.map((u) => (
                  <li key={u.question} className="flex items-start gap-3 px-4 py-3 md:px-6">
                    <span className="mt-0.5 rounded-full bg-emas-soft px-2 font-mono text-xs font-semibold text-emas-teks" title="Jumlah ditanyakan">{u.count}×</span>
                    <span className="flex-1">{u.question}</span>
                    <span className="shrink-0 text-xs text-teks-2">{when(u.last_asked)}</span>
                  </li>
                ))}
              </ul>
            )
          ) : data.negative.length === 0 ? <p className="p-6 text-center text-teks-2">Belum ada jawaban yang dinilai kurang.</p> : (
            <ul className="divide-y divide-garis">
              {data.negative.map((n) => (
                <li key={n.message_id} className="space-y-1 px-4 py-3 md:px-6">
                  <div className="flex items-start justify-between gap-3"><span className="font-medium">{n.question}</span><span className="shrink-0 text-xs text-teks-2">{when(n.created_at)}</span></div>
                  <p className="line-clamp-2 text-sm text-teks-2">{n.answer}</p>
                  {n.comment && <p className="rounded-sm bg-error-soft px-3 py-1.5 text-sm text-error">“{n.comment}”</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="card p-4 md:p-6" aria-labelledby="saran">
        <h2 id="saran" className="font-serif text-xl font-semibold text-primary-strong">Contoh pertanyaan di layar awal</h2>
        <p className="text-sm text-teks-2">Tampil sebagai pilihan cepat untuk mahasiswa (maksimal 12).</p>
        <ul className="mt-4 space-y-2">
          {sugs.map((q, i) => (
            <li key={i} className="flex gap-2">
              <label className="sr-only" htmlFor={`sug-${i}`}>Contoh pertanyaan {i + 1}</label>
              <input id={`sug-${i}`} className="input" value={q} maxLength={200}
                onChange={(e) => setSugs((l) => l.map((x, j) => (j === i ? e.target.value : x)))} />
              <button className="btn-icon shrink-0 hover:bg-error-soft hover:text-error" aria-label={`Hapus contoh ${i + 1}`}
                onClick={() => setSugs((l) => l.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-secondary" disabled={sugs.length >= 12} onClick={() => setSugs((l) => [...l, ""])}><Plus size={16} /> Tambah</button>
          <button className="btn-primary" disabled={!sugs.some((x) => x.trim())} onClick={save}><Save size={16} /> Simpan</button>
        </div>
      </section>
    </div>
  );
}
