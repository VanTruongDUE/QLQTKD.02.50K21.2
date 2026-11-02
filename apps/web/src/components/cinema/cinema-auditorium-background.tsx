"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

// ────────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────────
interface DustMote {
  id: number;
  x: number;       // 0–1 fraction of beam width
  y: number;       // 0–1 fraction of beam height (current position)
  vy: number;      // drift speed
  vx: number;      // lateral drift
  size: number;    // px
  opacity: number;
  baseOpacity: number;
  twinkleSpeed: number;
  twinkleOffset: number;
}

interface ClothPhysicsState {
  clothShift: number;  // Lateral fabric billow in px (gentle: ~3-6px)
  vShift: number;      // Lateral velocity
  clothSkew: number;   // Fabric shearing in degrees (gentle: ~0.5-1.0deg)
  vSkew: number;       // Shearing velocity
  wavePhase: number;   // Undulating fold ripple phase
  waveAmp: number;     // Ripple amplitude in px (gentle: ~2px)
  touchY: number;      // Relative Y of touch
  isHovered: boolean;
  isDragging: boolean;
  dragStartX: number;
}

const HUD_ZONES = [
  { threshold: 0.00, label: "🚪  Lối vào sảnh Starlight" },
  { threshold: 0.22, label: "🎟  Cửa Phòng 03 – Dolby 7.1" },
  { threshold: 0.48, label: "🪑  Lối đi trung tâm – Hàng G VIP" },
  { threshold: 0.72, label: "🎬  Khu vực gần màn hình IMAX" },
  { threshold: 0.90, label: "🌟  Hàng G07 / G08 – Ghế đã đặt" },
];

const SEAT_ROW_LABELS = ["ROW K", "ROW J", "ROW H", "ROW G VIP", "ROW F VIP", "ROW E"];

// ────────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ────────────────────────────────────────────────────────────────────────────────
// Initial dust motes
// ────────────────────────────────────────────────────────────────────────────────
function generateMotes(count: number): DustMote[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random(),
    y: Math.random(),
    vy: 0.00006 + Math.random() * 0.00012,
    vx: (Math.random() - 0.5) * 0.00004,
    size: 1 + Math.random() * 2.5,
    opacity: 0,
    baseOpacity: 0.25 + Math.random() * 0.55,
    twinkleSpeed: 0.6 + Math.random() * 1.4,
    twinkleOffset: Math.random() * Math.PI * 2,
  }));
}

