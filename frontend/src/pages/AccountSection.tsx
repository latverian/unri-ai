import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { KeyRound, Loader2, LogIn, LogOut, MonitorX, Trash2, UserPlus, UserRound } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { useToast } from "../components/Toast";
import { FAKULTAS } from "./AuthPages";

function Card({ title, icon, desc, children }: { title: string; icon: React.ReactNode; desc?: string; children: React.ReactNode }) {
  return (
    <section className="card p-4 md:p-6">
      <h2 className="flex items-center gap-2 font-serif text-xl font-semibold text-primary-strong">{icon} {title}</h2>
      {desc && <p className="mt-1 text-sm text-teks-2">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Tab "Akun" di Pengaturan. */
export function AccountSection() {
  const { user, setUser, signIn, signOut } = useSession();
  const toast = useToast();
  const nav = useNavigate();
  const [name, setName] = useState(user?.name ?? "");
  const [fakultas, setFakultas] = useState(user?.fakultas ?? "");
  const [pw, setPw] = useState({ current: "", next: "" });
  const [delPw, setDelPw] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  if (!user) {
    return (
      <Card title="Akun" icon={<UserRound size={20} />} desc="Kamu sedang memakai Balai Ilmu tanpa akun. Riwayat hanya tersimpan di perangkat ini.">
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-teks-2">
          <li>Riwayat percakapan tersinkron di HP dan laptop</li>
          <li>Lampirkan PDF untuk ditanyakan</li>
          <li>Bagikan percakapan lewat tautan</li>
        </ul>
        <div className="flex flex-wrap gap-2">
          <Link to="/daftar" className="btn-primary"><UserPlus size={16} /> Buat akun gratis</Link>
          <Link to="/masuk" className="btn-secondary"><LogIn size={16} /> Masuk</Link>
        </div>
      </Card>
    );
  }

  const act = (key: string, fn: () => Promise<void>) => async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(key);
    try { await fn(); } catch (err) { toast((err as Error).message, "error"); } finally { setBusy(null); }
  };
  const spin = (key: string) => busy === key && <Loader2 size={16} className="animate-spin" />;

  return (
    <div className="space-y-5">
      <Card title="Profil" icon={<UserRound size={20} />} desc={`Masuk sebagai ${user.email} · bergabung ${new Date(user.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`}>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={act("profil", async () => {
          const r = await api.updateMe({ name: name.trim(), fakultas });
          setUser(r.user); toast("Profil disimpan");
        })}>
          <div className="space-y-1.5"><label htmlFor="p-name" className="text-sm font-semibold">Nama</label>
            <input id="p-name" className="input" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><label htmlFor="p-fak" className="text-sm font-semibold">Fakultas</label>
            <select id="p-fak" className="input" value={fakultas} onChange={(e) => setFakultas(e.target.value)}>
              <option value="">Tidak disebutkan</option>
              {FAKULTAS.map((x) => <option key={x}>{x}</option>)}
            </select></div>
          <div className="sm:col-span-2"><button className="btn-primary" disabled={!name.trim() || busy === "profil"}>{spin("profil")} Simpan profil</button></div>
        </form>
      </Card>

      <Card title="Kata sandi" icon={<KeyRound size={20} />} desc="Setelah diganti, semua perangkat lain otomatis keluar.">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={act("pw", async () => {
          const s = await api.changePassword(pw.current, pw.next);
          signIn(s); setPw({ current: "", next: "" }); toast("Kata sandi diganti");
        })}>
          <div className="space-y-1.5"><label htmlFor="pw-cur" className="text-sm font-semibold">Kata sandi saat ini</label>
            <input id="pw-cur" type="password" autoComplete="current-password" className="input" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
          <div className="space-y-1.5"><label htmlFor="pw-new" className="text-sm font-semibold">Kata sandi baru</label>
            <input id="pw-new" type="password" autoComplete="new-password" className="input" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            <p className="text-xs text-teks-2">Minimal 8 karakter.</p></div>
          <div className="sm:col-span-2"><button className="btn-primary" disabled={!pw.current || pw.next.length < 8 || busy === "pw"}>{spin("pw")} Ganti kata sandi</button></div>
        </form>
      </Card>

      <Card title="Sesi" icon={<MonitorX size={20} />}>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => { signOut(); toast("Kamu sudah keluar"); nav("/"); }}><LogOut size={16} /> Keluar dari perangkat ini</button>
          <button className="btn-secondary" disabled={busy === "all"} onClick={act("all", async () => {
            if (!confirm("Keluar dari semua perangkat, termasuk perangkat ini?")) return;
            await api.logoutAll(); signOut(); toast("Semua sesi diakhiri"); nav("/masuk");
          })}>{spin("all")} <MonitorX size={16} /> Keluar dari semua perangkat</button>
        </div>
      </Card>

      <Card title="Hapus akun" icon={<Trash2 size={20} />} desc="Akun, seluruh riwayat percakapan, lampiran, dan tautan yang dibagikan akan dihapus permanen.">
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={act("del", async () => {
          if (!confirm("Hapus akun dan semua datanya secara permanen? Tindakan ini tidak bisa dibatalkan.")) return;
          await api.deleteAccount(delPw); signOut(); toast("Akun dihapus"); nav("/");
        })}>
          <label htmlFor="del-pw" className="sr-only">Kata sandi untuk konfirmasi</label>
          <input id="del-pw" type="password" autoComplete="current-password" placeholder="Masukkan kata sandi untuk konfirmasi" className="input" value={delPw} onChange={(e) => setDelPw(e.target.value)} />
          <button className="btn-secondary shrink-0 text-error hover:bg-error-soft" disabled={!delPw || busy === "del"}>{spin("del")} Hapus akun</button>
        </form>
      </Card>
    </div>
  );
}
