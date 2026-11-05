import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { LogoMark, PucukRebung } from "../components/Brand";
import { useToast } from "../components/Toast";

export const FAKULTAS = [
  "Fakultas Keguruan dan Ilmu Pendidikan", "Fakultas Pertanian", "Fakultas Ekonomi dan Bisnis",
  "Fakultas Ilmu Sosial dan Ilmu Politik", "Fakultas Teknik", "Fakultas Matematika dan Ilmu Pengetahuan Alam",
  "Fakultas Perikanan dan Kelautan", "Fakultas Hukum", "Fakultas Kedokteran", "Fakultas Keperawatan", "Pascasarjana", "Lainnya",
];

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <div className="pola-balai pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative w-full max-w-md">
        <Link to="/" className="mb-3 inline-flex min-h-[44px] items-center gap-2 text-sm text-teks-2 hover:text-teks"><ArrowLeft size={16} /> Kembali ke Balai Ilmu</Link>
        <div className="card overflow-hidden">
          <PucukRebung />
          <div className="space-y-5 p-6 md:p-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <LogoMark size={52} />
              <div>
                <h1 className="font-serif text-2xl font-semibold text-primary-strong">{title}</h1>
                <p className="mt-1 text-sm text-teks-2">{subtitle}</p>
              </div>
            </div>
            {children}
          </div>
        </div>
        {footer && <div className="mt-4 text-center text-sm text-teks-2">{footer}</div>}
      </div>
    </div>
  );
}

function Field({ id, label, hint, ...rest }: { id: string; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <input id={id} className="input" {...rest} />
      {hint && <p className="text-xs text-teks-2">{hint}</p>}
    </div>
  );
}

function PasswordField({ id, label, value, onChange, autoComplete, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string; hint?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <div className="relative">
        <input id={id} className="input pr-12" type={show ? "text" : "password"} autoComplete={autoComplete} required value={value} onChange={(e) => onChange(e.target.value)} />
        <button type="button" onClick={() => setShow((s) => !s)} className="btn-icon absolute right-0 top-1/2 -translate-y-1/2" aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {hint && <p className="text-xs text-teks-2">{hint}</p>}
    </div>
  );
}

function useSubmit() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const run = (fn: () => Promise<void>) => async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try { await fn(); } catch (err) { setError((err as Error).message); } finally { setLoading(false); }
  };
  return { error, loading, run };
}

const ErrorBox = ({ error }: { error: string }) => error ? <p role="alert" className="rounded-sm bg-error-soft px-3 py-2 text-sm text-error">{error}</p> : null;

