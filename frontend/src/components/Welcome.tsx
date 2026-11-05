import { useEffect, useState } from "react";
import { BookOpen, CalendarDays, Compass, GraduationCap, Medal, PauseCircle, ReceiptText, ScrollText } from "lucide-react";
import { api } from "../lib/api";
import { PANTUN } from "../lib/pantun";
import { LogoMark } from "./Brand";

const ICONS = [ScrollText, GraduationCap, PauseCircle, Medal, CalendarDays, ReceiptText];

export function Welcome({ onPick }: { onPick: (q: string) => void }) {
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  useEffect(() => {
    api.suggestions().then((r) => setSuggestions(r.suggestions)).catch(() => setSuggestions([]));
  }, []);

  return (
    <div className="relative">
      <div className="pola-balai pointer-events-none absolute inset-x-0 top-0 h-[420px]" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 pb-6 pt-8 text-center md:pt-14">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emas-soft px-3 py-1 text-emas-teks">
          <BookOpen size={14} /> <span className="label-caps">Balai Ilmu Digital</span>
        </span>
        <LogoMark size={64} className="drop-shadow-sm" />
        <div className="space-y-2">
          <h1 className="font-serif text-[26px] font-semibold leading-[34px] text-primary-strong md:text-[36px] md:leading-[46px]">
            Selamat datang di UNRI GPT
          </h1>
          <p className="mx-auto max-w-xl text-teks-2">Tanya aturan akademik, dapat jawaban beserta sumbernya.</p>
        </div>

        <div className="card relative w-full max-w-xl overflow-hidden px-5 py-4 text-left">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-emas to-primary" aria-hidden="true" />
          <div className="label-caps mb-1 text-emas-teks">Pantun sambutan</div>
          <blockquote className="font-serif text-[17px] italic leading-relaxed text-teks">
            {PANTUN.sambutan.map((l) => <span key={l} className="block">{l}</span>)}
          </blockquote>
        </div>

        <section className="w-full text-left" aria-labelledby="saran-judul">
          <h2 id="saran-judul" className="mb-2 flex items-center gap-2 px-1 font-semibold">
            <Compass size={18} className="text-primary" /> Contoh pertanyaan
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {suggestions === null
              ? Array.from({ length: 4 }, (_, i) => <div key={i} className="h-[68px] animate-pulse rounded border border-garis bg-surface" />)
              : suggestions.map((q, i) => {
                const Icon = ICONS[i % ICONS.length];
                return (
                  <button key={q} onClick={() => onPick(q)}
                    className="group flex items-center gap-3 rounded border border-garis bg-surface p-3 text-left transition-colors hover:border-primary hover:bg-primary-soft">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-onprimary">
                      <Icon size={20} />
                    </span>
                    <span className="text-[15px] font-medium leading-snug">{q}</span>
                  </button>
                );
              })}
          </div>
          {suggestions?.length === 0 && (
            <p className="px-1 text-sm text-teks-2">Ketik pertanyaanmu di kolom bawah.</p>
          )}
        </section>
      </div>
    </div>
  );
}
