"""Antarmuka chat. Jalankan: streamlit run app.py"""
import streamlit as st

import config
from rag import answer, format_source

st.set_page_config(page_title="UNRI GPT", page_icon="🎓")
st.title("🎓 UNRI GPT")
st.caption("Asisten informasi akademik berbasis dokumen. Bukan layanan resmi Universitas Riau — "
           "selalu konfirmasi ke bagian akademik untuk keputusan penting.")

with st.sidebar:
    st.markdown(f"**LLM:** `{config.LLM_PROVIDER}` "
                f"(`{config.OLLAMA_MODEL if config.LLM_PROVIDER == 'ollama' else config.GEMINI_MODEL}`)")
    st.markdown(f"**Embedding:** `{config.EMBED_MODEL}`")
    if st.button("Hapus percakapan"):
        st.session_state.messages = []

if "messages" not in st.session_state:
    st.session_state.messages = []

for m in st.session_state.messages:
    with st.chat_message(m["role"]):
        st.markdown(m["content"])
        if m.get("sources"):
            with st.expander("Sumber"):
                st.markdown(m["sources"])

if q := st.chat_input("Tanya soal KRS, cuti, skripsi, wisuda..."):
    with st.chat_message("user"):
        st.markdown(q)
    history = [{"role": m["role"], "content": m["content"]} for m in st.session_state.messages]
    with st.chat_message("assistant"):
        with st.spinner("Mencari di dokumen..."):
            try:
                text, hits = answer(q, history)
            except Exception as e:
                text, hits = f"⚠️ Terjadi error: `{e}`\n\nPastikan Ollama sudah jalan (`ollama serve`).", []
        st.markdown(text)
        src = "\n".join(f"- **{format_source(h)}** (skor {h['score']:.2f}): {h['text'][:200]}…" for h in hits)
        if src:
            with st.expander("Sumber"):
                st.markdown(src)
    st.session_state.messages += [{"role": "user", "content": q},
                                  {"role": "assistant", "content": text, "sources": src}]
