/**
 * Контекст авторизации: хранение токенов и пользователя, логин/логаут.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setTokenGetter } from '../api/client';
import * as authApi from '../api/auth';
import type { User } from '../models';

const ACCESS_KEY = 'voiceover_access_token';
const REFRESH_KEY = 'voiceover_refresh_token';
const USER_KEY = 'voiceover_user';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isReady: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<boolean>;
  setUser: (user: User | null | ((prev: User | null) => User | null)) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStored(): Partial<AuthState> {
  try {
    const access = localStorage.getItem(ACCESS_KEY);
    const refresh = localStorage.getItem(REFRESH_KEY);
    const userStr = localStorage.getItem(USER_KEY);
    let user: User | null = null;
    if (userStr) {
      user = JSON.parse(userStr) as User;
    }
    return { accessToken: access, refreshToken: refresh, user };
  } catch {
    return {};
  }
}

function saveStored(access: string | null, refresh: string | null, user: User | null): void {
  if (access) localStorage.setItem(ACCESS_KEY, access);
  else localStorage.removeItem(ACCESS_KEY);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  else localStorage.removeItem(REFRESH_KEY);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isReady: false,
  });

  const getAccessToken = useCallback(() => state.accessToken, [state.accessToken]);

  useEffect(() => {
    setTokenGetter(() => state.accessToken);
  }, [state.accessToken]);

  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    const refresh = state.refreshToken ?? localStorage.getItem(REFRESH_KEY);
    if (!refresh) return false;
    try {
      const res = await authApi.refreshToken(refresh);
      const user = state.user ?? (loadStored().user ?? null);
      setState((s) => ({
        ...s,
        accessToken: res.access_token,
        refreshToken: res.refresh_token,
        user,
      }));
      saveStored(res.access_token, res.refresh_token, user);
      return true;
    } catch {
      return false;
    }
  }, [state.refreshToken, state.user]);

  useEffect(() => {
    const stored = loadStored();
    if (stored.accessToken && stored.user) {
      setState((s) => ({
        ...s,
        accessToken: stored.accessToken,
        refreshToken: stored.refreshToken ?? null,
        user: stored.user ?? null,
        isReady: true,
      }));
    } else {
      setState((s) => ({ ...s, isReady: true }));
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    const user: User = {
      id: res.user_id,
      username: res.username,
      nametag: res.nametag ?? res.username,
      email: res.email,
      avatar_url: res.avatar_url ?? null,
    };
    setState({
      user,
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      isReady: true,
    });
    saveStored(res.access_token, res.refresh_token, user);
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const res = await authApi.register({ username, email, password });
    const user: User = {
      id: res.user_id,
      username: res.username,
      nametag: res.nametag ?? res.username,
      email: res.email,
      avatar_url: res.avatar_url ?? null,
    };
    setState({
      user,
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      isReady: true,
    });
    saveStored(res.access_token, res.refresh_token, user);
  }, []);

  const logout = useCallback(() => {
    setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isReady: true,
    });
    saveStored(null, null, null);
  }, []);

  const setUser = useCallback((userOrUpdater: User | null | ((prev: User | null) => User | null)) => {
    setState((s) => {
      const nextUser = typeof userOrUpdater === 'function' ? userOrUpdater(s.user) : userOrUpdater;
      if (s.accessToken && nextUser) saveStored(s.accessToken, s.refreshToken, nextUser);
      return { ...s, user: nextUser };
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      register,
      logout,
      getAccessToken,
      refreshAccessToken,
      setUser,
    }),
    [state, login, register, logout, getAccessToken, refreshAccessToken, setUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
