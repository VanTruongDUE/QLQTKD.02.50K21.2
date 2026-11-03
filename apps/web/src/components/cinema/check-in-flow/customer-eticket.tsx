"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Popcorn,
  DoorOpen,
  ShieldAlert,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Ticket } from "../types";

interface CustomerETicketProps {
  ticket: Ticket;
  onUpdateTicket: (updated: Ticket) => void;
  forceStampSlam?: boolean;
}

export function CustomerETicket({
  ticket,
  onUpdateTicket,
  forceStampSlam = false,
}: CustomerETicketProps) {
  const [activeQrTab, setActiveQrTab] = useState<"cinema" | "fnb">("cinema");
  const [activeSeatIndex, setActiveSeatIndex] = useState(0);
  const [qrRotateSeconds, setQrRotateSeconds] = useState(28);
  const qrEntries = ticket.seatQrCodes?.length ? ticket.seatQrCodes : [{ ticketId: ticket.id, seatLabel: ticket.seats[0], qrToken: ticket.qrToken, qrImage: ticket.qrImage, status: ticket.status }];
  const activeQr = qrEntries[Math.min(activeSeatIndex, qrEntries.length - 1)];

  useEffect(() => setActiveSeatIndex(0), [ticket.bookingId, ticket.id]);

  // 3D Tilt State
  const cardRef = useRef<HTMLDivElement>(null);
  const [tiltStyle, setTiltStyle] = useState({
    transform: "perspective(1000px) rotateX(0deg) rotateY(0deg)",
    sheenX: 50,
    sheenY: 50,
  });

  // 30s rotating token effect to prevent screenshots
  useEffect(() => {
    const timer = setInterval(() => {
      setQrRotateSeconds((prev) => (prev > 0 ? prev - 1 : 30));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleNotifyPopcorn = () => {
    const updated: Ticket = {
      ...ticket,
      popcornStatus: "PREPARING",
      popcornCounter: "Quầy FastTrack #2 (Tầng 4)",
      readyInMinutes: 3,
    };
    onUpdateTicket(updated);
  };

  // Mouse move 3D tilt calculation
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const rotX = (0.5 - y) * 12; // Subtle 12deg tilt
    const rotY = (x - 0.5) * 12;

    setTiltStyle({
      transform: `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.01, 1.01, 1.01)`,
      sheenX: Math.round(x * 100),
      sheenY: Math.round(y * 100),
    });
  };

  const handleMouseLeave = () => {
    setTiltStyle({
      transform: "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
      sheenX: 50,
      sheenY: 50,
    });
  };

  const isCheckedIn = ticket.status === "CHECKED_IN" || forceStampSlam;

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      {/* Sub Tab Switcher: QR 1 Vào phòng vs QR 2 Bắp nước */}
      <div className="grid grid-cols-2 p-1 rounded-xl bg-[#181B2A] border border-[#2A2E45]">
        <button
          type="button"
          onClick={() => setActiveQrTab("cinema")}
          className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeQrTab === "cinema"
              ? "bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white shadow-md shadow-purple-900/30"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <DoorOpen className="w-3.5 h-3.5" />
          <span>QR 1: Vào Phòng Chiếu</span>
          {isCheckedIn && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveQrTab("fnb")}
          className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeQrTab === "fnb"
              ? "bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white shadow-md shadow-purple-900/30"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <Popcorn className="w-3.5 h-3.5" />
          <span>QR 2: Nhận Bắp Nước</span>
          {ticket.popcornStatus === "PREPARING" && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          )}
        </button>
      </div>

      {/* 3D Holographic Tilt Card with Perforated Edges */}
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: tiltStyle.transform,
          transition: "transform 0.12s ease-out",
        }}
        className="relative rounded-2xl bg-[#131520] border border-[#222538] shadow-2xl overflow-hidden p-6 text-white space-y-4 select-none"
      >
        {/* Holographic moving glare sheen overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-15"
          style={{
            background: `radial-gradient(circle at ${tiltStyle.sheenX}% ${tiltStyle.sheenY}%, rgba(255,255,255,0.3) 0%, transparent 60%)`,
          }}
        />

        {/* Semi-circular notch cutouts on edges */}
        <div className="ticket-perforation-left" />
        <div className="ticket-perforation-right" />

        {/* Rubber Stamp Slam Overlay when Checked In */}
        {isCheckedIn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            <div className="px-6 py-2.5 rounded-xl border-4 border-emerald-500 bg-emerald-950/90 text-emerald-300 font-mono font-black text-xl uppercase tracking-widest shadow-2xl backdrop-blur-md animate-stamp-slam">
              ✓ ĐÃ CHECK-IN HỢP LỆ
            </div>
          </div>
        )}

        {/* Header Branding */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800 relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-rose-600 flex items-center justify-center text-xs font-bold text-white">
              ST
            </div>
            <div>
              <span className="text-xs font-bold tracking-wider text-white block">
                STARLIGHT CINEMA
              </span>
              <span className="text-[10px] text-zinc-500 block">
                {ticket.cinema.name}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider block">
              Mã Vé
            </span>
            <span className="font-mono text-xs font-bold text-amber-400">
              {ticket.bookingCode}
            </span>
          </div>
        </div>

        {/* Tab 1: Room Entry QR View */}
        {activeQrTab === "cinema" && (
          <div className="space-y-4 relative z-10">
            {/* Movie Title & Badges */}
            <div className="text-center space-y-0.5">
              <div className="flex items-center justify-center gap-1.5">
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {ticket.movie.ageRating}
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {ticket.showtime.format}
                </span>
              </div>
              <h3 className="text-lg font-bold tracking-tight text-white">
                {ticket.movie.title}
              </h3>
              <p className="text-[11px] text-zinc-400">
                Khách: <strong className="text-zinc-200">{ticket.customerName}</strong> ({ticket.phone})
              </p>
            </div>

            {qrEntries.length > 1 && <div className="flex flex-wrap justify-center gap-2" aria-label="Chọn mã QR theo ghế">
              {qrEntries.map((entry, index) => <button key={entry.ticketId} type="button" onClick={() => setActiveSeatIndex(index)} className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${index === activeSeatIndex ? "border-pink-500 bg-pink-500/15 text-pink-300" : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white"}`}>Ghế {entry.seatLabel}{entry.status === "CHECKED_IN" ? " · Đã check-in" : ""}</button>)}
            </div>}

            {/* Dynamic Animated QR Code Box */}
            <div className="max-w-[190px] mx-auto p-3 rounded-xl bg-white shadow-md relative group">
              <div className="relative aspect-square w-full bg-zinc-900 rounded-lg p-2 flex items-center justify-center overflow-hidden">
                <img
                  src={activeQr.qrImage || (activeQr.qrToken ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(activeQr.qrToken)}` : "")}
                  alt={`Mã QR soát vé ghế ${activeQr.seatLabel}`}
                  className="w-full h-full object-contain filter contrast-125"
                />

                {/* Secure Watermark Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full bg-rose-600/90 text-white text-[9px] font-bold flex items-center justify-center shadow-md">
                    ST
                  </div>
                </div>
              </div>

              {/* Anti-fraud 30s rotating token countdown */}
              <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-zinc-600 px-1">
                <span className="flex items-center gap-1 text-emerald-600 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Mã an toàn
                </span>
                <span className="text-[10px] text-zinc-500 font-bold">
                  Ghế {activeQr.seatLabel} · đổi mã sau {qrRotateSeconds}s
                </span>
              </div>
            </div>

            {/* Ticket Info Details */}
            <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-center text-xs">
              <div>
                <span className="text-[10px] text-zinc-500 block">Suất chiếu</span>
                <p className="font-bold text-white text-xs mt-0.5">
                  {ticket.showtime.startsAt}
                </p>
              </div>

              <div>
                <span className="text-[10px] text-zinc-500 block">Phòng chiếu</span>
                <p className="font-bold text-zinc-200 text-xs mt-0.5">
                  {ticket.showtime.room.split(" ")[0]} {ticket.showtime.room.split(" ")[1]}
                </p>
              </div>

              <div>
                <span className="text-[10px] text-zinc-500 block">Ghế</span>
                <p className="font-bold text-rose-400 text-xs mt-0.5">
                  {ticket.seats.join(", ")}
                </p>
              </div>
            </div>

            {/* Mandatory Age Warning Banner */}
            <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[11px] text-zinc-400 flex items-start gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>
                Phim phân loại <strong>{ticket.movie.ageRating}</strong>. Vui lòng chuẩn bị sẵn CCCD hoặc thẻ HSSV để nhân viên đối soát tại cổng.
              </span>
            </div>
          </div>
        )}

        {/* Tab 2: Popcorn Express Pickup QR View */}
        {activeQrTab === "fnb" && (
          <div className="space-y-4 relative z-10">
            <div className="text-center space-y-0.5">
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                FastTrack Popcorn Pickup
              </span>
              <h3 className="text-lg font-bold text-white">
                Quầy Bắp Nước Ưu Tiên
              </h3>
              <p className="text-[11px] text-zinc-400">
                Xuất trình mã này tại <strong>Quầy FastTrack #2 (Tầng 4)</strong>
              </p>
            </div>

            {/* Popcorn Items List */}
            <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs space-y-2">
              <div className="flex justify-between items-center text-zinc-400 text-[11px] pb-1.5 border-b border-zinc-800">
                <span>Món đã đặt</span>
                <span>Trạng thái</span>
              </div>

              {ticket.fnbItems && ticket.fnbItems.length > 0 ? (
                ticket.fnbItems.map((fi, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-white">
                      {fi.quantity}x {fi.item.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                      Sẵn sàng chế biến
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-white">
                    1x Combo Đôi Starlight (Bắp lớn + 2 Coke)
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                    Sẵn sàng chế biến
                  </span>
                </div>
              )}
            </div>

            {/* Readiness Trigger Button */}
            <div className="text-center pt-1">
              {ticket.popcornStatus === "PREPARING" ? (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400 animate-spin" />
                  <span>
                    Bếp đang chuẩn bị! Dự kiến xong sau <strong>3 phút</strong>. Quý khách vui lòng đến quầy #2.
                  </span>
                </div>
              ) : ticket.popcornStatus === "PICKED_UP" ? (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Đã nhận bắp nước thành công. Chúc quý khách xem phim vui vẻ!</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleNotifyPopcorn}
                  className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Popcorn className="w-3.5 h-3.5" />
                  <span>Bấm để báo quầy chuẩn bị bắp nước trước (Tôi đã đến rạp)</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
