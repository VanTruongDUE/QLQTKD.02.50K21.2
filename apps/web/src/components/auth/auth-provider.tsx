"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Role = "CUSTOMER" | "STAFF" | "MANAGER";
export type Profile = {
  id: string;
  email: string;
  role: Role;
  display_name: string;
  phone: string;
};

type ApiError = { code?: string; message?: string };
type AuthContextValue = {
  profile: Profile | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  request<T>(path: string, init?: RequestInit): Promise<T>;
  refreshProfile(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

async function decode<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & ApiError;
  if (!response.ok) throw new Error(data.message || "Không thể xử lý yêu cầu.");
  return data;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { Origin: window.location.origin },
    });
    const data = await decode<{ accessToken: string }>(response);
    setAccessToken(data.accessToken);
    return data.accessToken;
  };

  const authorized = async <T,>(path: string, init: RequestInit = {}) => {
    let token = accessToken;
    if (!token) token = await refresh();
    let response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init.headers },
    });
    if (response.status === 401) {
      token = await refresh();
      response = await fetch(`${API_URL}${path}`, {
        ...init,
        credentials: "include",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init.headers },
      });
    }
    return decode<T>(response);
  };

  const refreshProfile = async () => {
    const next = await authorized<Profile>("/me/profile");
    setProfile(next);
  };

  useEffect(() => {
    refresh()
      .then((token) =>
        fetch(`${API_URL}/me/profile`, { headers: { Authorization: `Bearer ${token}` } }),
      )
      .then(decode<Profile>)
      .then(setProfile)
      .catch(() => {
        setAccessToken(null);
        setProfile(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const authenticate = async (mode: "login" | "register", email: string, password: string) => {
    const response = await fetch(`${API_URL}/auth/${mode}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Origin: window.location.origin },
      body: JSON.stringify({ email, password }),
    });
    const data = await decode<{ accessToken: string }>(response);
    setAccessToken(data.accessToken);
    const next = await decode<Profile>(
      await fetch(`${API_URL}/me/profile`, { headers: { Authorization: `Bearer ${data.accessToken}` } }),
    );
    setProfile(next);
  };

  const value = useMemo<AuthContextValue>(() => ({
    profile,
    loading,
    login: (email, password) => authenticate("login", email, password),
    register: (email, password) => authenticate("register", email, password),
    logout: async () => {
      await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include", headers: { Origin: window.location.origin } });
      setAccessToken(null);
      setProfile(null);
    },
    request: authorized,
    refreshProfile,
  }), [profile, loading, accessToken]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
