"use client";

import React, { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  MapPin,
  Smartphone,
  TicketCheck,
} from "lucide-react";
import { Ticket } from "../types";
import { CustomerETicket } from "./customer-eticket";

interface CheckInModuleProps {
  tickets: Ticket[];
  onUpdateTicket: (updated: Ticket) => void;
}

export function CheckInModule({ tickets, onUpdateTicket }: CheckInModuleProps) {
  const usableTickets = tickets.filter(
    (ticket) =>
      ticket.status === "ELIGIBLE_REFUND" || ticket.status === "CHECKED_IN",
  );
  const bookings = useMemo(() => {
    const grouped = new Map<string, Ticket[]>();
    for (const ticket of usableTickets) {
      const key =
        ticket.bookingId || `${ticket.showtime.id}:${ticket.createdAt}`;
      grouped.set(key, [...(grouped.get(key) || []), ticket]);
    }
    return [...grouped.entries()]
      .map(([bookingId, rows]) => {
        const orderedRows = [...rows].sort((a, b) =>
          (a.seats[0] || "").localeCompare(b.seats[0] || "", "vi", {
            numeric: true,
          }),
        );
        const first = orderedRows[0];
        return {
          bookingId,
          ticket: {
            ...first,
            id: bookingId,
            bookingId,
            bookingCode: bookingId,
            seats: orderedRows.map((row) => row.seats[0]).filter(Boolean),
            seatTypes: Object.assign(
              {},
              ...orderedRows.map((row) => row.seatTypes),
            ),
            totalPrice: orderedRows.reduce(
              (sum, row) => sum + row.totalPrice,
              0,
            ),
            status: orderedRows.every((row) => row.status === "CHECKED_IN")
              ? "CHECKED_IN"
              : "ELIGIBLE_REFUND",
            seatQrCodes: orderedRows.map((row) => ({
              ticketId: row.id,
              seatLabel: row.seats[0],
              qrToken: row.qrToken,
              qrImage: row.qrImage,
              status: row.status,
            })),
          } as Ticket,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.ticket.createdAt).getTime() -
          new Date(a.ticket.createdAt).getTime(),
      );
  }, [usableTickets]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    null,
  );
  const currentTicket =
    bookings.find((item) => item.bookingId === selectedBookingId)?.ticket ||
    null;
  const handleGroupedTicketUpdate = (updated: Ticket) => {
    const seats = updated.seatQrCodes || [];
    if (!seats.length) {
      onUpdateTicket(updated);
      return;
    }
    for (const seat of seats) {
      onUpdateTicket({
        ...updated,
        id: seat.ticketId,
        bookingCode: seat.ticketId,
        seats: [seat.seatLabel],
        qrToken: seat.qrToken,
        qrImage: seat.qrImage,
        status: seat.status,
        seatQrCodes: undefined,
      });
    }
  };

  return (
    <div className="animate-subtle-step space-y-4">
      <div className="flex items-center gap-3 rounded-2xl border border-[#222538] bg-[#131520] p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-950/60 text-pink-400">
          <Smartphone className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">
            Smart Check-in của khách hàng
          </h2>
          <p className="text-xs text-zinc-400">
            Chọn phim đã đặt để xem thông tin và QR của toàn bộ ghế.
          </p>
        </div>
      </div>
      {bookings.length ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)] lg:items-start">
          <section
            className="rounded-2xl border border-[#222538] bg-[#131520] p-3"
            aria-label="Danh sách phim đã đặt"
          >
            <div className="px-2 pb-3">
              <h3 className="text-sm font-bold text-white">Phim đã đặt</h3>
              <p className="mt-1 text-xs text-zinc-400">
                Mỗi đơn hiển thị một lần, kèm toàn bộ ghế đã mua.
              </p>
            </div>
            <div className="space-y-2">
              {bookings.map(({ bookingId, ticket }) => {
                const selected = bookingId === selectedBookingId;
                return (
                  <button
                    key={bookingId}
                    type="button"
                    onClick={() => setSelectedBookingId(bookingId)}
                    aria-pressed={selected}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${selected ? "border-purple-500/70 bg-purple-950/25" : "border-[#2A2E45] bg-[#181B2A] hover:border-zinc-600"}`}
                  >
                    <div className="flex gap-3">
                      {ticket.movie.poster ? (
                        <img
                          src={ticket.movie.poster}
                          alt=""
                          className="h-24 w-16 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded-lg bg-zinc-900">
                          <TicketCheck className="h-5 w-5 text-zinc-600" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="line-clamp-2 text-sm font-bold text-white">
                            {ticket.movie.title}
                          </h4>
                          <ChevronRight
                            className={`mt-0.5 h-4 w-4 shrink-0 ${selected ? "text-pink-400" : "text-zinc-600"}`}
                          />
                        </div>
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {ticket.showtime.dateStr} · {ticket.showtime.startsAt}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
                          <MapPin className="h-3.5 w-3.5" />
                          {ticket.cinema.name} · {ticket.showtime.room}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-rose-300">
                          {ticket.seats.length} ghế: {ticket.seats.join(", ")}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
          <section className="min-w-0">
            {currentTicket ? (
              <CustomerETicket
                ticket={currentTicket}
                onUpdateTicket={handleGroupedTicketUpdate}
              />
            ) : (
              <div className="rounded-2xl border border-[#222538] bg-[#131520] p-10 text-center">
                <TicketCheck className="mx-auto h-8 w-8 text-zinc-600" />
                <h3 className="mt-3 font-bold text-white">
                  Chọn phim để mở vé
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                  Thông tin phim, toàn bộ ghế và QR sẽ hiển thị tại đây.
                </p>
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#222538] bg-[#131520] p-10 text-center">
          <TicketCheck className="mx-auto h-8 w-8 text-zinc-600" />
          <h3 className="mt-3 font-bold text-white">Chưa có vé điện tử</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Vé QR sẽ xuất hiện tại đây sau khi thanh toán thành công.
          </p>
        </div>
      )}
    </div>
  );
}
