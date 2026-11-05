import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LogIn, LayoutDashboard, Settings, UserRound } from "lucide-react";
import { auth } from "../lib/api";

/** Tombol akun di header: status sesi, Pengaturan, dan pintu masuk admin. */
export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isAdmin = !!auth.get();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const item = "flex min-h-[44px] items-center gap-3 rounded-sm px-3 text-sm hover:bg-surface2";

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Menu akun"
        className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-onprimary hover:bg-primary-hover">
        <UserRound size={18} />
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 top-11 z-50 w-72 animate-rise p-2">
          <div className="flex items-center gap-3 px-3 py-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary"><UserRound size={20} /></span>
            <div className="min-w-0">
              <div className="font-semibold">{isAdmin ? "Admin" : "Mahasiswa"}</div>
              <div className="text-xs text-teks-2">{isAdmin ? "Sesi admin aktif di tab ini" : "Tanpa akun · riwayat tersimpan di perangkat ini"}</div>
            </div>
          </div>
          <div className="my-1 h-px bg-garis" />
          <Link role="menuitem" to="/pengaturan" className={item} onClick={() => setOpen(false)}><Settings size={18} /> Pengaturan</Link>
          {isAdmin
            ? <Link role="menuitem" to="/admin" className={item} onClick={() => setOpen(false)}><LayoutDashboard size={18} /> Panel admin</Link>
            : <Link role="menuitem" to="/admin/login" className={item} onClick={() => setOpen(false)}><LogIn size={18} /> Masuk sebagai admin</Link>}
        </div>
      )}
    </div>
  );
}
