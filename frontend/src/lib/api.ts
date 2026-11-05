import type { DocumentRow, Source } from "./types";

const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const TOKEN_KEY = "unri-admin-token";

export class ApiError extends Error {
  constructor(public code: string, message: string, public status = 0) { super(message); }
}

export const auth = {
  get: () => { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string) => { try { sessionStorage.setItem(TOKEN_KEY, t); } catch { /* abaikan */ } },
  clear: () => { try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* abaikan */ } },
};

async function request<T>(path: string, init: RequestInit = {}, admin = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (admin) { const t = auth.get(); if (t) headers.set("Authorization", `Bearer ${t}`); }
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("NETWORK", "Tidak dapat terhubung ke server. Periksa koneksi kamu.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && admin) auth.clear();
    throw new ApiError(data?.error?.code ?? "HTTP", data?.error?.message ?? `Terjadi kesalahan (${res.status}).`, res.status);
  }
  return data as T;
}

export const api = {
  suggestions: () => request<{ suggestions: string[] }>("/api/suggestions"),
  health: () => request<{ status: string; llm_provider: string; embed_provider: string; documents: number; chunks: number | null }>("/api/health"),
  feedback: (message_id: string, rating: 1 | -1, comment?: string) =>
    request("/api/feedback", { method: "POST", body: JSON.stringify({ message_id, rating, comment }) }),

  login: (username: string, password: string) =>
    request<{ access_token: string; expires_in: number }>("/api/admin/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  documents: () => request<{ documents: DocumentRow[] }>("/api/admin/documents", {}, true),
  upload: (files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    return request<{ doc_ids: string[] }>("/api/admin/documents", { method: "POST", body: fd }, true);
  },
  deleteDoc: (id: string) => request(`/api/admin/documents/${id}`, { method: "DELETE" }, true),
  reindex: (id: string) => request(`/api/admin/documents/${id}/reindex`, { method: "POST" }, true),
  insights: () => request<Insights>("/api/admin/insights", {}, true),
  saveSuggestions: (suggestions: string[]) =>
    request<{ suggestions: string[] }>("/api/admin/suggestions", { method: "PUT", body: JSON.stringify({ suggestions }) }, true),
};

export type Insights = {
  stats: { total: number; answered: number; avg_latency: number | null; up: number; down: number };
  unanswered: { question: string; count: number; last_asked: string }[];
  negative: { message_id: string; question: string; answer: string; comment: string | null; created_at: string }[];
};

export type ChatHandlers = {
  onSources: (s: Source[]) => void;
  onToken: (t: string) => void;
  onDone: (d: { message_id: string; found: boolean; cited?: number[]; latency_ms: number }) => void;
  onError: (message: string) => void;
};

/** Kirim pertanyaan dan baca jawaban streaming (Server-Sent Events) dari POST /api/chat. */
export async function streamChat(
  body: { message: string; history: { role: string; content: string }[]; conversation_id: string },
  h: ChatHandlers,
  signal: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    return h.onError("Tidak dapat terhubung ke server. Periksa koneksi kamu.");
  }
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    return h.onError(data?.error?.message ?? "Layanan sedang tersendat. Coba lagi sebentar ya.");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let finished = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        let event = "message", data = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (!data) continue;
        const d = JSON.parse(data);
        if (event === "sources") h.onSources(d.sources);
        else if (event === "token") h.onToken(d.t);
        else if (event === "done") { finished = true; h.onDone(d); }
        else if (event === "error") { finished = true; h.onError(d.message); }
      }
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    return h.onError("Koneksi terputus saat menerima jawaban.");
  }
  if (!finished) h.onError("Koneksi terputus saat menerima jawaban.");
}
