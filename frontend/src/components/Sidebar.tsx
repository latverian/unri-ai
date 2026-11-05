import { Link } from "react-router-dom";
import { History, LibraryBig, MessageSquare, Plus, Settings, Trash2, X } from "lucide-react";
import type { Conversation } from "../lib/types";
import { LogoMark, Wordmark } from "./Brand";

type Props = {
  conversations: Conversation[];
  activeId: string | null;
  open: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onClose: () => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onClearAll: () => void;
};

function groupOf(ts: number): string {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const day = 86_400_000;
  if (ts >= start.getTime()) return "Hari ini";
  if (ts >= start.getTime() - day) return "Kemarin";
  if (ts >= start.getTime() - 6 * day) return "Pekan ini";
  return "Sebelumnya";
}

export function Sidebar(p: Props) {
  const groups = new Map<string, Conversation[]>();
  for (const c of p.conversations) {
    const g = groupOf(c.updatedAt);
    groups.set(g, [...(groups.get(g) ?? []), c]);
  }

  const clearAll = () => {
    if (confirm("Hapus semua riwayat percakapan di perangkat ini? Tindakan ini tidak bisa dibatalkan.")) p.onClearAll();
  };

  return (
    <>
      {/* Lapisan gelap di belakang drawer (HP) */}
      <div onClick={p.onClose} aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden ${p.open ? "opacity-100" : "pointer-events-none opacity-0"}`} />
      <aside aria-label="Riwayat percakapan"
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-garis bg-surface2 transition-transform lg:static lg:translate-x-0 ${p.open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-3 px-4 pb-3 pt-4">
          <LogoMark size={36} />
          <Wordmark />
          <button className="btn-icon ml-auto lg:hidden" onClick={p.onClose} aria-label="Tutup menu"><X size={20} /></button>
        </div>
        <div className="px-4 pb-3">
          <button className="btn-primary w-full" onClick={p.onNew}><Plus size={18} /> Percakapan Baru</button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
          {p.conversations.length === 0 && (
            <p className="px-2 pt-2 text-sm text-teks-2">Belum ada riwayat. Pertanyaanmu akan tersimpan di perangkat ini.</p>
          )}
          {[...groups.entries()].map(([label, list]) => (
            <div key={label}>
              <div className="label-caps px-2 pb-1 text-teks-2">{label}</div>
              <ul className="space-y-0.5">
                {list.map((c) => {
                  const active = c.id === p.activeId;
                  const Icon = label === "Hari ini" ? MessageSquare : History;
                  return (
                    <li key={c.id}>
                      <button onClick={() => p.onSelect(c.id)} aria-current={active ? "page" : undefined}
                        className={`flex min-h-[40px] w-full items-center gap-2 rounded-sm px-2 text-left text-sm transition-colors ${active ? "bg-primary-soft font-semibold text-primary-strong" : "text-teks-2 hover:bg-surface hover:text-teks"}`}>
                        <Icon size={16} className="shrink-0" />
                        <span className="truncate">{c.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="space-y-1 border-t border-garis p-3">
          <Link to="/pengaturan" className="flex min-h-[40px] items-center gap-2 rounded-sm px-2 text-sm text-teks-2 hover:bg-surface hover:text-teks">
            <Settings size={18} /> Pengaturan
            <span className="label-caps ml-auto rounded bg-emas-soft px-1.5 py-0.5 text-emas-teks">{p.theme === "dark" ? "Gelap" : "Terang"}</span>
          </Link>
          <Link to="/admin" className="flex min-h-[40px] items-center gap-2 rounded-sm px-2 text-sm text-teks-2 hover:bg-surface hover:text-teks">
            <LibraryBig size={18} /> Kelola Dokumen <span className="text-xs text-teks-2/80">(admin)</span>
          </Link>
          {p.conversations.length > 0 && (
            <button onClick={clearAll} className="flex min-h-[40px] w-full items-center gap-2 rounded-sm px-2 text-sm text-teks-2 hover:bg-error-soft hover:text-error">
              <Trash2 size={18} /> Hapus riwayat
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
