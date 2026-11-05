import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, streamChat, type ServerConversation, type ServerMessage } from "./api";
import { usePrefs } from "./prefs";
import { useSession } from "./session";
import { clearConversations, loadConversations, saveConversations, uid } from "./storage";
import type { AttachmentRef, Conversation, Message } from "./types";

const HISTORY_TURNS = 6;
const NEW = "__baru__"; // kunci lampiran untuk percakapan yang belum dibuat

function titleFrom(text: string) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 60 ? `${t.slice(0, 59)}…` : t;
}

function fromServerConv(c: ServerConversation): Conversation {
  return { id: c.id, title: c.title, pinned: c.pinned, shareToken: c.share_token, createdAt: Date.parse(c.created_at),
    updatedAt: Date.parse(c.updated_at), messages: [], loaded: false };
}

export function fromServerMsg(m: ServerMessage): Message {
  return { id: m.id, serverId: m.id, role: m.role, content: m.content, sources: m.sources, cited: m.cited,
    found: m.found ?? undefined, general: m.general, attachments: m.attachments,
    status: (m.status as Message["status"]) ?? "done", messageId: m.role === "assistant" ? m.id : undefined };
}

/** Riwayat percakapan untuk dikirim ke LLM: hanya pesan yang selesai & bukan penolakan. */
function historyOf(prior: Message[]) {
  return prior.filter((m) => !!m.content && ((m.role === "user") || (m.status === "done" && (m.found !== false || !!m.general))))
    .slice(-HISTORY_TURNS).map((m) => ({ role: m.role, content: m.content }));
}

export function conversationToMarkdown(c: Conversation): string {
  const lines = [`# ${c.title}`, "", `_Diekspor dari Balai Ilmu, ${new Date().toLocaleString("id-ID")}_`, ""];
  for (const m of c.messages) {
    if (m.role === "user") lines.push(`## 🧑 Pertanyaan`, "", m.content, "");
    else {
      lines.push(`## 🎓 Balai Ilmu${m.general ? " (pengetahuan umum)" : ""}`, "", m.content, "");
      const used = (m.sources ?? []).map((s, i) => ({ ...s, n: i + 1 })).filter((s) => !m.cited || m.cited.includes(s.n));
      if (used.length && m.found) lines.push("**Sumber:**", ...used.map((s) => `- [${s.n}] ${s.source}${s.page ? `, hal. ${s.page}` : ""}`), "");
    }
  }
  return lines.join("\n");
}

