import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, Info, Keyboard, MonitorSmartphone, Moon, Palette, ShieldCheck, Sparkles, Sun, Trash2, Type, UserRound, Volume2 } from "lucide-react";
import { api } from "../lib/api";
import { TEXT_SIZES, usePrefs, type TextSize, type ThemePref } from "../lib/prefs";
import { useSession } from "../lib/session";
import { clearConversations, loadConversations } from "../lib/storage";
import { AccountSection } from "./AccountSection";
import { LogoMark, PucukRebung } from "../components/Brand";
import { AccountMenu } from "../components/AccountMenu";
import { useToast } from "../components/Toast";

type Tab = "akun" | "tampilan" | "privasi" | "info";
const TABS: Tab[] = ["akun", "tampilan", "privasi", "info"];

function Switch({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-sm px-1 py-2">
      <span><span className="block font-medium">{label}</span><span className="block text-sm text-teks-2">{desc}</span></span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-garis"}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-6" : "left-1"}`} />
      </button>
    </label>
  );
}

function Section({ title, desc, icon, children }: { title: string; desc?: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-4 md:p-6">
      <h2 className="flex items-center gap-2 font-serif text-xl font-semibold text-primary-strong">{icon} {title}</h2>
      {desc && <p className="mt-1 text-sm text-teks-2">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const THEMES: { key: ThemePref; name: string; desc: string; icon: ReactNode; preview: string }[] = [
  { key: "light", name: "Balai Siang", desc: "Latar krem lembut dengan nuansa hijau.", icon: <Sun size={18} />, preview: "bg-[#FBF7EE] border-[#E4DECF]" },
  { key: "dark", name: "Malam Sungai Siak", desc: "Latar hijau pekat, nyaman dibaca malam hari.", icon: <Moon size={18} />, preview: "bg-[#0E1712] border-[#2A3B31]" },
  { key: "system", name: "Mengikuti Perangkat", desc: "Terang atau gelap sesuai pengaturan HP/laptop.", icon: <MonitorSmartphone size={18} />, preview: "bg-gradient-to-r from-[#FBF7EE] to-[#0E1712] border-[#E4DECF]" },
];

export default function SettingsPage() {
  const { prefs, set } = usePrefs();
  const toast = useToast();
  const { user } = useSession();
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.includes(params.get("tab") as Tab) ? (params.get("tab") as Tab) : "tampilan";
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true });
  const [count, setCount] = useState<number | null>(() => (user ? null : loadConversations().length));
  useEffect(() => {
    if (user && tab === "privasi") api.conversations().then((r) => setCount(r.conversations.length)).catch(() => setCount(0));
  }, [user, tab]);
  const [health, setHealth] = useState<Awaited<ReturnType<typeof api.health>> | null | "error">(null);

  useEffect(() => {
    if (tab === "info" && health === null) api.health().then(setHealth).catch(() => setHealth("error"));
  }, [tab, health]);

  const exportHistory = async () => {
    let list: unknown = loadConversations();
    if (user) {
      const { conversations } = await api.conversations();
      list = await Promise.all(conversations.map(async (c) => ({ ...c, messages: (await api.conversation(c.id)).messages })));
    }
    const data = JSON.stringify(list, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `riwayat-balai-ilmu-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    URL.revokeObjectURL(url);
  };
  const clearHistory = async () => {
    if (!confirm(user ? "Hapus semua riwayat percakapan di akunmu (di semua perangkat)? Tindakan ini tidak bisa dibatalkan."
      : "Hapus semua riwayat percakapan di perangkat ini? Tindakan ini tidak bisa dibatalkan.")) return;
    try {
      if (user) await api.deleteAllConversations(); else clearConversations();
      setCount(0);
      toast("Riwayat dihapus");
    } catch (e) { toast((e as Error).message, "error"); }
  };

  const tabs: { key: Tab; label: string; icon: ReactNode }[] = [
    { key: "akun", label: "Akun", icon: <UserRound size={16} /> },
    { key: "tampilan", label: "Tampilan", icon: <Palette size={16} /> },
    { key: "privasi", label: "Riwayat & Privasi", icon: <ShieldCheck size={16} /> },
    { key: "info", label: "Informasi Sistem", icon: <Info size={16} /> },
  ];

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-2 px-4">
          <Link to="/" className="btn-icon" aria-label="Kembali ke chat"><ArrowLeft size={20} /></Link>
          <LogoMark size={28} />
          <span className="font-serif text-lg font-semibold text-primary-strong">Pengaturan</span>
          <div className="ml-auto"><AccountMenu /></div>
        </div>
        <PucukRebung />
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        <div className="relative overflow-hidden rounded bg-primary-strong px-5 py-6 text-white dark:bg-primary-soft md:px-8">
          <span className="label-caps rounded bg-white/15 px-2 py-0.5 text-[#F6EBC8]">Balai Ilmu</span>
          <h1 className="mt-2 font-serif text-[26px] font-semibold leading-tight text-white dark:text-primary-strong md:text-[32px]">Pengaturan &amp; Preferensi</h1>
          <p className="mt-1 max-w-xl text-sm text-white/80 dark:text-teks-2">Atur tampilan dan privasi. Semua pengaturan tersimpan di perangkat ini dan langsung diterapkan.</p>
        </div>

        <div role="tablist" className="flex gap-1 overflow-x-auto rounded bg-surface2 p-1">
          {tabs.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-sm px-3 text-sm font-semibold transition-colors ${tab === t.key ? "bg-surface text-primary-strong shadow-card" : "text-teks-2 hover:text-teks"}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === "akun" && <div role="tabpanel"><AccountSection /></div>}

        {tab === "tampilan" && (
          <div role="tabpanel" className="space-y-5">
            <Section title="Tema" icon={<Palette size={20} />} desc="Pilih suasana tampilan yang nyaman untukmu.">
              <div className="grid gap-3 sm:grid-cols-3">
                {THEMES.map((t) => (
                  <button key={t.key} onClick={() => set({ theme: t.key })} aria-pressed={prefs.theme === t.key}
                    className={`rounded border-2 p-3 text-left transition-colors ${prefs.theme === t.key ? "border-primary bg-primary-soft" : "border-garis hover:border-primary/50"}`}>
                    <div className={`h-14 rounded-sm border ${t.preview}`} aria-hidden="true" />
                    <div className="mt-2 flex items-center gap-2 font-semibold">{t.icon} {t.name}</div>
                    <p className="mt-0.5 text-sm text-teks-2">{t.desc}</p>
                  </button>
                ))}
              </div>
            </Section>

            <div className="grid gap-5 md:grid-cols-2">
              <Section title="Ukuran teks jawaban" icon={<Type size={20} />}>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Ukuran teks jawaban">
                  {(Object.keys(TEXT_SIZES) as TextSize[]).map((k) => (
                    <button key={k} role="radio" aria-checked={prefs.textSize === k} onClick={() => set({ textSize: k })}
                      className={`min-h-[56px] rounded-sm border text-center ${prefs.textSize === k ? "border-primary bg-primary text-onprimary" : "border-garis bg-surface hover:bg-surface2"}`}>
                      <span className="block font-semibold">{TEXT_SIZES[k].label}</span>
                      <span className="block text-xs opacity-80">{TEXT_SIZES[k].px}px</span>
                    </button>
                  ))}
                </div>
                <div className="mt-3 rounded-sm border border-garis bg-surface2/60 p-3">
                  <div className="label-caps mb-1 text-teks-2">Pratinjau</div>
                  <p className="prose-jawaban">Dengan IPS 3,2, kamu boleh mengambil maksimal <strong>24 SKS</strong> pada semester berikutnya.</p>
                </div>
              </Section>

              <Section title="Nuansa Melayu" icon={<Sparkles size={20} />} desc="Sentuhan budaya pada tampilan.">
                <Switch checked={prefs.ornamen} onChange={(v) => set({ ornamen: v })} label="Ornamen pucuk rebung" desc="Garis motif songket dan pola latar." />
                <Switch checked={prefs.pantun} onChange={(v) => set({ pantun: v })} label="Pantun" desc="Pantun di layar sambutan dan saat menunggu." />
              </Section>

              <Section title="Suara" icon={<Volume2 size={20} />} desc="Memakai suara bawaan perangkat (bahasa Indonesia bila tersedia).">
                <Switch checked={prefs.autoSpeak} onChange={(v) => set({ autoSpeak: v })} label="Bacakan jawaban otomatis" desc="Setiap jawaban baru langsung dibacakan." />
              </Section>
            </div>
          </div>
        )}

        {tab === "privasi" && (
          <div role="tabpanel" className="space-y-5">
            <Section title="Riwayat percakapan" icon={<ShieldCheck size={20} />}
              desc={user ? "Riwayat tersimpan di akunmu dan tersinkron di semua perangkat. Hanya kamu yang bisa melihatnya, kecuali percakapan yang kamu bagikan."
                : "Kamu memakai Balai Ilmu tanpa akun. Riwayat chat hanya tersimpan di browser perangkat ini dan tidak dikirim ke mana pun."}>
              <p className="mb-3"><span className="font-serif text-3xl font-semibold">{count ?? "…"}</span> <span className="text-teks-2">percakapan tersimpan</span></p>
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary" disabled={!count} onClick={exportHistory}><Download size={16} /> Unduh riwayat (JSON)</button>
                <button className="btn-secondary hover:bg-error-soft hover:text-error" disabled={!count} onClick={clearHistory}><Trash2 size={16} /> Hapus semua riwayat</button>
              </div>
            </Section>
            <Section title="Data yang dikirim ke server" icon={<Info size={20} />}>
              <ul className="list-disc space-y-1 pl-5 text-sm text-teks-2">
                <li>Pertanyaan dan beberapa pesan sebelumnya, untuk menyusun jawaban.</li>
                {user && <li>Riwayat percakapan dan lampiran yang kamu unggah disimpan di akunmu sampai kamu menghapusnya.</li>}
                <li>Pertanyaan dicatat tanpa identitas atau alamat IP, dan dihapus otomatis setelah 90 hari.</li>
                <li>Penilaian 👍/👎 dan komentarmu, untuk memperbaiki kualitas jawaban.</li>
                <li>Jangan menulis data pribadi seperti NIM, nilai, atau nomor HP di kolom tanya.</li>
              </ul>
            </Section>
          </div>
        )}

        {tab === "info" && (
          <div role="tabpanel">
            <Section title="Informasi sistem" icon={<Info size={20} />}>
              {health === null ? <div className="h-24 animate-pulse rounded-sm bg-surface2" /> : health === "error" ? (
                <p className="text-error">Server tidak dapat dihubungi.</p>
              ) : (
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    ["Status server", health.status === "ok" ? "Aktif" : health.status],
                    ["Model AI (LLM)", health.llm_provider],
                    ["Model embedding", health.embed_provider],
                    ["Dokumen rujukan", `${health.documents} dokumen · ${health.chunks ?? "–"} potongan`],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-sm border border-garis p-3">
                      <dt className="label-caps text-teks-2">{k}</dt>
                      <dd className="mt-1 font-semibold">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className="mt-4 text-sm text-teks-2">
                Balai Ilmu adalah proyek mahasiswa dengan studi kasus Universitas Riau, bukan layanan resmi kampus.
                Jawaban disusun dari dokumen rujukan; selalu konfirmasi ke bagian akademik untuk keputusan penting.
              </p>
            </Section>
            <div className="mt-5">
              <Section title="Pintasan keyboard" icon={<Keyboard size={20} />}>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  {[["Ctrl/⌘ + K", "Cari percakapan"], ["Ctrl/⌘ + Shift + O", "Percakapan baru"], ["Enter", "Kirim pertanyaan"],
                    ["Shift + Enter", "Baris baru"], ["Esc", "Hentikan jawaban"]].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-3 rounded-sm border border-garis px-3 py-2">
                      <dt>{v}</dt><dd><kbd className="rounded border border-garis bg-surface2 px-1.5 py-0.5 font-mono text-xs">{k}</kbd></dd>
                    </div>
                  ))}
                </dl>
              </Section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
