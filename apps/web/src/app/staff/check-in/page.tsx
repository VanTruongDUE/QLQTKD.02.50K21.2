"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Film, LogOut, ShieldAlert } from "lucide-react";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { useAuth } from "@/components/auth/auth-provider";
import { CheckInDesk } from "@/components/check-in-desk";

export default function StaffCheckInPage() {
  const auth = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [queryClient] = useState(() => new QueryClient());
  if (auth.loading) return <main className="staff-shell flex min-h-screen items-center justify-center text-zinc-400">Đang kiểm tra phiên đăng nhập…</main>;
  if (!auth.profile) return <main className="staff-shell flex min-h-screen items-center justify-center p-5"><section className="staff-access-card"><Film className="mx-auto h-8 w-8 text-purple-400" /><h1>Đăng nhập dành cho nhân viên</h1><p>Chỉ tài khoản được Quản lý cấp vai trò Nhân viên mới truy cập được màn hình soát vé.</p><button onClick={() => setAuthOpen(true)}>Đăng nhập nhân viên</button></section><AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} /></main>;
  if (auth.profile.role !== "STAFF") return <main className="staff-shell flex min-h-screen items-center justify-center p-5"><section className="staff-access-card"><ShieldAlert className="mx-auto h-8 w-8 text-rose-400" /><h1>Không có quyền truy cập</h1><p>Tài khoản hiện tại là {auth.profile.role === "MANAGER" ? "Quản lý" : "Khách hàng"}. Màn hình này chỉ dành cho Nhân viên soát vé.</p><a href="/">Trở về website khách hàng</a></section></main>;
  const request = <T,>(path: string, body?: unknown, key?: string) => auth.request<T>(path, { method: body === undefined ? "GET" : "POST", headers: key ? { "Idempotency-Key": key } : undefined, body: body === undefined ? undefined : JSON.stringify(body) });
  return <QueryClientProvider client={queryClient}><main className="staff-shell min-h-screen"><header className="staff-topbar"><div><p className="staff-kicker">STARLIGHT CINEMA · NHÂN VIÊN</p><h1>Soát vé vào phòng chiếu</h1></div><div className="staff-user"><span>{auth.profile.display_name || auth.profile.email}</span><button onClick={() => void auth.logout()}><LogOut className="h-4 w-4" /> Đăng xuất</button></div></header><div className="staff-workspace"><CheckInDesk request={request} userId={auth.profile.id} /></div></main></QueryClientProvider>;
}
