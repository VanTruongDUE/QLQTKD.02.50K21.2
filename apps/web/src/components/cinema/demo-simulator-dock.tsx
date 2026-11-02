"use client";

import React, { useState } from "react";
import {
  Zap,
  Clock,
  GraduationCap,
  CheckCircle2,
  SlidersHorizontal,
  X,
} from "lucide-react";

interface DemoSimulatorDockProps {
  onTriggerSingleSeatError: () => void;
  onTriggerNearShowtime: () => void;
  onTriggerU22Surcharge: () => void;
  onTriggerCompleteCheckin: () => void;
  activeSimulation: string | null;
  onResetSimulation: () => void;
}

export function DemoSimulatorDock({
  onTriggerSingleSeatError,
  onTriggerNearShowtime,
  onTriggerU22Surcharge,
  onTriggerCompleteCheckin,
  activeSimulation,
  onResetSimulation,
}: DemoSimulatorDockProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-3 right-4 z-50 px-3 py-2 rounded-xl bg-[#131520]/95 border border-[#222538] hover:border-purple-500 text-zinc-300 hover:text-white shadow-2xl backdrop-blur-md flex items-center gap-2 text-xs font-semibold transition-all hover:scale-105 cursor-pointer"
        title="Mở lại Bộ giả lập nghiệp vụ"
      >
        <SlidersHorizontal className="w-3.5 h-3.5 text-[#EC4899]" />
        <span>Bộ Giả Lập</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="p-2.5 rounded-2xl bg-[#131520]/95 border border-[#222538] shadow-2xl backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-2.5 text-xs">
        {/* Title & Badge */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-[#8B5CF6] to-[#EC4899] flex items-center justify-center text-white shadow-sm">
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-xs">
                Bộ Giả Lập Nghiệp Vụ
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-purple-950/60 text-purple-300 border border-purple-500/30">
                Demo
              </span>
            </div>
          </div>
        </div>

        {/* 4 One-Click Trigger Buttons + Close */}
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          {/* Button 1: Test single-seat rule error */}
          <button
            type="button"
            onClick={onTriggerSingleSeatError}
            className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1 text-[11px] font-medium transition-colors cursor-pointer ${
              activeSimulation === "single_seat"
                ? "bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white border-transparent shadow-sm"
                : "bg-[#181B2A] hover:bg-[#20253B] text-zinc-300 border-[#2A2E45]"
            }`}
            title="Tự động chọn 2 ghế cách nhau 1 ô trống để kích hoạt rung lắc lỗi"
          >
            <Zap className="w-3 h-3 text-[#EC4899]" />
            <span>1. Lỗi chừa 1 ghế lẻ</span>
          </button>

          {/* Button 2: Fast-forward to < 45m */}
          <button
            type="button"
            onClick={onTriggerNearShowtime}
            className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1 text-[11px] font-medium transition-colors cursor-pointer ${
              activeSimulation === "near_showtime"
                ? "bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white border-transparent shadow-sm"
                : "bg-[#181B2A] hover:bg-[#20253B] text-zinc-300 border-[#2A2E45]"
            }`}
            title="Giả lập đồng hồ còn 28 phút trước giờ chiếu, khóa đổi/trả"
          >
            <Clock className="w-3 h-3 text-amber-400" />
            <span>2. Sát giờ chiếu (&lt; 45p)</span>
          </button>

          {/* Button 3: Customer missing U22 card */}
          <button
            type="button"
            onClick={onTriggerU22Surcharge}
            className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1 text-[11px] font-medium transition-colors cursor-pointer ${
              activeSimulation === "u22_surcharge"
                ? "bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white border-transparent shadow-sm"
                : "bg-[#181B2A] hover:bg-[#20253B] text-zinc-300 border-[#2A2E45]"
            }`}
            title="Mở popup thu phụ thu vé người lớn trên màn hình Kiosk"
          >
            <GraduationCap className="w-3 h-3 text-purple-300" />
            <span>3. Khách quên thẻ U22</span>
          </button>

          {/* Button 4: Laser scan & stamp slam checkin */}
          <button
            type="button"
            onClick={onTriggerCompleteCheckin}
            className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1 text-[11px] font-medium transition-colors cursor-pointer ${
              activeSimulation === "checkin_stamp"
                ? "bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white border-transparent shadow-sm"
                : "bg-[#181B2A] hover:bg-[#20253B] text-zinc-300 border-[#2A2E45]"
            }`}
            title="Kích hoạt quét laser + đóng dấu mộc ĐÃ CHECK-IN HỢP LỆ"
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>4. Đóng dấu Check-in</span>
          </button>

          {/* Reset button if active */}
          {activeSimulation && (
            <button
              type="button"
              onClick={onResetSimulation}
              className="px-2 py-1.5 rounded-lg bg-[#222538] hover:bg-[#2c3149] text-zinc-300 text-[11px] font-semibold border border-[#2A2E45] cursor-pointer"
              title="Đặt lại trạng thái ban đầu"
            >
              ✕ Reset
            </button>
          )}

          {/* Close / Dismiss Dock Button */}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg bg-[#181B2A] hover:bg-[#20253B] text-zinc-400 hover:text-white transition-colors cursor-pointer border border-[#2A2E45] ml-1"
            title="Ẩn thanh giả lập"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
