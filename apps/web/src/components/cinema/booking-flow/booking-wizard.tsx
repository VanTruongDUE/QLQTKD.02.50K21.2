"use client";

import React, { useState, useEffect } from "react";
import {
  Film,
  Armchair,
  Popcorn,
  CreditCard,
  Check,
  ChevronLeft,
  Timer,
  CheckCircle2,
  QrCode,
} from "lucide-react";
import { Movie, Showtime, CinemaLocation, Seat, Ticket } from "../types";
import { MOVIES, SHOWTIMES, generateInitialSeats, FNB_ITEMS } from "../mock-data";
import { Step1Showtimes } from "./step1-showtimes";
import { Step2SeatMap } from "./step2-seatmap";
import { Step3FnB } from "./step3-fnb";
import { Step4Checkout } from "./step4-checkout";

interface BookingWizardProps {
  cinema: CinemaLocation;
  onNavigateToCheckin: (ticketCode: string) => void;
  onTicketCreated: (newTicket: Ticket) => void;
  forceSingleSeatWarning?: { seatId: string; row: string; number: number } | null;
}

// Smooth Animated Price Counter
function AnimatedPrice({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = displayValue;
    const change = value - startValue;

    if (change === 0) return;

    let frameId: number;
    const duration = 250;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startValue + change * ease));

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [value]);

  return <span>{displayValue.toLocaleString("vi-VN")}đ</span>;
}

