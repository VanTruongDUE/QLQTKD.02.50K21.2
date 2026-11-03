"use client";

import React from "react";
import {
  Popcorn,
  Sparkles,
  Users,
  Coffee,
  Gamepad2,
  Plus,
  Minus,
} from "lucide-react";
import { FnBItem } from "../types";

interface Step3FnBProps {
  items: FnBItem[];
  loading: boolean;
  error: string;
  quantities: Record<string, number>;
  onQuantityChange: (itemId: string, delta: number) => void;
}

export function Step3FnB({ items, loading, error, quantities, onQuantityChange }: Step3FnBProps) {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "Popcorn":
        return <Popcorn className="w-5 h-5 text-amber-400" />;
      case "Sparkles":
        return <Sparkles className="w-5 h-5 text-rose-400" />;
      case "Users":
        return <Users className="w-5 h-5 text-purple-400" />;
      case "Coffee":
        return <Coffee className="w-5 h-5 text-amber-500" />;
      case "Gamepad2":
        return <Gamepad2 className="w-5 h-5 text-emerald-400" />;
      default:
        return <Popcorn className="w-5 h-5 text-amber-400" />;
    }
  };

  const fnbTotal = items.reduce((sum, item) => {
    return sum + (quantities[item.id] || 0) * item.price;
  }, 0);

  return (
    <div className="space-y-4 animate-subtle-step">
      {/* Header Banner */}
      <div className="p-4 rounded-2xl bg-[#131520] border border-[#222538] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="px-2 py-0.2 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              Quầy FastTrack
            </span>
            <span className="text-xs text-zinc-400">
              Nhận bắp nước nhanh tại quầy ưu tiên
            </span>
          </div>
          <h3 className="text-base font-bold text-white">
            Bắp Nước & Dịch Vụ Đi Kèm
          </h3>
        </div>

        <div className="text-right self-end sm:self-center">
          <span className="text-[11px] text-zinc-400 block">Tạm tính bắp nước:</span>
          <div className="text-lg font-extrabold text-[#EC4899]">
            {fnbTotal.toLocaleString("vi-VN")}đ
          </div>
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="rounded-2xl border border-[#222538] bg-[#131520] p-6 text-sm text-zinc-400">
          Đang tải sản phẩm đi kèm...
        </div>
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
          {error}
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {items.map((item) => {
          const qty = quantities[item.id] || 0;
          const isSelected = qty > 0;

          return (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                isSelected
                  ? "bg-[#161826] border-purple-500/50 shadow-md shadow-purple-950/30"
                  : "bg-[#131520] hover:bg-[#181a29] border-[#222538]"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-24 w-24 flex-shrink-0 rounded-xl border border-[#2A2E45] object-cover"
                    />
                  ) : (
                    <div className="h-24 w-24 rounded-xl bg-[#181B2A] border border-[#2A2E45] flex items-center justify-center flex-shrink-0">
                      {getIcon(item.iconName)}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-bold text-xs sm:text-sm text-white">
                        {item.name}
                      </h4>
                      {item.badge && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                    <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-zinc-200">
                      <Users className="h-3.5 w-3.5 text-purple-400" />
                      Gợi ý: {item.recommendedMinPeople === item.recommendedMaxPeople
                        ? `${item.recommendedMinPeople} người`
                        : `${item.recommendedMinPeople}–${item.recommendedMaxPeople} người`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2.5 border-t border-[#222538] flex items-center justify-between mt-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-bold text-amber-400">
                    {item.price.toLocaleString("vi-VN")}đ
                  </span>
                  {item.originalPrice && (
                    <span className="text-[10px] text-zinc-500 line-through">
                      {item.originalPrice.toLocaleString("vi-VN")}đ
                    </span>
                  )}
                </div>

                {/* Counter */}
                <div className="flex items-center gap-1.5 bg-[#181B2A] p-0.5 rounded-xl border border-[#2A2E45]">
                  <button
                    type="button"
                    disabled={qty <= 0}
                    onClick={() => onQuantityChange(item.id, -1)}
                    className="w-6 h-6 rounded-lg bg-[#222538] hover:bg-[#2b3047] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-5 text-center text-xs font-bold text-white">
                    {qty}
                  </span>
                  <button
                    type="button"
                    disabled={qty >= 10}
                    onClick={() => onQuantityChange(item.id, 1)}
                    className="w-6 h-6 rounded-lg bg-gradient-to-r from-[#A855F7] to-[#EC4899] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 flex items-center justify-center text-white transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Entertainment Upsell Card */}
      <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Gamepad2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-[11px]">
            <strong>Đặc quyền:</strong> Giảm 20% vé chơi Bowling hoặc Xu Game thùng tại Trung tâm Giải trí Starlight cùng tầng.
          </span>
        </div>
        <span className="font-semibold text-emerald-400 text-[11px] whitespace-nowrap">
          Ưu đãi kèm vé
        </span>
      </div>
    </div>
  );
}
