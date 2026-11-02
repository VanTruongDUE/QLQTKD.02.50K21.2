"use client";

import React, { useState } from "react";
import {
  Calendar,
  Clock,
  Info,
  SlidersHorizontal,
  Star,
  Film,
  Sparkles,
} from "lucide-react";
import { Movie, Showtime, CinemaLocation, AgeRating } from "../types";
import { MOVIES, SHOWTIMES } from "../mock-data";

interface Step1ShowtimesProps {
  cinema: CinemaLocation;
  selectedMovie: Movie | null;
  selectedShowtime: Showtime | null;
  onSelectShowtime: (movie: Movie, showtime: Showtime) => void;
}

const DATES = [
  { dayName: "Hôm nay", dateStr: "02/11", fullDate: "2026-11-02" },
  { dayName: "Thứ 3", dateStr: "03/11", fullDate: "2026-11-03" },
  { dayName: "Thứ 4", dateStr: "04/11", fullDate: "2026-11-04" },
  { dayName: "Thứ 5", dateStr: "05/11", fullDate: "2026-11-05" },
  { dayName: "Thứ 6", dateStr: "06/11", fullDate: "2026-11-06" },
  { dayName: "Thứ 7", dateStr: "07/11", fullDate: "2026-11-07" },
  { dayName: "Chủ nhật", dateStr: "08/11", fullDate: "2026-11-08" },
];

const GENRES = [
  "Tất cả",
  "Hành động",
  "Hoạt hình",
  "Gia đình",
  "Kinh dị",
  "Trinh thám",
  "Lịch sử",
  "Hài",
];

const FORMAT_FILTERS = ["Tất cả", "2D Phụ đề", "2D Lồng tiếng", "3D Dolby 7.1"];

const DAY_PROMOS: Record<
  string,
  { tag: string; title: string; desc: string; icon: string; borderGrad: string }
> = {
  "2026-11-02": {
    tag: "ĐẦU TUẦN XEM PHIM",
    title: "Thảnh Thơi Rạp Vắng — Thoải Mái Chọn Ghế VIP Trung Tâm",
    desc: "Suất chiếu rạp tiêu chuẩn Dolby 7.1 và Laser vắng khách, trọn vẹn không gian điện ảnh đỉnh cao.",
    icon: "🎬",
    borderGrad: "from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-300",
  },
  "2026-11-03": {
    tag: "STARLIGHT MEMBER DAY",
    title: "Ngày Hội Thành Viên — Giá Vé Đồng Giá 55.000đ",
    desc: "Nhân đôi (x2) điểm tích lũy Starlight Rewards & Giảm 20% khi mua kèm bắp nước.",
    icon: "⭐",
    borderGrad: "from-amber-500/20 to-yellow-500/20 border-amber-500/30 text-amber-300",
  },
  "2026-11-04": {
    tag: "HAPPY WEDNESDAY",
    title: "Thứ Tư Vui Vẻ — Đồng Giá Vé 50.000đ & Tặng Bắp Ngọt",
    desc: "Áp dụng cho mọi suất chiếu 2D tiêu chuẩn trong ngày & Tặng 01 túi bắp ngọt cho thành viên Starlight.",
    icon: "🎉",
    borderGrad: "from-pink-500/20 to-rose-500/20 border-pink-500/40 text-pink-300",
  },
  "2026-11-05": {
    tag: "MIDWEEK CINEMA",
    title: "Giờ Chiếu Vàng Giữa Tuần — Trọn Bộ Suất Chiếu Tối",
    desc: "Tăng cường các suất chiếu sau 18:00 cho phim Việt và bom tấn Hollywood cùng ưu đãi Combo Đôi.",
    icon: "🍿",
    borderGrad: "from-blue-500/20 to-indigo-500/20 border-blue-500/30 text-blue-300",
  },
  "2026-11-06": {
    tag: "TGIF & MIDNIGHT SCREENINGS",
    title: "Khởi Động Cuối Tuần — Suất Chiếu Khuya Sau 23:00",
    desc: "Suất chiếu đêm cực đại cho tín đồ kinh dị và hành động, tận hưởng không gian rạp cuồng nhiệt.",
    icon: "🌙",
    borderGrad: "from-indigo-500/20 to-purple-500/20 border-indigo-500/30 text-indigo-300",
  },
  "2026-11-07": {
    tag: "WEEKEND SNEAK PREVIEWS",
    title: "Suất Chiếu Sớm Gladiator II & Suất Sáng Doraemon Cho Bé",
    desc: "Cháy vé giờ vàng! Suất chiếu sớm giới hạn Võ Sĩ Giác Đấu II & Hoạt hình gia đình buổi sáng.",
    icon: "🔥",
    borderGrad: "from-rose-500/20 to-orange-500/20 border-rose-500/40 text-rose-300",
  },
  "2026-11-08": {
    tag: "FAMILY CINEMA SUNDAY",
    title: "Chủ Nhật Gia Đình — Phim Hoạt Hình & Bom Tấn Việt",
    desc: "Ưu đãi tặng ly nước khi mua 2 vé hoạt hình (P/K) trước 17:00 & Check-in nhận sticker nhân vật.",
    icon: "👨‍👩‍👧‍👦",
    borderGrad: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-300",
  },
};

