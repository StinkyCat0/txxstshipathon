/**
 * Session: which user is "logged in". Persisted to AsyncStorage so reloads
 * keep the same identity. No real auth — the backend trusts user_id params.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const KEY = 'session.userId';

interface Session {
  /** null while restoring, 0 = signed out */
  userId: number | null;
  signIn: (userId: number) => void;
  signOut: () => void;
}

const Ctx = createContext<Session>({ userId: null, signIn: () => {}, signOut: () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => setUserId(v ? Number(v) : 0));
  }, []);

  const signIn = (id: number) => {
    setUserId(id);
    AsyncStorage.setItem(KEY, String(id));
  };
  const signOut = () => {
    setUserId(0);
    AsyncStorage.removeItem(KEY);
  };

  return <Ctx.Provider value={{ userId, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useSession() {
  return useContext(Ctx);
}
