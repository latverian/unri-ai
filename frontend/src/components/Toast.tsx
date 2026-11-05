import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

type Toast = { id: number; text: string; kind: "ok" | "error" };
const Ctx = createContext<(text: string, kind?: Toast["kind"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);
  const show = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    const id = ++next.current;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4 md:inset-x-auto md:bottom-6 md:right-6 md:top-auto md:items-end"
        role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="card flex animate-rise items-center gap-2 px-4 py-2.5 text-sm font-medium">
            {t.kind === "ok" ? <CheckCircle2 size={16} className="text-primary" /> : <AlertTriangle size={16} className="text-error" />}
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
