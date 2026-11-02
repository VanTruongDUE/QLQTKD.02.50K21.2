"use client";

import React from "react";
import { Smartphone, TicketCheck } from "lucide-react";
import { Ticket } from "../types";
import { CustomerETicket } from "./customer-eticket";

interface CheckInModuleProps {
  tickets: Ticket[];
  activeTicketCode: string;
  onUpdateTicket: (updated: Ticket) => void;
}

export function CheckInModule({ tickets, activeTicketCode, onUpdateTicket }: CheckInModuleProps) {
  const currentTicket = tickets.find((ticket) => ticket.bookingCode === activeTicketCode) || tickets[0] || null;
  return <div className="animate-subtle-step space-y-4">
    <div className="flex items-center gap-3 rounded-2xl border border-[#222538] bg-[#131520] p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-950/60 text-pink-400"><Smartphone className="h-5 w-5" /></div>
      <div><h2 className="text-sm font-bold text-white">Vé điện tử của khách hàng</h2><p className="text-xs text-zinc-400">Xuất trình mã QR này cho nhân viên tại cổng soát vé.</p></div>
    </div>
    {currentTicket ? <CustomerETicket ticket={currentTicket} onUpdateTicket={onUpdateTicket} /> : <div className="rounded-2xl border border-[#222538] bg-[#131520] p-10 text-center"><TicketCheck className="mx-auto h-8 w-8 text-zinc-600" /><h3 className="mt-3 font-bold text-white">Chưa có vé điện tử</h3><p className="mt-1 text-sm text-zinc-400">Vé QR sẽ xuất hiện tại đây sau khi thanh toán thành công.</p></div>}
  </div>;
}
