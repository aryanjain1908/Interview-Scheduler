import { useQueryClient } from "@tanstack/react-query";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api, tokenStore } from "../lib/api";
import type { Role, User } from "../lib/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (input: SignupInput) => Promise<User>;
  logout: () => void;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  college?: string;
  badge_ids?: string[];
}

interface TokenResponse {
  access_token: string;
  user: User;
}

const AuthContext = createContext<AuthState | null>(null);

export const HOME_FOR_ROLE: Record<Role, string> = {
  student: "/student",
  interviewer: "/interviewer",
  admin: "/admin",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => Boolean(tokenStore.get()));

  useEffect(() => {
    if (!tokenStore.get()) return;
    api
      .get<User>("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => tokenStore.set(null))
      .finally(() => setLoading(false));
  }, []);

  const accept = useCallback(
    (data: TokenResponse) => {
      queryClient.clear();
      tokenStore.set(data.access_token);
      setUser(data.user);
      return data.user;
    },
    [queryClient],
  );

  const login = useCallback(
    async (email: string, password: string) =>
      accept((await api.post<TokenResponse>("/auth/login", { email, password })).data),
    [accept],
  );

  const signup = useCallback(
    async (input: SignupInput) => accept((await api.post<TokenResponse>("/auth/signup", input)).data),
    [accept],
  );

  const logout = useCallback(() => {
    tokenStore.set(null);
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

  const value = useMemo(() => ({ user, loading, login, signup, logout }), [user, loading, login, signup, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
