"use client";

import { useEffect, useRef } from "react";

const COLORS = {
  bg: "#000B3B",
  accent: "#B8FB3C",
  errorOverlay: "rgba(255, 60, 60, 0.22)",
  successOverlay: "rgba(184, 251, 60, 0.18)",
  text: "#FFFFFF",
};

// ====== ВСЕ НАСТРОЙКИ АНИМАЦИИ ТУТ ======
const CONFIG = {
  pulse: {
    enabled: true,          // выключить "сердцебиение" центра → false
    basePeriod: 1.4,        // чем БОЛЬШЕ — тем медленнее ритм
    activeFactor: 0.7,      // при удержании период *= activeFactor (0.7 = чуть быстрее)
    radiusFactor: 0.09,     // размер центрального круга относительно экрана
    pulseScale: 0.35,       // насколько сильно "раздувается" круг при ударе
  },
  waves: {
    count: 18,              // СКОЛЬКО колец одновременно видно
    maxRadiusFactor: 0.55,  // докуда они доходят (0.55 ~ чуть не до краёв)
    speedIdle: 0.18,        // скорость в покое (меньше → медленнее)
    speedActive: 0.45,      // скорость при удержании (больше → быстрее)
    lineWidthIdle: 4,       // толщина волн в покое
    lineWidthActive: 7,     // толщина при удержании
    alphaCenter: 0.7,       // яркость волн ближе к центру
    alphaEdge: 0.08,        // яркость у края
  },
  progress: {
    radiusMultiplier: 1.8,  // радиус кольца прогресса относительно coreRadius
    lineWidthBase: 3,
    lineWidthBoost: 2,
  },
};
// ====== КОНЕЦ НАСТРОЕК ======

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
    let intensity = 0;        // 0 = idle, 1 = hold
    let targetIntensity = 0;
    let lastTime = performance.now();
    let redeemCalled = false;
    let frameId: number | null = null;
    let apiTimeoutId: number | null = null;

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

      apiTimeoutId = window.setTimeout(() => {
        const ok = true; // TODO: заменить на реальный результат API
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
      const t = now / 1000;

      // фон
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      const maxRadius =
        Math.min(width, height) * CONFIG.waves.maxRadiusFactor;

      // -------- СЕРДЕЧНЫЙ РИТМ ЦЕНТРА --------
      let coreRadius = maxRadius * CONFIG.pulse.radiusFactor;
      let pulse = 0;

      if (CONFIG.pulse.enabled) {
        const basePeriod = CONFIG.pulse.basePeriod;
        const heartbeatPeriod =
          basePeriod *
          (1 - (1 - CONFIG.pulse.activeFactor) * intensity); // чуть быстрее при hold

        const heartbeatPhase = t / heartbeatPeriod;
        const beatPhase = heartbeatPhase - Math.floor(heartbeatPhase); // 0..1

        const s = Math.sin(Math.PI * beatPhase);
        pulse = Math.max(0, s * s * s);

        coreRadius =
          coreRadius * (1 + CONFIG.pulse.pulseScale * pulse);
      }

      const baseLineWidth =
        CONFIG.waves.lineWidthIdle +
        (CONFIG.waves.lineWidthActive - CONFIG.waves.lineWidthIdle) *
          intensity;

      // центральное кольцо
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
      ctx.lineWidth = baseLineWidth;
      ctx.strokeStyle = COLORS.accent;
      ctx.globalAlpha = 0.7 + 0.3 * pulse;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();

      // небольшой заполнитель внутри (опционально)
      if (pulse > 0.1) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, coreRadius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.accent;
        ctx.globalAlpha = 0.12 + 0.25 * pulse;
        ctx.fill();
        ctx.restore();
      }

      // -------- БЕСКОНЕЧНЫЕ ВОЛНЫ ОТ ЦЕНТРА --------
      const waveSpeed =
        CONFIG.waves.speedIdle +
        (CONFIG.waves.speedActive - CONFIG.waves.speedIdle) *
          intensity;

      const waveCount = CONFIG.waves.count;

      for (let i = 0; i < waveCount; i++) {
        const phase = (t * waveSpeed + i / waveCount) % 1; // 0..1
        const radius =
          coreRadius + phase * (maxRadius - coreRadius);

        const fade = 1 - phase;
        if (fade <= 0.02) continue;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.lineWidth = baseLineWidth * (0.9 + 0.1 * fade);
        const alpha =
          CONFIG.waves.alphaEdge +
          (CONFIG.waves.alphaCenter - CONFIG.waves.alphaEdge) *
            fade;
        ctx.strokeStyle = COLORS.accent;
        ctx.globalAlpha =
          alpha * (0.7 + 0.3 * intensity); // ярче при удержании
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
      }

      // -------- ПРОГРЕСС УДЕРЖАНИЯ --------
      if (holdProgress > 0.01) {
        const progAngle = holdProgress * Math.PI * 2;
        const progRadius =
          coreRadius * CONFIG.progress.radiusMultiplier;

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
      const t = now;

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