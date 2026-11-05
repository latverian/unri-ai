import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ban, CheckCircle2, Copy, KeyRound, Search, Trash2, Users } from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { AdminUser } from "../lib/types";
import { Modal } from "../components/Modal";
import { useToast } from "../components/Toast";

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "–");

export default function AdminUsers() {
  const toast = useToast();
  const nav = useNavigate();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [reset, setReset] = useState<{ email: string; link: string } | null>(null);

  const onError = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) nav("/admin/login", { replace: true });
    else toast((e as Error).message, "error");
  }, [nav, toast]);

  const load = useCallback((query = "") => api.users(query).then((r) => { setUsers(r.users); setTotal(r.total); }).catch(onError), [onError]);
  useEffect(() => { const t = setTimeout(() => load(q.trim()), 250); return () => clearTimeout(t); }, [q, load]);

  const toggle = async (u: AdminUser) => {
    if (!u.disabled && !confirm(`Nonaktifkan ${u.email}? Pengguna ini langsung keluar dan tidak bisa masuk.`)) return;
    try { await api.setUserDisabled(u.id, !u.disabled); toast(u.disabled ? "Akun diaktifkan" : "Akun dinonaktifkan"); load(q.trim()); } catch (e) { onError(e); }
  };
  const makeLink = async (u: AdminUser) => {
    try { const r = await api.userResetLink(u.id); setReset({ email: u.email, link: r.link }); } catch (e) { onError(e); }
  };
  const remove = async (u: AdminUser) => {
    if (!confirm(`Hapus akun ${u.email} beserta seluruh riwayatnya? Tidak bisa dibatalkan.`)) return;
    try { await api.deleteUser(u.id); toast("Akun dihapus"); load(q.trim()); } catch (e) { onError(e); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[26px] font-semibold text-primary-strong md:text-[32px]">Pengguna</h1>
        <p className="mt-1 text-teks-2">{total} akun terdaftar. Kelola akses dan bantu pengguna yang lupa kata sandi.</p>
      </div>
      <div className="relative max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-teks-2" />
        <label htmlFor="cari-pengguna" className="sr-only">Cari pengguna</label>
        <input id="cari-pengguna" className="input pl-9" placeholder="Cari nama atau email…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <section className="card overflow-hidden">
        {users === null ? <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-sm bg-surface2" />)}</div>
          : users.length === 0 ? <div className="flex flex-col items-center gap-2 p-10 text-center text-teks-2"><Users size={32} /> {q ? "Tidak ada yang cocok." : "Belum ada pengguna terdaftar."}</div>
          : (
            <ul className="divide-y divide-garis">
              {users.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-6">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary">{u.name.charAt(0).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="truncate font-semibold">{u.name}</span>
                      {u.disabled && <span className="rounded-full bg-error-soft px-2 py-0.5 text-xs font-semibold text-error">Nonaktif</span>}</div>
                    <div className="truncate text-sm text-teks-2">{u.email}{u.fakultas ? ` · ${u.fakultas}` : ""}</div>
                  </div>
                  <div className="text-xs text-teks-2">
                    <div>{u.conversations} percakapan</div>
                    <div>Daftar {date(u.created_at)} · terakhir masuk {date(u.last_login_at)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="btn-icon" onClick={() => makeLink(u)} aria-label={`Buat tautan reset untuk ${u.email}`} title="Buat tautan reset kata sandi"><KeyRound size={16} /></button>
                    <button className="btn-icon" onClick={() => toggle(u)} aria-label={`${u.disabled ? "Aktifkan" : "Nonaktifkan"} ${u.email}`} title={u.disabled ? "Aktifkan" : "Nonaktifkan"}>
                      {u.disabled ? <CheckCircle2 size={16} /> : <Ban size={16} />}</button>
                    <button className="btn-icon hover:bg-error-soft hover:text-error" onClick={() => remove(u)} aria-label={`Hapus ${u.email}`} title="Hapus akun"><Trash2 size={16} /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
      </section>
      {reset && (
        <Modal title="Tautan reset kata sandi" onClose={() => setReset(null)}>
          <p className="text-sm text-teks-2">Berikan tautan ini langsung kepada <strong>{reset.email}</strong> (misalnya lewat pesan pribadi). Berlaku 1 jam dan hanya bisa dipakai sekali.</p>
          <div className="mt-3 flex gap-2">
            <label htmlFor="reset-link" className="sr-only">Tautan reset</label>
            <input id="reset-link" readOnly className="input text-sm" value={reset.link} onFocus={(e) => e.target.select()} />
            <button className="btn-primary shrink-0" onClick={() => navigator.clipboard.writeText(reset.link).then(() => toast("Tautan disalin")).catch(() => {})}><Copy size={16} /> Salin</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
