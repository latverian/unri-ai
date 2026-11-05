import { useEffect, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BookOpen, Check, ChevronDown, CloudOff, Copy, FileText, Lightbulb, Paperclip, Pencil, RotateCcw, SearchX,
  ThumbsDown, ThumbsUp, Volume2, VolumeX,
} from "lucide-react";
import { api } from "../lib/api";
import { PANTUN } from "../lib/pantun";
import { usePrefs } from "../lib/prefs";
import type { Message, Source } from "../lib/types";
import { LogoMark, Pantun } from "./Brand";
import { useToast } from "./Toast";

// ---------- Pesan pengguna ----------
type UserProps = { m: Message; canEdit?: boolean; onEdit?: (text: string) => void };

export function UserBubble({ m, canEdit, onEdit }: UserProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(m.content);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (editing && ref.current) { ref.current.focus(); ref.current.style.height = `${ref.current.scrollHeight}px`; }
  }, [editing]);

  if (editing) {
    return (
      <form className="flex animate-rise flex-col items-end gap-2" onSubmit={(e) => {
        e.preventDefault();
        if (text.trim() && text.trim() !== m.content) onEdit?.(text.trim());
        setEditing(false);
      }}>
        <label htmlFor={`edit-${m.id}`} className="sr-only">Ubah pertanyaan</label>
        <textarea id={`edit-${m.id}`} ref={ref} value={text} maxLength={1000} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }}
          className="input min-h-[80px] w-full max-w-[85%] resize-y text-[16px] leading-[26px]" />
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={() => { setText(m.content); setEditing(false); }}>Batal</button>
          <button type="submit" className="btn-primary" disabled={!text.trim()}>Kirim ulang</button>
        </div>
      </form>
    );
  }
  return (
    <div className="group flex animate-rise flex-col items-end gap-1">
      {!!m.attachments?.length && (
        <div className="flex max-w-[85%] flex-wrap justify-end gap-1">
          {m.attachments.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1 rounded-full border border-garis bg-surface px-2.5 py-1 text-xs">
              <Paperclip size={12} /> {a.filename}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-start gap-1">
        {canEdit && (
          <button className="btn-icon opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
            onClick={() => setEditing(true)} aria-label="Ubah pertanyaan" title="Ubah pertanyaan"><Pencil size={15} /></button>
        )}
        <div className="max-w-[85vw] whitespace-pre-wrap break-words rounded-lg rounded-br-[6px] bg-primary px-4 py-3 text-onprimary md:max-w-[560px]"
          style={{ fontSize: "var(--answer-size, 16px)", lineHeight: 1.625 }}>
          {m.content}
        </div>
      </div>
    </div>
  );
}

// ---------- Bagian-bagian jawaban ----------
/** Ubah penanda [1] menjadi tautan khusus agar dirender sebagai chip sitasi. */
function withCitations(text: string, n: number) {
  return text.replace(/\[(\d{1,2})\](?!\()/g, (all, d) => (Number(d) >= 1 && Number(d) <= n ? `[${d}](#cite-${d})` : all));
}

function relevance(score: number) {
  return score >= 0.85 ? 3 : score >= 0.8 ? 2 : 1;
}

function sourceLabel(s: Source) {
  return s.page ? `${s.source} · hal. ${s.page}` : s.source;
}

function TypingIndicator({ phase }: { phase?: Message["phase"] }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 6000); return () => clearTimeout(t); }, []);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-sm text-teks-2">
        <span className="flex gap-1" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-2 w-2 rotate-45 animate-gem bg-emas" style={{ animationDelay: `${i * 0.18}s` }} />
          ))}
        </span>
        {phase === "writing" ? "Menyusun jawaban…" : "Mencari di dokumen…"}
      </div>
      {slow && <Pantun lines={PANTUN.memuat} className="text-sm" />}
    </div>
  );
}

