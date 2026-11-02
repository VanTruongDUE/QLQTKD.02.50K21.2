"use client";

import React, { useState } from "react";
import {
  Smartphone,
  ScanLine,
  Monitor,
  Columns2,
} from "lucide-react";
import { Ticket } from "../types";
import { CustomerETicket } from "./customer-eticket";
import { KioskStaffPos } from "./kiosk-staff-pos";

interface CheckInModuleProps {
  tickets: Ticket[];
  activeTicketCode: string;
  onUpdateTicket: (updated: Ticket) => void;
  onCheckInTicket: (ticketId: string) => void;
  forceStampSlam?: boolean;
  forceU22Surcharge?: boolean;
}

export function CheckInModule({
  tickets,
  activeTicketCode,
  onUpdateTicket,
  onCheckInTicket,
  forceStampSlam = false,
  forceU22Surcharge = false,
}: CheckInModuleProps) {
  const [subView, setSubView] = useState<"dual" | "customer" | "kiosk">("dual");

  const currentTicket =
    tickets.find((t) => t.bookingCode === activeTicketCode) ||
    tickets[0] ||
    null;

  return (
    <div className="space-y-4 animate-subtle-step">
      {/* Sub-view toggle: Dual Widescreen vs Customer vs Kiosk */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-[#131520] border border-[#222538] shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-[#EC4899]">
            <ScanLine className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              Hệ Thống Check-in Điện Tử & Kiosk
            </h3>
            <p className="text-[11px] text-zinc-400">
              Mô hình song song (Dual View): Thẻ vé Hologram 3D của khách & Kiosk nhân viên quét Laser tự động
            </p>
          </div>
        </div>

        {/* Sub-toggle buttons */}
        <div className="flex items-center p-1 rounded-xl bg-[#181B2A] border border-[#2A2E45] flex-wrap justify-center">
          <button
            onClick={() => setSubView("dual")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              subView === "dual"
                ? "bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white shadow-md shadow-purple-900/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span>Song Song 2 Màn Hình (1440px)</span>
          </button>

          <button
            onClick={() => setSubView("customer")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              subView === "customer"
                ? "bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white shadow-md shadow-purple-900/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Thẻ Vé Khách Hàng</span>
          </button>

          <button
            onClick={() => setSubView("kiosk")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              subView === "kiosk"
                ? "bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white shadow-md shadow-purple-900/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Kiosk Soát Vé POS</span>
          </button>
        </div>
      </div>

      {/* Render selected view */}
      {subView === "dual" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Customer E-Ticket View (6 cols) */}
          <div className="lg:col-span-6 space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" />
                Màn hình Khách Hàng (3D Tilt E-Ticket)
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                Xoay 3D & Token 30s
              </span>
            </div>
            {currentTicket ? (
              <CustomerETicket
                ticket={currentTicket}
                onUpdateTicket={onUpdateTicket}
              />
            ) : (
              <div className="p-8 text-center text-zinc-500">
                Không tìm thấy vé.
              </div>
            )}
          </div>

          {/* Right: Kiosk Staff POS View (6 cols) */}
          <div className="lg:col-span-6 space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5" />
                Kiosk Cổng Soát Vé (Staff POS)
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                Tia Laser & Đóng Dấu Mộc
              </span>
            </div>
            <KioskStaffPos
              tickets={tickets}
              onCheckInTicket={onCheckInTicket}
              forceStampSlam={forceStampSlam}
              forceU22Surcharge={forceU22Surcharge}
            />
          </div>
        </div>
      ) : subView === "customer" ? (
        currentTicket ? (
          <CustomerETicket
            ticket={currentTicket}
            onUpdateTicket={onUpdateTicket}
          />
        ) : (
          <div className="p-8 text-center text-zinc-500">
            Không tìm thấy thông tin vé.
          </div>
        )
      ) : (
        <KioskStaffPos
          tickets={tickets}
          onCheckInTicket={onCheckInTicket}
          forceStampSlam={forceStampSlam}
          forceU22Surcharge={forceU22Surcharge}
        />
      )}
    </div>
  );
}
