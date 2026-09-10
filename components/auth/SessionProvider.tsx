/**
 * Client-side session store. Holds the Supabase access/refresh tokens and
 * exposes them to API calls via fetchWithAuth.
 *
 * This replaces the pilot's `currentFarmerId: string | null` in useAppStore
 * with a real session. The store still holds crop/mandi/language; this hook
 * holds the auth tokens and the decoded user.
 *
 * Flow:
 *   1. User opens the app → useSession() restores tokens from localStorage.
 *   2. On each API call, fetchWithAuth attaches `Authorization: Bearer <token>`.
 *   3. Server routes call authenticateRequest() to validate the JWT and
 *      enforce RLS via getServerClient(token).
 *   4. On 401, the hook clears the session and redirects to /login.
 */

"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { useRouter } from "next/navigation";

const SESSION_STORAGE_KEY = "krishibandhu-session";

interface Session {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
  role: string;
  name: string;
}

interface SessionContextType {
  session: Session | null;
  isLoading: boolean;
  login: (data: LoginResponse) => void;
  logout: () => void;
  fetchWithAuth: (input: string, init?: RequestInit) => Promise<Response>;
}

const SessionContext = createContext<SessionContextType | null>(null);

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; role: string; name: string };
}

function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

function saveSession(session: Session): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setSession(loadSession());
    setIsLoading(false);
  }, []);

  const login = useCallback((data: LoginResponse) => {
    const sess: Session = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      userId: data.user.id,
      role: data.user.role,
      name: data.user.name,
    };
    saveSession(sess);
    setSession(sess);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
    router.push("/login");
  }, [router]);

  const fetchWithAuth = useCallback(
    (input: string, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers as HeadersInit | undefined);
      if (session?.accessToken) {
        headers.set("Authorization", `Bearer ${session.accessToken}`);
      }
      return fetch(input, { ...init, headers });
    },
    [session]
  );

  return (
    <SessionContext.Provider value={{ session, isLoading, login, logout, fetchWithAuth }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}