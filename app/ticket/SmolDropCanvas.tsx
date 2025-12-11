"use client";

import { useEffect, useRef } from "react";

const COLORS = {
  bg: "#000B3B",
  accent: "#B8FB3C",
  errorOverlay: "rgba(255, 60, 60, 0.22)",
  successOverlay: "rgba(184, 251, 60, 0.18)",
  text: "#FFFFFF",
};

type CanvasState = "idle" | "holding" | "pending" | "success" | "error";

export function SmolDropCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current as HTMLCanvasElement;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;

    const HOLD_DURATION = 800;

    let state: CanvasState = "idle";
    let holdStart = 0;
    let holdProgress = 0;
    let intensity = 0;
    let targetIntensity = 0;
    let lastTime = performance.now();
    let redeemCalled = false;
    let frameId: number | null = null;
    let apiTimeoutId: number | null = null;

    // iOS: вырубаем контекстное меню / селект
    const preventDefault = (e: Event) => e.preventDefault();
    window.addEventListener("contextmenu", preventDefault);
    document.addEventListener("selectstart", preventDefault);

    function resize() {
      dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener("resize", resize);

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

    // ---------- ВОЛНЫ ОТ ЦЕНТРА ----------
        function drawScene(t: number) {
      // фон
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, width, height);

      // центр экрана
      const cx = width / 2;
      const cy = height / 2;

      const maxRadius = Math.min(width, height) * 0.5;

      // -------- ПАРАМЕТРЫ СЕРДЦЕБИЕНИЯ --------

      // базовый период удара (сек)
      const basePeriod = 1.5; // ~60 ударов в минуту
      // при удержании бьётся чаще (до ~70–80)
      const heartbeatPeriod = basePeriod * (1 - 0.35 * intensity);
      const heartbeatPhase = t / heartbeatPeriod;           // растёт постоянно
      const beatPhase = heartbeatPhase - Math.floor(heartbeatPhase); // 0..1 внутри одного удара

      // плавный "удар": резкий пик и затухание
      // sin(π * x) даёт 0 → пик → 0 за один цикл
      const s = Math.sin(Math.PI * beatPhase); // 0..1..0
      const pulse = Math.max(0, s * s * s);    // подчёркиваем пик

      // -------- ЦЕНТРАЛЬНЫЙ КРУГ (СЕРДЦЕ) --------

      const baseCoreRadius = maxRadius * 0.09;
      const coreRadius = baseCoreRadius * (1 + 0.35 * pulse); // "ёкает"

      const baseLineWidth = 4 + intensity * 4; // общая толщина линий

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
      ctx.lineWidth = baseLineWidth;
      ctx.strokeStyle = COLORS.accent;
      ctx.globalAlpha = 0.7 + 0.3 * pulse; // ярче в момент удара
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();

      // лёгкий внутренний диск при пике — ощущение "удара"
      if (pulse > 0.1) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, coreRadius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.accent;
        ctx.globalAlpha = 0.15 + 0.35 * pulse;
        ctx.fill();
        ctx.restore();
      }

         // -------- ПОСТОЯННЫЕ ВОЛНЫ ОТ ЦЕНТРА --------
    // волны больше НЕ завязаны на heartbeatPhase — только на времени t
    const waveCount = 16; // сколько колец одновременно видно
    const waveSpeedBase = 0.25 + 0.4 * intensity; // скорость движения волн

    const waveLineWidth = baseLineWidth * 1.0; // толщина линий

    for (let i = 0; i < waveCount; i++) {
      // phase: 0..1 — где сейчас волна между центром и краем
      const phase = (t * waveSpeedBase + i / waveCount) % 1; // равномерный "поезд"
      const radius = coreRadius + phase * (maxRadius - coreRadius);

      const fade = 1 - phase; // ближе к центру — ярче
      if (fade <= 0.03) continue;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.lineWidth = waveLineWidth * (0.9 + 0.1 * fade);
      ctx.strokeStyle = COLORS.accent;
      ctx.globalAlpha =
        (0.12 + 0.55 * fade) * (0.7 + 0.3 * intensity); // чуть ярче при удержании
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();
    }


      // -------- ПРОГРЕСС УДЕРЖАНИЯ --------
      if (holdProgress > 0.01) {
        const progAngle = holdProgress * Math.PI * 2;
        const progRadius = coreRadius * 1.8;

        ctx.save();
        ctx.beginPath();
        ctx.arc(
          cx,
          cy,
          progRadius,
          -Math.PI / 2,
          -Math.PI / 2 + progAngle
        );
        ctx.lineWidth = 3 + 2 * intensity;
        ctx.strokeStyle = COLORS.accent;
        ctx.globalAlpha = 0.95;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
      }

      // -------- СОСТОЯНИЯ SUCCESS / ERROR / PENDING --------
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
      const t = now / 1000;
      lastTime = now;

      if (state === "holding") {
        const elapsed = now - holdStart;
        holdProgress = Math.min(1, elapsed / HOLD_DURATION);
        if (holdProgress === 1 && !redeemCalled) {
          onRedeem();
        }
      } else {
        holdProgress += (0 - holdProgress) * 0.15;
      }

      intensity += (targetIntensity - intensity) * 0.08;

      drawScene(t);

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