export function useChat() {
  const { user, ready } = useSession();
  const { prefs } = usePrefs();
  const remote = !!user;
  const [conversations, setConversations] = useState<Conversation[]>(() => (remote ? [] : loadConversations()));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [query, setQuery] = useState("");
  const [remoteMatches, setRemoteMatches] = useState<Set<string> | null>(null);
  const [attachments, setAttachments] = useState<Record<string, AttachmentRef[]>>({});
  const abortRef = useRef<AbortController | null>(null);

  // Ganti sumber riwayat saat status login berubah.
  const refreshList = useCallback(async () => {
    if (!remote) return;
    setLoadingList(true);
    try {
      const r = await api.conversations();
      setConversations((old) => r.conversations.map((c) => {
        const prev = old.find((o) => o.id === c.id);
        return prev?.loaded ? { ...fromServerConv(c), messages: prev.messages, loaded: true } : fromServerConv(c);
      }));
    } catch { /* ditampilkan kosong */ } finally { setLoadingList(false); }
  }, [remote]);

  useEffect(() => {
    if (!ready) return;
    abortRef.current?.abort();
    setActiveId(null);
    if (remote) { setConversations([]); refreshList(); } else setConversations(loadConversations());
  }, [remote, ready, user?.id, refreshList]);

  useEffect(() => { if (!remote && ready) saveConversations(conversations); }, [conversations, remote, ready]);
  useEffect(() => () => abortRef.current?.abort(), []);

  // Pencarian: lokal untuk tamu, di server (judul + isi) untuk akun.
  useEffect(() => {
    setRemoteMatches(null); // jangan tampilkan hasil kata kunci sebelumnya
    if (!remote || !query.trim()) return;
    const t = setTimeout(() => {
      api.conversations(query.trim()).then((r) => setRemoteMatches(new Set(r.conversations.map((c) => c.id)))).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [query, remote]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q ? conversations : remote
      ? conversations.filter((c) => remoteMatches?.has(c.id) ?? c.title.toLowerCase().includes(q))
      : conversations.filter((c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q)));
    return [...list].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt);
  }, [conversations, query, remote, remoteMatches]);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const busy = !!active?.messages.some((m) => m.status === "streaming");
  const attachKey = activeId ?? NEW;
  const activeAttachments = attachments[attachKey] ?? [];

  const patchConv = useCallback((id: string, fn: (c: Conversation) => Conversation) => {
    setConversations((list) => list.map((c) => (c.id === id ? fn(c) : c)));
  }, []);
  const patchMessage = useCallback((convId: string, msgId: string, fn: (m: Message) => Message) => {
    patchConv(convId, (c) => ({ ...c, updatedAt: Date.now(), messages: c.messages.map((m) => (m.id === msgId ? fn(m) : m)) }));
  }, [patchConv]);

  const run = useCallback((convId: string, question: string, prior: Message[], userId: string, assistantId: string,
    atts: AttachmentRef[], replaceFrom?: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const patch = (fn: (m: Message) => Message) => patchMessage(convId, assistantId, fn);
    streamChat({
      message: question, history: historyOf(prior), conversation_id: convId, mode: prefs.mode,
      model: prefs.model ?? undefined, attachment_ids: atts.map((a) => a.id), replace_from: replaceFrom,
    }, {
      onSources: (sources) => patch((m) => ({ ...m, sources, phase: "writing" })),
      onGeneral: () => patch((m) => ({ ...m, general: true })),
      onToken: (t) => patch((m) => ({ ...m, content: m.content + t })),
      onDone: (d) => {
        patch((m) => ({ ...m, status: "done", messageId: d.message_id, serverId: d.conversation_id ? d.message_id : undefined,
          found: d.found, general: d.general, cited: d.cited }));
        if (d.conversation_id) {
          patchMessage(convId, userId, (m) => ({ ...m, serverId: d.user_message_id }));
          if (d.title) patchConv(convId, (c) => ({ ...c, title: d.title! }));
        }
      },
      onError: (error) => patch((m) => ({ ...m, status: "error", error })),
    }, ctrl.signal);
  }, [patchConv, patchMessage, prefs.mode, prefs.model]);

  const send = useCallback((text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    const atts = attachments[attachKey] ?? [];
    const userMsg: Message = { id: uid(), role: "user", content: question, attachments: atts };
    const assistant: Message = { id: uid(), role: "assistant", content: "", status: "streaming", phase: "searching" };
    if (active) {
      patchConv(active.id, (c) => ({ ...c, updatedAt: Date.now(), messages: [...c.messages, userMsg, assistant] }));
      run(active.id, question, active.messages, userMsg.id, assistant.id, atts);
    } else {
      const convId = `c_${uid()}`;
      const conv: Conversation = { id: convId, title: titleFrom(question), createdAt: Date.now(), updatedAt: Date.now(),
        messages: [userMsg, assistant], loaded: true };
      setConversations((list) => [conv, ...list]);
      setActiveId(convId);
      // Lampiran yang dipilih sebelum percakapan dibuat pindah ke percakapan barunya.
      if (atts.length) setAttachments((a) => ({ ...a, [convId]: atts, [NEW]: [] }));
      run(convId, question, [], userMsg.id, assistant.id, atts);
    }
  }, [active, attachKey, attachments, busy, patchConv, run]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    if (!active) return;
    const streaming = active.messages.find((m) => m.status === "streaming");
    if (streaming) patchMessage(active.id, streaming.id, (m) => ({ ...m, status: "stopped" }));
  }, [active, patchMessage]);

  /** Kirim ulang mulai dari pesan pengguna ke-idx (untuk Ulangi dan Edit). */
  const resendFrom = useCallback((userIdx: number, text: string) => {
    if (!active || busy) return;
    const old = active.messages[userIdx];
    if (old?.role !== "user") return;
    const prior = active.messages.slice(0, userIdx);
    const userMsg: Message = { ...old, id: uid(), content: text, serverId: undefined };
    const fresh: Message = { id: uid(), role: "assistant", content: "", status: "streaming", phase: "searching" };
    patchConv(active.id, (c) => ({ ...c, updatedAt: Date.now(), messages: [...prior, userMsg, fresh] }));
    run(active.id, text, prior, userMsg.id, fresh.id, attachments[active.id] ?? [], old.serverId);
  }, [active, attachments, busy, patchConv, run]);

  const regenerate = useCallback((assistantId: string) => {
    const idx = active?.messages.findIndex((m) => m.id === assistantId) ?? -1;
    if (active && idx >= 1) resendFrom(idx - 1, active.messages[idx - 1].content);
  }, [active, resendFrom]);

  const editMessage = useCallback((userId: string, text: string) => {
    const idx = active?.messages.findIndex((m) => m.id === userId) ?? -1;
    if (idx >= 0 && text.trim()) resendFrom(idx, text.trim());
  }, [active, resendFrom]);

  const setRating = useCallback((assistantId: string, rating: 1 | -1) => {
    if (active) patchMessage(active.id, assistantId, (m) => ({ ...m, rating }));
  }, [active, patchMessage]);

  const ensureLoaded = useCallback(async (id: string): Promise<Conversation | null> => {
    const c = conversations.find((x) => x.id === id);
    if (!c || !remote || c.loaded) return c ?? null;
    const r = await api.conversation(id);
    const messages = r.messages.map(fromServerMsg);
    const loaded = { ...c, messages, loaded: true };
    patchConv(id, () => loaded);
    const seen = new Map<string, AttachmentRef>();
    messages.forEach((m) => m.attachments?.forEach((a) => seen.set(a.id, a)));
    setAttachments((a) => ({ ...a, [id]: [...seen.values()] }));
    return loaded;
  }, [conversations, patchConv, remote]);

  const select = useCallback((id: string) => {
    abortRef.current?.abort();
    setActiveId(id);
    ensureLoaded(id).catch(() => {});
  }, [ensureLoaded]);
  const newChat = useCallback(() => { stop(); setActiveId(null); }, [stop]);

  const rename = useCallback(async (id: string, title: string) => {
    const t = title.trim().slice(0, 120);
    if (!t) return;
    patchConv(id, (c) => ({ ...c, title: t }));
    if (remote) await api.updateConversation(id, { title: t });
  }, [patchConv, remote]);

  const togglePin = useCallback(async (id: string) => {
    const pinned = !conversations.find((c) => c.id === id)?.pinned;
    patchConv(id, (c) => ({ ...c, pinned }));
    if (remote) await api.updateConversation(id, { pinned });
  }, [conversations, patchConv, remote]);

  const remove = useCallback(async (id: string) => {
    if (id === activeId) newChat();
    setConversations((l) => l.filter((c) => c.id !== id));
    if (remote) await api.deleteConversation(id).catch(() => {});
  }, [activeId, newChat, remote]);

  const removeAll = useCallback(async () => {
    newChat();
    setConversations([]);
    if (remote) await api.deleteAllConversations();
    else clearConversations();
  }, [newChat, remote]);

  const share = useCallback(async (id: string): Promise<string | null> => {
    if (!remote) return null;
    const { share_token } = await api.share(id);
    patchConv(id, (c) => ({ ...c, shareToken: share_token }));
    return `${location.origin}/bagikan/${share_token}`;
  }, [patchConv, remote]);

  const unshare = useCallback(async (id: string) => {
    await api.unshare(id);
    patchConv(id, (c) => ({ ...c, shareToken: null }));
  }, [patchConv]);

  const exportConversation = useCallback(async (id: string) => {
    const c = await ensureLoaded(id);
    if (!c) return;
    const url = URL.createObjectURL(new Blob([conversationToMarkdown(c)], { type: "text/markdown" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${c.title.replace(/[^\w\- ]+/g, "").slice(0, 40) || "percakapan"}.md` });
    a.click();
    URL.revokeObjectURL(url);
  }, [ensureLoaded]);

  // Riwayat tamu yang masih ada di perangkat ini setelah login: bisa dipindah ke akun.
  const [localPending, setLocalPending] = useState(0);
  useEffect(() => { setLocalPending(remote ? loadConversations().length : 0); }, [remote]);
  const importLocal = useCallback(async () => {
    const local = loadConversations();
    const r = await api.importConversations(local.map((c) => ({
      title: c.title, messages: c.messages.filter((m) => m.status !== "error").map((m) => ({
        role: m.role, content: m.content, sources: m.sources ?? [], cited: m.cited ?? null, found: m.found ?? null })),
    })));
    clearConversations();
    setLocalPending(0);
    await refreshList();
    return r.imported;
  }, [refreshList]);
  const dismissLocal = useCallback(() => { clearConversations(); setLocalPending(0); }, []);

  const addAttachment = useCallback(async (file: File) => {
    const r = await api.attach(file);
    setAttachments((a) => ({ ...a, [attachKey]: [...(a[attachKey] ?? []), { id: r.id, filename: r.filename }] }));
    return r;
  }, [attachKey]);
  const removeAttachment = useCallback((id: string) => {
    setAttachments((a) => ({ ...a, [attachKey]: (a[attachKey] ?? []).filter((x) => x.id !== id) }));
  }, [attachKey]);

  return {
    remote, conversations, visible, active, busy, loadingList, query, setQuery,
    send, stop, regenerate, editMessage, setRating, newChat, select, rename, togglePin, remove, removeAll,
    share, unshare, exportConversation, localPending, importLocal, dismissLocal,
    attachments: activeAttachments, addAttachment, removeAttachment,
  };
}
