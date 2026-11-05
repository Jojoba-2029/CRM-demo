import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, type Profile } from "../lib/supabase";

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  /** Ошибка загрузки профиля (сеть и т. п.), не путать с отсутствием профиля. */
  profileError: unknown;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

interface ProfileResult {
  userId: string;
  profile: Profile | null;
  error: unknown;
}

async function signOut() {
  await supabase.auth.signOut();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [result, setResult] = useState<ProfileResult | null>(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setInitialized(true);
      // После выхода забываем профиль, чтобы при повторном входе не показать устаревшую роль
      if (!next) setResult(null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (!cancelled) setResult({ userId, profile: data, error });
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Профиль считается загруженным, только если он относится к текущему пользователю:
  // так нет промежуточного состояния «сессия есть, профиля нет» сразу после входа.
  const current = userId && result?.userId === userId ? result : null;
  const loading = !initialized || (Boolean(userId) && !current);

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile: current?.profile ?? null,
      profileError: current?.error ?? null,
      loading,
      signOut,
    }),
    [session, current, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth вне AuthProvider");
  return ctx;
}

/** Профиль текущего пользователя внутри защищённых маршрутов. */
export function useProfile(): Profile {
  const { profile } = useAuth();
  if (!profile) throw new Error("Профиль не загружен");
  return profile;
}
