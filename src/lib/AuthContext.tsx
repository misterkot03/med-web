'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from './session';
import { readSession, saveSession, clearSession } from './session';

type AuthState = {
  session: Session | null;
  setSession: (s: Session | null) => void;
  logout: () => void;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setState] = useState<Session | null>(null);

  useEffect(() => {
    setState(readSession());
  }, []);

  const setSession = (s: Session | null) => {
    if (s) saveSession(s);
    else clearSession();
    setState(s);
  };

  const logout = () => setSession(null);

  return <Ctx.Provider value={{ session, setSession, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
