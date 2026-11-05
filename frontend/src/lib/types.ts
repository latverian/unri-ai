export type Source = { doc_id: string; source: string; page: number; snippet: string; score: number; attachment?: boolean };
export type AttachmentRef = { id: string; filename: string };

export type Message = {
  id: string;            // id lokal (stabil selama tampil)
  serverId?: string;     // id di server (akun login) untuk edit/ulangi
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  messageId?: string;    // id jawaban di server, untuk feedback
  found?: boolean;
  general?: boolean;     // dijawab dari pengetahuan umum (bukan dokumen)
  cited?: number[] | null;
  attachments?: AttachmentRef[];
  status?: "streaming" | "done" | "error" | "stopped";
  phase?: "searching" | "writing";
  error?: string;
  rating?: 1 | -1;
};

export type Conversation = {
  id: string; title: string; createdAt: number; updatedAt: number; messages: Message[];
  pinned?: boolean; shareToken?: string | null; loaded?: boolean; // loaded=false: pesan belum diambil dari server
};

export type User = { id: string; email: string; name: string; fakultas: string | null; created_at: string };
export type ModelOption = { id: string; provider: string; model: string; label: string };
export type PublicConfig = { models: ModelOption[]; general_mode: boolean; registration: boolean; email_reset: boolean; max_attachment_mb: number };

export type DocumentRow = {
  id: string; filename: string; size_bytes: number; pages: number | null; chunks: number | null;
  status: "queued" | "processing" | "ready" | "failed"; error: string | null; uploaded_at: string;
};

export type AdminUser = {
  id: string; email: string; name: string; fakultas: string | null; disabled: boolean;
  created_at: string; last_login_at: string | null; conversations: number;
};
