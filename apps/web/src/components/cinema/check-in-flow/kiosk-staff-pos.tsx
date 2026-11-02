"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Search,
  Camera,
  CameraOff,
  Zap,
  DoorOpen,
  Printer,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  QrCode,
} from "lucide-react";
import { Ticket } from "../types";
import type { IScannerControls } from "@zxing/browser";

interface KioskStaffPosProps {
  tickets: Ticket[];
  onCheckInTicket: (ticketId: string) => void;
  forceStampSlam?: boolean;
  forceU22Surcharge?: boolean;
}

export function KioskStaffPos({
  tickets,
  onCheckInTicket,
  forceStampSlam = false,
  forceU22Surcharge = false,
}: KioskStaffPosProps) {
  const [inputCode, setInputCode] = useState("STL-894210");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(() => {
    return tickets.find((t) => t.bookingCode === "STL-894210") || tickets[0] || null;
  });

  const [isScanningSim, setIsScanningSim] = useState(false);
  const [isRealCameraActive, setIsRealCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanSuccessFeedback, setScanSuccessFeedback] = useState(false);
  const [isCccdVerified, setIsCccdVerified] = useState(false);
  const [gateOpenSuccess, setGateOpenSuccess] = useState(false);
  const [showThermalPrintModal, setShowThermalPrintModal] = useState(false);
  const [showSurchargeModal, setShowSurchargeModal] = useState(false);
  const [surchargePaid, setSurchargePaid] = useState(false);

  // Real Camera Hardware References
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const generationRef = useRef(0);

  // Stop & release real camera hardware
  const stopRealCamera = () => {
    generationRef.current++;
    controlsRef.current?.stop();
    controlsRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsRealCameraActive(false);
  };

  // Start Real Hardware Camera (Webcam / Back Camera) with ZXing QR Reader
  const startRealCamera = async () => {
    stopRealCamera();
    setCameraError(null);

    if (
      typeof window === "undefined" ||
      !window.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setCameraError(
        "Trình duyệt không hỗ trợ truy cập Camera trực tiếp hoặc cần môi trường an toàn (HTTPS/localhost). Bạn có thể dùng nút 'Quét Nhanh (Mô Phỏng)'."
      );
      return;
    }

    const currentGen = generationRef.current;
    setIsRealCameraActive(true);

    try {
      // 1. Request user camera permission & stream
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      if (currentGen !== generationRef.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = media;
      if (videoRef.current) {
        videoRef.current.srcObject = media;
        await videoRef.current.play().catch(() => {});
      }

      // 2. Dynamically import @zxing/browser and decode from stream
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      if (currentGen !== generationRef.current || !videoRef.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }

      const reader = new BrowserQRCodeReader();
      const scanner = await reader.decodeFromStream(
        media,
        videoRef.current,
        (result, _error, scannerControls) => {
          if (!result || currentGen !== generationRef.current) return;
          const decodedText = result.getText();
          if (decodedText) {
            scannerControls.stop();
            stopRealCamera();
            setScanSuccessFeedback(true);
            setTimeout(() => setScanSuccessFeedback(false), 2000);
            handleSearch(decodedText);
          }
        }
      );

      if (currentGen !== generationRef.current) {
        scanner.stop();
      } else {
        controlsRef.current = scanner;
      }
    } catch (err: any) {
      if (currentGen !== generationRef.current) return;
      stopRealCamera();
      const name = err?.name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setCameraError(
          "Quyền truy cập Camera bị từ chối. Hãy nhấp vào biểu tượng Ổ khóa / Cài đặt trang trên thanh địa chỉ trình duyệt để Cho phép Camera."
        );
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setCameraError(
          "Không tìm thấy thiết bị Camera trên máy tính của bạn. Hãy kết nối webcam hoặc dùng nút 'Quét Nhanh (Mô Phỏng)'."
        );
      } else if (name === "NotReadableError") {
        setCameraError(
          "Camera đang bị một ứng dụng khác (Zoom, Teams...) chiếm dụng. Hãy tắt ứng dụng kia hoặc dùng 'Quét Nhanh'."
        );
      } else {
        setCameraError(
          `Không thể mở Camera: ${err?.message || "Lỗi không xác định"}. Bạn vẫn có thể dùng 'Quét Nhanh (Mô Phỏng)' hoặc gõ mã vé.`
        );
      }
    }
  };

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopRealCamera();
    };
  }, []);

  // React to simulation triggers
  useEffect(() => {
    if (forceU22Surcharge) {
      setShowSurchargeModal(true);
      setSurchargePaid(false);
      const u22Ticket = tickets.find((t) => t.u22Count > 0) || tickets[0];
      if (u22Ticket) {
        setSelectedTicket(u22Ticket);
        setInputCode(u22Ticket.bookingCode);
      }
    }
  }, [forceU22Surcharge, tickets]);

  useEffect(() => {
    if (forceStampSlam) {
      setGateOpenSuccess(true);
      if (selectedTicket) {
        onCheckInTicket(selectedTicket.id);
      }
    }
  }, [forceStampSlam, selectedTicket, onCheckInTicket]);

  // Search or key input (smart matcher: bookingCode, phone, qrToken, or raw number)
  const handleSearch = (codeToSearch: string) => {
    const raw = codeToSearch.trim();
    if (!raw) return;

    let found = tickets.find(
      (t) =>
        t.bookingCode.toLowerCase() === raw.toLowerCase() ||
        t.phone === raw ||
        t.qrToken?.toLowerCase() === raw.toLowerCase()
    );

    // If string is an encrypted token like STL-SECURE-894210-..., extract code
    if (!found) {
      const match = raw.match(/STL-\d{6}/i) || raw.match(/\d{6}/);
      if (match) {
        const normalized = match[0].toUpperCase().startsWith("STL-")
          ? match[0].toUpperCase()
          : `STL-${match[0]}`;
        found = tickets.find((t) => t.bookingCode.toUpperCase() === normalized);
      }
    }

    if (found) {
      setSelectedTicket(found);
      setInputCode(found.bookingCode);
      setIsCccdVerified(false);
      setGateOpenSuccess(false);
      setSurchargePaid(false);
    } else {
      // Fallback: pick first eligible ticket so user always sees realistic flow
      const fallback = tickets[0];
      if (fallback) {
        setSelectedTicket(fallback);
        setInputCode(fallback.bookingCode);
      }
    }
  };

  // Simulate Camera Scan
  const handleSimulateCameraScan = () => {
    setIsScanningSim(true);
    setTimeout(() => {
      setIsScanningSim(false);
      const eligible = tickets.find((t) => t.status === "ELIGIBLE_REFUND") || tickets[0];
      if (eligible) {
        setSelectedTicket(eligible);
        setInputCode(eligible.bookingCode);
        setIsCccdVerified(false);
        setGateOpenSuccess(false);
      }
    }, 800);
  };

  // Confirm Gate Checkin
  const handleConfirmGate = () => {
    if (!selectedTicket) return;
    onCheckInTicket(selectedTicket.id);
    setGateOpenSuccess(true);
  };

  const keypadButtons = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "Xóa", "0", "Tìm"];

  const handleKeypadPress = (val: string) => {
    if (val === "Xóa") {
      setInputCode((prev) => prev.slice(0, -1));
    } else if (val === "Tìm") {
      handleSearch(inputCode);
    } else {
      if (inputCode.length < 12) {
        setInputCode((prev) => prev + val);
      }
    }
  };

  const isU22OrRestricted =
    selectedTicket && (selectedTicket.u22Count > 0 || ["T16", "T18"].includes(selectedTicket.movie.ageRating));

  const canUnlockGate = !isU22OrRestricted || isCccdVerified || surchargePaid;

  return (
    <div className="space-y-4 animate-subtle-step">
      {/* Header Info */}
      <div className="p-3.5 rounded-xl bg-[#121215] border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="px-2 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Cổng Kiosk Soát Vé POS
            </span>
            <span className="text-[11px] text-zinc-500">
              Starlight Đà Nẵng
            </span>
          </div>
          <h2 className="text-sm sm:text-base font-bold text-white">
            Đối Soát & Xác Thực Vào Rạp
          </h2>
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <button
            onClick={() => handleSearch("STL-894210")}
            className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-[11px] font-mono font-semibold text-amber-400 border border-zinc-800 cursor-pointer"
          >
            Mẫu: STL-894210
          </button>
          <button
            onClick={() => handleSearch("STL-651982")}
            className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-[11px] font-mono font-semibold text-purple-400 border border-zinc-800 cursor-pointer"
          >
            Mẫu: STL-651982
          </button>
        </div>
      </div>

      {/* Grid: Left Keypad / Camera Scanner (Cols 5) + Right Instant Verification Card (Cols 7) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Keypad & QR Scanner (Cols 5) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#131520] border border-[#222538] space-y-3 shadow-lg">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-purple-400" />
              Nhập Mã Hoặc Quét QR
            </h3>

            {/* Input with Search CTA */}
            <div className="flex gap-2">
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder="STL-894210 hoặc SĐT"
                className="flex-1 bg-[#181B2A] border border-[#2A2E45] rounded-xl px-3.5 py-2 font-mono text-xs font-bold text-white uppercase focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={() => handleSearch(inputCode)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white text-xs font-bold shadow-md cursor-pointer hover:opacity-90"
              >
                Kiểm tra
              </button>
            </div>

            {/* Camera QR Scanner Dual Controls */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={isRealCameraActive ? stopRealCamera : startRealCamera}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isRealCameraActive
                    ? "bg-rose-950/70 border-rose-500/60 text-rose-300 hover:bg-rose-900/80 shadow-md shadow-rose-950/40"
                    : "bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white border-transparent hover:opacity-95 shadow-md shadow-purple-950/40"
                }`}
              >
                {isRealCameraActive ? (
                  <>
                    <CameraOff className="w-3.5 h-3.5 text-rose-300" />
                    <span>Tắt Camera</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5" />
                    <span>Bật Camera Thật</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isScanningSim}
                onClick={handleSimulateCameraScan}
                className="py-2.5 px-3 rounded-xl bg-[#181B2A] hover:bg-[#20253B] active:bg-[#282e4a] border border-[#2A2E45] text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {isScanningSim ? "Đang quét..." : "Quét Nhanh (1-Click)"}
                </span>
              </button>
            </div>

            {/* Camera Permission / Error Notification Alert */}
            {cameraError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-bold text-rose-200">Không thể bật Camera:</p>
                  <p className="text-[11px] text-rose-300/90 leading-relaxed">
                    {cameraError}
                  </p>
                  <p className="text-[10px] text-zinc-400 pt-0.5">
                    👉 Bấm <strong>Quét Nhanh (1-Click)</strong> để kiểm tra vé ngay lập tức mà không cần webcam.
                  </p>
                </div>
              </div>
            )}

            {/* High-Tech Optical Laser Scanner Viewfinder */}
            <div className="relative rounded-xl overflow-hidden border border-[#222538] bg-[#0B0C14] min-h-[190px] flex flex-col items-center justify-center text-center">
              {/* Corner targeting reticles */}
              <div className="absolute top-2.5 left-2.5 w-3.5 h-3.5 border-t-2 border-l-2 border-[#EC4899] z-20 pointer-events-none" />
              <div className="absolute top-2.5 right-2.5 w-3.5 h-3.5 border-t-2 border-r-2 border-[#EC4899] z-20 pointer-events-none" />
              <div className="absolute bottom-2.5 left-2.5 w-3.5 h-3.5 border-b-2 border-l-2 border-[#EC4899] z-20 pointer-events-none" />
              <div className="absolute bottom-2.5 right-2.5 w-3.5 h-3.5 border-b-2 border-r-2 border-[#EC4899] z-20 pointer-events-none" />

              {/* Real Video Stream from Webcam */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300 ${
                  isRealCameraActive
                    ? "opacity-100"
                    : "opacity-0 pointer-events-none"
                }`}
              />

              {/* Laser beam scan line */}
              <div className="absolute left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-[#EC4899] to-transparent shadow-[0_0_12px_#EC4899] animate-laser-scan pointer-events-none z-10" />

              {/* Success scan flash overlay */}
              {scanSuccessFeedback && (
                <div className="absolute inset-0 z-30 bg-emerald-500/30 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in duration-150">
                  <div className="px-3.5 py-1.5 rounded-full bg-emerald-950/90 border border-emerald-500 text-emerald-300 text-xs font-bold flex items-center gap-1.5 shadow-xl">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Đã nhận diện mã QR thành công!</span>
                  </div>
                </div>
              )}

              {/* Viewfinder Content when camera is idle */}
              {!isRealCameraActive && (
                <div className="p-4 flex flex-col items-center justify-center relative z-10 space-y-2">
                  <div className="w-16 h-16 border border-dashed border-[#222538] rounded-xl flex items-center justify-center bg-[#131520]/70 shadow-inner">
                    <QrCode className="w-9 h-9 text-zinc-500" />
                  </div>
                  <div className="text-[11px] text-zinc-400 font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Cảm biến Laser sẵn sàng quét</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 max-w-[200px]">
                    Bấm <strong>&ldquo;Bật Camera Thật&rdquo;</strong> để quét QR từ điện thoại/vé in
                  </p>
                </div>
              )}

              {/* Live badge when real camera active */}
              {isRealCameraActive && (
                <div className="absolute top-3 inset-x-0 z-20 flex justify-center pointer-events-none">
                  <span className="px-2.5 py-1 rounded-full bg-black/75 border border-emerald-500/50 text-emerald-300 text-[10px] font-bold backdrop-blur-md flex items-center gap-1.5 shadow-lg">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Đang quét qua Camera...
                  </span>
                </div>
              )}
            </div>

            {/* Fast Touch Keypad */}
            <div>
              <span className="text-[10px] text-zinc-500 font-medium block mb-1.5">
                Bàn phím số nhanh:
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {keypadButtons.map((btn) => (
                  <button
                    key={btn}
                    onClick={() => handleKeypadPress(btn)}
                    className="py-2.5 rounded-xl bg-[#181B2A] hover:bg-[#20253B] active:bg-[#282e4a] text-white font-bold text-xs border border-[#2A2E45] transition-colors cursor-pointer"
                  >
                    {btn}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Instant Verification Card (Cols 7) */}
        <div className="lg:col-span-7 space-y-3">
          {selectedTicket ? (
            <div className="p-5 rounded-2xl bg-[#131520] border border-[#222538] space-y-4 relative overflow-hidden shadow-xl">
              {/* Rubber Stamp Slam Overlay */}
              {(gateOpenSuccess || forceStampSlam || selectedTicket.status === "CHECKED_IN") && (
                <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none select-none bg-black/40 backdrop-blur-[1px]">
                  <div className="px-6 py-3 rounded-xl border-4 border-emerald-500 bg-emerald-950/95 text-emerald-300 font-mono font-black text-lg sm:text-xl uppercase tracking-widest shadow-2xl backdrop-blur-md animate-stamp-slam flex items-center gap-2">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                    <span>ĐÃ CHECK-IN HỢP LỆ</span>
                  </div>
                </div>
              )}

              {/* Header Status & Code */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-800">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">
                    Mã Vé Tra Cứu
                  </span>
                  <span className="text-xl font-mono font-bold text-amber-400">
                    {selectedTicket.bookingCode}
                  </span>
                </div>

                <div>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${
                      selectedTicket.status === "CHECKED_IN"
                        ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    }`}
                  >
                    {selectedTicket.status === "CHECKED_IN"
                      ? "ĐÃ CHECK-IN VÀO PHÒNG"
                      : "HỢP LỆ • CHƯA CHECK-IN"}
                  </span>
                </div>
              </div>

              {/* Gate Open Success Banner */}
              {gateOpenSuccess && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2.5 animate-pulse">
                  <DoorOpen className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-white">
                      CỔNG ĐÃ MỞ - CHÀO MỪNG QUÝ KHÁCH VÀO PHÒNG {selectedTicket.showtime.room.split(" ")[1]}!
                    </div>
                    <p className="font-normal text-emerald-300/80 text-[11px] mt-0.5">
                      Xác thực thành công lúc {new Date().toLocaleTimeString("vi-VN")}.
                    </p>
                  </div>
                </div>
              )}

              {/* Movie & Seat Info Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-zinc-500 block text-[11px]">Tên phim:</span>
                  <p className="font-bold text-white mt-0.5">
                    {selectedTicket.movie.title}
                  </p>
                  <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {selectedTicket.movie.ageRating}
                  </span>
                </div>

                <div>
                  <span className="text-zinc-500 block text-[11px]">Khách hàng:</span>
                  <p className="font-semibold text-white mt-0.5">
                    {selectedTicket.customerName}
                  </p>
                  <p className="text-zinc-400 text-[11px]">{selectedTicket.phone}</p>
                </div>

                <div>
                  <span className="text-zinc-500 block text-[11px]">Suất chiếu:</span>
                  <p className="font-bold text-amber-400 mt-0.5">
                    {selectedTicket.showtime.startsAt} • Hôm nay
                  </p>
                  <p className="text-zinc-400 text-[11px]">{selectedTicket.showtime.room}</p>
                </div>

                <div>
                  <span className="text-zinc-500 block text-[11px]">Ghế ngồi:</span>
                  <p className="font-bold text-rose-400 mt-0.5">
                    {selectedTicket.seats.join(", ")}
                  </p>
                  {selectedTicket.u22Count > 0 && (
                    <span className="text-[10px] text-purple-400 font-medium block">
                      ({selectedTicket.u22Count} vé U22)
                    </span>
                  )}
                </div>
              </div>

              {/* Mandatory Age & U22 Verification Checklist Box */}
              {isU22OrRestricted && (
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    <span>Điều kiện đối soát bắt buộc:</span>
                  </div>

                  <label className="flex items-start gap-2 p-2 rounded-md bg-zinc-950 border border-zinc-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isCccdVerified}
                      onChange={(e) => setIsCccdVerified(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-rose-600 bg-zinc-800 border-zinc-700 mt-0.5"
                    />
                    <span className="text-[11px] text-zinc-300 leading-relaxed">
                      Đã đối chiếu <strong>CCCD / Thẻ HSSV hợp lệ</strong> của khách (sinh năm 2004 trở về sau hoặc đủ độ tuổi {selectedTicket.movie.ageRating}).
                    </span>
                  </label>

                  {surchargePaid && (
                    <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Đã thu phụ thu vé người lớn (+25.000đ). Cổng sẵn sàng mở!
                    </div>
                  )}
                </div>
              )}

              {/* 3 Operator Action Buttons */}
              <div className="pt-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* Button 1: Confirm & Open Gate */}
                <button
                  type="button"
                  disabled={!canUnlockGate}
                  onClick={handleConfirmGate}
                  className="py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-sm"
                >
                  <DoorOpen className="w-3.5 h-3.5" />
                  <span>Xác nhận & Mở cổng</span>
                </button>

                {/* Button 2: Print Thermal Physical Ticket */}
                <button
                  type="button"
                  onClick={() => setShowThermalPrintModal(true)}
                  className="py-2.5 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs border border-zinc-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In vé nhiệt</span>
                </button>

                {/* Button 3: Reject / Surcharge */}
                <button
                  type="button"
                  onClick={() => setShowSurchargeModal(true)}
                  className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] hover:opacity-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Thu phụ thu</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800 text-center text-zinc-500 space-y-1">
              <QrCode className="w-8 h-8 mx-auto text-zinc-600" />
              <p className="text-xs">
                Chưa có vé tra cứu. Nhập mã vé hoặc bấm nút mô phỏng quét QR.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Thermal Physical Ticket Printer Preview Modal */}
      {showThermalPrintModal && selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-white text-zinc-900 shadow-2xl p-5 space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center pb-2 border-b-2 border-dashed border-zinc-300">
              <span className="font-bold text-sm tracking-wider">
                STARLIGHT CINEMA
              </span>
              <button
                onClick={() => setShowThermalPrintModal(false)}
                className="text-zinc-500 hover:text-black font-sans font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-center space-y-0.5">
              <div className="text-[10px] text-zinc-600 uppercase">
                {selectedTicket.cinema.name}
              </div>
              <div className="font-bold text-sm uppercase">
                {selectedTicket.movie.title}
              </div>
              <div className="text-xs text-zinc-700">
                {selectedTicket.showtime.startsAt} • {selectedTicket.showtime.room}
              </div>
            </div>

            <div className="p-2.5 bg-zinc-100 rounded text-center space-y-0.5 border border-zinc-200">
              <div className="text-[10px] text-zinc-500">GHẾ NGỒI (SEATS)</div>
              <div className="text-xl font-bold text-black">
                {selectedTicket.seats.join(", ")}
              </div>
              <div className="text-[10px] text-zinc-600">
                Giá: {selectedTicket.totalPrice.toLocaleString("vi-VN")}đ
              </div>
            </div>

            {/* Popcorn Voucher on ticket roll */}
            <div className="pt-2 border-t-2 border-dashed border-zinc-300 text-center space-y-0.5">
              <span className="text-[10px] font-bold uppercase text-amber-800">
                --- PHIẾU BẮP NƯỚC KÈM THEO ---
              </span>
              <p className="font-semibold text-zinc-800">
                1x Combo Đôi Starlight
              </p>
              <p className="text-[10px] text-zinc-500">
                Quầy FastTrack #2 trước giờ chiếu
              </p>
            </div>

            {/* Barcode representation */}
            <div className="text-center pt-1">
              <div className="h-6 bg-zinc-900 mx-auto w-40 rounded flex items-center justify-center text-white text-[8px] tracking-[0.3em]">
                ||||||||||||||||||||||||||||||
              </div>
              <span className="text-[9px] font-bold mt-0.5 block">
                {selectedTicket.bookingCode}
              </span>
            </div>

            <button
              onClick={() => {
                alert("Đã gửi lệnh in cuộn vé nhiệt thành công!");
                setShowThermalPrintModal(false);
              }}
              className="w-full py-2 rounded-lg bg-zinc-900 text-white font-semibold text-xs uppercase tracking-wider hover:bg-black transition-colors cursor-pointer"
            >
              In Vé Nhiệt Ngay
            </button>
          </div>
        </div>
      )}

      {/* Surcharge Dialog Modal */}
      {showSurchargeModal && selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-[#121215] border border-zinc-800 shadow-2xl p-5 space-y-4 text-white">
            <div className="flex justify-between items-center pb-2.5 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Xử Lý Phụ Thu Chênh Lệch Vé
              </h3>
              <button
                onClick={() => setShowSurchargeModal(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Khách hàng không xuất trình được CCCD / Thẻ HSSV hợp lệ dưới 22 tuổi. Cần thu phụ thu nâng lên vé người lớn:
            </p>

            <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs space-y-1.5">
              <div className="flex justify-between text-zinc-400">
                <span>Số lượng vé U22:</span>
                <span className="font-semibold text-white">{selectedTicket.u22Count || 1} vé</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Đơn giá phụ thu:</span>
                <span>25.000đ / vé</span>
              </div>
              <div className="pt-2 border-t border-zinc-800 flex justify-between font-bold text-xs sm:text-sm">
                <span className="text-zinc-200">Tổng phụ thu:</span>
                <span className="text-rose-400 font-bold">+25.000đ</span>
              </div>
            </div>

            {/* VietQR Quick Scan Box */}
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center gap-3">
              <div className="w-12 h-12 bg-white p-1 rounded flex items-center justify-center flex-shrink-0">
                <QrCode className="w-10 h-10 text-zinc-900" />
              </div>
              <div className="text-[11px] text-zinc-300">
                <div className="font-semibold text-white">
                  Mã VietQR Phụ Thu Tức Thì
                </div>
                <p className="text-zinc-500 text-[10px] mt-0.5">
                  Khách quét app ngân hàng (+25.000đ) để mở cổng tự động.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setSurchargePaid(true);
                  setShowSurchargeModal(false);
                }}
                className="py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs border border-zinc-700 transition-colors cursor-pointer"
              >
                ✓ Đã Thu Tiền Mặt / POS
              </button>
              <button
                type="button"
                onClick={() => {
                  setSurchargePaid(true);
                  setShowSurchargeModal(false);
                }}
                className="py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors cursor-pointer shadow-sm"
              >
                ⚡ Đã Quét VietQR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
