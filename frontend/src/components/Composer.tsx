import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";

const MAX = 1000;

type Props = { busy: boolean; onSend: (text: string) => void; onStop: () => void; prefill?: { text: string; n: number } };

export function Composer({ busy, onSend, onStop, prefill }: Props) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

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
    if (prefill) { setText(prefill.text); focusNext.current = true; }
  }, [prefill]);
  useEffect(() => {
    if (focusNext.current) { focusNext.current = false; ref.current?.focus(); }
  }, [text]);

  // Baca nilai dari elemen (bukan state) supaya tidak tertinggal satu render setelah prefill.
  const submit = () => {
    const t = (ref.current?.value ?? text).trim();
    if (!t || busy || t.length > MAX) return;
    onSend(t);
    setText("");
  };

  return (
    <form className="mx-auto w-full max-w-chat px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2"
      onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="card flex items-end gap-2 p-2 focus-within:border-primary-hover">
        <label htmlFor="pertanyaan" className="sr-only">Pertanyaan</label>
        <textarea id="pertanyaan" ref={ref} rows={1} value={text} maxLength={MAX + 200}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
          }}
          placeholder="Tanya soal KRS, cuti, skripsi, wisuda…"
          className="max-h-[176px] min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[16px] leading-[26px] placeholder:text-teks-2/70 focus:outline-none" />
        {busy ? (
          <button type="button" onClick={onStop} className="btn-secondary h-11 w-11 shrink-0 px-0" aria-label="Hentikan jawaban">
            <Square size={16} className="fill-current" />
          </button>
        ) : (
          <button type="submit" disabled={!text.trim() || text.length > MAX} className="btn-primary h-11 w-11 shrink-0 px-0" aria-label="Kirim pertanyaan">
            <ArrowUp size={20} />
          </button>
        )}
      </div>
      <div className="mt-1.5 flex items-start justify-between gap-3 px-1 text-xs text-teks-2">
        <span>Studi kasus Universitas Riau · proyek mahasiswa, bukan layanan resmi. Selalu konfirmasi ke bagian akademik.</span>
        {text.length > 800 && (
          <span className={`shrink-0 font-mono ${text.length > MAX ? "font-semibold text-error" : ""}`} aria-live="polite">
            {text.length}/{MAX}
          </span>
        )}
      </div>
    </form>
  );
}
