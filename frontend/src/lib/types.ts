export type Source = { doc_id: string; source: string; page: number; snippet: string; score: number };

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  messageId?: string; // id dari backend, untuk feedback
  found?: boolean;
  cited?: number[]; // nomor sumber yang benar-benar dikutip jawaban
  status?: "streaming" | "done" | "error" | "stopped";
  phase?: "searching" | "writing";
  error?: string;
  rating?: 1 | -1;
};

export type Conversation = { id: string; title: string; createdAt: number; updatedAt: number; messages: Message[] };

export type DocumentRow = {
  id: string; filename: string; size_bytes: number; pages: number | null; chunks: number | null;
  status: "queued" | "processing" | "ready" | "failed"; error: string | null; uploaded_at: string;
};
