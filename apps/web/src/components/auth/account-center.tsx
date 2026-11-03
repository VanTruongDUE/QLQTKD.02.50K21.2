"use client";

import React, { FormEvent, useEffect, useState } from "react";
import { KeyRound, Lock, Shield, Unlock, UserCog } from "lucide-react";
import { Profile, useAuth } from "./auth-provider";

type Cinema = { id: string; name: string };
type Staff = Profile & { locked: boolean; cinemaIds: string[] };

export function AccountCenter({ onClose, embedded = false }: { onClose(): void; embedded?: boolean }) {
  const { profile, request, refreshProfile, logout } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [message, setMessage] = useState("");
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  if (!profile) return null;

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await request("/me/profile", { method: "PATCH", body: JSON.stringify({ displayName, phone }) });
      await refreshProfile();
      setMessage("Đã cập nhật hồ sơ.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Cập nhật thất bại."); }
  };
  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await request("/me/password", { method: "POST", body: JSON.stringify(passwords) });
      setMessage("Đã đổi mật khẩu. Vui lòng đăng nhập lại.");
      await logout();
      onClose();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Đổi mật khẩu thất bại."); }
  };

  return (
    <div className={embedded ? "manager-account-embedded" : "fixed inset-0 z-[75] overflow-y-auto bg-black/80 p-4 backdrop-blur-md"}>
      <div className="mx-auto my-8 max-w-5xl rounded-2xl border border-[#2b2f45] bg-[#11131e] p-5 shadow-2xl sm:p-7">
        <div className="mb-6 flex items-start justify-between border-b border-[#272a3d] pb-5">
          <div><p className="text-xs font-bold text-amber-400">{roleLabel(profile.role)}</p><h2 className="mt-1 text-xl font-extrabold">Quản lý tài khoản</h2><p className="mt-1 text-sm text-zinc-500">{profile.email}</p></div>
          <button onClick={onClose} className="rounded-lg border border-[#30344a] px-3 py-2 text-sm text-zinc-300 hover:bg-white/5">Đóng</button>
        </div>
        {message && <p role="status" className="mb-5 rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 text-sm text-purple-200">{message}</p>}
        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={saveProfile} className="space-y-4 rounded-xl border border-[#272a3d] bg-[#0d0f18] p-5">
            <h3 className="flex items-center gap-2 font-bold"><UserCog className="h-4 w-4 text-pink-400" /> Hồ sơ cá nhân</h3>
            <Field label="Tên hiển thị" value={displayName} onChange={setDisplayName} />
            <Field label="Số điện thoại" value={phone} onChange={setPhone} />
            <button className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 text-sm font-bold">Lưu hồ sơ</button>
          </form>
          <form onSubmit={changePassword} className="space-y-4 rounded-xl border border-[#272a3d] bg-[#0d0f18] p-5">
            <h3 className="flex items-center gap-2 font-bold"><KeyRound className="h-4 w-4 text-amber-400" /> Đổi mật khẩu</h3>
            <Field type="password" label="Mật khẩu hiện tại" value={passwords.currentPassword} onChange={(v) => setPasswords((p) => ({ ...p, currentPassword: v }))} minLength={12} />
            <Field type="password" label="Mật khẩu mới" value={passwords.newPassword} onChange={(v) => setPasswords((p) => ({ ...p, newPassword: v }))} minLength={12} />
            <button className="rounded-lg border border-amber-500/40 px-4 py-2.5 text-sm font-bold text-amber-300">Đổi mật khẩu</button>
          </form>
        </div>
        {profile.role === "MANAGER" && <StaffManagement request={request} />}
      </div>
    </div>
  );
}

function StaffManagement({ request }: { request: <T>(path: string, init?: RequestInit) => Promise<T> }) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [cinemas, setCinemas] = useState<Cinema[]>([]);
  const [form, setForm] = useState({ email: "", password: "", cinemaId: "" });
  const [error, setError] = useState("");
  const load = () => Promise.all([request<Staff[]>("/admin/staff"), fetch(`${process.env.NEXT_PUBLIC_API_URL || "/api/v1"}/cinemas`).then((r) => r.json())]).then(([s, c]) => { setStaff(s); setCinemas(c); if (!form.cinemaId && c[0]) setForm((x) => ({ ...x, cinemaId: c[0].id })); });
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);
  const create = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    try {
      await request("/admin/staff", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ email: form.email, password: form.password, cinemaIds: [form.cinemaId] }) });
      setForm((x) => ({ ...x, email: "", password: "" })); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Không tạo được nhân viên."); }
  };
  const toggle = async (member: Staff) => {
    try {
      await request(`/admin/staff/${member.id}`, { method: "PATCH", body: JSON.stringify({ locked: !member.locked, cinemaIds: member.cinemaIds, displayName: member.display_name }) });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Không cập nhật được nhân viên."); }
  };
  return <section className="mt-6 rounded-xl border border-[#272a3d] bg-[#0d0f18] p-5">
    <div className="mb-4"><h3 className="flex items-center gap-2 font-bold"><Shield className="h-4 w-4 text-purple-400" /> Nhân viên thuộc phạm vi quản lý</h3><p className="mt-1 text-xs text-zinc-500">Quản lý có thể tạo, khóa hoặc mở khóa nhân viên; không thể tự cấp vai trò Quản lý.</p></div>
    <form onSubmit={create} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
      <Field label="Email nhân viên" type="email" value={form.email} onChange={(v) => setForm((x) => ({ ...x, email: v }))} />
      <Field label="Mật khẩu ban đầu" type="password" value={form.password} onChange={(v) => setForm((x) => ({ ...x, password: v }))} minLength={12} />
      <label className="text-sm text-zinc-300">Cụm rạp<select required value={form.cinemaId} onChange={(e) => setForm((x) => ({ ...x, cinemaId: e.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-[#30344a] bg-[#0b0c14] px-3"><option value="">Chọn cụm rạp</option>{cinemas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <button className="self-end rounded-lg bg-purple-600 px-4 py-3 text-sm font-bold">Tạo nhân viên</button>
    </form>
    {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
    <div className="mt-5 divide-y divide-[#272a3d] border-t border-[#272a3d]">{staff.map((member) => <div key={member.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">{member.display_name || member.email}</p><p className="text-xs text-zinc-500">{member.email} · {member.locked ? "Đang khóa" : "Đang hoạt động"}</p></div><button onClick={() => toggle(member)} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${member.locked ? "border-emerald-500/40 text-emerald-300" : "border-rose-500/40 text-rose-300"}`}>{member.locked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}{member.locked ? "Mở khóa" : "Khóa tài khoản"}</button></div>)}</div>
  </section>;
}

function Field({ label, value, onChange, type = "text", minLength }: { label: string; value: string; onChange(v: string): void; type?: string; minLength?: number }) {
  return <label className="block text-sm text-zinc-300">{label}<input aria-label={label} required type={type} minLength={minLength} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-[#30344a] bg-[#0b0c14] px-3 text-white outline-none focus:border-purple-500" /></label>;
}

export function roleLabel(role: Profile["role"]) { return role === "MANAGER" ? "QUẢN LÝ" : role === "STAFF" ? "NHÂN VIÊN" : "KHÁCH HÀNG"; }
