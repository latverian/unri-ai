import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, LogIn, ShieldCheck } from "lucide-react";
import { api, auth } from "../lib/api";
import { LogoMark, PucukRebung } from "../components/Brand";

export default function AdminLogin() {
  const nav = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/admin";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await api.login(username.trim(), password);
      auth.set(r.access_token);
      nav(from, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <div className="pola-balai pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative w-full max-w-md">
        <Link to="/" className="mb-3 inline-flex min-h-[44px] items-center gap-2 text-sm text-teks-2 hover:text-teks">
          <ArrowLeft size={16} /> Kembali ke halaman tanya jawab
        </Link>
        <div className="card overflow-hidden">
          <PucukRebung />
          <div className="space-y-6 p-6 md:p-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <LogoMark size={56} />
              <div>
                <h1 className="font-serif text-2xl font-semibold text-primary-strong">
                  UNRI GPT <span className="label-caps ml-1 rounded bg-primary px-1.5 py-0.5 align-middle text-onprimary">Admin</span>
                </h1>
                <p className="mt-1 text-sm text-teks-2">Masuk untuk mengelola dokumen rujukan.</p>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label htmlFor="username" className="text-sm font-semibold">Nama pengguna</label>
                <input id="username" className="input" autoComplete="username" required value={username}
                  onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-semibold">Kata sandi</label>
                <div className="relative">
                  <input id="password" className="input pr-12" type={show ? "text" : "password"} autoComplete="current-password"
                    required value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShow((s) => !s)} className="btn-icon absolute right-0 top-1/2 -translate-y-1/2"
                    aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}>
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              {error && <p role="alert" className="rounded-sm bg-error-soft px-3 py-2 text-sm text-error">{error}</p>}
              <button className="btn-primary w-full" disabled={loading || !username || !password}>
                <LogIn size={18} /> {loading ? "Memeriksa…" : "Masuk"}
              </button>
            </form>
            <p className="flex items-center justify-center gap-1.5 text-xs text-teks-2">
              <ShieldCheck size={14} /> Sesi berlaku 8 jam dan berakhir saat tab ditutup.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
