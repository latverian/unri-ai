import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogIn, LogOut, Settings, UserPlus, UserRound } from "lucide-react";
import { auth } from "../lib/api";
import { useSession } from "../lib/session";
import { useToast } from "./Toast";

/** Tombol akun di header: status sesi, Pengaturan, masuk/keluar, dan pintu masuk admin. */
export function AccountMenu() {
  const { user, signOut } = useSession();
  const toast = useToast();
  const nav = useNavigate();
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

  const item = "flex min-h-[44px] w-full items-center gap-3 rounded-sm px-3 text-left text-sm hover:bg-surface2";
  const initial = user?.name.trim().charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Menu akun"
        className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-onprimary hover:bg-primary-hover">
        {initial || <UserRound size={18} />}
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 top-11 z-50 w-72 animate-rise p-2">
          <div className="flex items-center gap-3 px-3 py-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary">{initial || <UserRound size={20} />}</span>
            <div className="min-w-0">
              <div className="truncate font-semibold">{user ? user.name : "Tamu"}</div>
              <div className="truncate text-xs text-teks-2">{user ? user.email : "Riwayat hanya tersimpan di perangkat ini"}</div>
            </div>
          </div>
          <div className="my-1 h-px bg-garis" />
          {!user && <>
            <Link role="menuitem" to="/masuk" className={item} onClick={() => setOpen(false)}><LogIn size={18} /> Masuk</Link>
            <Link role="menuitem" to="/daftar" className={item} onClick={() => setOpen(false)}><UserPlus size={18} /> Buat akun</Link>
          </>}
          <Link role="menuitem" to={user ? "/pengaturan?tab=akun" : "/pengaturan"} className={item} onClick={() => setOpen(false)}><Settings size={18} /> Pengaturan{user ? " & akun" : ""}</Link>
          {isAdmin
            ? <Link role="menuitem" to="/admin" className={item} onClick={() => setOpen(false)}><LayoutDashboard size={18} /> Panel admin</Link>
            : <Link role="menuitem" to="/admin/login" className={item} onClick={() => setOpen(false)}><LayoutDashboard size={18} /> Masuk sebagai admin</Link>}
          {user && <>
            <div className="my-1 h-px bg-garis" />
            <button role="menuitem" className={`${item} text-error hover:bg-error-soft`} onClick={() => { setOpen(false); signOut(); toast("Kamu sudah keluar"); nav("/"); }}>
              <LogOut size={18} /> Keluar
            </button>
          </>}
        </div>
      )}
    </div>
  );
}