function SourceList({ sources, msgId, highlight }: { sources: (Source & { n: number })[]; msgId: string; highlight: number | null }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mt-4 rounded-sm border border-garis bg-surface2/60">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-h-[44px] w-full items-center gap-2 px-3 text-left">
        <BookOpen size={16} className="text-emas-teks" />
        <span className="label-caps text-emas-teks">Sumber</span>
        <span className="text-sm text-teks-2">({sources.length})</span>
        <ChevronDown size={16} className={`ml-auto text-teks-2 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ol className="space-y-2 px-3 pb-3">
          {sources.map((s) => {
            const rel = relevance(s.score);
            return (
              <li key={`${s.doc_id}-${s.n}`} id={`src-${msgId}-${s.n}`}
                className={`rounded-sm border-l-[3px] bg-surface px-3 py-2 transition-shadow ${s.attachment ? "border-primary" : "border-emas"} ${highlight === s.n ? "ring-2 ring-emas" : ""}`}>
                <div className="flex items-center gap-2 text-sm">
                  <span className="rounded bg-emas-soft px-1.5 font-mono text-[11px] font-medium text-emas-teks">[{s.n}]</span>
                  {s.attachment ? <Paperclip size={14} className="shrink-0 text-primary" /> : <FileText size={14} className="shrink-0 text-teks-2" />}
                  <span className="min-w-0 truncate font-medium" title={sourceLabel(s)}>{sourceLabel(s)}</span>
                  {!s.attachment && (
                    <span className="ml-auto flex shrink-0 gap-0.5" role="img" aria-label={`Relevansi ${rel} dari 3`} title={`Skor kemiripan ${s.score.toFixed(2)}`}>
                      {[1, 2, 3].map((d) => <span key={d} className={`h-1.5 w-1.5 rounded-full ${d <= rel ? "bg-primary" : "bg-garis"}`} />)}
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-teks-2">“{s.snippet}”</p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function CodeBlock({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(ref.current?.innerText ?? ""); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* abaikan */ }
  };
  return (
    <div className="relative">
      <button type="button" onClick={copy} className="absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-surface px-2 py-1 text-xs shadow-card"
        aria-label="Salin kode">{copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Tersalin" : "Salin"}</button>
      <pre ref={ref} className="overflow-x-auto rounded-sm bg-surface2 p-3 pr-20 font-mono text-[13px] leading-5">{children}</pre>
    </div>
  );
}

/** Bacakan jawaban dengan suara bawaan perangkat (Web Speech API). */
function plainText(md: string) {
  return md.replace(/\[(\d{1,2})\]/g, "").replace(/[#*_`>|]/g, " ").replace(/\s+/g, " ").trim();
}
let speakingId: string | null = null;

