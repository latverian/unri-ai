import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Check, CloudUpload, Copy, Menu, Moon, Plus, Sun, X } from "lucide-react";
import { useChat } from "../lib/useChat";
import { usePrefs } from "../lib/prefs";
import { useSession } from "../lib/session";
import { useTheme } from "../lib/theme";
import { LogoMark, PucukRebung } from "../components/Brand";
import { Sidebar } from "../components/Sidebar";
import { AccountMenu } from "../components/AccountMenu";
import { Welcome } from "../components/Welcome";
import { Composer } from "../components/Composer";
import { AssistantBubble, UserBubble } from "../components/MessageView";
import { ModelPicker } from "../components/ModelPicker";
import { Modal } from "../components/Modal";
import { useToast } from "../components/Toast";

function ShareDialog({ url, onCopy, onStop, onClose }: { url: string; onCopy: () => void; onStop: () => void; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Modal title="Bagikan percakapan" onClose={onClose}>
      <p className="text-sm text-teks-2">Siapa pun yang punya tautan ini bisa membaca percakapan ini (tanpa nama atau emailmu). Pesan baru juga ikut terlihat.</p>
      <div className="mt-3 flex gap-2">
        <label htmlFor="tautan-bagikan" className="sr-only">Tautan</label>
        <input id="tautan-bagikan" readOnly value={url} className="input text-sm" onFocus={(e) => e.target.select()} />
        <button className="btn-primary shrink-0" onClick={() => { onCopy(); setCopied(true); }}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Tersalin" : "Salin"}</button>
      </div>
      <button className="btn-secondary mt-4 w-full hover:bg-error-soft hover:text-error" onClick={onStop}>Hentikan berbagi</button>
    </Modal>
  );
}

