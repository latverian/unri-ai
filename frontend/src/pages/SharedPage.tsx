import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Link2Off, MessageSquarePlus } from "lucide-react";
import { api } from "../lib/api";
import { fromServerMsg } from "../lib/useChat";
import type { Message } from "../lib/types";
import { LogoMark, PucukRebung } from "../components/Brand";
import { AssistantBubble, UserBubble } from "../components/MessageView";

/** Tampilan baca-saja untuk percakapan yang dibagikan lewat tautan. */
export default function SharedPage() {
  const { token = "" } = useParams();
  const [data, setData] = useState<{ title: string; updated_at: string; messages: Message[] } | null | "error">(null);
  useEffect(() => {
    api.shared(token)
      .then((r) => setData({ ...r, messages: r.messages.map((m, i) => fromServerMsg({ ...m, id: `s${i}`, attachments: [], status: "done", created_at: "" })) }))
      .catch(() => setData("error"));
  }, [token]);
  useEffect(() => { if (data && data !== "error") document.title = `${data.title} · Balai Ilmu`; }, [data]);

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-chat items-center gap-2 px-4">
          <Link to="/" className="flex items-center gap-2"><LogoMark size={28} /><span className="font-serif text-lg font-semibold text-primary-strong">Balai <span className="text-emas-teks">Ilmu</span></span></Link>
          <Link to="/" className="btn-primary ml-auto"><MessageSquarePlus size={16} /> <span className="hidden sm:inline">Mulai bertanya</span></Link>
        </div>
        <PucukRebung />
      </header>
      <main className="mx-auto max-w-chat px-4 py-6">
        {data === null ? <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded bg-surface" />)}</div>
          : data === "error" ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-teks-2">
              <Link2Off size={40} /> <p>Tautan tidak ditemukan atau pemiliknya sudah berhenti membagikan percakapan ini.</p>
              <Link to="/" className="btn-primary">Buka Balai Ilmu</Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <span className="label-caps rounded bg-emas-soft px-2 py-0.5 text-emas-teks">Percakapan dibagikan</span>
                <h1 className="mt-2 font-serif text-2xl font-semibold text-primary-strong">{data.title}</h1>
                <p className="text-sm text-teks-2">Diperbarui {new Date(data.updated_at).toLocaleString("id-ID")}</p>
              </div>
              <div className="flex flex-col gap-6">
                {data.messages.map((m) => m.role === "user" ? <UserBubble key={m.id} m={m} /> : <AssistantBubble key={m.id} m={m} readOnly />)}
              </div>
              <p className="mt-8 text-center text-xs text-teks-2">Balai Ilmu · studi kasus Universitas Riau · proyek mahasiswa, bukan layanan resmi.</p>
            </>
          )}
      </main>
    </div>
  );
}