export function Step1Showtimes({
  cinema,
  selectedMovie,
  selectedShowtime,
  onSelectShowtime,
}: Step1ShowtimesProps) {
  const [selectedDate, setSelectedDate] = useState("2026-11-02");
  const [selectedGenre, setSelectedGenre] = useState("Tất cả");
  const [selectedFormat, setSelectedFormat] = useState("Tất cả");
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Group showtimes for the selected date & format
  const activePromo = DAY_PROMOS[selectedDate] || DAY_PROMOS["2026-11-02"];

  // Filter movies and showtimes strictly dynamically by selected date
  const moviesWithShowtimes = MOVIES.map((movie) => {
    const showtimesForDate = SHOWTIMES.filter(
      (s) =>
        s.movieId === movie.id &&
        s.dateStr === selectedDate &&
        (selectedFormat === "Tất cả" || s.format === selectedFormat)
    ).sort((a, b) => a.startsAt.localeCompare(b.startsAt));

    return {
      movie,
      showtimes: showtimesForDate,
    };
  }).filter(({ movie, showtimes }) => {
    const matchGenre =
      selectedGenre === "Tất cả" || movie.genres.includes(selectedGenre);
    return showtimes.length > 0 && matchGenre;
  });

  const totalShowtimesInDay = moviesWithShowtimes.reduce(
    (acc, m) => acc + m.showtimes.length,
    0
  );

  const getAgeRatingBadge = (rating: AgeRating) => {
    switch (rating) {
      case "P":
        return {
          label: "P",
          bg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
          text: "P - Phim dành cho mọi lứa tuổi",
        };
      case "K":
        return {
          label: "K",
          bg: "bg-sky-500/15 text-sky-400 border-sky-500/30",
          text: "K - Dưới 13 tuổi xem cùng phụ huynh",
        };
      case "T13":
        return {
          label: "T13",
          bg: "bg-amber-500/15 text-amber-400 border-amber-500/30",
          text: "T13 - Khán giả từ đủ 13 tuổi trở lên",
        };
      case "T16":
        return {
          label: "T16",
          bg: "bg-orange-500/15 text-orange-400 border-orange-500/30",
          text: "T16 - Khán giả từ đủ 16 tuổi trở lên",
        };
      case "T18":
        return {
          label: "T18",
          bg: "bg-rose-500/15 text-rose-400 border-rose-500/30 font-bold",
          text: "T18 - Cấm khán giả dưới 18 tuổi (Kiểm tra CCCD)",
        };
      default:
        return {
          label: "C",
          bg: "bg-zinc-800 text-zinc-300 border-zinc-700",
          text: "Chưa phân loại",
        };
    }
  };

  return (
    <div className="space-y-4 animate-subtle-step">
      {/* Date Strip - Starlight Neon Gradient */}
      <div className="p-4 rounded-2xl bg-[#131520]/80 backdrop-blur-md border border-[#222538] shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#EC4899]" />
            <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
              Lịch Chiếu Phim Theo Ngày
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-medium">
              {totalShowtimesInDay} suất chiếu hôm nay
            </span>
          </div>
          <span className="text-xs text-zinc-400">
            📍 {cinema.name}
          </span>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          {DATES.map((d) => {
            const isSelected = selectedDate === d.fullDate;
            return (
              <button
                key={d.fullDate}
                type="button"
                onClick={() => setSelectedDate(d.fullDate)}
                className={`flex-1 min-w-[85px] py-2 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? "bg-gradient-to-r from-[#A855F7] to-[#EC4899] border-transparent text-white font-bold shadow-md shadow-purple-900/40 scale-105"
                    : "bg-[#181B2A] hover:bg-[#1f2338] text-zinc-400 border-[#2A2E45]"
                }`}
              >
                <span
                  className={`text-[11px] block leading-tight font-medium ${
                    isSelected ? "text-purple-100" : "text-zinc-400"
                  }`}
                >
                  {d.dayName}
                </span>
                <span className="text-sm font-extrabold block mt-0.5 leading-tight">
                  {d.dateStr}
                </span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Day Promotion Ribbon */}
        {activePromo && (
          <div
            className={`mt-3 p-3 rounded-xl bg-gradient-to-r ${activePromo.borderGrad} border flex items-center justify-between gap-3 text-xs`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-lg flex-shrink-0">{activePromo.icon}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold tracking-wide uppercase text-[10px] px-1.5 py-0.5 rounded bg-black/30">
                    {activePromo.tag}
                  </span>
                  <span className="font-bold text-white truncate text-xs">
                    {activePromo.title}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-300/90 truncate mt-0.5">
                  {activePromo.desc}
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-1 flex-shrink-0 text-[11px] font-semibold text-purple-200">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              <span>Cập nhật theo rạp</span>
            </div>
          </div>
        )}
      </div>

      {/* Filter Chips Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-[#131520]/80 backdrop-blur-md border border-[#222538] text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400 ml-1 flex-shrink-0" />
          <span className="text-zinc-400 text-xs font-semibold mr-1 flex-shrink-0">
            Thể loại:
          </span>
          {GENRES.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => setSelectedGenre(genre)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                selectedGenre === genre
                  ? "bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white font-bold shadow-sm"
                  : "bg-[#181B2A] text-zinc-400 hover:text-white border border-[#2A2E45]"
              }`}
            >
              {genre}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-zinc-400 text-xs font-semibold">Định dạng:</span>
          <select
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value)}
            className="bg-[#181B2A] border border-[#2A2E45] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            {FORMAT_FILTERS.map((fmt) => (
              <option key={fmt} value={fmt}>
                {fmt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Movie Showtime Cards with 4-Column Rectangular Showtime Slots */}
      {moviesWithShowtimes.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#131520] border border-[#222538] text-center space-y-3">
          <Film className="w-10 h-10 text-purple-400/60 mx-auto" />
          <h4 className="text-base font-bold text-white">
            Không có suất chiếu phù hợp cho ngày này
          </h4>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Không tìm thấy phim thuộc thể loại hoặc định dạng đã chọn trong ngày{" "}
            {DATES.find((d) => d.fullDate === selectedDate)?.dateStr}. Bạn có thể
            chọn lại thể loại hoặc chọn ngày khác.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedGenre("Tất cả");
              setSelectedFormat("Tất cả");
            }}
            className="px-4 py-2 rounded-xl bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-semibold hover:bg-purple-600/50 transition-all cursor-pointer"
          >
            Xem tất cả suất chiếu
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {moviesWithShowtimes.map(({ movie, showtimes }) => {
            const ratingBadge = getAgeRatingBadge(movie.ageRating);
            const isCurrentSelectedMovie = selectedMovie?.id === movie.id;

            return (
              <div
                key={movie.id}
                className={`rounded-2xl p-5 border transition-all backdrop-blur-sm ${
                  isCurrentSelectedMovie
                    ? "bg-[#131520]/85 border-purple-500/50 shadow-xl shadow-purple-950/40"
                    : "bg-[#131520]/75 border-[#222538] hover:border-[#353a57]"
                }`}
              >
                <div className="flex flex-col sm:flex-row gap-5">
                  {/* Movie Poster */}
                  <div className="relative w-full sm:w-40 h-52 sm:h-56 rounded-xl overflow-hidden flex-shrink-0 bg-[#0B0C14] border border-[#222538]">
                    <img
                      src={movie.poster}
                      alt={movie.title}
                      className="w-full h-full object-cover"
                    />

                    {/* Age Rating Badge */}
                    <div className="absolute top-2.5 left-2.5">
                      <div
                        onMouseEnter={() => setActiveTooltip(movie.id)}
                        onMouseLeave={() => setActiveTooltip(null)}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold border backdrop-blur-md cursor-help flex items-center gap-1 shadow-md ${ratingBadge.bg}`}
                      >
                        <span>{ratingBadge.label}</span>
                        <Info className="w-2.5 h-2.5 opacity-80" />
                      </div>

                      {activeTooltip === movie.id && (
                        <div className="absolute left-0 mt-1 w-60 p-2.5 rounded-xl bg-[#131520] border border-purple-500/40 text-[11px] text-zinc-300 shadow-2xl z-20">
                          <div className="font-bold text-white mb-0.5">
                            {ratingBadge.text}
                          </div>
                          <p className="text-zinc-400 leading-relaxed">
                            {movie.ageWarning}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Rating Score */}
                    <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 bg-black/80 px-2 py-0.5 rounded text-[11px] font-bold text-amber-400">
                      <Star className="w-3 h-3 fill-amber-400" />
                      <span>{movie.ratingScore}</span>
                    </div>
                  </div>

                  {/* Movie Info & 4-Column Grid Showtimes */}
                  <div className="flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      {/* Title & Purple Format Tags */}
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <h4 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                          {movie.title}
                        </h4>
                        {movie.formats.map((fmt) => (
                          <span
                            key={fmt}
                            className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-900/40 text-purple-300 border border-purple-500/40"
                          >
                            {fmt}
                          </span>
                        ))}
                      </div>

                      <p className="text-xs text-zinc-400 mb-2">
                        <span className="text-purple-300 font-medium">
                          {movie.genres.join(", ")}
                        </span>{" "}
                        • <span>{movie.durationMinutes} phút</span> • Đạo diễn:{" "}
                        <span className="text-zinc-300">{movie.director}</span>
                      </p>

                      <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                        {movie.synopsis}
                      </p>
                    </div>

                    {/* 4 Slots Per Row Rectangular Showtime Cards */}
                    <div className="pt-3 border-t border-[#222538] space-y-2.5">
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span className="flex items-center gap-1.5 text-zinc-300 font-bold text-xs uppercase tracking-wide">
                          <Clock className="w-3.5 h-3.5 text-[#EC4899]" />
                          Suất chiếu ngày {DATES.find((d) => d.fullDate === selectedDate)?.dateStr}:
                        </span>
                        <span className="text-[11px] text-zinc-400 hidden sm:inline">
                          ({showtimes.length} suất • Bấm để chọn suất chiếu)
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {showtimes.map((st) => {
                          const isChosen =
                            selectedShowtime?.id === st.id &&
                            selectedMovie?.id === movie.id;

                          // Realistic seat threshold indicators
                          const isSoldOut = st.availableSeats <= 4;
                          const isAlmostFull =
                            st.availableSeats > 4 && st.availableSeats <= 15;

                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => onSelectShowtime(movie, st)}
                              className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer relative ${
                                isChosen
                                  ? "bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white border-transparent ring-2 ring-purple-300 shadow-lg shadow-purple-900/50 scale-[1.02]"
                                  : "bg-[#181B2A] border-[#2A2E45] hover:border-purple-500/50 hover:bg-[#1f2338] text-zinc-300"
                              }`}
                            >
                              {/* Top Row: Time Left, Format Tag Right */}
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-base font-extrabold tracking-tight">
                                  {st.startsAt}
                                </span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                    isChosen
                                      ? "bg-white/20 text-white"
                                      : "bg-purple-900/40 text-purple-300 border border-purple-500/30"
                                  }`}
                                >
                                  {st.format === "3D Dolby 7.1"
                                    ? "3D"
                                    : st.format.includes("Lồng tiếng")
                                    ? "Lồng tiếng"
                                    : "Phụ đề"}
                                </span>
                              </div>

                              {/* Bottom Row: Room Left, Seat Count Right */}
                              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-white/[0.08]">
                                <span
                                  className={`text-[11px] truncate max-w-[75px] ${
                                    isChosen ? "text-white/80" : "text-zinc-400"
                                  }`}
                                >
                                  {st.room.replace("Phòng ", "P.")}
                                </span>

                                {isSoldOut ? (
                                  <div className="flex items-center gap-1">
                                    <span
                                      className={`text-[9px] px-1 py-0.5 rounded font-bold uppercase ${
                                        isChosen
                                          ? "bg-black/30 text-white"
                                          : "bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse"
                                      }`}
                                    >
                                      Cháy vé ({st.availableSeats})
                                    </span>
                                  </div>
                                ) : isAlmostFull ? (
                                  <div className="flex items-center gap-1">
                                    <span
                                      className={`text-[9px] px-1 py-0.5 rounded font-bold uppercase ${
                                        isChosen
                                          ? "bg-black/30 text-white"
                                          : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                      }`}
                                    >
                                      Sắp hết ({st.availableSeats})
                                    </span>
                                  </div>
                                ) : (
                                  <span
                                    className={`text-[11px] font-bold ${
                                      isChosen ? "text-white" : "text-emerald-400"
                                    }`}
                                  >
                                    {st.availableSeats}/{st.totalSeats} ghế
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
