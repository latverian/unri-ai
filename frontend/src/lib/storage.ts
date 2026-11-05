import type { Conversation } from "./types";

// Riwayat chat disimpan di browser saja (tanpa akun) — spec FR-07.
const KEY = "unri-conversations";
const MAX = 50;

export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Conversation[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveConversations(list: Conversation[]): void {
  try {
    const clean = list
      .filter((c) => c.messages.length > 0)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX)
      .map((c) => ({ ...c, messages: c.messages.map((m) => (m.status === "streaming" ? { ...m, status: "stopped" as const } : m)) }));
    localStorage.setItem(KEY, JSON.stringify(clean));
  } catch {
    /* penyimpanan penuh / diblokir: abaikan */
  }
}

export function clearConversations(): void {
  try { localStorage.removeItem(KEY); } catch { /* abaikan */ }
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
