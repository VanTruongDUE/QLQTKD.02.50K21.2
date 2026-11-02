"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ShieldAlert,
  Heart,
  GraduationCap,
  Plus,
  Minus,
} from "lucide-react";
import { Seat, Showtime, Movie } from "../types";

interface Step2SeatMapProps {
  movie: Movie;
  showtime: Showtime;
  seats: Seat[];
  selectedSeatIds: string[];
  onToggleSeat: (seatId: string) => void;
  u22TicketCount: number;
  onU22CountChange: (count: number) => void;
  forceSingleSeatWarning?: { seatId: string; row: string; number: number } | null;
}

export function Step2SeatMap({
  movie,
  showtime,
  seats,
  selectedSeatIds,
  onToggleSeat,
  u22TicketCount,
  onU22CountChange,
  forceSingleSeatWarning,
}: Step2SeatMapProps) {
  const [hoveredSeat, setHoveredSeat] = useState<Seat | null>(null);

  // Group seats by row
  const rows = useMemo(() => {
    const map = new Map<string, Seat[]>();
    seats.forEach((seat) => {
      const list = map.get(seat.row) || [];
      list.push(seat);
      map.set(seat.row, list);
    });
    return Array.from(map.entries());
  }, [seats]);

  // Single-Seat Rule Validation Logic
  const detectedSingleSeatWarning = useMemo(() => {
    if (selectedSeatIds.length === 0) return null;

    for (const [rowLabel, rowSeats] of rows) {
      if (rowLabel === "J") continue; // Skip couple row

      const sorted = [...rowSeats].sort((a, b) => a.number - b.number);
      const rowLen = sorted.length;

      const seatStates = sorted.map((s) => ({
        id: s.id,
        number: s.number,
        isOccupied: s.status === "booked" || selectedSeatIds.includes(s.id),
        isSelected: selectedSeatIds.includes(s.id),
      }));

      for (let i = 0; i < rowLen; i++) {
        const curr = seatStates[i];
        if (!curr.isOccupied) {
          const leftOccupied = i === 0 || seatStates[i - 1].isOccupied;
          const rightOccupied = i === rowLen - 1 || seatStates[i + 1].isOccupied;

          const leftSelected = i > 0 && seatStates[i - 1].isSelected;
          const rightSelected = i < rowLen - 1 && seatStates[i + 1].isSelected;

          if (leftOccupied && rightOccupied && (leftSelected || rightSelected)) {
            return {
              seatId: curr.id,
              row: rowLabel,
              number: curr.number,
            };
          }
        }
      }
    }
    return null;
  }, [rows, selectedSeatIds]);

  const singleSeatWarning = forceSingleSeatWarning || detectedSingleSeatWarning;
  const maxU22Allowed = selectedSeatIds.length;

  return (
    <div className="space-y-4 animate-subtle-step">
      {/* Theater & Screen Room Header */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#131520] border border-[#222538] relative shadow-xl">
        {/* Top Room Metadata */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#222538] text-xs">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="font-semibold text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded text-[11px] border border-purple-500/30">
                {showtime.room}
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-400 text-[11px]">
                {showtime.format}
              </span>
            </div>
            <h3 className="text-base font-bold text-white tracking-tight">
              {movie.title}
            </h3>
          </div>

          <div className="text-right">
            <div className="text-zinc-400 text-[11px]">Suất chiếu</div>
            <div className="font-bold text-white text-sm">
              <span className="text-[#EC4899]">{showtime.startsAt}</span> • Hôm nay
            </div>
          </div>
        </div>

        {/* Realistic Cinema Screen with Subtle Top Arc */}
        <div className="pt-8 pb-4 text-center relative">
          <div className="cinema-screen-3d w-[80%] max-w-[540px] mx-auto h-7 rounded-t-lg bg-[#181B2A] border-t-2 border-purple-500 flex items-center justify-center relative shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-purple-200">
              MÀN HÌNH CHIẾU / SCREEN
            </span>
          </div>

          <div className="ambient-light-cone w-[85%] max-w-[580px] h-20 mx-auto -mt-1 rounded-b-full pointer-events-none" />
        </div>

        {/* Single-Seat Rule Alert Banner */}
        {singleSeatWarning && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-seat-shake">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-rose-200 text-xs mb-0.5">
                Cảnh báo quy tắc chọn ghế (Single-Seat Rule)
              </div>
              <p className="text-[11px] leading-relaxed text-rose-300/90">
                Bạn đang để lại <strong>1 ghế trống đơn lẻ ({singleSeatWarning.seatId})</strong>. Vui lòng không để trống 1 ghế đơn độc lập giữa các ghế đã chọn theo quy định của rạp.
              </p>
            </div>
          </div>
        )}

        {/* Seat Map Grid Container */}
        <div className="overflow-x-auto pb-4 pt-1">
          <div className="min-w-[640px] max-w-[700px] mx-auto space-y-2 relative">
            {rows.map(([rowLabel, rowSeats]) => {
              const isCoupleRow = rowLabel === "J";

              return (
                <div key={rowLabel} className="flex items-center gap-2">
                  {/* Row Letter Left */}
                  <span className="w-5 text-xs font-semibold text-zinc-500 text-center">
                    {rowLabel}
                  </span>

                  {/* Seats in row */}
                  <div className="flex-1 flex justify-center gap-1.5 sm:gap-2 relative">
                    {/* Dotted Best View Zone on Rows F, G, H */}
                    {["F", "G", "H"].includes(rowLabel) && (
                      <div className="absolute inset-y-[-2px] left-[20%] right-[20%] rounded-md border border-dashed border-purple-500/30 pointer-events-none -z-0" />
                    )}

                    {rowSeats.map((seat) => {
                      const isSelected = selectedSeatIds.includes(seat.id);
                      const isBooked = seat.status === "booked";
                      const isIsolated = singleSeatWarning?.seatId === seat.id;

                      // Authentic cinema seat shape (curved top, flatter bottom)
                      let seatClasses =
                        "rounded-t-md rounded-b-sm border text-[10px] font-semibold transition-all relative group cursor-pointer ";

                      if (isBooked) {
                        seatClasses +=
                          "bg-[#0F111A] border-[#1C2033] text-zinc-600 opacity-40 cursor-not-allowed";
                      } else if (isSelected) {
                        seatClasses +=
                          "bg-gradient-to-tr from-[#A855F7] to-[#EC4899] border-transparent text-white font-bold shadow-[0_0_15px_rgba(236,72,153,0.6)] active:scale-95 transition-transform duration-100 z-10";
                      } else if (isCoupleRow) {
                        seatClasses +=
                          "bg-purple-950/40 hover:bg-purple-900/50 border-purple-600/40 text-purple-300 active:scale-95 transition-transform duration-100";
                      } else if (seat.type === "vip") {
                        seatClasses +=
                          "bg-amber-950/40 hover:bg-amber-900/50 border-amber-600/40 text-amber-300 active:scale-95 transition-transform duration-100";
                      } else {
                        seatClasses +=
                          "bg-[#181B2A] hover:bg-[#20253B] border-[#2A2E45] text-zinc-300 active:scale-95 transition-transform duration-100";
                      }

                      // Error shake on isolated single seat
                      if (isIsolated) {
                        seatClasses +=
                          " animate-seat-shake border-2 border-rose-500 bg-rose-500/20 text-rose-300 ring-1 ring-rose-500";
                      }

                      const seatWidth = isCoupleRow
                        ? "w-20 h-8 rounded-t-lg rounded-b-sm"
                        : "w-8 h-8 sm:w-9 sm:h-8";

                      return (
                        <div key={seat.id} className="relative">
                          <button
                            type="button"
                            disabled={isBooked}
                            onMouseEnter={() => setHoveredSeat(seat)}
                            onMouseLeave={() => setHoveredSeat(null)}
                            onClick={() => onToggleSeat(seat.id)}
                            className={`${seatWidth} ${seatClasses} flex items-center justify-center`}
                          >
                            {isCoupleRow ? (
                              <span className="flex items-center gap-1 text-[10px]">
                                <Heart className="w-3 h-3 fill-purple-400" />
                                {seat.id}
                              </span>
                            ) : (
                              seat.id
                            )}
                          </button>

                          {/* Subtle Floating Tooltip on Hover */}
                          {hoveredSeat?.id === seat.id && !isBooked && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-28 p-2 rounded-xl bg-[#131520] border border-[#222538] text-[10px] text-zinc-200 shadow-2xl z-30 pointer-events-none text-center space-y-0.5">
                              <div className="font-semibold text-white">
                                Ghế {seat.id}
                              </div>
                              <div className="text-zinc-400 text-[9px]">
                                {seat.type === "vip"
                                  ? "VIP Golden"
                                  : seat.type === "couple"
                                  ? "Ghế Đôi"
                                  : "Ghế Thường"}
                              </div>
                              <div className="font-bold text-[#EC4899]">
                                {seat.price.toLocaleString("vi-VN")}đ
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Row Letter Right */}
                  <span className="w-5 text-xs font-semibold text-zinc-500 text-center">
                    {rowLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Seat Legend */}
        <div className="pt-3 border-t border-[#222538] flex flex-wrap items-center justify-center gap-5 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-t-sm rounded-b-[2px] bg-[#181B2A] border border-[#2A2E45]" />
            <span className="text-zinc-400 text-[11px]">Thường (60k)</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-t-sm rounded-b-[2px] bg-amber-950/40 border border-amber-600/40" />
            <span className="text-amber-300 font-medium text-[11px]">VIP (70k)</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-7 h-4 rounded-t-sm rounded-b-[2px] bg-purple-950/40 border border-purple-600/40 flex items-center justify-center">
              <Heart className="w-2.5 h-2.5 fill-purple-400 text-purple-400" />
            </div>
            <span className="text-purple-300 font-medium text-[11px]">Ghế Đôi (130k)</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-t-sm rounded-b-[2px] bg-gradient-to-r from-[#A855F7] to-[#EC4899]" />
            <span className="text-white font-semibold text-[11px]">Đang chọn</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-t-sm rounded-b-[2px] bg-[#0F111A] border border-[#1C2033] opacity-40" />
            <span className="text-zinc-500 text-[11px]">Đã bán</span>
          </div>
        </div>
      </div>

      {/* Starlight Special Ticket Type Selector (U22 / HSSV) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#131520] border border-[#222538] shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-300 flex-shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-white">
                  Vé U22 / Học Sinh Sinh Viên
                </h4>
                <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  45.000đ/vé
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Áp dụng cho thành viên dưới 22 tuổi (Tiết kiệm từ 15k đến 25k/vé).
              </p>
            </div>
          </div>

          {/* U22 Ticket Counter */}
          <div className="flex items-center gap-2 bg-[#181B2A] p-1 rounded-xl border border-[#2A2E45] self-end sm:self-center">
            <button
              type="button"
              disabled={u22TicketCount <= 0}
              onClick={() => onU22CountChange(Math.max(0, u22TicketCount - 1))}
              className="w-7 h-7 rounded-lg bg-[#222538] hover:bg-[#2b3047] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-6 text-center font-bold text-sm text-white">
              {u22TicketCount}
            </span>
            <button
              type="button"
              disabled={u22TicketCount >= maxU22Allowed}
              onClick={() => onU22CountChange(Math.min(maxU22Allowed, u22TicketCount + 1))}
              className="w-7 h-7 rounded-lg bg-gradient-to-r from-[#A855F7] to-[#EC4899] hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Warning Banner for U22 */}
        <div className="mt-3 p-2.5 rounded-xl bg-purple-950/20 border border-purple-500/20 text-[11px] text-purple-300 flex items-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span>
            Vui lòng xuất trình <strong>CCCD hoặc Thẻ HSSV</strong> dưới 22 tuổi tại quầy/cổng soát vé khi Check-in.
          </span>
        </div>
      </div>
    </div>
  );
}
