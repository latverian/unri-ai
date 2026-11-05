import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, FileStack, LogOut, MessageSquare, Moon, Sun } from "lucide-react";
import { auth } from "../lib/api";
import { useTheme } from "../lib/theme";
import { LogoMark, PucukRebung } from "../components/Brand";

export default function AdminLayout() {
  const loc = useLocation();
  const nav = useNavigate();
  const { theme, toggle } = useTheme();
  if (!auth.get()) return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />;

  const link = ({ isActive }: { isActive: boolean }) =>
    `inline-flex min-h-[40px] items-center gap-2 rounded-sm px-3 text-sm font-medium transition-colors ${isActive ? "bg-primary-soft text-primary-strong" : "text-teks-2 hover:bg-surface2 hover:text-teks"}`;

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
          <LogoMark size={30} />
          <span className="mr-2 hidden font-serif text-lg font-semibold text-primary-strong sm:inline">
            UNRI <span className="font-sans text-emas-teks">GPT</span> <span className="label-caps text-teks-2">Admin</span>
          </span>
          <nav className="flex items-center gap-1" aria-label="Menu admin">
            <NavLink to="/admin" end className={link}><FileStack size={18} /> <span className="hidden sm:inline">Dokumen</span></NavLink>
            <NavLink to="/admin/insights" className={link}><BarChart3 size={18} /> <span className="hidden sm:inline">Insights</span></NavLink>
            <NavLink to="/" className={link}><MessageSquare size={18} /> <span className="hidden sm:inline">Chat</span></NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <button className="btn-icon" onClick={toggle} aria-label={theme === "dark" ? "Gunakan mode terang" : "Gunakan mode gelap"}>
              {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className="btn-icon" aria-label="Keluar" title="Keluar" onClick={() => { auth.clear(); nav("/admin/login"); }}>
              <LogOut size={20} />
            </button>
          </div>
        </div>
        <PucukRebung />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}
