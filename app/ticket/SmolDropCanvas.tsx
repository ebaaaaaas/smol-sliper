"use client";

import { useEffect, useRef } from "react";

const COLORS = {
  bg: "#000B3B",
  accent: "#B8FB3C",
  errorOverlay: "rgba(255, 60, 60, 0.22)",
  successOverlay: "rgba(184, 251, 60, 0.18)",
  text: "#FFFFFF",
};

// ====== НАСТРОЙКИ АНИМАЦИИ (ПРУЖИНА -> УДАР -> 1 ВОЛНА) ======
const CONFIG = {
  baseRings: {
    maxRadiusFactor: 0.95,
    spacing: 20,           // расстояние между статичными кольцами
    alphaCenter: 0.28,     // статичные кольца почти невидимые
    alphaEdge: 0.06,
  },

  spring: {
    coreRadius: 14,        // базовый радиус центрального кольца (px)
    pullMax: 34,           // насколько сильно "раздувается" при натяжении (px)
    pullEase: 2.4,         // крутизна натяжения (больше = резче)
    snapBack: 0.22,        // скорость возврата к базовому радиусу (0..1)
  },

  impactWave: {
    speed: 520,            // px/сек — скорость фронта волны
    width: 36,             // ширина фронта (размазанность)
    amplitude: 1.0,        // общая сила (множитель альфы)
    fade: 1.25,            // затухание по времени (больше = быстрее гаснет)
    lineWidth: 10,         // толщина колец
    alphaPeak: 0.75,       // яркость фронта на старте
  },

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

    let intensity = 0; // 0..1 (hold)
    let targetIntensity = 0;

    let redeemCalled = false;
    let frameId: number | null = null;
    let apiTimeoutId: number | null = null;

    // ===== ПРУЖИННЫЙ ИМПАКТ =====
    // coreScale: текущий "натянутый" радиус (в px добавка)
    let pullAmount = 0; // 0..pullMax
    // ударная волна: время старта (сек), активна/нет
    let impactStartSec = -999;
    let impactActive = false;

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

    function endHold(nowSec: number) {
      if (state === "holding") {
        state = "idle";
        targetIntensity = 0;

        // === ВАЖНО: "УДАР" ЗАПУСКАЕМ НА ОТПУСКАНИИ ===
        impactStartSec = nowSec;
        impactActive = true;
      }
    }

    const handlePointerDown = (e: PointerEvent) => {
      e.preventDefault();
      startHold();
    };

    const handlePointerUp = (e: PointerEvent) => {
      e.preventDefault();
      endHold(performance.now() / 1000);
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

    const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

    function drawScene(now: number) {
      const t = now / 1000;

      // фон
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      const minSide = Math.min(width, height);
      const maxRadius = minSide * CONFIG.baseRings.maxRadiusFactor;

      // ===== 0) СТАТИЧНЫЕ КОЛЬЦА КАК НА GIF =====
      const spacing = CONFIG.baseRings.spacing;
      const ringCount = Math.ceil(maxRadius / spacing) + 2;

      for (let i = 1; i < ringCount; i++) {
        const r = i * spacing;
        const fade = 1 - r / maxRadius;

        const alpha =
          CONFIG.baseRings.alphaEdge +
          (CONFIG.baseRings.alphaCenter - CONFIG.baseRings.alphaEdge) * fade;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.lineWidth = CONFIG.impactWave.lineWidth * 0.55;
        ctx.strokeStyle = COLORS.accent;
        ctx.globalAlpha = alpha;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
      }

      // ===== 1) НАТЯЖЕНИЕ ЦЕНТРА (holding) =====
      // Натяжение: по мере удержания растет pullAmount, но нелинейно (резко)
      const pullMax = CONFIG.spring.pullMax;

      if (state === "holding") {
        const u = clamp01(holdProgress);
        const eased = Math.pow(u, CONFIG.spring.pullEase); // резкий рост к концу
        pullAmount = pullMax * eased;
      } else {
        // Возврат к базе
        pullAmount += (0 - pullAmount) * CONFIG.spring.snapBack;
      }

      const coreRadius = CONFIG.spring.coreRadius + pullAmount;

      // Центральное кольцо
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
      ctx.lineWidth = CONFIG.impactWave.lineWidth;
      ctx.strokeStyle = COLORS.accent;
      ctx.globalAlpha = 0.85;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();

      // ===== 2-3) УДАРНАЯ ВОЛНА (ОДНА) =====
      if (impactActive) {
        const elapsed = t - impactStartSec; // сек после удара
        if (elapsed >= 0) {
          const front = coreRadius + elapsed * CONFIG.impactWave.speed;

          // если ушло за предел — выключаем
          if (front > maxRadius + CONFIG.impactWave.width * 2) {
            impactActive = false;
          } else {
            // затухание по времени + немного по расстоянию
            const timeFade = Math.exp(-CONFIG.impactWave.fade * elapsed);
            const distFade = 1 - Math.min(1, front / maxRadius);

            const baseAlpha =
              CONFIG.impactWave.alphaPeak *
              CONFIG.impactWave.amplitude *
              timeFade *
              (0.55 + 0.45 * distFade);

            // рисуем фронт + лёгкий хвост (2 кольца)
            for (let k = 0; k < 3; k++) {
              const r = front - k * CONFIG.impactWave.width * 0.55;
              if (r <= coreRadius) continue;

              const a = baseAlpha * (1 - k * 0.35);
              if (a <= 0.01) continue;

              ctx.save();
              ctx.beginPath();
              ctx.arc(cx, cy, r, 0, Math.PI * 2);
              ctx.lineWidth = CONFIG.impactWave.lineWidth * (1 - k * 0.12);
              ctx.strokeStyle = COLORS.accent;
              ctx.globalAlpha = a;
              ctx.lineCap = "round";
              ctx.stroke();
              ctx.restore();
            }
          }
        }
      }

      // ===== ПРОГРЕСС УДЕРЖАНИЯ =====
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

      // ===== СОСТОЯНИЯ =====
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