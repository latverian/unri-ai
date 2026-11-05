import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, FileText, Layers, Loader2, RefreshCw, ShieldAlert, Trash2, UploadCloud } from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { DocumentRow } from "../lib/types";
import { useToast } from "../components/Toast";

const ACCEPT = [".pdf", ".txt", ".md"];

function size(b: number) {
  return b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}
function date(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function StatusBadge({ d }: { d: DocumentRow }) {
  if (d.status === "ready") return <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary-strong"><CheckCircle2 size={14} /> Siap</span>;
  if (d.status === "failed") return <span className="inline-flex items-center gap-1 rounded-full bg-error-soft px-2.5 py-1 text-xs font-semibold text-error" title={d.error ?? ""}><AlertTriangle size={14} /> Gagal</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-emas-soft px-2.5 py-1 text-xs font-semibold text-emas-teks"><Loader2 size={14} className="animate-spin" /> {d.status === "queued" ? "Antre" : "Diproses"}</span>;
}

export default function AdminDocuments() {
  const toast = useToast();
  const nav = useNavigate();
  const [docs, setDocs] = useState<DocumentRow[] | null>(null);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onError = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) nav("/admin/login", { replace: true });
    else toast((e as Error).message, "error");
  }, [nav, toast]);

  const load = useCallback(() => api.documents().then((r) => setDocs(r.documents)).catch(onError), [onError]);
  useEffect(() => { load(); }, [load]);

  // Pantau status selama masih ada dokumen yang diproses.
  const pending = docs?.some((d) => d.status === "queued" || d.status === "processing");
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [pending, load]);

  const upload = async (files: File[]) => {
    const ok = files.filter((f) => ACCEPT.some((ext) => f.name.toLowerCase().endsWith(ext)));
    if (ok.length < files.length) toast("Sebagian file dilewati: hanya PDF, TXT, atau MD.", "error");
    if (!ok.length) return;
    setUploading(true);
    try {
      await api.upload(ok);
      toast(`${ok.length} dokumen diunggah, sedang diproses`);
      await load();
    } catch (e) { onError(e); } finally { setUploading(false); }
  };

  const remove = async (d: DocumentRow) => {
    if (!confirm(`Hapus "${d.filename}"? Isinya tidak akan lagi dipakai untuk menjawab.`)) return;
    try { await api.deleteDoc(d.id); toast("Dokumen dihapus"); load(); } catch (e) { onError(e); }
  };
  const reindex = async (d: DocumentRow) => {
    try { await api.reindex(d.id); load(); } catch (e) { onError(e); }
  };

  const ready = docs?.filter((d) => d.status === "ready") ?? [];
  const chunks = ready.reduce((n, d) => n + (d.chunks ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <span className="label-caps rounded-full bg-emas-soft px-2.5 py-1 text-emas-teks">Balai arsip</span>
        <h1 className="mt-3 font-serif text-[26px] font-semibold leading-tight text-primary-strong md:text-[32px]">Kelola Dokumen</h1>
        <p className="mt-1 max-w-2xl text-teks-2">Dokumen di sini menjadi satu-satunya rujukan UNRI GPT saat menjawab. Unggah dokumen publik saja.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="card p-4"><div className="label-caps text-teks-2">Dokumen siap</div><div className="mt-1 font-serif text-3xl font-semibold">{docs ? ready.length : "–"}</div></div>
        <div className="card p-4"><div className="label-caps text-teks-2">Potongan (chunk)</div><div className="mt-1 font-serif text-3xl font-semibold">{docs ? chunks : "–"}</div></div>
        <div className="card col-span-2 p-4 md:col-span-1"><div className="label-caps text-teks-2">Perlu perhatian</div>
          <div className="mt-1 font-serif text-3xl font-semibold">{docs ? docs.filter((d) => d.status === "failed").length : "–"}</div></div>
      </div>

      <section className="card p-4 md:p-6" aria-labelledby="unggah">
        <h2 id="unggah" className="font-serif text-xl font-semibold text-primary-strong">Unggah dokumen</h2>
        <p className="text-sm text-teks-2">PDF berteks, TXT, atau MD · maksimal 20 MB per file</p>
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); upload([...e.dataTransfer.files]); }}
          className={`mt-4 flex flex-col items-center gap-3 rounded border-2 border-dashed px-4 py-8 text-center transition-colors ${drag ? "border-primary bg-primary-soft" : "border-primary/40 bg-surface2/50"}`}>
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary"><UploadCloud size={28} /></span>
          <p className="font-medium">Tarik PDF ke sini atau pilih file</p>
          <input ref={inputRef} type="file" multiple accept={ACCEPT.join(",")} className="sr-only" id="file-input"
            onChange={(e) => { upload([...(e.target.files ?? [])]); e.target.value = ""; }} />
          <button className="btn-primary" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />} {uploading ? "Mengunggah…" : "Pilih dokumen"}
          </button>
        </div>
        <p className="mt-3 flex items-start gap-2 rounded-sm bg-emas-soft/60 px-3 py-2 text-sm">
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-emas-teks" />
          Jangan unggah data pribadi mahasiswa (nilai, NIM, transkrip). Hanya dokumen publik seperti buku pedoman, panduan, dan kalender akademik.
        </p>
      </section>

      <section className="card overflow-hidden" aria-labelledby="daftar">
        <div className="flex items-center justify-between gap-2 p-4 md:px-6">
          <h2 id="daftar" className="font-serif text-xl font-semibold text-primary-strong">Daftar dokumen</h2>
          <button className="btn-secondary" onClick={load}><RefreshCw size={16} /> <span className="hidden sm:inline">Muat ulang</span></button>
        </div>
        {docs === null ? (
          <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-sm bg-surface2" />)}</div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 pb-10 pt-4 text-center text-teks-2">
            <Layers size={32} /> Belum ada dokumen. Unggah buku pedoman akademik untuk memulai.
          </div>
        ) : (
          <ul className="divide-y divide-garis border-t border-garis">
            {docs.map((d) => (
              <li key={d.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 md:grid-cols-[minmax(0,2.5fr)_repeat(4,minmax(0,1fr))_auto] md:px-6">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText size={18} className="shrink-0 text-teks-2" />
                  <span className="truncate font-mono text-sm" title={d.filename}>{d.filename}</span>
                </div>
                <div className="md:order-last md:col-start-6 md:row-start-1 md:justify-self-end">
                  <div className="flex items-center gap-1">
                    {d.status === "failed" && <button className="btn-icon" onClick={() => reindex(d)} aria-label={`Proses ulang ${d.filename}`} title="Proses ulang"><RefreshCw size={16} /></button>}
                    <button className="btn-icon hover:bg-error-soft hover:text-error" onClick={() => remove(d)} aria-label={`Hapus ${d.filename}`} title="Hapus"><Trash2 size={16} /></button>
                  </div>
                </div>
                <div className="col-span-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-teks-2 md:contents">
                  <span className="md:text-teks">{size(d.size_bytes)}</span>
                  <span className="md:text-teks">{d.pages ? `${d.pages} hal.` : "–"}</span>
                  <span className="md:text-teks">{d.chunks != null ? `${d.chunks} chunk` : "–"}</span>
                  <span className="md:text-teks">{date(d.uploaded_at)}</span>
                </div>
                <div className="col-span-2 md:col-span-1 md:col-start-6 md:row-start-1 md:mr-24 md:justify-self-end">
                  <StatusBadge d={d} />
                </div>
                {d.status === "failed" && d.error && <p className="col-span-2 text-sm text-error md:col-span-6">{d.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
