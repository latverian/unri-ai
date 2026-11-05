import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Menu, Moon, Plus, Sun } from "lucide-react";
import { useChat } from "../lib/useChat";
import { useTheme } from "../lib/theme";
import { LogoMark, PucukRebung } from "../components/Brand";
import { Sidebar } from "../components/Sidebar";
import { AccountMenu } from "../components/AccountMenu";
import { Welcome } from "../components/Welcome";
import { Composer } from "../components/Composer";
import { AssistantBubble, UserBubble } from "../components/MessageView";

export default function ChatPage() {
  const chat = useChat();
  const { theme, toggle } = useTheme();
  const [drawer, setDrawer] = useState(false);
  const [prefill, setPrefill] = useState<{ text: string; n: number }>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [announce, setAnnounce] = useState("");

  const messages = useMemo(() => chat.active?.messages ?? [], [chat.active]);
  const last = messages[messages.length - 1];

  // Gulir otomatis hanya jika pengguna sudah di dekat bawah (design.md §10).
  useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottom) el.scrollTop = el.scrollHeight;
  }, [messages, atBottom]);

  useEffect(() => { setAtBottom(true); }, [chat.active?.id]);

  // Umumkan ke pembaca layar saat jawaban selesai, bukan setiap token.
  const lastStatus = last?.role === "assistant" ? last.status : undefined;
  useEffect(() => {
    if (lastStatus === "done") setAnnounce("Jawaban selesai");
    else if (lastStatus === "error") setAnnounce("Jawaban gagal dimuat");
  }, [lastStatus]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  const close = () => setDrawer(false);

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar conversations={chat.conversations} activeId={chat.active?.id ?? null} open={drawer} theme={theme}
        onToggleTheme={toggle} onClose={close}
        onNew={() => { chat.newChat(); close(); }}
        onSelect={(id) => { chat.select(id); close(); }}
        onClearAll={chat.removeAll} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-30 shrink-0 bg-surface/90 backdrop-blur">
          <div className="flex h-14 items-center gap-2 px-2 md:h-16 md:px-5">
            <button className="btn-icon lg:hidden" onClick={() => setDrawer(true)} aria-label="Buka menu"><Menu size={22} /></button>
            <div className="flex items-center gap-2 lg:hidden">
              <LogoMark size={28} />
              <span className="font-serif text-lg font-semibold text-primary-strong">Balai <span className="text-emas-teks">Ilmu</span></span>
            </div>
            <h1 className="hidden min-w-0 truncate font-semibold lg:block">
              {chat.active ? chat.active.title : "Konsultasi Akademik"}
            </h1>
            <div className="ml-auto flex items-center gap-1">
              {chat.active && (
                <button className="btn-icon" onClick={chat.newChat} aria-label="Percakapan baru" title="Percakapan baru"><Plus size={20} /></button>
              )}
              <button className="btn-icon" onClick={toggle} aria-label={theme === "dark" ? "Gunakan mode terang" : "Gunakan mode gelap"}
                title={theme === "dark" ? "Mode terang" : "Mode gelap"}>
                {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <AccountMenu />
            </div>
          </div>
          <PucukRebung />
        </header>

        <main className="relative min-h-0 flex-1">
          <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto">
            {!chat.active ? (
              <Welcome onPick={(q) => setPrefill((p) => ({ text: q, n: (p?.n ?? 0) + 1 }))} />
            ) : (
              <div role="log" aria-label="Percakapan" className="mx-auto flex max-w-chat flex-col gap-6 px-4 py-6">
                {messages.map((m, i) => m.role === "user"
                  ? <UserBubble key={m.id} m={m} />
                  : <AssistantBubble key={m.id} m={m} isLast={i === messages.length - 1}
                      onRegenerate={() => chat.regenerate(m.id)} onRated={(r) => chat.setRating(m.id, r)} />)}
              </div>
            )}
          </div>
          {!atBottom && chat.active && (
            <button onClick={() => { setAtBottom(true); }}
              className="btn-secondary absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full shadow-card">
              <ArrowDown size={16} /> {chat.busy ? "Jawaban baru" : "Ke bawah"}
            </button>
          )}
        </main>

        <div className="shrink-0 bg-gradient-to-t from-bg via-bg to-bg/0">
          <Composer busy={chat.busy} onSend={chat.send} onStop={chat.stop} prefill={prefill} />
        </div>
        <div className="sr-only" aria-live="polite">{announce}</div>
      </div>
    </div>
  );
}
