import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUp, BookOpen, Lightbulb, Loader2, Mic, MicOff, Paperclip, Square, X } from "lucide-react";
import type { AnswerMode } from "../lib/prefs";
import type { AttachmentRef } from "../lib/types";
import { useToast } from "./Toast";

const MAX = 1000;

type Props = {
  busy: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  prefill?: { text: string; n: number };
  attachments: AttachmentRef[];
  canAttach: boolean;
  maxAttachMb: number;
  onAttach: (file: File) => Promise<unknown>;
  onRemoveAttachment: (id: string) => void;
  mode: AnswerMode;
  generalAvailable: boolean;
  onModeChange: (m: AnswerMode) => void;
};

// Web Speech API (Chrome/Edge/Safari). Tidak semua browser mendukung.
type Recognition = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };
const SR = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition });
const RecognitionCtor = SR.SpeechRecognition ?? SR.webkitSpeechRecognition;

export function Composer(p: Props) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [listening, setListening] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<Recognition | null>(null);
  const baseText = useRef("");

  // Tinggi otomatis 1–6 baris
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 6 * 26 + 20)}px`;
  }, [text]);

  // Contoh pertanyaan dipilih: isi kolom dulu, baru fokus setelah teksnya benar-benar tampil.
  const focusNext = useRef(false);
  useEffect(() => {
    if (p.prefill) { setText(p.prefill.text); focusNext.current = true; }
  }, [p.prefill]);
  useEffect(() => {
    if (focusNext.current) { focusNext.current = false; ref.current?.focus(); }
  }, [text]);

  useEffect(() => () => recRef.current?.stop(), []);

  // Baca nilai dari elemen (bukan state) supaya tidak tertinggal satu render setelah prefill.
  const submit = () => {
    const t = (ref.current?.value ?? text).trim();
    if (!t || p.busy || t.length > MAX || uploading) return;
    recRef.current?.stop();
    p.onSend(t);
    setText("");
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > p.maxAttachMb * 1024 * 1024) return toast(`Ukuran lampiran maksimal ${p.maxAttachMb} MB.`, "error");
    setUploading(true);
    try { await p.onAttach(file); toast(`${file.name} dilampirkan`); } catch (e) { toast((e as Error).message, "error"); } finally { setUploading(false); }
  };

  const toggleVoice = () => {
    if (!RecognitionCtor) return toast("Browser ini belum mendukung input suara. Coba Chrome atau Edge.", "error");
    if (listening) { recRef.current?.stop(); return; }
    const rec = new RecognitionCtor();
    rec.lang = "id-ID";
    rec.interimResults = true;
    rec.continuous = false;
    baseText.current = text ? `${text.trimEnd()} ` : "";
    rec.onresult = (e) => {
      const said = Array.from(e.results).map((r) => r[0].transcript).join("");
      setText((baseText.current + said).slice(0, MAX));
    };
    rec.onerror = (e) => { if (e.error !== "aborted" && e.error !== "no-speech") toast("Mikrofon tidak dapat dipakai. Periksa izin browser.", "error"); };
    rec.onend = () => { setListening(false); ref.current?.focus(); };
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <form className="mx-auto w-full max-w-chat px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2"
      onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="card p-2 focus-within:border-primary-hover">
        {(p.attachments.length > 0 || uploading) && (
          <div className="flex flex-wrap gap-1.5 px-1 pb-2">
            {p.attachments.map((a) => (
              <span key={a.id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary-soft py-1 pl-2.5 pr-1 text-xs font-medium text-primary-strong">
                <Paperclip size={12} /> <span className="truncate">{a.filename}</span>
                <button type="button" className="rounded-full p-0.5 hover:bg-surface" onClick={() => p.onRemoveAttachment(a.id)} aria-label={`Lepas lampiran ${a.filename}`}><X size={12} /></button>
              </span>
            ))}
            {uploading && <span className="inline-flex items-center gap-1 px-2 py-1 text-xs text-teks-2"><Loader2 size={12} className="animate-spin" /> Mengunggah…</span>}
          </div>
        )}
        <div className="flex items-end gap-1">
          <label htmlFor="pertanyaan" className="sr-only">Pertanyaan</label>
          <textarea id="pertanyaan" ref={ref} rows={1} value={text} maxLength={MAX + 200}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
            placeholder={listening ? "Mendengarkan… silakan bicara" : p.attachments.length ? "Tanya tentang lampiran atau dokumen kampus…" : "Tanya soal KRS, cuti, skripsi, wisuda…"}
            className="max-h-[176px] min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[16px] leading-[26px] placeholder:text-teks-2/70 focus:outline-none" />
          {p.busy ? (
            <button type="button" onClick={p.onStop} className="btn-secondary h-11 w-11 shrink-0 px-0" aria-label="Hentikan jawaban" title="Hentikan (Esc)">
              <Square size={16} className="fill-current" />
            </button>
          ) : (
            <button type="submit" disabled={!text.trim() || text.length > MAX || uploading} className="btn-primary h-11 w-11 shrink-0 px-0" aria-label="Kirim pertanyaan">
              <ArrowUp size={20} />
            </button>
          )}
        </div>
        <div className="mt-1 flex items-center gap-1 border-t border-garis/70 pt-1">
          <input ref={fileRef} type="file" accept=".pdf,.txt,.md" className="sr-only" tabIndex={-1}
            onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
          {p.canAttach ? (
            <button type="button" className="btn-icon" onClick={() => fileRef.current?.click()} disabled={uploading || p.attachments.length >= 5}
              aria-label="Lampirkan dokumen" title="Lampirkan PDF/TXT/MD"><Paperclip size={18} /></button>
          ) : (
            <Link to="/masuk" className="btn-icon" aria-label="Masuk untuk melampirkan dokumen" title="Masuk untuk melampirkan dokumen"><Paperclip size={18} /></Link>
          )}
          <button type="button" className={`btn-icon ${listening ? "bg-error-soft text-error" : ""}`} onClick={toggleVoice}
            aria-pressed={listening} aria-label={listening ? "Berhenti mendengarkan" : "Tanya dengan suara"} title="Input suara">
            {listening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          {p.generalAvailable && (
            <div role="radiogroup" aria-label="Sumber jawaban" className="ml-auto flex rounded-full bg-surface2 p-0.5 text-xs font-semibold">
              {([["dokumen", "Dokumen", BookOpen, "Hanya menjawab dari dokumen kampus"], ["umum", "Umum", Lightbulb, "Boleh menjawab pertanyaan umum jika tidak ada di dokumen"]] as const).map(([k, label, Icon, title]) => (
                <button key={k} type="button" role="radio" aria-checked={p.mode === k} title={title} onClick={() => p.onModeChange(k)}
                  className={`inline-flex min-h-[32px] items-center gap-1 rounded-full px-3 transition-colors ${p.mode === k ? "bg-surface text-primary-strong shadow-card" : "text-teks-2 hover:text-teks"}`}>
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex items-start justify-between gap-3 px-1 text-xs text-teks-2">
        <span>Studi kasus Universitas Riau · proyek mahasiswa, bukan layanan resmi. Selalu konfirmasi ke bagian akademik.</span>
        {text.length > 800 && (
          <span className={`shrink-0 font-mono ${text.length > MAX ? "font-semibold text-error" : ""}`} aria-live="polite">{text.length}/{MAX}</span>
        )}
      </div>
    </form>
  );
}