export function LoginPage() {
  const { signIn } = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { error, loading, run } = useSubmit();
  return (
    <AuthShell title="Masuk" subtitle="Riwayat percakapanmu tersimpan dan tersinkron di semua perangkat."
      footer={<>Belum punya akun? <Link to="/daftar" className="font-semibold text-primary underline-offset-2 hover:underline">Daftar gratis</Link></>}>
      <form className="space-y-4" onSubmit={run(async () => {
        const s = await api.userLogin(email.trim(), password);
        signIn(s); toast(`Selamat datang, ${s.user.name}!`); nav("/");
      })}>
        <Field id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordField id="password" label="Kata sandi" autoComplete="current-password" value={password} onChange={setPassword} />
        <div className="text-right text-sm"><Link to="/lupa-password" className="text-primary hover:underline">Lupa kata sandi?</Link></div>
        <ErrorBox error={error} />
        <button className="btn-primary w-full" disabled={loading || !email || !password}>{loading && <Loader2 size={16} className="animate-spin" />} Masuk</button>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { signIn, config } = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const [f, setF] = useState({ name: "", email: "", password: "", fakultas: "" });
  const { error, loading, run } = useSubmit();
  const upd = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  if (config && !config.registration) {
    return <AuthShell title="Pendaftaran ditutup" subtitle="Pendaftaran akun baru sedang tidak dibuka. Kamu tetap bisa bertanya tanpa akun."><Link to="/" className="btn-primary w-full">Kembali bertanya</Link></AuthShell>;
  }
  return (
    <AuthShell title="Buat akun" subtitle="Gratis. Simpan riwayat, lampirkan dokumen, dan bagikan percakapan."
      footer={<>Sudah punya akun? <Link to="/masuk" className="font-semibold text-primary underline-offset-2 hover:underline">Masuk</Link></>}>
      <form className="space-y-4" onSubmit={run(async () => {
        const s = await api.register({ name: f.name.trim(), email: f.email.trim(), password: f.password, fakultas: f.fakultas || undefined });
        signIn(s); toast("Akun berhasil dibuat"); nav("/");
      })}>
        <Field id="name" label="Nama" autoComplete="name" required maxLength={80} value={f.name} onChange={upd("name")} />
        <Field id="email" label="Email" type="email" autoComplete="email" required value={f.email} onChange={upd("email")} />
        <PasswordField id="password" label="Kata sandi" autoComplete="new-password" value={f.password} onChange={(v) => setF({ ...f, password: v })} hint="Minimal 8 karakter." />
        <div className="space-y-1.5">
          <label htmlFor="fakultas" className="text-sm font-semibold">Fakultas <span className="font-normal text-teks-2">(opsional)</span></label>
          <select id="fakultas" className="input" value={f.fakultas} onChange={upd("fakultas")}>
            <option value="">Pilih fakultas</option>
            {FAKULTAS.map((x) => <option key={x}>{x}</option>)}
          </select>
        </div>
        <ErrorBox error={error} />
        <button className="btn-primary w-full" disabled={loading || !f.name || !f.email || f.password.length < 8}>{loading && <Loader2 size={16} className="animate-spin" />} Daftar</button>
        <p className="text-center text-xs text-teks-2">Jangan memakai kata sandi akun kampus (SSO/SIAKAD). Balai Ilmu adalah proyek mahasiswa, bukan layanan resmi.</p>
      </form>
    </AuthShell>
  );
}

export function ForgotPage() {
  const { config } = useSession();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { error, loading, run } = useSubmit();
  if (sent) {
    return (
      <AuthShell title="Periksa email" subtitle="">
        <div className="flex flex-col items-center gap-3 text-center">
          <MailCheck size={40} className="text-primary" />
          <p>Jika <strong>{email}</strong> terdaftar, tautan untuk membuat kata sandi baru sudah dikirim. Tautan berlaku 1 jam.</p>
          <Link to="/masuk" className="btn-secondary">Kembali ke halaman masuk</Link>
        </div>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Lupa kata sandi" subtitle={config?.email_reset ? "Masukkan email akunmu. Kami kirimkan tautan untuk membuat kata sandi baru." : "Pengiriman email belum diaktifkan di server ini."}>
      {config?.email_reset === false ? (
        <div className="space-y-3 text-sm">
          <p>Hubungi admin Balai Ilmu dan sebutkan email akunmu. Admin dapat membuatkan tautan reset kata sandi untukmu.</p>
          <Link to="/masuk" className="btn-secondary w-full">Kembali ke halaman masuk</Link>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={run(async () => { await api.forgot(email.trim()); setSent(true); })}>
          <Field id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <ErrorBox error={error} />
          <button className="btn-primary w-full" disabled={loading || !email}>{loading && <Loader2 size={16} className="animate-spin" />} Kirim tautan</button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { signIn } = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const { error, loading, run } = useSubmit();
  return (
    <AuthShell title="Kata sandi baru" subtitle="Buat kata sandi baru untuk akunmu.">
      {!token ? <ErrorBox error="Tautan tidak lengkap. Buka lagi tautan dari email atau admin." /> : (
        <form className="space-y-4" onSubmit={run(async () => {
          if (password !== confirm) throw new Error("Konfirmasi kata sandi tidak sama.");
          const s = await api.reset(token, password);
          signIn(s); toast("Kata sandi diperbarui"); nav("/");
        })}>
          <PasswordField id="password" label="Kata sandi baru" autoComplete="new-password" value={password} onChange={setPassword} hint="Minimal 8 karakter." />
          <PasswordField id="confirm" label="Ulangi kata sandi" autoComplete="new-password" value={confirm} onChange={setConfirm} />
          <ErrorBox error={error} />
          <button className="btn-primary w-full" disabled={loading || password.length < 8 || !confirm}>{loading && <Loader2 size={16} className="animate-spin" />} Simpan kata sandi</button>
        </form>
      )}
    </AuthShell>
  );
}
