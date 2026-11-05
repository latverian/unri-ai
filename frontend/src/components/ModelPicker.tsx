import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Cpu } from "lucide-react";
import type { ModelOption } from "../lib/types";

export function ModelPicker({ models, value, onChange }: { models: ModelOption[]; value: string | null; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = models.find((m) => m.id === value) ?? models[0];
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  if (!current) return null;
  const single = models.length < 2;
  return (
    <div ref={ref} className="relative">
      <button onClick={() => !single && setOpen((o) => !o)} aria-haspopup={single ? undefined : "listbox"} aria-expanded={open}
        title={single ? "Model AI yang dipakai" : "Pilih model AI"}
        className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-sm px-2.5 text-sm font-medium ${single ? "cursor-default text-teks-2" : "hover:bg-surface2"}`}>
        <Cpu size={16} className="text-primary" />
        <span className="max-w-[160px] truncate">{current.label}</span>
        {!single && <ChevronDown size={14} className="text-teks-2" />}
      </button>
      {open && (
        <ul role="listbox" aria-label="Model AI" className="card absolute left-0 top-10 z-50 w-64 animate-rise p-1.5">
          {models.map((m) => (
            <li key={m.id} role="option" aria-selected={m.id === current.id}>
              <button onClick={() => { onChange(m.id); setOpen(false); }}
                className="flex min-h-[44px] w-full items-center gap-2 rounded-sm px-3 text-left text-sm hover:bg-surface2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{m.label}</span>
                  <span className="block truncate text-xs text-teks-2">{m.provider === "ollama" ? "Lokal · offline" : "Cloud"} · {m.model}</span>
                </span>
                {m.id === current.id && <Check size={16} className="text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
