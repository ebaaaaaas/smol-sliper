"use client";

import { useEffect, useRef } from "react";

const COLORS = {
  bg: "#000B3B",
  accent: "#B8FB3C",
  errorOverlay: "rgba(255, 60, 60, 0.22)",
  successOverlay: "rgba(184, 251, 60, 0.18)",
  text: "#FFFFFF",
};

// ====== НАСТРОЙКИ АНИМАЦИИ (КАПЛЯ + ВОЛНА) ======
const CONFIG = {
  waves: {
    maxRadiusFactor: 0.95,   // докуда доходят кольца (0.95 ~ почти до краёв)
    spacing: 34,             // базовое расстояние между кольцами (px)
    speedIdle: 110,          // скорость волны в покое (px/сек)
    speedActive: 190,        // скорость волны при удержании
    lineWidthIdle: 6,        // толщина колец в покое
    lineWidthActive: 10,     // толщина при удержании

    // параметры "ударной волны"
    pulseAmplitudeIdle: 22,  // деформация колец в покое (px)
    pulseAmplitudeActive: 42,// деформация при удержании (px)
    pulseWidth: 120,         // ширина области деформации вдоль радиуса (чем больше — мягче)
    distortionFrequency: 2.6,// внутренняя частота колебаний внутри волны

    alphaCenter: 0.9,        // яркость ближе к центру
    alphaEdge: 0.12,         // яркость у края
  },
  progress: {
    radiusFactor: 0.16,      // радиус кольца прогресса относительно min(width,height)
    lineWidthBase: 3,
    lineWidthBoost: 2,
  },
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
    let intensity = 0; // 0 = idle, 1 = hold
    let targetIntensity = 0;
    let redeemCalled = false;
    let frameId: number | null = null;
    let apiTimeoutId: number | null = null;

    // iOS: вырубаем контекстное меню / выделение
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

    function drawScene(now: number) {
      const t = now / 1000; // секунды

      // фон
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      const minSide = Math.min(width, height);
      const maxRadius = minSide * CONFIG.waves.maxRadiusFactor;

      const spacing = CONFIG.waves.spacing;

      // базовый статический центральный круг (как точка удара)
      const coreRadius = spacing * 0.7;

      // толщина колец и параметры волны от интенсивности
      const lineWidth =
        CONFIG.waves.lineWidthIdle +
        (CONFIG.waves.lineWidthActive - CONFIG.waves.lineWidthIdle) *
          intensity;

      const waveSpeed =
        CONFIG.waves.speedIdle +
        (CONFIG.waves.speedActive - CONFIG.waves.speedIdle) * intensity;

      const pulseAmplitude =
        CONFIG.waves.pulseAmplitudeIdle +
        (CONFIG.waves.pulseAmplitudeActive -
          CONFIG.waves.pulseAmplitudeIdle) *
          intensity;

      const sigma = CONFIG.waves.pulseWidth;
      const omega = CONFIG.waves.distortionFrequency * 2 * Math.PI;

      // рисуем статичное центральное кольцо
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = COLORS.accent;
      ctx.globalAlpha = 0.9;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();

      // положение фронта волны (как капля, бегущая наружу)
      const front =
        (t * waveSpeed) % (maxRadius + spacing + sigma * 2);

      // сколько колец нужно
      const ringCount = Math.ceil(maxRadius / spacing) + 6;

      // -------- ОСНОВНЫЕ КОЛЬЦА С ДЕФОРМАЦИЕЙ --------
      for (let i = 0; i < ringCount; i++) {
        const baseR = coreRadius + i * spacing;
        if (baseR <= 0 || baseR > maxRadius + sigma) continue;

        // расстояние кольца от фронта волны
        const dist = baseR - front;

        // гауссово затухание деформации вокруг фронта
        const gauss = Math.exp(
          -((dist * dist) / (2 * sigma * sigma))
        );

        // локальное колебание (сжатие/расширение)
        const oscillation = Math.sin(dist / sigma - t * omega);

        const offset = pulseAmplitude * gauss * oscillation;

        const radius = baseR + offset;
        if (radius <= coreRadius || radius > maxRadius) continue;

        const fade = 1 - radius / maxRadius;
        if (fade <= 0.02) continue;

        const alpha =
          CONFIG.waves.alphaEdge +
          (CONFIG.waves.alphaCenter - CONFIG.waves.alphaEdge) *
            fade;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = COLORS.accent;
        ctx.globalAlpha = alpha * (0.8 + 0.2 * intensity);
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
      }

      // -------- КОЛЬЦО ПРОГРЕССА УДЕРЖАНИЯ --------
      if (holdProgress > 0.01) {
        const progAngle = holdProgress * Math.PI * 2;
        const progRadius = minSide * CONFIG.progress.radiusFactor;

        ctx.save();
        ctx.beginPath();
        ctx.arc(
          cx,
          cy,
          progRadius,
          -Math.PI / 2,
          -Math.PI / 2 + progAngle
        );
        ctx.lineWidth =
          CONFIG.progress.lineWidthBase +
          CONFIG.progress.lineWidthBoost * intensity;
        ctx.strokeStyle = COLORS.accent;
        ctx.globalAlpha = 0.95;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
      }

      // -------- СОСТОЯНИЯ --------
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
        holdProgress = Math.min(1, elapsed / HOLD_DURATION);
        if (holdProgress === 1 && !redeemCalled) {
          onRedeem();
        }
      } else {
        holdProgress += (0 - holdProgress) * 0.15;
      }

      // плавная интерполяция интенсивности
      intensity += (targetIntensity - intensity) * 0.08;

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
