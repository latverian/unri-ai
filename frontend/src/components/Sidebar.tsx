import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Download, History, LibraryBig, Link2, LogIn, MessageSquare, MoreHorizontal, Pencil, Pin, PinOff, Plus, Search,
  Settings, Trash2, UserRound, X,
} from "lucide-react";
import type { Conversation, User } from "../lib/types";
import { LogoMark, Wordmark } from "./Brand";

type Props = {
  conversations: Conversation[];
  total: number;
  activeId: string | null;
  open: boolean;
  theme: "light" | "dark";
  user: User | null;
  loading: boolean;
  query: string;
  searchRef: React.RefObject<HTMLInputElement>;
  onQuery: (q: string) => void;
  onClose: () => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onTogglePin: (id: string) => void;
  onShare: (id: string) => void;
  onExport: (id: string) => void;
  onDelete: (id: string) => void;
};

function groupOf(c: Conversation): string {
  if (c.pinned) return "Disematkan";
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const day = 86_400_000;
  if (c.updatedAt >= start.getTime()) return "Hari ini";
  if (c.updatedAt >= start.getTime() - day) return "Kemarin";
  if (c.updatedAt >= start.getTime() - 6 * day) return "Pekan ini";
  if (c.updatedAt >= start.getTime() - 29 * day) return "30 hari terakhir";
  return "Sebelumnya";
}

function ItemMenu({ c, p, onRename }: { c: Conversation; p: Props; onRename: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const item = "flex min-h-[40px] w-full items-center gap-2.5 rounded-sm px-3 text-left text-sm hover:bg-surface2";
  const act = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={`Opsi untuk ${c.title}`}
        className="flex h-8 w-8 items-center justify-center rounded-sm text-teks-2 opacity-100 hover:bg-surface hover:text-teks lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100 aria-expanded:opacity-100">
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 top-9 z-50 w-52 animate-rise p-1.5">
          <button role="menuitem" className={item} onClick={act(onRename)}><Pencil size={15} /> Ganti nama</button>
          <button role="menuitem" className={item} onClick={act(() => p.onTogglePin(c.id))}>
            {c.pinned ? <PinOff size={15} /> : <Pin size={15} />} {c.pinned ? "Lepas sematan" : "Sematkan"}
          </button>
          {p.user && <button role="menuitem" className={item} onClick={act(() => p.onShare(c.id))}><Link2 size={15} /> {c.shareToken ? "Kelola tautan" : "Bagikan"}</button>}
          <button role="menuitem" className={item} onClick={act(() => p.onExport(c.id))}><Download size={15} /> Ekspor (.md)</button>
          <div className="my-1 h-px bg-garis" />
          <button role="menuitem" className={`${item} text-error hover:bg-error-soft`} onClick={act(() => p.onDelete(c.id))}><Trash2 size={15} /> Hapus</button>
        </div>
      )}
    </div>
  );
}

function Row({ c, p }: { c: Conversation; p: Props }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(c.title);
  const active = c.id === p.activeId;
  const Icon = c.pinned ? Pin : groupOf(c) === "Hari ini" ? MessageSquare : History;
  if (editing) {
    return (
      <li>
        <form onSubmit={(e) => { e.preventDefault(); p.onRename(c.id, title); setEditing(false); }}>
          <label className="sr-only" htmlFor={`rename-${c.id}`}>Nama percakapan</label>
          <input id={`rename-${c.id}`} autoFocus className="input py-1.5 text-sm" value={title} maxLength={120}
            onChange={(e) => setTitle(e.target.value)} onBlur={() => { p.onRename(c.id, title); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === "Escape") { setTitle(c.title); setEditing(false); } }} />
        </form>
      </li>
    );
  }
  return (
    <li className={`group flex items-center rounded-sm pr-1 ${active ? "bg-primary-soft" : "hover:bg-surface"}`}>
      <button onClick={() => p.onSelect(c.id)} aria-current={active ? "page" : undefined}
        className={`flex min-h-[40px] min-w-0 flex-1 items-center gap-2 px-2 text-left text-sm ${active ? "font-semibold text-primary-strong" : "text-teks-2 group-hover:text-teks"}`}>
        <Icon size={15} className="shrink-0" />
        <span className="truncate">{c.title}</span>
        {c.shareToken && <Link2 size={13} className="shrink-0 text-emas-teks" aria-label="Dibagikan" />}
      </button>
      <ItemMenu c={c} p={p} onRename={() => { setTitle(c.title); setEditing(true); }} />
    </li>
  );
}

