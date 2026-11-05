import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, AUTH_EXPIRED, userAuth, type Session } from "./api";
import type { PublicConfig, User } from "./types";

type Ctx = {
  user: User | null;
  ready: boolean;                 // status login sudah diketahui
  config: PublicConfig | null;
  signIn: (s: Session) => void;
  signOut: () => void;
  setUser: (u: User) => void;
};
const SessionCtx = createContext<Ctx | null>(null);
const USER_KEY = "unri-user";

function cachedUser(): User | null {
  try { return userAuth.get() ? JSON.parse(localStorage.getItem(USER_KEY) ?? "null") : null; } catch { return null; }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(cachedUser);
  const [ready, setReady] = useState(!userAuth.get());
  const [config, setConfig] = useState<PublicConfig | null>(null);

  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    try { if (u) localStorage.setItem(USER_KEY, JSON.stringify(u)); else localStorage.removeItem(USER_KEY); } catch { /* abaikan */ }
  }, []);

  useEffect(() => {
    api.config().then(setConfig).catch(() => setConfig(null));
    if (userAuth.get()) {
      api.me().then((r) => setUser(r.user)).catch(() => setUser(null)).finally(() => setReady(true));
    }
    const expired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED, expired);
    return () => window.removeEventListener(AUTH_EXPIRED, expired);
  }, [setUser]);

  const signIn = useCallback((s: Session) => { userAuth.set(s.access_token); setUser(s.user); setReady(true); }, [setUser]);
  const signOut = useCallback(() => { userAuth.clear(); setUser(null); }, [setUser]);

  return <SessionCtx.Provider value={{ user, ready, config, signIn, signOut, setUser }}>{children}</SessionCtx.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionCtx);
  if (!ctx) throw new Error("useSession harus dipakai di dalam SessionProvider");
  return ctx;
}
