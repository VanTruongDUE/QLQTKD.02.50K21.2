"use client";

import React, { FormEvent, useState } from "react";
import { Film, ShieldCheck, TicketCheck, X } from "lucide-react";
import { useAuth } from "./auth-provider";

export function AuthDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await (mode === "login" ? login(email, password) : register(email, password));
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Đăng nhập thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="auth-title" className="relative grid w-full max-w-3xl overflow-hidden rounded-2xl border border-purple-500/40 bg-[#10121d] shadow-2xl md:grid-cols-[0.8fr_1.2fr]">
        <div className="border-b border-[#272a3d] bg-gradient-to-br from-purple-950/80 to-pink-950/50 p-7 md:border-b-0 md:border-r">
          <div className="mb-8 flex items-center gap-2 text-sm font-extrabold"><Film className="h-5 w-5 text-pink-400" /> STARLIGHT CINEMA</div>
          <h2 id="auth-title" className="text-2xl font-extrabold">Một tài khoản cho mọi trải nghiệm</h2>
          <ul className="mt-6 space-y-4 text-sm text-zinc-300">
            <li className="flex gap-3"><TicketCheck className="h-5 w-5 shrink-0 text-amber-400" /> Đặt vé, lưu vé QR và theo dõi lịch sử.</li>
            <li className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" /> Quyền truy cập được kiểm tra tại backend.</li>
          </ul>
        </div>
        <div className="p-6 sm:p-8">
          <button aria-label="Đóng" onClick={onClose} className="absolute right-4 top-4 rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white"><X className="h-4 w-4" /></button>
          <div className="mb-6 flex gap-5 border-b border-[#272a3d] text-sm font-semibold">
            {(["login", "register"] as const).map((item) => <button key={item} onClick={() => { setMode(item); setError(""); }} className={`border-b-2 px-1 pb-3 ${mode === item ? "border-pink-500 text-white" : "border-transparent text-zinc-500"}`}>{item === "login" ? "Đăng nhập" : "Đăng ký khách hàng"}</button>)}
          </div>
          <form className="space-y-4" onSubmit={submit}>
            <label className="block text-sm text-zinc-300">Email<input aria-label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-[#30344a] bg-[#0b0c14] px-3 text-white outline-none focus:border-purple-500" /></label>
            <label className="block text-sm text-zinc-300">Mật khẩu<input aria-label="Mật khẩu" type="password" minLength={12} required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-[#30344a] bg-[#0b0c14] px-3 text-white outline-none focus:border-purple-500" /></label>
            <p className="text-xs text-zinc-500">Tối thiểu 12 ký tự. Tài khoản đăng ký mới luôn là Khách hàng.</p>
            {error && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}
            <button disabled={busy} className="h-11 w-full rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-sm font-bold text-white disabled:opacity-50">{busy ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</button>
          </form>
        </div>
      </section>
    </div>
  );
}
