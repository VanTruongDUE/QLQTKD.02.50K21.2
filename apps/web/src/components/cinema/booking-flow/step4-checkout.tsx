"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  QrCode,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  Tag,
  Award,
  Wallet,
  Loader2,
  Mail,
} from "lucide-react";
import { Movie, Showtime, CinemaLocation, Seat } from "../types";
import { FNB_ITEMS } from "../mock-data";
import { useAuth } from "@/components/auth/auth-provider";

interface Step4CheckoutProps {
  movie: Movie;
  showtime: Showtime;
  cinema: CinemaLocation;
  selectedSeatIds: string[];
  seats: Seat[];
  u22TicketCount: number;
  fnbQuantities: Record<string, number>;
  promoCode: string;
  promoDiscount: number;
  onApplyPromo: (code: string) => void;
  usePoints: boolean;
  onTogglePoints: (use: boolean) => void;
  onPaymentSuccess: (bookingCode?: string) => void;
}

export function Step4Checkout({
  movie,
  showtime,
  cinema,
  selectedSeatIds,
  seats,
  u22TicketCount,
  fnbQuantities,
  promoDiscount,
  promoCode,
  onApplyPromo,
  usePoints,
  onTogglePoints,
  onPaymentSuccess,
}: Step4CheckoutProps) {
  const { profile } = useAuth();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    if (profile?.email && !email) {
      setEmail(profile.email);
    }
  }, [profile?.email]);

  const [selectedMethod, setSelectedMethod] = useState<
    "vnpay" | "momo" | "wallet" | "card"
  >("vnpay");
  const [inputCode, setInputCode] = useState(promoCode);
  const [isAgreedPolicy, setIsAgreedPolicy] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate real total
  const rawSeatTotal = selectedSeatIds.reduce((sum, id) => {
    const s = seats.find((x) => x.id === id);
    return sum + (s?.price || 60000);
  }, 0);
  const u22DiscountTotal = u22TicketCount * 25000;
  const fnbTotal = FNB_ITEMS.reduce((sum, item) => {
    return sum + (fnbQuantities[item.id] || 0) * item.price;
  }, 0);
  const pointsDiscount = usePoints ? 25000 : 0;
  const computedTotal = Math.max(
    0,
    rawSeatTotal - u22DiscountTotal + fnbTotal - promoDiscount - pointsDiscount
  );

  const handlePay = async () => {
    if (!isAgreedPolicy) return;
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setEmailError("Vui lòng nhập địa chỉ email hợp lệ để nhận vé điện tử!");
      return;
    }
    setEmailError("");
    setIsProcessing(true);
    let confirmedCode: string | undefined;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
      const combos = Object.entries(fnbQuantities)
        .filter((entry) => entry[1] > 0)
        .map(([id, quantity]) => {
          const item = FNB_ITEMS.find((f) => f.id === id);
          return {
            name: item?.name || id,
            quantity,
            unitPrice: item?.price || 0,
          };
        });

      const res = await fetch(`${apiUrl}/checkout/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipientEmail: trimmedEmail,
          customerName: profile?.display_name || "Khách hàng",
          movieTitle: movie.title,
          cinemaName: cinema?.name || "Starlight Cinema",
          roomName: showtime?.room || "Phòng Chiếu",
          startsAt: showtime?.startsAt || new Date().toISOString(),
          seats: selectedSeatIds,
          combos,
          total: computedTotal,
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.bookingId) {
          confirmedCode = data.bookingId;
        }
      }
    } catch (err) {
      console.error("Booking confirmation error:", err);
    } finally {
      setIsProcessing(false);
      onPaymentSuccess(confirmedCode);
    }
  };

  const paymentMethods = [
    {
      id: "vnpay",
      name: "VNPAY-QR",
      desc: "Quét mã QR qua ứng dụng của hơn 30 ngân hàng lớn",
      badge: "Phổ biến",
      icon: <QrCode className="w-4 h-4 text-sky-400" />,
    },
    {
      id: "momo",
      name: "Ví MoMo",
      desc: "Thanh toán một chạm liên kết bảo mật",
      badge: "Khuyên dùng",
      icon: <Smartphone className="w-4 h-4 text-rose-400" />,
    },
    {
      id: "wallet",
      name: "Ví Starlight Pay",
      desc: "Số dư: 350.000đ • Giảm thêm 5% giá vé",
      badge: "-5%",
      icon: <Wallet className="w-4 h-4 text-amber-400" />,
    },
    {
      id: "card",
      name: "Thẻ ATM / Visa / Mastercard",
      desc: "Cổng thanh toán bảo mật chuẩn PCI-DSS",
      badge: "",
      icon: <CreditCard className="w-4 h-4 text-zinc-300" />,
    },
  ];

  return (
    <div className="space-y-4 animate-subtle-step">
      {/* Promo Code & Member Points Box */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#131520] border border-[#222538] space-y-4 shadow-lg">
        <h3 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
          <Tag className="w-3.5 h-3.5 text-[#EC4899]" />
          Mã Giảm Giá & Điểm Thưởng
        </h3>

        {/* Promo Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.toUpperCase())}
            placeholder="Nhập mã ưu đãi (Ví dụ: STARLIGHTVIP)"
            className="flex-1 bg-[#181B2A] border border-[#2A2E45] rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 uppercase tracking-wider font-semibold focus:outline-none focus:border-purple-500"
          />
          <button
            type="button"
            onClick={() => onApplyPromo(inputCode)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white text-xs font-bold transition-all cursor-pointer shadow-md hover:opacity-95"
          >
            Áp Dụng
          </button>
        </div>

        {/* Quick Promo Chips */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-zinc-400 text-[11px]">Gợi ý:</span>
          <button
            type="button"
            onClick={() => {
              setInputCode("STARLIGHTVIP");
              onApplyPromo("STARLIGHTVIP");
            }}
            className="px-2.5 py-0.5 rounded-lg bg-[#181B2A] hover:bg-[#20253B] border border-[#2A2E45] text-purple-300 text-[11px] font-medium cursor-pointer"
          >
            STARLIGHTVIP (-20k)
          </button>
          <button
            type="button"
            onClick={() => {
              setInputCode("CHAOBANMOI");
              onApplyPromo("CHAOBANMOI");
            }}
            className="px-2.5 py-0.5 rounded-lg bg-[#181B2A] hover:bg-[#20253B] border border-[#2A2E45] text-purple-300 text-[11px] font-medium cursor-pointer"
          >
            CHAOBANMOI (-30k)
          </button>
        </div>

        {promoDiscount > 0 && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 font-medium flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              Đã áp dụng mã {promoCode}
            </span>
            <span className="font-bold text-sm">
              -{promoDiscount.toLocaleString("vi-VN")}đ
            </span>
          </div>
        )}

        {/* Member Points Toggle */}
        <div className="pt-3 border-t border-[#222538] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">
                Dùng 1.250 Điểm Starlight Rewards
              </div>
              <div className="text-[11px] text-zinc-400">
                Quy đổi giảm -25.000đ vào đơn vé
              </div>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={usePoints}
              onChange={(e) => onTogglePoints(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-[#181B2A] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-[#A855F7] peer-checked:to-[#EC4899]" />
          </label>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#131520] border border-[#222538] space-y-3.5 shadow-lg">
        <h3 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
          <CreditCard className="w-3.5 h-3.5 text-zinc-400" />
          Phương Thức Thanh Toán
        </h3>

        <div className="grid grid-cols-1 gap-2.5">
          {paymentMethods.map((method) => {
            const isSelected = selectedMethod === method.id;
            return (
              <button
                key={method.id}
                type="button"
                onClick={() => setSelectedMethod(method.id as any)}
                className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#181A28] border-purple-500/60 ring-1 ring-purple-500/40 shadow-md shadow-purple-950/30"
                    : "bg-[#181B2A]/60 hover:bg-[#1f2338] border-[#2A2E45]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#0B0C14] border border-[#222538] flex items-center justify-center flex-shrink-0">
                    {method.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        {method.name}
                      </span>
                      {method.badge && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          {method.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {method.desc}
                    </p>
                  </div>
                </div>

                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    isSelected
                      ? "border-purple-400 bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white"
                      : "border-zinc-700"
                  }`}
                >
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recipient Email for E-ticket */}
      <div className={`p-3.5 rounded-xl bg-[#131520] border ${emailError ? "border-rose-500/80 bg-rose-950/10" : "border-[#222538]"} text-xs transition-colors`}>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-purple-400" />
            <span>Email nhận vé điện tử (E-ticket):</span>
          </label>
          <span className="text-[10px] text-amber-400 font-medium">Bắt buộc</span>
        </div>
        <div className="relative">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError("");
            }}
            placeholder="ví dụ: vantruongdkrqt@gmail.com"
            className={`w-full px-3 py-2 rounded-lg bg-[#0e1017] border ${
              emailError ? "border-rose-500 text-rose-200" : "border-[#272b3f] text-white"
            } text-xs placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors`}
          />
        </div>
        {emailError ? (
          <p className="text-[11px] text-rose-400 font-medium mt-1.5 flex items-center gap-1">
            <span>⚠️</span> {emailError}
          </p>
        ) : (
          <p className="text-[10px] text-zinc-400 mt-1">
            Hệ thống n8n sẽ tự động gửi vé xem phim và mã QR về hòm thư này ngay sau khi bấm thanh toán.
          </p>
        )}
      </div>

      {/* Policy Agreement Checkbox */}
      <div className="p-3.5 rounded-xl bg-[#131520] border border-[#222538] text-xs text-zinc-400">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={isAgreedPolicy}
            onChange={(e) => setIsAgreedPolicy(e.target.checked)}
            className="w-3.5 h-3.5 rounded bg-[#181B2A] border-[#2A2E45] text-purple-600 focus:ring-purple-500 mt-0.5"
          />
          <span className="text-[11px] leading-relaxed">
            Tôi xác nhận đã đủ độ tuổi xem phim theo phân loại <strong>{movie.ageRating}</strong> và đồng ý với <strong>Chính sách đổi/hoàn vé tự động trước 45 phút</strong> của Starlight Cinema.
          </span>
        </label>
      </div>

      {/* Confirm Payment Action Button */}
      <div className="pt-1">
        <button
          type="button"
          disabled={!isAgreedPolicy || isProcessing}
          onClick={handlePay}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] hover:opacity-95 active:scale-[0.99] text-white font-bold text-sm shadow-xl shadow-pink-900/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang kết nối cổng thanh toán an toàn...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              <span>
                Thanh Toán Ngay • {computedTotal.toLocaleString("vi-VN")}đ
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