function useSpeech(id: string, text: string) {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  useEffect(() => () => { if (speakingId === id) { speechSynthesis.cancel(); speakingId = null; } }, [id]);
  const toggle = () => {
    if (!supported) return;
    if (speaking) { speechSynthesis.cancel(); setSpeaking(false); speakingId = null; return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(plainText(text));
    u.lang = "id-ID";
    const voice = speechSynthesis.getVoices().find((v) => v.lang.startsWith("id"));
    if (voice) u.voice = voice;
    u.onend = u.onerror = () => { setSpeaking(false); if (speakingId === id) speakingId = null; };
    speakingId = id;
    setSpeaking(true);
    speechSynthesis.speak(u);
  };
  return { supported, speaking, toggle };
}

// ---------- Jawaban asisten ----------
type AssistantProps = {
  m: Message;
  isLast?: boolean;
  readOnly?: boolean;
  onRegenerate?: () => void;
  onRated?: (r: 1 | -1) => void;
};

export function AssistantBubble({ m, isLast, readOnly, onRegenerate, onRated }: AssistantProps) {
  const toast = useToast();
  const { prefs } = usePrefs();
  const [highlight, setHighlight] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [askComment, setAskComment] = useState(false);
  const speech = useSpeech(m.id, m.content);
  const sources = m.sources ?? [];
  const streaming = m.status === "streaming";
  const notFound = m.status === "done" && m.found === false && !m.general;
  // Setelah selesai, tampilkan hanya sumber yang benar-benar dikutip (nomor aslinya dipertahankan).
  const shown = m.general ? [] : sources.map((s, i) => ({ ...s, n: i + 1 }))
    .filter((s) => !(m.status === "done" && m.cited) || m.cited.includes(s.n));

  // Bacakan otomatis jawaban baru jika diaktifkan di Pengaturan.
  const autoSpoken = useRef(false);
  const wasStreaming = useRef(streaming);
  useEffect(() => {
    if (wasStreaming.current && m.status === "done" && prefs.autoSpeak && !autoSpoken.current && speech.supported) {
      autoSpoken.current = true;
      speech.toggle();
    }
    wasStreaming.current = streaming;
  }, [m.status, prefs.autoSpeak, speech, streaming]);

  const cite = (n: number) => {
    document.getElementById(`src-${m.id}-${n}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setHighlight(n);
    setTimeout(() => setHighlight(null), 1600);
  };

  const rate = async (r: 1 | -1, text?: string) => {
    if (!m.messageId) return;
    try {
      await api.feedback(m.messageId, r, text);
      onRated?.(r);
      if (r === -1 && text === undefined) setAskComment(true);
      else toast(r === 1 ? "Terima kasih atas penilaianmu!" : "Terima kasih, masukanmu membantu kami memperbaiki jawaban.");
      if (text !== undefined) setAskComment(false);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(m.content); toast("Jawaban disalin"); } catch { toast("Gagal menyalin", "error"); }
  };

  let body: ReactNode;
  if (m.status === "error") {
    body = (
      <div className="space-y-3">
        <p className="flex items-center gap-2 font-medium text-error"><CloudOff size={18} /> {m.error ?? "Layanan sedang tersendat. Coba lagi sebentar ya."}</p>
        <Pantun lines={PANTUN.error} className="text-sm" />
      </div>
    );
  } else if (streaming && !m.content) {
    body = <TypingIndicator phase={m.phase} />;
  } else if (notFound) {
    body = (
      <div className="space-y-3">
        <p className="flex items-start gap-2 whitespace-pre-line"><SearchX size={18} className="mt-1 shrink-0 text-emas-teks" /> {m.content}</p>
        <Pantun lines={PANTUN.tidakDitemukan} className="text-sm" />
      </div>
    );
  } else {
    body = (
      <div className={`prose-jawaban ${streaming ? "kursor" : ""}`}>
        {m.general && (
          <p className="!mt-0 mb-3 flex items-start gap-2 rounded-sm bg-emas-soft/70 px-3 py-2 text-sm">
            <Lightbulb size={16} className="mt-0.5 shrink-0 text-emas-teks" />
            Info umum, bukan dari dokumen UNRI. Untuk aturan kampus, konfirmasi ke bagian akademik.
          </p>
        )}
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          a: ({ href, children, ...rest }) => {
            const n = href?.startsWith("#cite-") ? Number(href.slice(6)) : 0;
            if (n) {
              return (
                <button type="button" onClick={() => cite(n)} aria-label={`Lihat sumber ${n}`}
                  className="cite mx-0.5 inline-flex -translate-y-0.5 items-center rounded bg-emas-soft px-1.5 align-baseline font-mono text-[11px] font-semibold leading-[18px] text-emas-teks hover:ring-1 hover:ring-emas">
                  {n}
                </button>
              );
            }
            return <a href={href} target="_blank" rel="noreferrer noopener" {...rest}>{children}</a>;
          },
        }}>
          {m.general ? m.content : withCitations(m.content, sources.length)}
        </ReactMarkdown>
        {m.status === "stopped" && <p className="text-sm italic text-teks-2">(Jawaban dihentikan)</p>}
      </div>
    );
  }

  const accent = m.status === "error" ? "border-l-[3px] border-l-error" : notFound ? "border-l-[3px] border-l-emas"
    : m.general ? "border-l-[3px] border-l-emas/60" : "";

  return (
    <div className="flex animate-rise gap-3">
      <LogoMark size={32} className="mt-1 hidden shrink-0 sm:block" />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2 text-sm">
          <span className="font-serif font-semibold text-primary-strong">Balai Ilmu</span>
          {shown.length > 0 && m.status === "done" && !notFound && <span className="label-caps rounded bg-emas-soft px-1.5 py-0.5 text-emas-teks">Berdasar dokumen</span>}
          {m.general && m.status !== "error" && <span className="label-caps rounded bg-surface2 px-1.5 py-0.5 text-teks-2">Pengetahuan umum</span>}
        </div>
        <div className={`card rounded-tl-[6px] px-4 py-3 ${accent}`}>
          {body}
          {shown.length > 0 && m.status !== "error" && !notFound && !(streaming && !m.content) && (
            <SourceList sources={shown} msgId={m.id} highlight={highlight} />
          )}
        </div>

        {!streaming && !readOnly && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1 text-sm">
            {m.messageId && m.status === "done" && !notFound && (
              <>
                <button className={`btn-icon ${m.rating === 1 ? "bg-primary-soft text-primary" : ""}`} onClick={() => rate(1)}
                  aria-label="Jawaban membantu" aria-pressed={m.rating === 1}><ThumbsUp size={16} /></button>
                <button className={`btn-icon ${m.rating === -1 ? "bg-error-soft text-error" : ""}`} onClick={() => rate(-1)}
                  aria-label="Jawaban kurang akurat" aria-pressed={m.rating === -1}><ThumbsDown size={16} /></button>
              </>
            )}
            {m.content && m.status !== "error" && (
              <button className="btn-icon w-auto gap-1.5 px-2 md:w-auto" onClick={copy}><Copy size={16} /> <span>Salin</span></button>
            )}
            {m.content && m.status !== "error" && speech.supported && (
              <button className="btn-icon w-auto gap-1.5 px-2 md:w-auto" onClick={speech.toggle} aria-pressed={speech.speaking}>
                {speech.speaking ? <VolumeX size={16} /> : <Volume2 size={16} />} <span>{speech.speaking ? "Hentikan" : "Bacakan"}</span>
              </button>
            )}
            {isLast && onRegenerate && (
              <button className="btn-icon w-auto gap-1.5 px-2 md:w-auto" onClick={onRegenerate}>
                <RotateCcw size={16} /> <span>{m.status === "error" ? "Coba lagi" : "Ulangi"}</span>
              </button>
            )}
          </div>
        )}

        {askComment && (
          <form className="mt-2 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); rate(-1, comment.trim()); }}>
            <label htmlFor={`komentar-${m.id}`} className="sr-only">Apa yang kurang dari jawaban ini?</label>
            <input id={`komentar-${m.id}`} className="input text-sm" maxLength={1000} autoFocus value={comment}
              onChange={(e) => setComment(e.target.value)} placeholder="Apa yang kurang? (opsional)" />
            <div className="flex gap-2">
              <button className="btn-primary" type="submit">Kirim masukan</button>
              <button className="btn-secondary" type="button" onClick={() => { setAskComment(false); toast("Terima kasih, masukanmu membantu kami memperbaiki jawaban."); }}>Lewati</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
