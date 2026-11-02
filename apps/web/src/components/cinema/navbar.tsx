"use client";

import React, { useState } from "react";
import {
  Film,
  MapPin,
  ChevronDown,
  Ticket,
  RotateCcw,
  QrCode,
  Award,
  User,
} from "lucide-react";
import { CinemaLocation } from "./types";
import { CINEMA_LOCATIONS } from "./mock-data";

interface NavbarProps {
  activeTab: "booking" | "exchange_refund" | "checkin";
  onTabChange: (tab: "booking" | "exchange_refund" | "checkin") => void;
  selectedCinema: CinemaLocation;
  onCinemaChange: (cinema: CinemaLocation) => void;
  onLogoClick?: () => void;
}

export function Navbar({
  activeTab,
  onTabChange,
  selectedCinema,
  onCinemaChange,
  onLogoClick,
}: NavbarProps) {
  const [isLocationOpen, setIsLocationOpen] = useState(false);

  const handleLogoClick = () => {
    if (onLogoClick) {
      onLogoClick();
    } else {
      onTabChange("booking");
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[#0B0C14]/95 backdrop-blur-md border-b border-[#222538]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo & Location Dropdown */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <button
              onClick={handleLogoClick}
              className="flex items-center gap-2.5 text-left active:scale-95 transition-transform cursor-pointer"
              title="Về Trang chủ Starlight Cinema"
              aria-label="Về Trang chủ Starlight Cinema"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#8B5CF6] to-[#EC4899] flex items-center justify-center text-white shadow-md shadow-purple-900/30">
                <Film className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1 leading-none">
                  <span className="font-extrabold text-base tracking-tight text-white">
                    STARLIGHT
                  </span>
                  <span className="font-bold text-xs tracking-wider text-[#F59E0B] uppercase">
                    CINEMA
                  </span>
                </div>
                <span className="text-[10px] text-zinc-400 mt-0.5 hidden sm:inline">
                  Hệ thống Rạp & Giải trí
                </span>
              </div>
            </button>

            {/* Cinema Location Selector Dropdown */}
            <div className="relative hidden md:block">
              <button
                type="button"
                onClick={() => setIsLocationOpen(!isLocationOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#131520] hover:bg-[#1a1d2e] border border-[#222538] text-xs font-medium text-zinc-300 transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 text-[#EC4899] flex-shrink-0" />
                <span className="max-w-[140px] truncate">{selectedCinema.name}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-150 ${
                    isLocationOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isLocationOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsLocationOpen(false)}
                  />
                  <div className="absolute left-0 mt-1.5 w-72 rounded-xl bg-[#131520] border border-[#222538] shadow-2xl p-1.5 z-50">
                    <div className="px-2.5 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-[#222538]">
                      Chọn Cụm Rạp Starlight
                    </div>
                    <div className="py-1 max-h-72 overflow-y-auto space-y-0.5">
                      {CINEMA_LOCATIONS.map((cinema) => (
                        <button
                          key={cinema.id}
                          onClick={() => {
                            onCinemaChange(cinema);
                            setIsLocationOpen(false);
                          }}
                          className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors flex flex-col gap-0.5 ${
                            cinema.id === selectedCinema.id
                              ? "bg-purple-950/60 text-white font-medium border border-purple-500/40"
                              : "text-zinc-300 hover:bg-[#1c2033]"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{cinema.name}</span>
                            {cinema.id === selectedCinema.id && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#EC4899]" />
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-500 line-clamp-1">
                            {cinema.address}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Segmented Core View Switcher - Starlight Neon Gradient, No text clipping */}
          <nav className="flex items-center p-1 rounded-xl bg-[#131520] border border-[#222538] flex-shrink-0">
            <button
              onClick={() => onTabChange("booking")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "booking"
                  ? "bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white font-semibold shadow-md shadow-purple-900/40"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>Đặt Vé Xem Phim</span>
            </button>

            <button
              onClick={() => onTabChange("exchange_refund")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "exchange_refund"
                  ? "bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white font-semibold shadow-md shadow-purple-900/40"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Đổi / Hoàn Vé</span>
              <span className="px-1 py-0.2 text-[9px] font-bold rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                24/7
              </span>
            </button>

            <button
              onClick={() => onTabChange("checkin")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "checkin"
                  ? "bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white font-semibold shadow-md shadow-purple-900/40"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <QrCode className="w-3.5 h-3.5 text-purple-300" />
              <span>Smart Check-in</span>
            </button>
          </nav>

          {/* Compact Member Status Bar (Single Line) */}
          <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#131520] border border-[#222538] text-xs whitespace-nowrap">
              <Award className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="font-medium text-zinc-200">Starlight Gold</span>
              <span className="text-zinc-600">•</span>
              <span className="font-semibold text-amber-400">1.250 điểm</span>
              <span className="text-[10px] px-1 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold">
                VIP
              </span>
            </div>

            <div
              className="w-8 h-8 rounded-lg bg-[#131520] border border-[#222538] flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="khach@starlight.demo"
            >
              <User className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
