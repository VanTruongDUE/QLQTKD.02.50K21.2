"use client";

import React, { useEffect, useState } from "react";
import { Navbar } from "@/components/cinema/navbar";
import { BookingWizard } from "@/components/cinema/booking-flow/booking-wizard";
import { ExchangeRefundDashboard } from "@/components/cinema/exchange-refund-flow/exchange-refund-dashboard";
import { CheckInModule } from "@/components/cinema/check-in-flow/check-in-module";
import { CinemaAuditoriumBackground } from "@/components/cinema/cinema-auditorium-background";
import { CinemaLocation, Ticket } from "@/components/cinema/types";
import { CINEMA_LOCATIONS, MOVIES, SAMPLE_TICKETS, SHOWTIMES } from "@/components/cinema/mock-data";
import { useAuth } from "@/components/auth/auth-provider";

export default function CinemaApp() {
  const { profile, request } = useAuth();
  const [activeTab, setActiveTab] = useState<
    "booking" | "exchange_refund" | "checkin"
  >("booking");
  const [selectedCinema, setSelectedCinema] = useState<CinemaLocation>(
    CINEMA_LOCATIONS[0] // Starlight Đà Nẵng
  );

  const [tickets, setTickets] = useState<Ticket[]>(SAMPLE_TICKETS);
  const [activeTicketCode, setActiveTicketCode] = useState<string>("STL-894210");
  const [bookingKey, setBookingKey] = useState(0);

  // Sync cinemas with backend PostgreSQL
  useEffect(() => {
    fetch("/api/v1/cinemas")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const match = data.find((c: any) =>
            c.name.toLowerCase().includes("đà nẵng") || c.name.toLowerCase().includes("da nang")
          ) || data[0];
          if (match) {
            setSelectedCinema((prev) => ({
              ...prev,
              id: match.id,
              name: match.name,
            }));
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (profile?.role !== "CUSTOMER") return;
    request<Array<Record<string, any>>>("/me/tickets")
      .then((rows) => setTickets(rows.map((row) => {
        const movie = MOVIES.find((item) => item.title === row.movie_title) || {
          id: row.movie_id,
          title: row.movie_title,
          director: "Starlight Cinema",
          cast: "",
          durationMinutes: row.duration_minutes,
          releaseDate: "",
          genres: [],
          ageRating: row.rating,
          ageWarning: "",
          poster: row.poster || "",
          synopsis: row.description || "",
          formats: ["2D Phụ đề"],
          ratingScore: 0,
          voteCount: 0,
        } as Ticket["movie"];
        const showtime = SHOWTIMES.find((item) => item.id === row.showtime_id) || {
          id: row.showtime_id,
          movieId: movie.id,
          cinemaId: row.cinema_id,
          room: row.room,
          format: "2D Phụ đề",
          startsAt: row.starts_at,
          dateStr: row.starts_at.slice(0, 10),
          priceRegular: row.price,
          priceVip: row.price,
          priceCouple: row.price * 2,
          totalSeats: 0,
          availableSeats: 0,
        } as Ticket["showtime"];
        return {
          id: row.id,
          bookingCode: row.id,
          phone: profile.phone,
          customerName: profile.display_name,
          movie,
          showtime,
          cinema: { id: row.cinema_id, name: row.cinema, address: "", city: "", hotline: "1900 1722" },
          seats: [row.seat_label],
          seatTypes: { [row.seat_label]: "regular" },
          u22Count: 0,
          fnbItems: [],
          totalPrice: row.value_vnd,
          status: row.status === "CHECKED_IN" ? "CHECKED_IN" : row.status === "REFUNDED" ? "REFUNDED" : "ELIGIBLE_REFUND",
          createdAt: row.created_at,
          popcornStatus: "PICKED_UP",
          qrToken: row.qrToken,
          qrImage: row.qrImage,
          checkedInAt: row.checked_in_at,
        } as Ticket;
      })))
      .catch(() => setTickets([]));
  }, [profile, request]);

  useEffect(() => {
    if (profile?.role === "STAFF") window.location.replace("/staff/check-in");
    if (profile?.role === "MANAGER") window.location.replace("/manager/accounts");
  }, [profile]);

  // Reset to Home / Step 1 on logo click
  const handleGoHome = () => {
    setActiveTab("booking");
    setBookingKey((prev) => prev + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Add newly created ticket from booking flow
  const handleTicketCreated = (newTicket: Ticket) => {
    setTickets((prev) => [newTicket, ...prev]);
    setActiveTicketCode(newTicket.bookingCode);
  };

  // Update existing ticket (exchange or refund)
  const handleUpdateTicket = (updatedTicket: Ticket) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === updatedTicket.id ? updatedTicket : t))
    );
  };

  // Jump to checkin view
  const handleNavigateToCheckin = (ticketCode: string) => {
    setActiveTicketCode(ticketCode);
    setActiveTab("checkin");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#0B0C14] text-[#FAFAFA] flex flex-col selection:bg-purple-600 selection:text-white">
      {/* 3D Cinematic Scroll Background (fixed, behind everything) */}
      <CinemaAuditoriumBackground />

      {/* Top Sticky Navigation */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedCinema={selectedCinema}
        onCinemaChange={setSelectedCinema}
        onLogoClick={handleGoHome}
      />

      {/* Main Interactive Workflows Area */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Hero Banner Section (Restored Starlight Cinema Ecosystem) */}
        {activeTab === "booking" && (
          <div className="mb-6 p-5 sm:p-6 rounded-2xl bg-[#131520]/80 backdrop-blur-md border border-[#222538] relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-2xl">
            {/* Subtle glow background */}
            <div className="absolute -top-12 -right-12 w-80 h-80 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-full blur-3xl pointer-events-none" />

            {/* Left Column */}
            <div className="space-y-2.5 max-w-2xl relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-purple-950/60 text-purple-300 border border-purple-500/40">
                <span>✨ STARLIGHT CINEMA ECOSYSTEM</span>
                <span className="text-purple-400/60">•</span>
                <span className="text-zinc-300 font-normal">Cụm rạp tiêu chuẩn quốc tế Dolby 7.1</span>
              </div>

              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Hôm nay, xem gì?{" "}
                <span className="bg-gradient-to-r from-[#A855F7] to-[#EC4899] bg-clip-text text-transparent">
                  — Trải nghiệm Điện ảnh & Giải trí Đỉnh cao
                </span>
              </h1>

              <p className="text-xs sm:text-sm text-zinc-400 flex items-center gap-1.5">
                <span className="text-amber-400">📍</span>
                <span>
                  Đang xem tại: <strong className="text-white">{selectedCinema.name}</strong> ({selectedCinema.address})
                </span>
              </p>
            </div>

            {/* Right Column: 2 badges stacked vertically */}
            <div className="flex flex-row lg:flex-col items-center sm:items-end gap-2.5 relative z-10">
              <div className="px-3.5 py-2 rounded-xl bg-purple-950/50 border border-purple-500/50 text-purple-300 text-xs font-semibold flex items-center gap-2 shadow-sm whitespace-nowrap">
                <span className="text-base">🛡️</span>
                <span>Vé U22 chỉ 45.000đ</span>
              </div>
              <div className="px-3.5 py-2 rounded-xl bg-emerald-950/50 border border-emerald-500/50 text-emerald-300 text-xs font-semibold flex items-center gap-2 shadow-sm whitespace-nowrap">
                <span className="text-base">🕒</span>
                <span>Đổi/Hoàn vé trước 45p</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "booking" && (
          <BookingWizard
            key={bookingKey}
            cinema={selectedCinema}
            onNavigateToCheckin={handleNavigateToCheckin}
            onTicketCreated={handleTicketCreated}
          />
        )}

        {activeTab === "exchange_refund" && (
          <ExchangeRefundDashboard
            tickets={tickets}
            onUpdateTicket={handleUpdateTicket}
            onNavigateToCheckin={handleNavigateToCheckin}
          />
        )}

        {activeTab === "checkin" && (
          <CheckInModule
            tickets={tickets}
            activeTicketCode={activeTicketCode}
            onUpdateTicket={handleUpdateTicket}
          />
        )}
      </main>

      {/* Starlight Dark Obsidian Footer */}
      <footer className="relative z-10 border-t border-[#222538] bg-[#0B0C14]/90 backdrop-blur-md text-zinc-400 text-xs py-8 pb-24 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-gradient-to-tr from-[#8B5CF6] to-[#EC4899] flex items-center justify-center text-white font-bold text-xs">
                  S
                </div>
                <span className="font-bold text-white text-sm">
                  STARLIGHT CINEMA
                </span>
              </div>
              <p className="text-zinc-500 text-xs leading-relaxed">
                Hệ thống rạp chiếu phim & khu vui chơi giải trí tiêu chuẩn quốc tế. Âm thanh Dolby 7.1, máy chiếu sắc nét.
              </p>
              <div className="text-zinc-300 font-semibold text-xs">
                Hotline: 1900 1722
              </div>
            </div>

            <div className="space-y-1.5">
              <h4 className="font-semibold text-zinc-300 uppercase text-[11px] tracking-wider">
                Cụm Rạp
              </h4>
              <ul className="space-y-1 text-zinc-400 text-xs">
                {CINEMA_LOCATIONS.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelectedCinema(c)}
                      className={`hover:text-white transition-colors text-left ${
                        selectedCinema.id === c.id ? "text-purple-400 font-medium" : ""
                      }`}
                    >
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-1.5">
              <h4 className="font-semibold text-zinc-300 uppercase text-[11px] tracking-wider">
                Quy Định & Chính Sách
              </h4>
              <ul className="space-y-1 text-zinc-400 text-xs">
                <li>• Phân loại độ tuổi (P, K, T13, T16, T18)</li>
                <li>• Đổi/Hoàn vé trực tuyến trước 45 phút</li>
                <li>• Vé U22 & Học sinh Sinh viên (45.000đ)</li>
                <li>• Điều khoản tích lũy Starlight Rewards</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <h4 className="font-semibold text-zinc-300 uppercase text-[11px] tracking-wider">
                Tiện Ích Giải Trí
              </h4>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Giảm 20% các dịch vụ Bowling, Khu game xèng và Khu ẩm thực cà phê khi có vé xem phim trong ngày.
              </p>
              <div className="text-[11px] text-zinc-400">
                Mở cửa: 08:00 - 24:00 hàng ngày
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#222538] flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-zinc-500">
            <div>© 2026 Starlight Cinema. Bản quyền thuộc về Starlight Corporation.</div>
            <div className="text-zinc-400">Thiết kế Starlight Cinematic Neon Experience</div>
          </div>
        </div>
      </footer>

    </div>
  );
}