export function Sidebar(p: Props) {
  const groups = new Map<string, Conversation[]>();
  for (const c of p.conversations) {
    const g = groupOf(c);
    groups.set(g, [...(groups.get(g) ?? []), c]);
  }

  return (
    <>
      <div onClick={p.onClose} aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden ${p.open ? "opacity-100" : "pointer-events-none opacity-0"}`} />
      <aside aria-label="Riwayat percakapan"
        className={`fixed inset-y-0 left-0 z-50 flex w-[288px] flex-col border-r border-garis bg-surface2 transition-transform lg:static lg:translate-x-0 ${p.open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-3 px-4 pb-3 pt-4">
          <LogoMark size={36} />
          <Wordmark />
          <button className="btn-icon ml-auto lg:hidden" onClick={p.onClose} aria-label="Tutup menu"><X size={20} /></button>
        </div>
        <div className="space-y-2 px-4 pb-3">
          <button className="btn-primary w-full" onClick={p.onNew} title="Percakapan baru (Ctrl+Shift+O)"><Plus size={18} /> Percakapan Baru</button>
          {p.total > 0 && (
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-teks-2" />
              <label htmlFor="cari-riwayat" className="sr-only">Cari percakapan</label>
              <input id="cari-riwayat" ref={p.searchRef} value={p.query} onChange={(e) => p.onQuery(e.target.value)} placeholder="Cari percakapan… (Ctrl+K)"
                className="input py-2 pl-9 pr-8 text-sm" />
              {p.query && <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-teks-2 hover:text-teks" onClick={() => p.onQuery("")} aria-label="Hapus pencarian"><X size={14} /></button>}
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
          {p.loading && p.conversations.length === 0 && [0, 1, 2].map((i) => <div key={i} className="mx-2 h-8 animate-pulse rounded-sm bg-surface" />)}
          {!p.loading && p.total === 0 && (
            <p className="px-2 pt-2 text-sm text-teks-2">
              Belum ada riwayat. {p.user ? "Percakapanmu tersimpan di akun dan tersinkron antarperangkat." : "Pertanyaanmu tersimpan di perangkat ini."}
            </p>
          )}
          {p.query && p.conversations.length === 0 && p.total > 0 && <p className="px-2 text-sm text-teks-2">Tidak ada percakapan yang cocok.</p>}
          {[...groups.entries()].map(([label, list]) => (
            <div key={label}>
              <div className="label-caps px-2 pb-1 text-teks-2">{label}</div>
              <ul className="space-y-0.5">{list.map((c) => <Row key={c.id} c={c} p={p} />)}</ul>
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
          {p.user ? (
            <Link to="/pengaturan?tab=akun" className="flex items-center gap-2 rounded-sm bg-surface p-2 hover:ring-1 hover:ring-garis">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-onprimary">
                {p.user.name.trim().charAt(0).toUpperCase() || <UserRound size={16} />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{p.user.name}</span>
                <span className="block truncate text-xs text-teks-2">{p.user.fakultas || p.user.email}</span>
              </span>
            </Link>
          ) : (
            <Link to="/masuk" className="btn-secondary w-full"><LogIn size={16} /> Masuk / Daftar</Link>
          )}
        </div>
      </aside>
    </>
  );
}
