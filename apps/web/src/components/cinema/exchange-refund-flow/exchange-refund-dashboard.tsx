"use client";

import React, { useState } from "react";
import {
  Search,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  CreditCard,
  Wallet,
  RefreshCw,
  Loader2,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { Ticket, TicketStatus } from "../types";

interface ExchangeRefundDashboardProps {
  tickets: Ticket[];
  onUpdateTicket: (updated: Ticket) => void;
  onNavigateToCheckin: (bookingCode: string) => void;
  forceNearShowtime?: boolean;
}

export function ExchangeRefundDashboard({
  tickets,
  onUpdateTicket,
  onNavigateToCheckin,
  forceNearShowtime = false,
}: ExchangeRefundDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [activeModalTicket, setActiveModalTicket] = useState<Ticket | null>(null);
  const [activeTabBranch, setActiveTabBranch] = useState<"exchange" | "refund">("exchange");

  // State for Branch A (Exchange)
  const [newShowtimeTime, setNewShowtimeTime] = useState("22:15");
  const [exchangeSuccess, setExchangeSuccess] = useState(false);

  // State for Branch B (Refund)
  const [refundReason, setRefundReason] = useState("Bận việc đột xuất không thể sắp xếp");
  const [refundMethod, setRefundMethod] = useState<"WALLET" | "ORIGINAL">("WALLET");
  const [refundStep, setRefundStep] = useState<number>(0); // 0 = not started, 1=sending, 2=validating, 3=releasing, 4=done

  const filteredTickets = tickets.filter((t) => {
    const q = searchQuery.trim().toLowerCase();
    const matchSearch =
      !q ||
      t.bookingCode.toLowerCase().includes(q) ||
      t.phone.includes(q) ||
      t.movie.title.toLowerCase().includes(q);

    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ELIGIBLE" && t.status === "ELIGIBLE_REFUND") ||
      (statusFilter === "LOCKED" && t.status === "LOCKED_REFUND") ||
      (statusFilter === "CHECKED_IN" && t.status === "CHECKED_IN") ||
      (statusFilter === "REFUNDED" && t.status === "REFUNDED");

    return matchSearch && matchStatus;
  });

  const getStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case "ELIGIBLE_REFUND":
        return {
          label: "Sắp chiếu • Đủ điều kiện đổi/trả",
          bg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
          desc: "Được hỗ trợ đổi hoặc hoàn vé tự động 100%",
        };
      case "LOCKED_REFUND":
        return {
          label: "Sắp chiếu (< 45 phút - Khóa đổi/trả)",
          bg: "bg-rose-500/15 text-rose-400 border-rose-500/30",
          desc: "Đã quá hạn đổi/hoàn vé trực tuyến",
        };
      case "CHECKED_IN":
        return {
          label: "Đã Check-in vào phòng chiếu",
          bg: "bg-purple-500/15 text-purple-400 border-purple-500/30",
          desc: "Vé đã được kiểm tra tại cổng soát vé",
        };
      case "REFUNDED":
        return {
          label: "Đã Hoàn Vé Thành Công",
          bg: "bg-blue-500/15 text-blue-400 border-blue-500/30",
          desc: "Tiền đã được hoàn lại vào tài khoản",
        };
    }
  };

  // Perform Exchange
  const handleConfirmExchange = () => {
    if (!activeModalTicket) return;
    const updated: Ticket = {
      ...activeModalTicket,
      bookingCode: `${activeModalTicket.bookingCode}-EX1`,
      showtime: {
        ...activeModalTicket.showtime,
        startsAt: newShowtimeTime,
      },
    };
    onUpdateTicket(updated);
    setExchangeSuccess(true);
    setTimeout(() => {
      setExchangeSuccess(false);
      setActiveModalTicket(null);
    }, 1800);
  };

  // Perform Refund Simulation
  const handleStartRefund = () => {
    if (!activeModalTicket) return;
    setRefundStep(1);

    setTimeout(() => setRefundStep(2), 700);
    setTimeout(() => setRefundStep(3), 1500);
    setTimeout(() => {
      setRefundStep(4);
      const updated: Ticket = {
        ...activeModalTicket,
        status: "REFUNDED",
        refundMethod: refundMethod === "WALLET" ? "WALLET" : "ORIGINAL_PAYMENT",
        refundedAmount:
          refundMethod === "WALLET"
            ? activeModalTicket.totalPrice
            : Math.round(activeModalTicket.totalPrice * 0.9),
      };
      onUpdateTicket(updated);
    }, 2400);
  };

  return (
    <div className="space-y-4 animate-subtle-step">
      {/* Clean Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Quản Lý & Đổi / Trả Vé Trực Tuyến
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Tự đổi suất chiếu hoặc hủy hoàn vé 100% trước giờ chiếu tối thiểu <strong>45 phút</strong>.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 self-start sm:self-auto">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Hoàn tiền vào Ví trong 30s</span>
        </div>
      </div>

      {/* Ticket Lookup Search & Status Filters */}
      <div className="p-4 rounded-2xl bg-[#131520] border border-[#222538] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo Mã đặt vé (STL-...) hoặc SĐT"
            className="w-full bg-[#181B2A] border border-[#2A2E45] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {[
            { id: "ALL", label: "Tất cả vé" },
            { id: "ELIGIBLE", label: "Đủ điều kiện đổi/trả" },
            { id: "LOCKED", label: "Khóa đổi/trả (< 45p)" },
            { id: "CHECKED_IN", label: "Đã Check-in" },
            { id: "REFUNDED", label: "Đã hoàn vé" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === tab.id
                  ? "bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white shadow-md shadow-purple-900/30"
                  : "bg-[#181B2A] text-zinc-400 hover:text-white border border-[#2A2E45]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Automated Eligibility Checker Banner for Active Eligible Ticket */}
      {forceNearShowtime ? (
        <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block">
                  Cảnh Báo Nghiệp Vụ Sát Giờ Chiếu (&lt; 45 Phút)
                </span>
                <h4 className="text-xs sm:text-sm font-semibold text-white">
                  Chỉ còn 28 phút trước giờ chiếu (Suất 19:45) • ĐÃ KHÓA ĐỔI / HOÀN VÉ TỰ ĐỘNG
                </h4>
              </div>
            </div>

            <div className="text-right text-xs">
              <span className="text-zinc-400">Mốc khóa vé:</span>
              <span className="font-mono font-bold text-rose-400 ml-1.5">
                Đã quá mốc 19:00 (17 phút)
              </span>
            </div>
          </div>

          {/* Time Remaining Progress Bar */}
          <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden mb-3">
            <div
              className="bg-rose-500 h-full rounded-full transition-all duration-500"
              style={{ width: "95%" }}
            />
          </div>

          {/* Failed Criteria Checklist */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="flex items-center gap-2 text-rose-300 bg-zinc-900/80 p-2 rounded-lg border border-rose-900/40">
              <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>Thời gian còn lại &lt; 45 phút (Vi phạm)</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-300 bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Vé chưa qua cổng Check-in</span>
            </div>
            <div className="flex items-center gap-2 text-rose-300 bg-zinc-900/80 p-2 rounded-lg border border-rose-900/40">
              <Lock className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>Tự động khóa đổi / hủy trực tuyến</span>
            </div>
          </div>
        </div>
      ) : tickets.some((t) => t.status === "ELIGIBLE_REFUND") ? (
        <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                  Automated Rule Engine
                </span>
                <h4 className="text-xs sm:text-sm font-semibold text-white">
                  Còn 01 giờ 45 phút để thực hiện đổi hoặc hoàn vé hợp lệ (Mã: STL-894210)
                </h4>
              </div>
            </div>

            <div className="text-right text-xs">
              <span className="text-zinc-400">Mốc khóa vé:</span>
              <span className="font-mono font-bold text-amber-400 ml-1.5">
                19:00 Hôm nay (trước 45 phút)
              </span>
            </div>
          </div>

          {/* Time Remaining Progress Bar */}
          <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden mb-3">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: "70%" }}
            />
          </div>

          {/* Passed Criteria Checklist */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="flex items-center gap-2 text-zinc-300 bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/80">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Trước giờ chiếu ≥ 45 phút</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-300 bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/80">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Vé chưa qua cổng Check-in</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-300 bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/80">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Phương thức đủ điều kiện hoàn tự động</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Ticket Cards List */}
      <div className="space-y-3">
        {filteredTickets.map((ticket) => {
          const isNearShowtimeLocked = forceNearShowtime && ticket.bookingCode === "STL-894210";
          const badge = isNearShowtimeLocked
            ? {
                label: "Sắp chiếu (< 45 phút - Khóa đổi/trả)",
                bg: "bg-rose-500/10 text-rose-400 border-rose-500/20",
                desc: "Đã quá hạn đổi/hoàn vé trực tuyến (< 45 phút trước giờ chiếu)",
              }
            : getStatusBadge(ticket.status);
          const isEligible = !isNearShowtimeLocked && ticket.status === "ELIGIBLE_REFUND";

          return (
            <div
              key={ticket.id}
              className="p-5 rounded-2xl bg-[#131520] border border-[#222538] hover:border-[#353a57] transition-all shadow-lg"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left: Movie & Ticket Info */}
                <div className="flex items-start gap-4">
                  <img
                    src={ticket.movie.poster}
                    alt={ticket.movie.title}
                    className="w-16 h-22 rounded-xl object-cover flex-shrink-0 bg-[#0B0C14] border border-[#222538]"
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="font-mono text-xs font-bold text-amber-400 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30">
                        {ticket.bookingCode}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${badge.bg}`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <h4 className="text-base sm:text-lg font-extrabold text-white">
                      {ticket.movie.title}
                    </h4>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-400 mt-1">
                      <span>Rạp: <strong className="text-zinc-200">{ticket.cinema.name}</strong></span>
                      <span>Suất: <strong className="text-zinc-200">{ticket.showtime.startsAt} • {ticket.showtime.room}</strong></span>
                      <span>Ghế: <strong className="text-[#EC4899] font-bold">{ticket.seats.join(", ")}</strong></span>
                      <span>Tổng: <strong className="text-amber-400 font-bold">{ticket.totalPrice.toLocaleString("vi-VN")}đ</strong></span>
                    </div>

                    <p className="text-[11px] text-zinc-400 mt-1.5">
                      {badge.desc}
                    </p>
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-2 self-end lg:self-center">
                  {isEligible ? (
                    <button
                      onClick={() => {
                        setActiveModalTicket(ticket);
                        setActiveTabBranch("exchange");
                        setRefundStep(0);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] hover:opacity-95 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-purple-900/40"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Xử Lý Đổi / Hoàn Vé</span>
                    </button>
                  ) : isNearShowtimeLocked ? (
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/30 text-xs font-semibold">
                        <Lock className="w-3.5 h-3.5 text-rose-400" />
                        <span>Khóa Đổi/Trả (&lt; 45p)</span>
                      </div>
                      <button
                        onClick={() => onNavigateToCheckin(ticket.bookingCode)}
                        className="text-[11px] text-purple-400 hover:text-purple-300 underline font-medium cursor-pointer"
                      >
                        Mở Thẻ Vé Vào Phòng Chiếu →
                      </button>
                    </div>
                  ) : ticket.status === "LOCKED_REFUND" ? (
                    <div className="text-right">
                      <span className="text-[11px] text-zinc-500 block mb-1">
                        Chiếu sau 25 phút
                      </span>
                      <button
                        onClick={() => onNavigateToCheckin(ticket.bookingCode)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#181B2A] hover:bg-[#20253B] text-zinc-200 border border-[#2A2E45] text-xs font-medium cursor-pointer"
                      >
                        Mở Vé Vào Phòng Chiếu
                      </button>
                    </div>
                  ) : ticket.status === "CHECKED_IN" ? (
                    <button
                      onClick={() => onNavigateToCheckin(ticket.bookingCode)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#181B2A] text-zinc-300 border border-[#2A2E45] text-xs font-medium hover:bg-[#20253B] cursor-pointer"
                    >
                      Xem Thẻ Vé Đã Check-in
                    </button>
                  ) : (
                    <div className="text-xs text-sky-400 font-bold bg-sky-500/10 px-3 py-1.5 rounded-xl border border-sky-500/20">
                      Đã hoàn: {ticket.refundedAmount?.toLocaleString("vi-VN")}đ
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Action Modal / Split View with 2 Branches */}
      {activeModalTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-xl rounded-2xl bg-[#131520] border border-[#222538] shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-[#222538]">
              <div>
                <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block">
                  Xử lý vé: {activeModalTicket.bookingCode}
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  {activeModalTicket.movie.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveModalTicket(null)}
                className="w-8 h-8 rounded-xl bg-[#181B2A] hover:bg-[#20253B] text-zinc-400 hover:text-white flex items-center justify-center text-xs font-bold transition-colors cursor-pointer border border-[#2A2E45]"
              >
                ✕
              </button>
            </div>

            {/* Segmented Branch Switcher (Nhánh A vs Nhánh B) */}
            <div className="grid grid-cols-2 p-1 rounded-xl bg-[#181B2A] border border-[#2A2E45]">
              <button
                onClick={() => setActiveTabBranch("exchange")}
                className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTabBranch === "exchange"
                    ? "bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white shadow-md shadow-purple-900/30"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Nhánh A: Đổi Suất Chiếu</span>
              </button>

              <button
                onClick={() => setActiveTabBranch("refund")}
                className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTabBranch === "refund"
                    ? "bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white shadow-md shadow-purple-900/30"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Nhánh B: Hủy & Hoàn Tiền</span>
              </button>
            </div>

            {/* Branch A: Ticket Exchange */}
            {activeTabBranch === "exchange" && (
              <div className="space-y-3.5">
                <p className="text-xs text-zinc-300">
                  Chọn suất chiếu mới cho phim <strong>{activeModalTicket.movie.title}</strong> hôm nay:
                </p>

                {/* Showtime Selector */}
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { time: "21:30", room: "Phòng 02", diff: 0 },
                    { time: "22:15", room: "Phòng 03 VIP", diff: 20000 },
                    { time: "23:45", room: "Phòng 01", diff: -15000 },
                  ].map((s) => (
                    <button
                      key={s.time}
                      onClick={() => setNewShowtimeTime(s.time)}
                      className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        newShowtimeTime === s.time
                          ? "bg-zinc-800 border-zinc-700 text-white shadow-sm ring-1 ring-zinc-700"
                          : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850"
                      }`}
                    >
                      <div className="text-sm font-bold text-white">{s.time}</div>
                      <div className="text-[10px] text-zinc-400">{s.room}</div>
                      <div className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                        {s.diff > 0 ? `+${s.diff.toLocaleString("vi-VN")}đ` : s.diff < 0 ? `${s.diff.toLocaleString("vi-VN")}đ` : "Cùng giá"}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Price Difference Calculator Card */}
                <div className="p-3.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs space-y-1.5">
                  <div className="flex justify-between text-zinc-400">
                    <span>Giá trị vé cũ:</span>
                    <span>{activeModalTicket.totalPrice.toLocaleString("vi-VN")}đ</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Giá trị suất mới ({newShowtimeTime}):</span>
                    <span>{(activeModalTicket.totalPrice + 20000).toLocaleString("vi-VN")}đ</span>
                  </div>
                  <div className="pt-2 border-t border-zinc-800 flex justify-between font-semibold text-xs sm:text-sm">
                    <span className="text-zinc-200">Chênh lệch cần thanh toán:</span>
                    <span className="text-rose-400 font-bold">+20.000đ</span>
                  </div>
                </div>

                {exchangeSuccess ? (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold text-center flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Đổi vé thành công! Mã vé mới: {activeModalTicket.bookingCode}-EX1
                  </div>
                ) : (
                  <button
                    onClick={handleConfirmExchange}
                    className="w-full py-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer"
                  >
                    Xác Nhận Đổi Suất Chiếu (+20.000đ)
                  </button>
                )}
              </div>
            )}

            {/* Branch B: Cancel & Refund */}
            {activeTabBranch === "refund" && (
              <div className="space-y-4">
                {/* Reason Selector */}
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    Lý do hủy vé:
                  </label>
                  <select
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700"
                  >
                    <option>Bận việc đột xuất không thể sắp xếp</option>
                    <option>Đặt nhầm suất chiếu / Rạp chiếu</option>
                    <option>Người đi cùng hủy hẹn</option>
                    <option>Thay đổi kế hoạch cá nhân</option>
                  </select>
                </div>

                {/* Refund Method Comparison Cards */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-300 block">
                    Chọn phương thức nhận tiền hoàn:
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Method 1: Starlight Wallet (Recommended) */}
                    <button
                      type="button"
                      onClick={() => setRefundMethod("WALLET")}
                      className={`p-3.5 rounded-xl border text-left transition-colors relative cursor-pointer ${
                        refundMethod === "WALLET"
                          ? "bg-zinc-900 border-rose-600 ring-1 ring-rose-600"
                          : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-bold text-white">
                            Ví Starlight Pay
                          </span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-rose-600 text-white">
                          Khuyên dùng
                        </span>
                      </div>
                      <div className="text-base font-bold text-emerald-400">
                        Hoàn 100% ({activeModalTicket.totalPrice.toLocaleString("vi-VN")}đ)
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1">
                        ⚡ Nhận ngay trong <strong>30 giây</strong>. Tặng thêm Voucher 15% bắp nước.
                      </p>
                    </button>

                    {/* Method 2: Original Payment Method */}
                    <button
                      type="button"
                      onClick={() => setRefundMethod("ORIGINAL")}
                      className={`p-3.5 rounded-xl border text-left transition-colors relative cursor-pointer ${
                        refundMethod === "ORIGINAL"
                          ? "bg-zinc-900 border-rose-600 ring-1 ring-rose-600"
                          : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <CreditCard className="w-4 h-4 text-zinc-400" />
                        <span className="text-xs font-bold text-white">
                          Cổng thanh toán gốc
                        </span>
                      </div>
                      <div className="text-base font-bold text-zinc-200">
                        Hoàn 90% ({(activeModalTicket.totalPrice * 0.9).toLocaleString("vi-VN")}đ)
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1">
                        Khấu trừ 10% phí cổng thanh toán. Nhận sau <strong>3–5 ngày làm việc</strong>.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Animated Refund Timeline Stepper Simulation */}
                {refundStep > 0 && (
                  <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2.5">
                    <span className="text-xs font-semibold text-zinc-300 block">
                      Tiến trình xử lý hoàn tiền tự động:
                    </span>

                    <div className="space-y-1.5 text-xs">
                      {[
                        { step: 1, label: "Gửi yêu cầu hủy vé lên hệ thống Starlight" },
                        { step: 2, label: "Hệ thống tự động kiểm tra điều kiện & khóa mã vé cũ" },
                        { step: 3, label: `Giải phóng ghế ${activeModalTicket.seats.join(", ")} trên sơ đồ rạp` },
                        {
                          step: 4,
                          label:
                            refundMethod === "WALLET"
                              ? `Đã hoàn 100% (${activeModalTicket.totalPrice.toLocaleString("vi-VN")}đ) vào Ví Starlight Pay!`
                              : `Yêu cầu hoàn ${(activeModalTicket.totalPrice * 0.9).toLocaleString("vi-VN")}đ đã chuyển ngân hàng!`,
                        },
                      ].map((s) => {
                        const isCompleted = refundStep >= s.step;
                        const isCurrent = refundStep === s.step && refundStep !== 4;

                        return (
                          <div
                            key={s.step}
                            className={`flex items-center gap-2.5 p-2 rounded-lg transition-colors ${
                              isCompleted
                                ? "text-emerald-300 bg-emerald-500/10"
                                : "text-zinc-500"
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            ) : isCurrent ? (
                              <Loader2 className="w-4 h-4 text-amber-400 animate-spin flex-shrink-0" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-zinc-700 flex-shrink-0" />
                            )}
                            <span className="font-medium">{s.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {refundStep === 4 ? (
                  <div className="space-y-3">
                    <div className="relative py-2 flex flex-col items-center justify-center overflow-hidden">
                      <div className="w-full p-3.5 rounded-xl bg-zinc-950 border border-dashed border-rose-600/40 relative">
                        <div className="flex justify-between items-center text-xs text-zinc-400">
                          <span>
                            Mã hủy:{" "}
                            <strong className="text-white font-mono">
                              {activeModalTicket.bookingCode}
                            </strong>
                          </span>
                          <span className="text-rose-400 font-bold uppercase text-[11px]">
                            VÉ ĐÃ VÔ HIỆU HÓA
                          </span>
                        </div>
                        <div className="text-xs text-zinc-400 mt-1">
                          Ghế đã giải phóng:{" "}
                          <strong className="text-amber-400">
                            {activeModalTicket.seats.join(", ")}
                          </strong>
                        </div>

                        {/* Stamp Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                          <div className="px-4 py-1.5 rounded-lg border-2 border-rose-500 bg-rose-950/90 text-rose-300 font-mono font-bold text-sm uppercase tracking-wider animate-stamp-slam">
                            ✓ ĐÃ HOÀN TIỀN 100%
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveModalTicket(null)}
                      className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer"
                    >
                      Hoàn tất & Đóng cửa sổ
                    </button>
                  </div>
                ) : (
                  <button
                    disabled={refundStep > 0}
                    onClick={handleStartRefund}
                    className="w-full py-3 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold text-xs shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {refundStep > 0 ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang xử lý hoàn tiền tự động...</span>
                      </>
                    ) : (
                      <span>
                        Xác Nhận Hủy Vé & Hoàn Tiền (
                        {refundMethod === "WALLET"
                          ? `${activeModalTicket.totalPrice.toLocaleString("vi-VN")}đ`
                          : `${(activeModalTicket.totalPrice * 0.9).toLocaleString("vi-VN")}đ`}
                        )
                      </span>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
