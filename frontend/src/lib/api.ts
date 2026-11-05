import type { AdminUser, DocumentRow, PublicConfig, Source, User } from "./types";

const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public code: string, message: string, public status = 0) { super(message); }
}

function store(storage: () => Storage, key: string) {
  return {
    get: () => { try { return storage().getItem(key); } catch { return null; } },
    set: (t: string) => { try { storage().setItem(key, t); } catch { /* abaikan */ } },
    clear: () => { try { storage().removeItem(key); } catch { /* abaikan */ } },
  };
}

/** Token admin: hanya untuk tab ini. */
export const auth = store(() => sessionStorage, "unri-admin-token");
/** Token akun mahasiswa: tetap login di perangkat ini. */
export const userAuth = store(() => localStorage, "unri-user-token");
export const AUTH_EXPIRED = "unri-auth-expired";

type Kind = "public" | "admin" | "user";

async function request<T>(path: string, init: RequestInit = {}, kind: Kind = "public"): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const token = kind === "admin" ? auth.get() : kind === "user" ? userAuth.get() : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("NETWORK", "Tidak dapat terhubung ke server. Periksa koneksi kamu.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && kind === "admin") auth.clear();
    if (res.status === 401 && kind === "user" && token) { userAuth.clear(); window.dispatchEvent(new Event(AUTH_EXPIRED)); }
    throw new ApiError(data?.error?.code ?? "HTTP", data?.error?.message ?? `Terjadi kesalahan (${res.status}).`, res.status);
  }
  return data as T;
}

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export type Session = { access_token: string; expires_in: number; user: User };
export type ServerMessage = {
  id: string; role: "user" | "assistant"; content: string; sources: Source[]; cited: number[] | null;
  found: boolean | null; general: boolean; status: string; attachments: { id: string; filename: string }[]; created_at: string;
};
export type ServerConversation = { id: string; title: string; pinned: boolean; shared: boolean; share_token: string | null; created_at: string; updated_at: string };

export const api = {
  // publik
  config: () => request<PublicConfig>("/api/config"),
  suggestions: () => request<{ suggestions: string[] }>("/api/suggestions"),
  health: () => request<{ status: string; llm_provider: string; embed_provider: string; documents: number; chunks: number | null }>("/api/health"),
  feedback: (message_id: string, rating: 1 | -1, comment?: string) => request("/api/feedback", json("POST", { message_id, rating, comment })),
  shared: (token: string) => request<{ title: string; updated_at: string; messages: ServerMessage[] }>(`/api/shared/${encodeURIComponent(token)}`),

  // akun
  register: (b: { name: string; email: string; password: string; fakultas?: string }) => request<Session>("/api/auth/register", json("POST", b)),
  userLogin: (email: string, password: string) => request<Session>("/api/auth/login", json("POST", { email, password })),
  forgot: (email: string) => request<{ ok: boolean; email_enabled: boolean }>("/api/auth/forgot", json("POST", { email })),
  reset: (token: string, password: string) => request<Session>("/api/auth/reset", json("POST", { token, password })),
  me: () => request<{ user: User }>("/api/me", {}, "user"),
  updateMe: (b: { name?: string; fakultas?: string }) => request<{ user: User }>("/api/me", json("PATCH", b), "user"),
  changePassword: (current_password: string, new_password: string) => request<Session>("/api/me/password", json("POST", { current_password, new_password }), "user"),
  logoutAll: () => request("/api/me/logout-all", json("POST"), "user"),
  deleteAccount: (password: string) => request("/api/me/delete", json("POST", { password }), "user"),

  // riwayat (akun)
  conversations: (q?: string) => request<{ conversations: ServerConversation[] }>(`/api/conversations${q ? `?q=${encodeURIComponent(q)}` : ""}`, {}, "user"),
  conversation: (id: string) => request<{ conversation: ServerConversation; messages: ServerMessage[] }>(`/api/conversations/${id}`, {}, "user"),
  updateConversation: (id: string, b: { title?: string; pinned?: boolean }) => request(`/api/conversations/${id}`, json("PATCH", b), "user"),
  deleteConversation: (id: string) => request(`/api/conversations/${id}`, json("DELETE"), "user"),
  deleteAllConversations: () => request("/api/conversations", json("DELETE"), "user"),
  share: (id: string) => request<{ share_token: string }>(`/api/conversations/${id}/share`, json("POST"), "user"),
  unshare: (id: string) => request(`/api/conversations/${id}/share`, json("DELETE"), "user"),
  importConversations: (conversations: unknown[]) => request<{ imported: number }>("/api/conversations/import", json("POST", { conversations }), "user"),
  attach: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<{ id: string; filename: string; chars: number; truncated: boolean }>("/api/attachments", { method: "POST", body: fd }, "user");
  },

  // admin
  login: (username: string, password: string) => request<{ access_token: string; expires_in: number }>("/api/admin/login", json("POST", { username, password })),
  documents: () => request<{ documents: DocumentRow[] }>("/api/admin/documents", {}, "admin"),
  upload: (files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    return request<{ doc_ids: string[] }>("/api/admin/documents", { method: "POST", body: fd }, "admin");
  },
  deleteDoc: (id: string) => request(`/api/admin/documents/${id}`, json("DELETE"), "admin"),
  reindex: (id: string) => request(`/api/admin/documents/${id}/reindex`, json("POST"), "admin"),
  insights: () => request<Insights>("/api/admin/insights", {}, "admin"),
  saveSuggestions: (suggestions: string[]) => request<{ suggestions: string[] }>("/api/admin/suggestions", json("PUT", { suggestions }), "admin"),
  users: (q?: string) => request<{ users: AdminUser[]; total: number }>(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`, {}, "admin"),
  setUserDisabled: (id: string, disabled: boolean) => request(`/api/admin/users/${id}`, json("PATCH", { disabled }), "admin"),
  userResetLink: (id: string) => request<{ link: string; expires_hours: number }>(`/api/admin/users/${id}/reset-link`, json("POST"), "admin"),
  deleteUser: (id: string) => request(`/api/admin/users/${id}`, json("DELETE"), "admin"),
};

export type Insights = {
  stats: { total: number; answered: number; avg_latency: number | null; up: number; down: number };
  unanswered: { question: string; count: number; last_asked: string }[];
  negative: { message_id: string; question: string; answer: string; comment: string | null; created_at: string }[];
};

export type DoneEvent = {
  message_id: string; user_message_id: string; found: boolean; general: boolean; cited?: number[]; latency_ms: number;
  conversation_id?: string; created?: boolean; title?: string | null;
};

export type ChatHandlers = {
  onSources: (s: Source[]) => void;
  onGeneral: () => void;
  onToken: (t: string) => void;
  onDone: (d: DoneEvent) => void;
  onError: (message: string) => void;
};

export type ChatBody = {
  message: string; history: { role: string; content: string }[]; conversation_id: string;
  mode?: "dokumen" | "umum"; model?: string; attachment_ids?: string[]; replace_from?: string;
};

/** Kirim pertanyaan dan baca jawaban streaming (Server-Sent Events) dari POST /api/chat. */
export async function streamChat(body: ChatBody, h: ChatHandlers, signal: AbortSignal): Promise<void> {
  let res: Response;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = userAuth.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    res = await fetch(`${BASE}/api/chat`, { method: "POST", headers, body: JSON.stringify(body), signal });
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
        else if (event === "mode") h.onGeneral();
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
