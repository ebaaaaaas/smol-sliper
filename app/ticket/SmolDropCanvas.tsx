"use client";

import { useEffect, useRef } from "react";

const COLORS = {
  bg: "#000000",
  rings: "#FFFFFF",
  errorOverlay: "rgba(255, 60, 60, 0.22)",
  successOverlay: "rgba(184, 251, 60, 0.18)",
  text: "#FFFFFF",
};

const CONFIG = {
  // РАДАР/СОНАР
  spacing: 70, // px между кольцами
  speed: 260, // px/сек (строго линейно)
  lineWidth: 8, // толщина линии
  alpha: 1.0, // без fade
  extraRings: 3, // запас колец за диагональ

  // удержание (оставил из твоей логики)
  holdDurationMs: 800,

  progress: {
    radiusFactor: 0.16,
    lineWidthBase: 3,
    lineWidthBoost: 2,
  },
};

type CanvasState = "idle" | "holding" | "pending" | "success" | "error";

export function SmolDropCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;

    let state: CanvasState = "idle";
    let holdStart = 0;
    let holdProgress = 0;

    let intensity = 0; // 0..1 (для толщины прогресс-кольца)
    let targetIntensity = 0;

    let redeemCalled = false;
    let frameId: number | null = null;
    let apiTimeoutId: number | null = null;

    const preventDefault = (e: Event) => e.preventDefault();
    window.addEventListener("contextmenu", preventDefault);
    document.addEventListener("selectstart", preventDefault);

    const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
    const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

    function resize() {
      // TS-safe: проверяем реф каждый раз (на случай размонтирования)
      const c = canvasRef.current;
      if (!c) return;

      dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;

      c.width = Math.floor(width * dpr);
      c.height = Math.floor(height * dpr);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    window.addEventListener("resize", resize);
    resize();

    function drawLabel(text: string, cx: number, cy: number) {
      ctx.save();
      ctx.font =
        "500 16px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = COLORS.text;
      ctx.globalAlpha = 0.9;
      ctx.fillText(text, cx, cy);
      ctx.restore();
    }

    function onRedeem() {
      if (redeemCalled) return;
      redeemCalled = true;
      state = "pending";

      // TODO: реальный API-вызов
      apiTimeoutId = window.setTimeout(() => {
        const ok = true; // заменить на реальный результат
        state = ok ? "success" : "error";
        targetIntensity = ok ? 0.6 : 0.2;
      }, 400);
    }

    function startHold() {
      if (state === "success" || state === "pending") return;
      state = "holding";
      holdStart = performance.now();
      holdProgress = 0;
      targetIntensity = 1;
      redeemCalled = false;
    }

    function endHold() {
      if (state === "holding") {
        state = "idle";
        targetIntensity = 0;
      }
    }

    const handlePointerDown = (e: PointerEvent) => {
      e.preventDefault();
      startHold();
    };

    const handlePointerUp = (e: PointerEvent) => {
      e.preventDefault();
      endHold();
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerUp);
    canvas.addEventListener("pointerleave", handlePointerUp);

    function drawScene(now: number) {
      const t = now / 1000;

      // фон
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      // диагональный радиус до угла, чтобы кольца исчезали за границей кадра
      const maxR = Math.hypot(cx, cy);

      const s = CONFIG.spacing;
      const v = CONFIG.speed;
      const w = CONFIG.lineWidth;

      // линейная фаза, бесшовный луп
      const base = (v * t) % s;

      // количество колец, чтобы закрыть весь кадр + запас
      const ringCount = Math.ceil(maxR / s) + CONFIG.extraRings;

      ctx.save();
      ctx.strokeStyle = COLORS.rings;
      ctx.lineWidth = w;
      ctx.lineCap = "round";
      ctx.globalAlpha = CONFIG.alpha;

      for (let i = 0; i < ringCount; i++) {
        const r = base + i * s;
        if (r > maxR + w) continue;

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();

      // прогресс удержания
      if (holdProgress > 0.01) {
        const progAngle = holdProgress * Math.PI * 2;
        const minSide = Math.min(width, height);
        const progRadius = minSide * CONFIG.progress.radiusFactor;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, progRadius, -Math.PI / 2, -Math.PI / 2 + progAngle);
        ctx.lineWidth =
          CONFIG.progress.lineWidthBase +
          CONFIG.progress.lineWidthBoost * intensity;
        ctx.strokeStyle = COLORS.rings;
        ctx.globalAlpha = 0.95;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
      }

      // состояния
      if (state === "success") {
        ctx.save();
        ctx.fillStyle = COLORS.successOverlay;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
        drawLabel("Билет погашён", cx, cy);
      } else if (state === "error") {
        ctx.save();
        ctx.fillStyle = COLORS.errorOverlay;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
        drawLabel("Ошибка", cx, cy);
      } else if (state === "pending") {
        drawLabel("Проверка…", cx, cy);
      }
    }

    function loop(now: number) {
      if (state === "holding") {
        const elapsed = now - holdStart;
        holdProgress = clamp01(elapsed / CONFIG.holdDurationMs);
        if (holdProgress >= 1 && !redeemCalled) onRedeem();
      } else {
        // мягко гасим прогресс-кольцо
        holdProgress += (0 - holdProgress) * 0.15;
      }

      intensity = lerp(intensity, targetIntensity, 0.08);

      drawScene(now);
      frameId = requestAnimationFrame(loop);
    }

    frameId = requestAnimationFrame(loop);

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      if (apiTimeoutId !== null) window.clearTimeout(apiTimeoutId);

      window.removeEventListener("resize", resize);

      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerUp);
      canvas.removeEventListener("pointerleave", handlePointerUp);

      window.removeEventListener("contextmenu", preventDefault);
      document.removeEventListener("selectstart", preventDefault);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100vw",
        height: "100vh",
        display: "block",
        touchAction: "none",
      }}
    />
  );
}
