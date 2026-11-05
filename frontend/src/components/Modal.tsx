import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Dialog sederhana yang bisa ditutup dengan Esc atau klik di luar. */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("input,button,textarea,select")?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("keydown", esc); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}
        className="card w-full max-w-md animate-rise rounded-b-none p-5 sm:rounded-b">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-serif text-xl font-semibold text-primary-strong">{title}</h2>
          <button className="btn-icon ml-auto" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