export default function ChatPage() {
  const chat = useChat();
  const toast = useToast();
  const { user, config } = useSession();
  const { prefs, set } = usePrefs();
  const { theme, toggle } = useTheme();
  const [drawer, setDrawer] = useState(false);
  const [prefill, setPrefill] = useState<{ text: string; n: number }>();
  const [shareFor, setShareFor] = useState<{ id: string; url: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [announce, setAnnounce] = useState("");

  const messages = useMemo(() => chat.active?.messages ?? [], [chat.active]);
  const last = messages[messages.length - 1];
  const loadingConv = !!chat.active && chat.remote && chat.active.loaded === false;

  useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottom) el.scrollTop = el.scrollHeight;
  }, [messages, atBottom]);
  useEffect(() => { setAtBottom(true); }, [chat.active?.id]);

  const lastStatus = last?.role === "assistant" ? last.status : undefined;
  useEffect(() => {
    if (lastStatus === "done") setAnnounce("Jawaban selesai");
    else if (lastStatus === "error") setAnnounce("Jawaban gagal dimuat");
  }, [lastStatus]);

  // Pintasan keyboard: Ctrl/⌘+K cari, Ctrl/⌘+Shift+O percakapan baru, Esc hentikan jawaban.
  const { busy, stop, newChat } = chat;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); setDrawer(true); searchRef.current?.focus(); }
      else if (mod && e.shiftKey && e.key.toLowerCase() === "o") { e.preventDefault(); newChat(); document.getElementById("pertanyaan")?.focus(); }
      else if (e.key === "Escape" && busy) stop();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, stop, newChat]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };
  const close = () => setDrawer(false);

  const openShare = useCallback(async (id: string) => {
    try {
      const url = await chat.share(id);
      if (url) setShareFor({ id, url });
    } catch (e) { toast((e as Error).message, "error"); }
  }, [chat, toast]);

  const remove = useCallback((id: string) => {
    const c = chat.conversations.find((x) => x.id === id);
    if (c && confirm(`Hapus percakapan "${c.title}"?`)) chat.remove(id).then(() => toast("Percakapan dihapus"));
  }, [chat, toast]);

  const models = config?.models ?? [];

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar conversations={chat.visible} total={chat.conversations.length} activeId={chat.active?.id ?? null}
        open={drawer} theme={theme} user={user} loading={chat.loadingList} query={chat.query} searchRef={searchRef}
        onQuery={chat.setQuery} onClose={close}
        onNew={() => { chat.newChat(); close(); }}
        onSelect={(id) => { chat.select(id); close(); }}
        onRename={(id, t) => { chat.rename(id, t).catch((e) => toast(e.message, "error")); }}
        onTogglePin={(id) => { chat.togglePin(id).catch((e) => toast(e.message, "error")); }}
        onShare={openShare}
        onExport={(id) => { chat.exportConversation(id).catch((e) => toast(e.message, "error")); }}
        onDelete={remove} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-30 shrink-0 bg-surface/90 backdrop-blur">
          <div className="flex h-14 items-center gap-1 px-2 md:h-16 md:px-4">
            <button className="btn-icon lg:hidden" onClick={() => setDrawer(true)} aria-label="Buka menu"><Menu size={22} /></button>
            <div className="flex items-center gap-2 lg:hidden">
              <LogoMark size={28} />
              <span className="hidden font-serif text-lg font-semibold text-primary-strong min-[400px]:inline">Balai <span className="text-emas-teks">Ilmu</span></span>
            </div>
            <div className="hidden md:block"><ModelPicker models={models} value={prefs.model} onChange={(id) => set({ model: id })} /></div>
            <h1 className="hidden min-w-0 truncate pl-2 text-sm text-teks-2 xl:block">{chat.active?.title}</h1>
            <div className="ml-auto flex items-center gap-1">
              {chat.active && (
                <button className="btn-icon" onClick={chat.newChat} aria-label="Percakapan baru" title="Percakapan baru (Ctrl+Shift+O)"><Plus size={20} /></button>
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

        {chat.localPending > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-garis bg-emas-soft/60 px-4 py-2 text-sm">
            <CloudUpload size={16} className="text-emas-teks" />
            <span className="min-w-0 flex-1">Ada {chat.localPending} percakapan tersimpan di perangkat ini. Pindahkan ke akunmu supaya tersinkron?</span>
            <button className="btn-primary min-h-[36px]" onClick={() => chat.importLocal().then((n) => toast(`${n} percakapan dipindahkan ke akun`)).catch((e) => toast(e.message, "error"))}>Pindahkan</button>
            <button className="btn-icon" onClick={chat.dismissLocal} aria-label="Abaikan dan hapus riwayat lokal" title="Abaikan"><X size={16} /></button>
          </div>
        )}

        <main className="relative min-h-0 flex-1">
          <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto">
            {!chat.active ? (
              <Welcome onPick={(q) => setPrefill((p) => ({ text: q, n: (p?.n ?? 0) + 1 }))} />
            ) : loadingConv ? (
              <div className="mx-auto max-w-chat space-y-4 px-4 py-6">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded bg-surface" />)}</div>
            ) : (
              <div role="log" aria-label="Percakapan" className="mx-auto flex max-w-chat flex-col gap-6 px-4 py-6">
                {messages.map((m, i) => m.role === "user"
                  ? <UserBubble key={m.id} m={m} canEdit={!chat.busy} onEdit={(t) => chat.editMessage(m.id, t)} />
                  : <AssistantBubble key={m.id} m={m} isLast={i === messages.length - 1}
                      onRegenerate={() => chat.regenerate(m.id)} onRated={(r) => chat.setRating(m.id, r)} />)}
              </div>
            )}
          </div>
          {!atBottom && chat.active && (
            <button onClick={() => setAtBottom(true)} className="btn-secondary absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full shadow-card">
              <ArrowDown size={16} /> {chat.busy ? "Jawaban baru" : "Ke bawah"}
            </button>
          )}
        </main>

        <div className="shrink-0 bg-gradient-to-t from-bg via-bg to-bg/0">
          {models.length > 1 && <div className="mx-auto flex max-w-chat px-4 md:hidden"><ModelPicker models={models} value={prefs.model} onChange={(id) => set({ model: id })} /></div>}
          <Composer busy={chat.busy} onSend={chat.send} onStop={chat.stop} prefill={prefill}
            attachments={chat.attachments} canAttach={!!user} maxAttachMb={config?.max_attachment_mb ?? 10}
            onAttach={chat.addAttachment} onRemoveAttachment={chat.removeAttachment}
            mode={prefs.mode} generalAvailable={config?.general_mode ?? false} onModeChange={(m) => set({ mode: m })} />
        </div>
        <div className="sr-only" aria-live="polite">{announce}</div>
      </div>

      {shareFor && (
        <ShareDialog url={shareFor.url} onClose={() => setShareFor(null)}
          onCopy={() => navigator.clipboard.writeText(shareFor.url).catch(() => {})}
          onStop={() => { chat.unshare(shareFor.id).then(() => { toast("Tautan dinonaktifkan"); setShareFor(null); }).catch((e) => toast(e.message, "error")); }} />
      )}
    </div>
  );
}