export function BookingWizard({
  cinema,
  onNavigateToCheckin,
  onTicketCreated,
  forceSingleSeatWarning,
}: BookingWizardProps) {
  // Wizard steps: 1 = Showtime, 2 = Seats, 3 = F&B, 4 = Checkout, 5 = Confirmed
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Selections - Restored Full Starlight Neon Demo State
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(MOVIES[0]);
  const [selectedShowtime, setSelectedShowtime] = useState<Showtime | null>(SHOWTIMES[2]); // 19:45
  const [seats] = useState<Seat[]>(() => generateInitialSeats());
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>(["G07", "G08"]);
  const [u22TicketCount, setU22TicketCount] = useState<number>(1);
  const [fnbQuantities, setFnbQuantities] = useState<Record<string, number>>({
    "fnb-combo2": 1, // 1x Combo Đôi Starlight (Best Seller) - 135.000đ
  });
  const [promoCode, setPromoCode] = useState<string>("STARLIGHTVIP");
  const [promoDiscount, setPromoDiscount] = useState<number>(20000);
  const [usePoints, setUsePoints] = useState<boolean>(false);
  const [createdTicketCode, setCreatedTicketCode] = useState<string>("STL-894210");

  // Countdown Timer: initialized at 09:35 (575s) as requested
  const [secondsRemaining, setSecondsRemaining] = useState<number>(575);

  // Auto switch to step 2 if demo simulation for single seat error is activated
  useEffect(() => {
    if (forceSingleSeatWarning) {
      setCurrentStep(2);
      setSelectedSeatIds(["E04", "E06"]);
    }
  }, [forceSingleSeatWarning]);

  useEffect(() => {
    if (selectedSeatIds.length === 0 || currentStep < 2 || currentStep === 5) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [selectedSeatIds.length, currentStep]);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Seat toggle handler (including couple seat pairing logic)
  const handleToggleSeat = (seatId: string) => {
    const seatObj = seats.find((s) => s.id === seatId);
    if (!seatObj || seatObj.status === "booked") return;

    if (seatObj.type === "couple" && seatObj.pairId) {
      const pairId = seatObj.pairId;
      const isAlready = selectedSeatIds.includes(seatId);

      if (isAlready) {
        setSelectedSeatIds((prev) =>
          prev.filter((id) => id !== seatId && id !== pairId)
        );
      } else {
        if (selectedSeatIds.length + 2 > 8) return;
        setSelectedSeatIds((prev) => [...prev, seatId, pairId]);
      }
    } else {
      if (selectedSeatIds.includes(seatId)) {
        setSelectedSeatIds((prev) => prev.filter((id) => id !== seatId));
      } else {
        if (selectedSeatIds.length >= 8) return;
        setSelectedSeatIds((prev) => [...prev, seatId]);
      }
    }
  };

  const handleSelectShowtime = (movie: Movie, showtime: Showtime) => {
    setSelectedMovie(movie);
    setSelectedShowtime(showtime);
    setCurrentStep(2);
  };

  const handleQuantityChange = (itemId: string, delta: number) => {
    setFnbQuantities((prev) => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [itemId]: next };
    });
  };

  const handleApplyPromo = (code: string) => {
    setPromoCode(code);
    if (code === "STARLIGHTVIP") {
      setPromoDiscount(20000);
    } else if (code === "CHAOBANMOI") {
      setPromoDiscount(30000);
    } else {
      setPromoDiscount(0);
    }
  };

  // Price calculations based on real progressive selections
  const rawSeatTotal = selectedSeatIds.reduce((sum, id) => {
    const seat = seats.find((s) => s.id === id);
    return sum + (seat?.price || 60000);
  }, 0);

  const u22DiscountTotal = u22TicketCount * 25000;
  const seatSubtotal = Math.max(0, rawSeatTotal - u22DiscountTotal);

  const fnbSubtotal = FNB_ITEMS.reduce((sum, item) => {
    return sum + (fnbQuantities[item.id] || 0) * item.price;
  }, 0);

  const pointsDiscount = usePoints ? 25000 : 0;
  const finalTotal = Math.max(
    0,
    seatSubtotal + fnbSubtotal - promoDiscount - pointsDiscount
  );

  // Payment success
  const handlePaymentSuccess = () => {
    const newCode = `STL-${Math.floor(100000 + Math.random() * 900000)}`;
    setCreatedTicketCode(newCode);

    if (selectedMovie && selectedShowtime) {
      const seatTypeMap: Record<string, any> = {};
      selectedSeatIds.forEach((id) => {
        const s = seats.find((x) => x.id === id);
        seatTypeMap[id] = s?.type || "regular";
      });

      const fnbList = FNB_ITEMS.filter((f) => (fnbQuantities[f.id] || 0) > 0).map(
        (item) => ({ item, quantity: fnbQuantities[item.id] })
      );

      const newTicket: Ticket = {
        id: `t-${Date.now()}`,
        bookingCode: newCode,
        phone: "0905123456",
        customerName: "Nguyễn Văn Hùng",
        movie: selectedMovie,
        showtime: selectedShowtime,
        cinema,
        seats: selectedSeatIds,
        seatTypes: seatTypeMap,
        u22Count: u22TicketCount,
        fnbItems: fnbList,
        totalPrice: finalTotal,
        status: "ELIGIBLE_REFUND",
        createdAt: new Date().toISOString(),
        popcornStatus: fnbList.length > 0 ? "NOT_PICKED" : "PICKED_UP",
        qrToken: `STL-SECURE-${newCode}-${Date.now()}`,
      };

      onTicketCreated(newTicket);
    }

    setCurrentStep(5);
  };

  const stepsMeta = [
    { num: 1, label: "Suất Chiếu", icon: Film },
    { num: 2, label: "Chọn Ghế", icon: Armchair },
    { num: 3, label: "Bắp Nước", icon: Popcorn },
    { num: 4, label: "Thanh Toán", icon: CreditCard },
  ];

  return (
    <div className="space-y-5">
      {/* Stepper Bar (4 Large Circular Icons Above Step Labels with Glowing Gradient) */}
      {currentStep !== 5 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#131520]/80 backdrop-blur-md border border-[#222538] shadow-xl cinema-glass-shimmer">
          <div className="flex items-center justify-between max-w-2xl mx-auto relative">
            {/* Connecting line behind circles */}
            <div className="absolute top-5 left-6 right-6 h-[2px] bg-[#222538] -z-0" />

            {stepsMeta.map((s) => {
              const isPast = currentStep > s.num;
              const isCurrent = currentStep === s.num;
              const Icon = s.icon;

              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => setCurrentStep(s.num as any)}
                  className="flex flex-col items-center gap-2 relative z-10 group cursor-pointer"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      isCurrent
                        ? "bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white shadow-[0_0_20px_rgba(168,85,247,0.55)] ring-4 ring-purple-500/20 scale-110"
                        : isPast
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : "bg-[#181B2A] text-zinc-500 border border-[#2A2E45] group-hover:text-zinc-300"
                    }`}
                  >
                    {isPast ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      isCurrent
                        ? "text-white"
                        : isPast
                        ? "text-emerald-400"
                        : "text-zinc-400 group-hover:text-zinc-200"
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Desktop Layout: 8:4 Asymmetric Split View */}
      {currentStep !== 5 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Stage Workspace (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {currentStep === 1 && (
              <Step1Showtimes
                cinema={cinema}
                selectedMovie={selectedMovie}
                selectedShowtime={selectedShowtime}
                onSelectShowtime={handleSelectShowtime}
              />
            )}

            {currentStep === 2 && selectedMovie && selectedShowtime && (
              <Step2SeatMap
                movie={selectedMovie}
                showtime={selectedShowtime}
                seats={seats}
                selectedSeatIds={selectedSeatIds}
                onToggleSeat={handleToggleSeat}
                u22TicketCount={u22TicketCount}
                onU22CountChange={setU22TicketCount}
                forceSingleSeatWarning={forceSingleSeatWarning}
              />
            )}

            {currentStep === 3 && (
              <Step3FnB
                quantities={fnbQuantities}
                onQuantityChange={handleQuantityChange}
              />
            )}

            {currentStep === 4 && selectedMovie && selectedShowtime && (
              <Step4Checkout
                movie={selectedMovie}
                showtime={selectedShowtime}
                cinema={cinema}
                selectedSeatIds={selectedSeatIds}
                seats={seats}
                u22TicketCount={u22TicketCount}
                fnbQuantities={fnbQuantities}
                promoCode={promoCode}
                promoDiscount={promoDiscount}
                onApplyPromo={handleApplyPromo}
                usePoints={usePoints}
                onTogglePoints={() => setUsePoints(!usePoints)}
                onPaymentSuccess={handlePaymentSuccess}
              />
            )}

            {/* Back button on steps 2, 3, 4 */}
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#131520] border border-[#222538] hover:bg-[#1a1d2e] text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Quay lại bước trước</span>
              </button>
            )}
          </div>

          {/* Right Sticky Sidebar: Full Starlight Neon Ticket Summary (4 cols) */}
          <div className="lg:col-span-4 lg:sticky lg:top-20 z-20 space-y-4">
            <div className="rounded-2xl bg-[#131520]/85 backdrop-blur-md border border-[#222538] overflow-hidden shadow-2xl relative cinema-glass-shimmer">
              {/* Ticket Top Half */}
              <div className="p-4 sm:p-5 space-y-4">
                {/* Header title */}
                <div className="flex items-center justify-between pb-3 border-b border-[#222538]">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-white text-xs tracking-wider uppercase">
                      Tóm Tắt Đơn Vé
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-950/60 text-purple-300 border border-purple-500/30">
                    Bước {currentStep}/4
                  </span>
                </div>

                {/* 10:00 Countdown Timer Alert Box */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs flex items-center justify-between text-amber-300 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="font-bold text-amber-300">🟡 Giữ ghế trong:</span>
                  </div>
                  <div className="font-mono font-bold text-sm text-amber-400 flex items-center gap-1">
                    <Timer className="w-3.5 h-3.5" />
                    <span>{formatCountdown(secondsRemaining)}</span>
                  </div>
                </div>

                {/* Movie & Showtime Info */}
                {selectedMovie && (
                  <div className="flex gap-3.5 items-start">
                    <img
                      src={selectedMovie.poster}
                      alt={selectedMovie.title}
                      className="w-16 h-22 rounded-lg object-cover flex-shrink-0 bg-[#0B0C14] border border-[#222538]"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-white truncate">
                        {selectedMovie.title}
                      </h4>
                      <p className="text-[11px] font-semibold mt-1">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-pink-500/20 text-pink-300 border border-pink-500/30">
                          {selectedMovie.ageRating} • {selectedMovie.durationMinutes} phút
                        </span>
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-2 truncate">
                        📍 {cinema.name}
                      </p>
                      {selectedShowtime && (
                        <p className="text-[11px] text-zinc-300 font-semibold mt-0.5">
                          📅 {selectedShowtime.dateStr} • 🎬 {selectedShowtime.room} • <span className="text-[#EC4899] font-bold">{selectedShowtime.startsAt}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Full Ticket Detailed Breakdown */}
                <div className="pt-3 border-t border-[#222538] text-xs space-y-2">
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Ghế đã chọn:</span>
                    <span className="font-bold text-white font-mono">
                      {selectedSeatIds.length > 0 ? selectedSeatIds.join(", ") : "Chưa chọn ghế"}
                    </span>
                  </div>

                  <div className="flex justify-between text-zinc-400">
                    <span>Giá vé gốc ({selectedSeatIds.length} ghế):</span>
                    <span className="font-semibold text-zinc-200">
                      {rawSeatTotal.toLocaleString("vi-VN")}đ
                    </span>
                  </div>

                  {u22DiscountTotal > 0 && (
                    <div className="flex justify-between text-[#EC4899] font-semibold">
                      <span>Ưu đãi U22 ({u22TicketCount} vé):</span>
                      <span>-{u22DiscountTotal.toLocaleString("vi-VN")}đ</span>
                    </div>
                  )}

                  {fnbSubtotal > 0 && (
                    <>
                      <div className="flex justify-between text-zinc-400">
                        <span className="truncate max-w-[210px]">
                          Bắp nước & Dịch vụ:
                        </span>
                        <span className="font-medium text-zinc-300 text-right">
                          {fnbSubtotal.toLocaleString("vi-VN")}đ
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 pl-2 space-y-0.5">
                        {FNB_ITEMS.filter((f) => (fnbQuantities[f.id] || 0) > 0).map(
                          (item) => (
                            <div key={item.id} className="truncate">
                              • {fnbQuantities[item.id]}x {item.name}
                            </div>
                          )
                        )}
                      </div>
                    </>
                  )}

                  {promoDiscount > 0 && (
                    <div className="flex justify-between text-emerald-400 font-semibold">
                      <span>Mã giảm giá ({promoCode}):</span>
                      <span>-{promoDiscount.toLocaleString("vi-VN")}đ</span>
                    </div>
                  )}

                  {pointsDiscount > 0 && (
                    <div className="flex justify-between text-amber-400 font-semibold">
                      <span>Đổi điểm Starlight Rewards:</span>
                      <span>-{pointsDiscount.toLocaleString("vi-VN")}đ</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Perforated Dashed Line with 2 Semicircular Cutouts */}
              <div className="relative my-0.5">
                <div className="ticket-perforation-left" />
                <div className="border-b border-dashed border-[#222538] w-full" />
                <div className="ticket-perforation-right" />
              </div>

              {/* Bottom Ticket Stub */}
              <div className="p-4 sm:p-5 bg-[#0e1019] space-y-3.5">
                {/* Total Payment Amount */}
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-zinc-400 block font-medium">
                      Tổng thanh toán
                    </span>
                    <span className="text-[10px] text-zinc-500">Đã gồm VAT & Khuyến mãi</span>
                  </div>
                  <div className="text-2xl font-extrabold text-[#F59E0B] tracking-tight">
                    <AnimatedPrice value={finalTotal} />
                  </div>
                </div>

                {/* Primary Next Action CTA Button with Gradient */}
                {currentStep < 4 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((prev) => (prev + 1) as any)}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] hover:opacity-95 active:scale-[0.99] text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-pink-900/40 cursor-pointer"
                  >
                    <span>
                      {currentStep === 1
                        ? "Tiếp tục: Chọn Ghế >"
                        : currentStep === 2
                        ? "Tiếp tục: Bắp Nước >"
                        : "Tiếp tục: Thanh Toán >"}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Step 5: Booking Confirmed Screen */
        <div className="max-w-xl mx-auto p-6 sm:p-8 rounded-xl bg-[#121215] border border-zinc-800 text-center space-y-5 animate-subtle-step">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/20">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Giao Dịch Thành Công
            </span>
            <h2 className="text-xl font-bold text-white mt-2">
              Đặt vé xem phim thành công
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Mã vé đã được kích hoạt trên hệ thống Starlight Cinema.
            </p>
          </div>

          {/* Ticket Key Card */}
          <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 text-left text-xs space-y-2">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
              <span className="text-zinc-400">Mã đặt vé:</span>
              <span className="font-mono text-base font-bold text-rose-400">
                {createdTicketCode}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Phim:</span>
              <span className="font-semibold text-white">{selectedMovie?.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Suất chiếu:</span>
              <span className="font-semibold text-zinc-200">
                {selectedShowtime?.startsAt} • {selectedShowtime?.room}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Ghế ngồi:</span>
              <span className="font-semibold text-rose-400">
                {selectedSeatIds.join(", ")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Tổng thanh toán:</span>
              <span className="font-bold text-white">
                {finalTotal.toLocaleString("vi-VN")}đ
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onNavigateToCheckin(createdTicketCode)}
              className="flex-1 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Mở Thẻ Vé Điện Tử (Check-in)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentStep(1);
                setSelectedSeatIds([]);
                setFnbQuantities({});
              }}
              className="py-2.5 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition-colors cursor-pointer"
            >
              Đặt thêm vé khác
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
