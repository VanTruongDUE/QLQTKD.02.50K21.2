"use client";

import React, { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { AccountCenter } from "@/components/auth/account-center";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { useAuth } from "@/components/auth/auth-provider";

export default function ManagerAccountsPage() {
  const auth = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  if (auth.loading) return <main className="staff-shell flex min-h-screen items-center justify-center text-zinc-400">Đang kiểm tra phiên đăng nhập…</main>;
  if (!auth.profile) return <main className="staff-shell flex min-h-screen items-center justify-center p-5"><section className="staff-access-card"><h1>Đăng nhập quản lý</h1><p>Đăng nhập bằng tài khoản Quản lý để quản trị nhân viên và tài khoản.</p><button onClick={() => setAuthOpen(true)}>Đăng nhập quản lý</button></section><AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} /></main>;
  if (auth.profile.role !== "MANAGER") return <main className="staff-shell flex min-h-screen items-center justify-center p-5"><section className="staff-access-card"><ShieldAlert className="mx-auto h-8 w-8 text-rose-400" /><h1>Không có quyền truy cập</h1><p>Khu vực này chỉ dành cho Quản lý.</p><a href={auth.profile.role === "STAFF" ? "/staff/check-in" : "/"}>Trở về màn hình của bạn</a></section></main>;
  return <main className="staff-shell min-h-screen"><AccountCenter onClose={() => undefined} /></main>;
}