// ────────────────────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────────────────────
export function CinemaAuditoriumBackground() {
  const [smoothProgress, setSmoothProgress] = useState(0);
  const [isLeftHovered, setIsLeftHovered] = useState(false);
  const [isRightHovered, setIsRightHovered] = useState(false);

  const rafRef = useRef<number | null>(null);
  const targetRef = useRef(0);
  const currentRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const motesRef = useRef<DustMote[]>(generateMotes(38));
  const lastTimeRef = useRef<number>(0);
  const canvasRafRef = useRef<number | null>(null);

  // DOM Refs:
  // - Containers track scroll opening
  // - Fabric & Folds deform organically on touch
  // - Fringe (Thanh vàng) remains straight and calm (đứng yên)
  const leftCurtainContainerRef = useRef<HTMLDivElement>(null);
  const rightCurtainContainerRef = useRef<HTMLDivElement>(null);
  const leftFabricRef = useRef<HTMLDivElement>(null);
  const rightFabricRef = useRef<HTMLDivElement>(null);
  const leftFoldsRef = useRef<HTMLDivElement>(null);
  const rightFoldsRef = useRef<HTMLDivElement>(null);
  const leftFringeRef = useRef<HTMLDivElement>(null);
  const rightFringeRef = useRef<HTMLDivElement>(null);

  // Gentle Cloth Physics States for Left & Right Velvet
  const leftCloth = useRef<ClothPhysicsState>({
    clothShift: 0,
    vShift: 0,
    clothSkew: 0,
    vSkew: 0,
    wavePhase: 0,
    waveAmp: 0,
    touchY: 0.5,
    isHovered: false,
    isDragging: false,
    dragStartX: 0,
  });

  const rightCloth = useRef<ClothPhysicsState>({
    clothShift: 0,
    vShift: 0,
    clothSkew: 0,
    vSkew: 0,
    wavePhase: 0,
    waveAmp: 0,
    touchY: 0.5,
    isHovered: false,
    isDragging: false,
    dragStartX: 0,
  });

  const lastMousePos = useRef<{ x: number; y: number; time: number }>({
    x: 0,
    y: 0,
    time: 0,
  });

  // ── Scroll listener with rAF smoothing ──────────────────────────────────────
  const handleScroll = useCallback(() => {
    const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (totalScroll <= 0) return;
    targetRef.current = clamp(window.scrollY / totalScroll, 0, 1);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    function tick() {
      // 1. Scroll progress smoothing
      const delta = (targetRef.current - currentRef.current) * 0.072;
      currentRef.current += delta;
      const p = currentRef.current;
      setSmoothProgress(p);

      // Curtain scroll opening calculation
      const curtainP = clamp(p / 0.45, 0, 1);
      const curtainEased = easeInOutCubic(curtainP);
      const curtainTranslateLeft = -(curtainEased * 108);
      const curtainTranslateRight = curtainEased * 108;
      const curtainScaleX = 1 + curtainEased * 0.18;

      // Update Curtain Containers (Scroll position)
      if (leftCurtainContainerRef.current) {
        leftCurtainContainerRef.current.style.transform = `translateX(${curtainTranslateLeft}%) scaleX(${curtainScaleX})`;
      }
      if (rightCurtainContainerRef.current) {
        rightCurtainContainerRef.current.style.transform = `translateX(${curtainTranslateRight}%) scaleX(${curtainScaleX})`;
      }

      // 2. Cloth-Only Velvet Simulation (Soft, Damped, Natural Hand Brush)
      const kShift = 0.026;
      const dShift = 0.115;
      const kSkew = 0.024;
      const dSkew = 0.110;

      // ── Left Velvet Fabric ──
      const lp = leftCloth.current;
      if (!lp.isDragging) {
        const fShift = -kShift * lp.clothShift - dShift * lp.vShift;
        lp.vShift += fShift;
        lp.clothShift += lp.vShift;
        lp.clothShift = clamp(lp.clothShift, -7, 7);

        const fSkew = -kSkew * lp.clothSkew - dSkew * lp.vSkew;
        lp.vSkew += fSkew;
        lp.clothSkew += lp.vSkew;
        lp.clothSkew = clamp(lp.clothSkew, -1.2, 1.2);
      }

      lp.wavePhase += 0.07;
      lp.waveAmp = Math.max(0, lp.waveAmp * 0.94);

      // Apply billow & shear to the velvet cloth body
      if (leftFabricRef.current) {
        leftFabricRef.current.style.transform = `translateX(${lp.clothShift.toFixed(2)}px) skewX(${lp.clothSkew.toFixed(2)}deg)`;
      }

      // Ripple individual fold highlights as a silk wave
      if (leftFoldsRef.current) {
        const waveX = Math.sin(lp.wavePhase) * lp.waveAmp;
        const waveSkewY = Math.cos(lp.wavePhase * 0.75) * (lp.clothSkew * 0.35);
        leftFoldsRef.current.style.transform = `translateX(${waveX.toFixed(2)}px) skewY(${waveSkewY.toFixed(2)}deg)`;
      }

      // Thanh Vàng đứng yên / giữ thẳng mép rèm (chỉ đệm vi sai tối đa 0.2px)
      if (leftFringeRef.current) {
        const microCushion = lp.clothShift * 0.05;
        leftFringeRef.current.style.transform = `translateX(${microCushion.toFixed(2)}px)`;
      }

      // ── Right Velvet Fabric ──
      const rp = rightCloth.current;
      if (!rp.isDragging) {
        const fShift = -kShift * rp.clothShift - dShift * rp.vShift;
        rp.vShift += fShift;
        rp.clothShift += rp.vShift;
        rp.clothShift = clamp(rp.clothShift, -7, 7);

        const fSkew = -kSkew * rp.clothSkew - dSkew * rp.vSkew;
        rp.vSkew += fSkew;
        rp.clothSkew += rp.vSkew;
        rp.clothSkew = clamp(rp.clothSkew, -1.2, 1.2);
      }

      rp.wavePhase += 0.07;
      rp.waveAmp = Math.max(0, rp.waveAmp * 0.94);

      if (rightFabricRef.current) {
        rightFabricRef.current.style.transform = `translateX(${rp.clothShift.toFixed(2)}px) skewX(${rp.clothSkew.toFixed(2)}deg)`;
      }

      if (rightFoldsRef.current) {
        const waveX = Math.sin(rp.wavePhase) * rp.waveAmp;
        const waveSkewY = Math.cos(rp.wavePhase * 0.75) * (rp.clothSkew * 0.35);
        rightFoldsRef.current.style.transform = `translateX(${waveX.toFixed(2)}px) skewY(${waveSkewY.toFixed(2)}deg)`;
      }

      // Thanh Vàng phải đứng yên
      if (rightFringeRef.current) {
        const microCushion = rp.clothShift * 0.05;
        rightFringeRef.current.style.transform = `translateX(${microCushion.toFixed(2)}px)`;
      }

      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleScroll]);

  // ── Global Pointer Tracking: Subtle Gentle Cloth Brush ─────────────────────
  useEffect(() => {
    let lastNudgeTimeLeft = 0;
    let lastNudgeTimeRight = 0;

    const handlePointerMove = (e: MouseEvent | PointerEvent) => {
      const now = performance.now();
      const dt = Math.max(1, now - lastMousePos.current.time);
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      const speed = Math.sqrt(dx * dx + dy * dy) / (dt / 16);
      lastMousePos.current = { x: e.clientX, y: e.clientY, time: now };

      const w = window.innerWidth;
      const h = window.innerHeight;
      const curtainW = w * 0.16;
      const normY = clamp(e.clientY / h, 0.2, 0.9);

      // Handle gentle drag on left curtain
      if (leftCloth.current.isDragging) {
        const dragDelta = e.clientX - leftCloth.current.dragStartX;
        leftCloth.current.clothShift = clamp(dragDelta * 0.28, -8, 8);
        leftCloth.current.clothSkew = clamp((dragDelta / 50) * 0.9, -1.2, 1.2);
        leftCloth.current.vShift = 0;
        leftCloth.current.waveAmp = 1.8;
        return;
      }

      // Handle gentle drag on right curtain
      if (rightCloth.current.isDragging) {
        const dragDelta = e.clientX - rightCloth.current.dragStartX;
        rightCloth.current.clothShift = clamp(dragDelta * 0.28, -8, 8);
        rightCloth.current.clothSkew = clamp((dragDelta / 50) * 0.9, -1.2, 1.2);
        rightCloth.current.vShift = 0;
        rightCloth.current.waveAmp = 1.8;
        return;
      }

      // Check Left Curtain Proximity
      const leftBoundary = Math.max(curtainW * 1.05, 110);
      const isInLeftZone = e.clientX <= leftBoundary;
      setIsLeftHovered(isInLeftZone);

      if (isInLeftZone && now - lastNudgeTimeLeft > 75) {
        lastNudgeTimeLeft = now;
        const dir = dx > 0 ? 1 : dx < 0 ? -1 : 1;
        const gentleImpulseShift = (dir * Math.min(speed * 0.08 + 0.35, 1.2)) * normY;
        const gentleImpulseSkew = (dir * Math.min(speed * 0.02 + 0.08, 0.25)) * normY;

        leftCloth.current.vShift = clamp(leftCloth.current.vShift + gentleImpulseShift, -2.2, 2.2);
        leftCloth.current.vSkew = clamp(leftCloth.current.vSkew + gentleImpulseSkew, -0.4, 0.4);
        leftCloth.current.waveAmp = Math.min(leftCloth.current.waveAmp + 0.45, 2.8);
      }

      // Check Right Curtain Proximity
      const rightBoundary = w - Math.max(curtainW * 1.05, 110);
      const isInRightZone = e.clientX >= rightBoundary;
      setIsRightHovered(isInRightZone);

      if (isInRightZone && now - lastNudgeTimeRight > 75) {
        lastNudgeTimeRight = now;
        const dir = dx < 0 ? -1 : dx > 0 ? 1 : -1;
        const gentleImpulseShift = (dir * Math.min(speed * 0.08 + 0.35, 1.2)) * normY;
        const gentleImpulseSkew = (dir * Math.min(speed * 0.02 + 0.08, 0.25)) * normY;

        rightCloth.current.vShift = clamp(rightCloth.current.vShift + gentleImpulseShift, -2.2, 2.2);
        rightCloth.current.vSkew = clamp(rightCloth.current.vSkew + gentleImpulseSkew, -0.4, 0.4);
        rightCloth.current.waveAmp = Math.min(rightCloth.current.waveAmp + 0.45, 2.8);
      }
    };

    const handlePointerUp = () => {
      if (leftCloth.current.isDragging) {
        leftCloth.current.isDragging = false;
        leftCloth.current.vShift = clamp(leftCloth.current.clothShift * -0.15, -1.8, 1.8);
        leftCloth.current.vSkew = clamp(leftCloth.current.clothSkew * -0.12, -0.3, 0.3);
      }
      if (rightCloth.current.isDragging) {
        rightCloth.current.isDragging = false;
        rightCloth.current.vShift = clamp(rightCloth.current.clothShift * -0.15, -1.8, 1.8);
        rightCloth.current.vSkew = clamp(rightCloth.current.clothSkew * -0.12, -0.3, 0.3);
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  // ── Canvas: floating dust motes ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function drawFrame(timestamp: number) {
      if (!canvas || !ctx) return;
      const dt = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const progress = currentRef.current;
      const beamCentreX = canvas.width * 0.5;
      const beamTopY = -canvas.height * 0.04;
      const beamHalfWidthTop = canvas.width * 0.04;
      const beamHalfWidthBot = canvas.width * 0.28;
      const beamBotY = canvas.height * 1.02;

      const globalOpacity = clamp(progress * 2.2, 0, 1);

      motesRef.current.forEach((mote) => {
        mote.y += mote.vy * (dt || 16);
        mote.x += mote.vx * (dt || 16);
        if (mote.y > 1.05) {
          mote.y = -0.05;
          mote.x = Math.random();
        }
        if (mote.x < -0.1 || mote.x > 1.1) mote.x = Math.random();

        const py = lerp(beamTopY, beamBotY, mote.y);
        const halfW = lerp(beamHalfWidthTop, beamHalfWidthBot, mote.y);
        const px = beamCentreX + (mote.x * 2 - 1) * halfW;

        const twinkle =
          0.5 + 0.5 * Math.sin(timestamp * 0.001 * mote.twinkleSpeed + mote.twinkleOffset);
        const alpha = mote.baseOpacity * twinkle * globalOpacity;

        const edgeFactor = Math.abs(mote.x * 2 - 1);
        const r = Math.round(lerp(240, 168, edgeFactor));
        const g = Math.round(lerp(240, 85, edgeFactor));
        const b = Math.round(lerp(255, 247, edgeFactor));

        ctx.beginPath();
        ctx.arc(px, py, mote.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fill();
      });

      canvasRafRef.current = requestAnimationFrame(drawFrame);
    }
    canvasRafRef.current = requestAnimationFrame(drawFrame);

    return () => {
      window.removeEventListener("resize", resize);
      if (canvasRafRef.current) cancelAnimationFrame(canvasRafRef.current);
    };
  }, []);

  // ── Derived values from smoothProgress ─────────────────────────────────────
  const p = smoothProgress;

  // Projector beam opacity
  const beamOpacity = lerp(0.18, 0.72, clamp(p * 1.4, 0, 1));

  // House-lights vignette
  const vignetteStrength = lerp(0.35, 0.82, clamp(p * 1.2, 0, 1));

  // Screen glow scale + translateY parallax
  const screenScale = lerp(0.78, 1.22, easeInOutCubic(p));
  const screenTranslateY = lerp(28, -22, p);

  // Aisle walls parallax depth
  const aisleDepthZ = lerp(0, 140, p);

  // Seat silhouette rise
  const seatTranslateY = lerp(60, -28, easeInOutCubic(p));
  const seatScale = lerp(0.82, 1.14, easeInOutCubic(p));
  const seatOpacity = clamp(p * 2.4, 0, 0.9);

  // HUD zone label
  const hudZone = [...HUD_ZONES].reverse().find((z) => p >= z.threshold) ?? HUD_ZONES[0];
  const hudOpacity = clamp(p * 3.5, 0, 0.55);

  // Aisle step lights animate further in
  const aisleStepOffset = lerp(0, 120, p);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
      aria-hidden="true"
    >
      {/* ──────────────────────────────────────────────────────────────────────
          LAYER 0 – Base deep-space gradient background
      ────────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 120% 70% at 50% 30%, rgba(30,18,60,0.55) 0%, #0B0C14 65%)",
        }}
      />

      {/* ──────────────────────────────────────────────────────────────────────
          LAYER 4 – Distant glowing screen + seat silhouettes
      ────────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          transform: `translateX(-50%) translateY(${screenTranslateY}px) scale(${screenScale})`,
          transformOrigin: "center bottom",
          bottom: "10%",
          width: "72vw",
          height: "36vw",
          background:
            "radial-gradient(ellipse 80% 55% at 50% 85%, rgba(168,85,247,0.30) 0%, rgba(236,72,153,0.18) 45%, transparent 75%)",
          filter: "blur(38px)",
          willChange: "transform, opacity",
          opacity: clamp(p * 1.8, 0, 0.9),
        }}
      />

      {/* Seat row silhouettes – 4 rows, staggered depth */}
      {[0, 1, 2, 3].map((rowIdx) => {
        const rowDepth = rowIdx * 0.25;
        const rowScale = seatScale * lerp(0.85, 1.05, rowDepth);
        const rowY = seatTranslateY - rowIdx * 56 - aisleStepOffset * 0.18;
        const rowOp = seatOpacity * (1 - rowIdx * 0.2);
        return (
          <div
            key={rowIdx}
            style={{
              position: "absolute",
              bottom: `${4 + rowIdx * 7}%`,
              left: "50%",
              transform: `translateX(-50%) translateY(${rowY}px) scale(${rowScale})`,
              transformOrigin: "center bottom",
              width: "88vw",
              height: "7vh",
              opacity: rowOp,
              willChange: "transform, opacity",
            }}
          >
            <svg
              viewBox="0 0 880 56"
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMid meet"
              fill="none"
            >
              {Array.from({ length: 20 }).map((_, si) => {
                const cx = 22 + si * 44;
                return (
                  <g key={si}>
                    <rect
                      x={cx - 16}
                      y={4}
                      width={32}
                      height={28}
                      rx={5}
                      fill="#111118"
                      stroke="rgba(168,85,247,0.18)"
                      strokeWidth="0.8"
                    />
                    <rect
                      x={cx - 16}
                      y={30}
                      width={32}
                      height={16}
                      rx={4}
                      fill="#0e0e18"
                      stroke="rgba(168,85,247,0.10)"
                      strokeWidth="0.5"
                    />
                    <rect x={cx - 20} y={22} width={5} height={18} rx={2} fill="#0d0d16" />
                    <rect x={cx + 15} y={22} width={5} height={18} rx={2} fill="#0d0d16" />
                  </g>
                );
              })}
            </svg>
          </div>
        );
      })}

      {/* ──────────────────────────────────────────────────────────────────────
          LAYER 3 – Volumetric projector beam + canvas dust motes
      ────────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "60vw",
          height: "105vh",
          background:
            "conic-gradient(from 270deg at 50% -2%, transparent 0deg, rgba(200,170,255,0.12) 10deg, rgba(236,72,153,0.07) 26deg, rgba(200,170,255,0.10) 34deg, transparent 44deg)",
          filter: "blur(32px)",
          mixBlendMode: "screen",
          opacity: beamOpacity,
          pointerEvents: "none",
          willChange: "opacity",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "18vw",
          height: "100vh",
          background:
            "linear-gradient(180deg, rgba(220,200,255,0.18) 0%, rgba(168,85,247,0.08) 55%, transparent 100%)",
          filter: "blur(14px)",
          mixBlendMode: "screen",
          opacity: clamp(beamOpacity * 1.3, 0, 0.9),
          pointerEvents: "none",
          willChange: "opacity",
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />

      {/* ──────────────────────────────────────────────────────────────────────
          LAYER 2 – 3D perspective aisle walls + LED strip lights
      ────────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "13vw",
          height: "100vh",
          transform: `perspective(900px) rotateY(34deg) translateZ(${aisleDepthZ}px)`,
          transformOrigin: "left center",
          background: "linear-gradient(90deg, #0a0a12 0%, #12101e 70%, transparent 100%)",
          willChange: "transform",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: "3px",
            background:
              "linear-gradient(180deg, transparent 0%, #A855F7 20%, #EC4899 50%, #A855F7 80%, transparent 100%)",
            boxShadow: "0 0 12px 4px rgba(168,85,247,0.45)",
            opacity: 0.7,
          }}
        />
        {SEAT_ROW_LABELS.map((label, i) => {
          const topPct = 18 + i * 12 + aisleStepOffset * 0.06 - i * aisleStepOffset * 0.012;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                right: "6px",
                top: `${clamp(topPct, 5, 92)}%`,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: "2px",
                opacity: clamp(0.28 + p * 0.5, 0, 0.72),
                transition: "opacity 0.3s",
              }}
            >
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: i % 2 === 0 ? "#A855F7" : "#EC4899",
                  boxShadow: `0 0 8px 3px ${
                    i % 2 === 0 ? "rgba(168,85,247,0.6)" : "rgba(236,72,153,0.6)"
                  }`,
                }}
              />
              <span
                style={{
                  fontSize: "8px",
                  color: i >= 3 ? "#F59E0B" : "#A855F7",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  fontFamily: "monospace",
                  textShadow:
                    i >= 3 ? "0 0 8px rgba(245,158,11,0.7)" : "0 0 6px rgba(168,85,247,0.7)",
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "13vw",
          height: "100vh",
          transform: `perspective(900px) rotateY(-34deg) translateZ(${aisleDepthZ}px)`,
          transformOrigin: "right center",
          background: "linear-gradient(270deg, #0a0a12 0%, #12101e 70%, transparent 100%)",
          willChange: "transform",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "3px",
            background:
              "linear-gradient(180deg, transparent 0%, #EC4899 20%, #A855F7 50%, #EC4899 80%, transparent 100%)",
            boxShadow: "0 0 12px 4px rgba(236,72,153,0.45)",
            opacity: 0.7,
          }}
        />
        {SEAT_ROW_LABELS.map((label, i) => {
          const topPct = 18 + i * 12 + aisleStepOffset * 0.06 - i * aisleStepOffset * 0.012;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: "6px",
                top: `${clamp(topPct, 5, 92)}%`,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "2px",
                opacity: clamp(0.28 + p * 0.5, 0, 0.72),
                transition: "opacity 0.3s",
              }}
            >
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: i % 2 === 0 ? "#EC4899" : "#A855F7",
                  boxShadow: `0 0 8px 3px ${
                    i % 2 === 0 ? "rgba(236,72,153,0.6)" : "rgba(168,85,247,0.6)"
                  }`,
                }}
              />
              <span
                style={{
                  fontSize: "8px",
                  color: i >= 3 ? "#F59E0B" : "#EC4899",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  fontFamily: "monospace",
                  textShadow:
                    i >= 3 ? "0 0 8px rgba(245,158,11,0.7)" : "0 0 6px rgba(236,72,153,0.7)",
                  writingMode: "vertical-rl",
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────
          LAYER 1 – Pure Velvet Cloth Billow & Still Golden Trim
          (Thanh vàng đứng yên, Tấm vải nhung đung đưa mềm mại như tay người thướt qua)
      ────────────────────────────────────────────────────────────────────── */}

      {/* ── LEFT CURTAIN (Container anchored to ceiling, handles scroll opening) ── */}
      <div
        ref={leftCurtainContainerRef}
        onPointerDown={(e) => {
          leftCloth.current.isDragging = true;
          leftCloth.current.dragStartX = e.clientX;
          const normY = clamp(e.clientY / window.innerHeight, 0.2, 0.9);
          leftCloth.current.vShift = clamp(leftCloth.current.vShift + 1.8 * normY, -2.5, 2.5);
          leftCloth.current.vSkew = clamp(leftCloth.current.vSkew + 0.35 * normY, -0.5, 0.5);
          leftCloth.current.waveAmp = 2.5;
        }}
        onPointerEnter={(e) => {
          const normY = clamp(e.clientY / window.innerHeight, 0.2, 0.9);
          leftCloth.current.vShift = clamp(leftCloth.current.vShift + 1.2 * normY, -2.0, 2.0);
          leftCloth.current.vSkew = clamp(leftCloth.current.vSkew + 0.22 * normY, -0.35, 0.35);
          leftCloth.current.waveAmp = 2.0;
        }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "16vw",
          height: "100vh",
          transformOrigin: "left center",
          pointerEvents: "auto",
          cursor: "grab",
          zIndex: 2,
        }}
        title="Rèm nhung Starlight Cinema"
      >
        {/* TẤM VẢI NHUNG (THE VELVET CLOTH - ĐUNG ĐƯA NHẸ NHÀNG NHƯ TAY NGƯỜI THƯỚT QUA) */}
        <div
          ref={leftFabricRef}
          style={{
            position: "absolute",
            inset: 0,
            transformOrigin: "top left",
            background: `
              linear-gradient(
                90deg,
                #1a0828 0%,
                #280a3c 12%,
                #200830 18%,
                #2e0c44 26%,
                #1e0630 32%,
                #2a0a40 40%,
                #180628 48%,
                #240836 55%,
                #2e1040 65%,
                #1a0630 75%,
                #0d0418 90%,
                #06020c 100%
              )
            `,
            boxShadow:
              "8px 0 48px 8px rgba(15,5,30,0.85), inset -12px 0 32px rgba(0,0,0,0.6)",
            willChange: "transform",
          }}
        >
          {/* CÁC NẾP GẤP VẢI NHUNG GỢN SÓNG */}
          <div
            ref={leftFoldsRef}
            style={{
              position: "absolute",
              inset: 0,
              transformOrigin: "top left",
              pointerEvents: "none",
              willChange: "transform",
            }}
          >
            {[12, 30, 48, 66, 82].map((leftPct, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: `${leftPct}%`,
                  width: "3px",
                  background:
                    "linear-gradient(180deg, transparent 0%, rgba(200,100,255,0.14) 20%, rgba(160,60,220,0.09) 50%, rgba(200,100,255,0.12) 80%, transparent 100%)",
                }}
              />
            ))}
          </div>
        </div>

        {/* THANH VÀNG (GOLD STRIP / BORDER - ĐỨNG YÊN HOẶC CHỈ ĐUNG ĐƯA SIÊU NHẸ) */}
        <div
          ref={leftFringeRef}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: "5px",
            background:
              "linear-gradient(180deg, #F59E0B44 0%, #F59E0B99 30%, #F59E0B55 60%, #F59E0B22 100%)",
            boxShadow: "0 0 10px 3px rgba(245,158,11,0.25)",
            pointerEvents: "none",
            willChange: "transform",
          }}
        />

        {/* Interactive hover hint badge */}
        <div
          style={{
            position: "absolute",
            right: "-14px",
            top: "42%",
            transform: "translateX(100%)",
            opacity: isLeftHovered ? 0.85 : 0,
            transition: "opacity 0.25s ease-in-out",
            pointerEvents: "none",
            background: "rgba(19, 21, 32, 0.88)",
            border: "1px solid rgba(168, 85, 247, 0.4)",
            backdropFilter: "blur(8px)",
            borderRadius: "999px",
            padding: "3px 9px",
            fontSize: "10px",
            fontWeight: 600,
            color: "#E9D5FF",
            boxShadow: "0 4px 14px rgba(168,85,247,0.25)",
            whiteSpace: "nowrap",
          }}
        >
          ✨ Vuốt nhẹ rèm
        </div>
      </div>

      {/* ── RIGHT CURTAIN (Container anchored to ceiling, handles scroll opening) ── */}
      <div
        ref={rightCurtainContainerRef}
        onPointerDown={(e) => {
          rightCloth.current.isDragging = true;
          rightCloth.current.dragStartX = e.clientX;
          const normY = clamp(e.clientY / window.innerHeight, 0.2, 0.9);
          rightCloth.current.vShift = clamp(rightCloth.current.vShift - 1.8 * normY, -2.5, 2.5);
          rightCloth.current.vSkew = clamp(rightCloth.current.vSkew - 0.35 * normY, -0.5, 0.5);
          rightCloth.current.waveAmp = 2.5;
        }}
        onPointerEnter={(e) => {
          const normY = clamp(e.clientY / window.innerHeight, 0.2, 0.9);
          rightCloth.current.vShift = clamp(rightCloth.current.vShift - 1.2 * normY, -2.0, 2.0);
          rightCloth.current.vSkew = clamp(rightCloth.current.vSkew - 0.22 * normY, -0.35, 0.35);
          rightCloth.current.waveAmp = 2.0;
        }}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "16vw",
          height: "100vh",
          transformOrigin: "right center",
          pointerEvents: "auto",
          cursor: "grab",
          zIndex: 2,
        }}
        title="Rèm nhung Starlight Cinema"
      >
        {/* TẤM VẢI NHUNG PHẢI (THE VELVET CLOTH) */}
        <div
          ref={rightFabricRef}
          style={{
            position: "absolute",
            inset: 0,
            transformOrigin: "top right",
            background: `
              linear-gradient(
                270deg,
                #1a0828 0%,
                #280a3c 12%,
                #200830 18%,
                #2e0c44 26%,
                #1e0630 32%,
                #2a0a40 40%,
                #180628 48%,
                #240836 55%,
                #2e1040 65%,
                #1a0630 75%,
                #0d0418 90%,
                #06020c 100%
              )
            `,
            boxShadow:
              "-8px 0 48px 8px rgba(15,5,30,0.85), inset 12px 0 32px rgba(0,0,0,0.6)",
            willChange: "transform",
          }}
        >
          {/* CÁC NẾP GẤP VẢI NHUNG PHẢI */}
          <div
            ref={rightFoldsRef}
            style={{
              position: "absolute",
              inset: 0,
              transformOrigin: "top right",
              pointerEvents: "none",
              willChange: "transform",
            }}
          >
            {[12, 30, 48, 66, 82].map((leftPct, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  right: `${leftPct}%`,
                  width: "3px",
                  background:
                    "linear-gradient(180deg, transparent 0%, rgba(200,100,255,0.14) 20%, rgba(160,60,220,0.09) 50%, rgba(200,100,255,0.12) 80%, transparent 100%)",
                }}
              />
            ))}
          </div>
        </div>

        {/* THANH VÀNG PHẢI (GOLD STRIP - ĐỨNG YÊN) */}
        <div
          ref={rightFringeRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: "5px",
            background:
              "linear-gradient(180deg, #F59E0B44 0%, #F59E0B99 30%, #F59E0B55 60%, #F59E0B22 100%)",
            boxShadow: "0 0 10px 3px rgba(245,158,11,0.25)",
            pointerEvents: "none",
            willChange: "transform",
          }}
        />

        {/* Interactive hover hint badge */}
        <div
          style={{
            position: "absolute",
            left: "-14px",
            top: "42%",
            transform: "translateX(-100%)",
            opacity: isRightHovered ? 0.85 : 0,
            transition: "opacity 0.25s ease-in-out",
            pointerEvents: "none",
            background: "rgba(19, 21, 32, 0.88)",
            border: "1px solid rgba(236, 72, 153, 0.4)",
            backdropFilter: "blur(8px)",
            borderRadius: "999px",
            padding: "3px 9px",
            fontSize: "10px",
            fontWeight: 600,
            color: "#FBCFE8",
            boxShadow: "0 4px 14px rgba(236,72,153,0.25)",
            whiteSpace: "nowrap",
          }}
        >
          ✨ Vuốt nhẹ rèm
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────
          VIGNETTE – House lights dimming
      ────────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 65% 70% at 50% 38%, transparent 0%, rgba(6,4,14,${vignetteStrength}) 100%)`,
          pointerEvents: "none",
          willChange: "background",
          zIndex: 3,
        }}
      />

      {/* ──────────────────────────────────────────────────────────────────────
          LAYER 5 – Depth HUD indicator
      ────────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          left: "1.8vw",
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: "10px",
          opacity: hudOpacity,
          zIndex: 4,
          pointerEvents: "none",
          transition: "opacity 0.4s",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "4px",
            top: 0,
            bottom: 0,
            width: "2px",
            background:
              "linear-gradient(180deg, transparent, rgba(168,85,247,0.5) 20%, rgba(236,72,153,0.5) 80%, transparent)",
            borderRadius: "2px",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "1px",
            top: `${p * 100}%`,
            transform: "translateY(-50%)",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #A855F7, #EC4899)",
            boxShadow: "0 0 8px 3px rgba(168,85,247,0.6)",
            transition: "top 0.2s",
          }}
        />
        <div
          style={{
            marginLeft: "18px",
            marginTop: `${p * 220}px`,
            fontSize: "9px",
            fontFamily: "monospace",
            letterSpacing: "0.07em",
            color: "#C4B5FD",
            textShadow: "0 0 10px rgba(168,85,247,0.8)",
            whiteSpace: "nowrap",
            maxWidth: "10vw",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineHeight: "1.4",
          }}
        >
          {hudZone.label}
        </div>
      </div>
    </div>
  );
}
