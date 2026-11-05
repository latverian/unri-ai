import { useCallback, useEffect, useRef, useState } from "react";
import { streamChat } from "./api";
import { loadConversations, saveConversations, uid } from "./storage";
import type { Conversation, Message } from "./types";

const HISTORY_TURNS = 6;

function titleFrom(text: string) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 48 ? `${t.slice(0, 47)}…` : t;
}

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { saveConversations(conversations); }, [conversations]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const busy = !!active?.messages.some((m) => m.status === "streaming");

  const patchMessage = useCallback((convId: string, msgId: string, fn: (m: Message) => Message) => {
    setConversations((list) => list.map((c) => c.id !== convId ? c : {
      ...c, updatedAt: Date.now(), messages: c.messages.map((m) => (m.id === msgId ? fn(m) : m)),
    }));
  }, []);

  /** Minta jawaban untuk `question`, dengan `prior` sebagai riwayat percakapan sebelumnya. */
  const run = useCallback((convId: string, question: string, prior: Message[], assistantId: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const history = prior
      .filter((m) => (m.status === "done" || m.role === "user") && m.content && m.found !== false)
      .slice(-HISTORY_TURNS)
      .map((m) => ({ role: m.role, content: m.content }));
    const patch = (fn: (m: Message) => Message) => patchMessage(convId, assistantId, fn);

    streamChat({ message: question, history, conversation_id: convId }, {
      onSources: (sources) => patch((m) => ({ ...m, sources, phase: "writing" })),
      onToken: (t) => patch((m) => ({ ...m, content: m.content + t })),
      onDone: (d) => patch((m) => ({ ...m, status: "done", messageId: d.message_id, found: d.found, cited: d.cited })),
      onError: (error) => patch((m) => ({ ...m, status: "error", error })),
    }, ctrl.signal);
  }, [patchMessage]);

  const send = useCallback((text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    const user: Message = { id: uid(), role: "user", content: question };
    const assistant: Message = { id: uid(), role: "assistant", content: "", status: "streaming", phase: "searching" };
    let convId = activeId;
    let prior: Message[] = [];
    if (active) {
      prior = active.messages;
      setConversations((list) => list.map((c) => c.id === active.id
        ? { ...c, updatedAt: Date.now(), messages: [...c.messages, user, assistant] } : c));
    } else {
      convId = `c_${uid()}`;
      const conv: Conversation = { id: convId, title: titleFrom(question), createdAt: Date.now(), updatedAt: Date.now(), messages: [user, assistant] };
      setConversations((list) => [conv, ...list]);
      setActiveId(convId);
    }
    run(convId!, question, prior, assistant.id);
  }, [active, activeId, busy, run]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    if (!active) return;
    const streaming = active.messages.find((m) => m.status === "streaming");
    if (streaming) patchMessage(active.id, streaming.id, (m) => ({ ...m, status: "stopped" }));
  }, [active, patchMessage]);

  /** Ulangi jawaban asisten terakhir (atau yang gagal). */
  const regenerate = useCallback((assistantId: string) => {
    if (!active || busy) return;
    const idx = active.messages.findIndex((m) => m.id === assistantId);
    const question = active.messages[idx - 1];
    if (idx < 1 || question?.role !== "user") return;
    const fresh: Message = { id: uid(), role: "assistant", content: "", status: "streaming", phase: "searching" };
    const prior = active.messages.slice(0, idx - 1);
    setConversations((list) => list.map((c) => c.id === active.id
      ? { ...c, updatedAt: Date.now(), messages: [...c.messages.slice(0, idx), fresh] } : c));
    run(active.id, question.content, prior, fresh.id);
  }, [active, busy, run]);

  const setRating = useCallback((assistantId: string, rating: 1 | -1) => {
    if (active) patchMessage(active.id, assistantId, (m) => ({ ...m, rating }));
  }, [active, patchMessage]);

  const newChat = useCallback(() => { stop(); setActiveId(null); }, [stop]);
  const select = useCallback((id: string) => { stop(); setActiveId(id); }, [stop]);
  const removeAll = useCallback(() => { stop(); setConversations([]); setActiveId(null); }, [stop]);

  return { conversations, active, busy, send, stop, regenerate, setRating, newChat, select, removeAll };
}
