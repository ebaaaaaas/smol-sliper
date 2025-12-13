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
  // расстояние между кольцами (px)
  spacing: 70,

  // скорость расширения колец (px/сек)
  speed: 260,

  // толщина линии колец (px)
  lineWidth: 8,

  // прозрачность колец (константа, без fade)
  alpha: 1.0,

  // сколько колец рисовать "с запасом"
  extraRings: 3,

  progress: {
    radiusFactor: 0.16,
    lineWidthBase: 3,
    lineWidthBoost: 2,
  },

  auto: {
    holdDurationMs: 800,
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

    let intensity = 0; // для прогресс-кольца
    let targetIntensity = 0;

    let redeemCalled = false;
    let frameId: number | null = null;
    let apiTimeoutId: number | null = null;

    const HOLD_DURATION = CONFIG.auto.holdDurationMs;

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

      apiTimeoutId = window.setTimeout(() => {
        const ok = true;
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

    const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

    function drawScene(now: number) {
      const t = now / 1000;

      // фон
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      // максимальный радиус до угла (чтобы кольца уходили за диагональ)
      const maxR = Math.hypot(cx, cy);

      const s = CONFIG.spacing;
      const v = CONFIG.speed;
      const w = CONFIG.lineWidth;

      // базовый сдвиг — линейный, без easing
      const base = (v * t) % s;

      // сколько колец надо, чтобы заполнить до maxR
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

      // прогресс удержания (оставил как в твоём коде)
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
        holdProgress = Math.min(1, elapsed / HOLD_DURATION);
        if (holdProgress === 1 && !redeemCalled) onRedeem();
      } else {
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
