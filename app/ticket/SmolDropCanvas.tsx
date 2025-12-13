"use client";

import { useEffect, useRef } from "react";

const COLORS = {
  bg: "#000B3B",
  accent: "#B8FB3C",
  errorOverlay: "rgba(255, 60, 60, 0.22)",
  successOverlay: "rgba(184, 251, 60, 0.18)",
  text: "#FFFFFF",
};

// ====== НАСТРОЙКИ АНИМАЦИИ (АВТО-УДАР -> ВОЛНА) ======
const CONFIG = {
  baseRings: {
    maxRadiusFactor: 0.95,
    spacing: 20,
    alphaCenter: 0.22,
    alphaEdge: 0.06,
  },

  auto: {
    cycleSec: 2.0,        // полный цикл (натяжение+удар+затухание)
    pullPortion: 0.32,    // доля цикла на натяжение (0..1)
    pausePortion: 0.06,   // микро-пауза после удара (0..1)
  },

  spring: {
    coreRadius: 14,
    pullMaxIdle: 30,      // насколько раздувается в idle
    pullMaxActive: 44,    // насколько раздувается при удержании
    pullEase: 2.6,        // резкость натяжения
    snapBack: 0.22,
  },

  impactWave: {
    speedIdle: 520,
    speedActive: 720,
    width: 36,
    fade: 1.15,           // меньше = дольше живёт волна
    lineWidthIdle: 10,
    lineWidthActive: 12,
    alphaPeakIdle: 0.7,
    alphaPeakActive: 0.9,
    trailCount: 3,
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

    // чтобы не запускать удар дважды на одном цикле
    let lastImpactIndex = -1;

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

    const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

    function lerp(a: number, b: number, k: number) {
      return a + (b - a) * k;
    }

    function drawScene(now: number) {
      const t = now / 1000;

      // фон
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      const minSide = Math.min(width, height);
      const maxRadius = minSide * CONFIG.baseRings.maxRadiusFactor;

      // ====== СТАТИЧНЫЕ КОЛЬЦА-ФОН ======
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
        ctx.lineWidth = lerp(CONFIG.impactWave.lineWidthIdle, CONFIG.impactWave.lineWidthActive, intensity) * 0.55;
        ctx.strokeStyle = COLORS.accent;
        ctx.globalAlpha = alpha;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
      }

      // ====== АВТОЦИКЛ (натяжение -> удар -> волна) ======
      const cycle = CONFIG.auto.cycleSec;
      const p = (t % cycle) / cycle; // 0..1

      const pullPortion = CONFIG.auto.pullPortion;
      const pausePortion = CONFIG.auto.pausePortion;

      // как сильно тянем в этом цикле
      let pull = 0; // 0..1
      if (p < pullPortion) {
        const u = clamp01(p / pullPortion);
        pull = Math.pow(u, CONFIG.spring.pullEase); // резкий рост к концу
      } else {
        pull = 0;
      }

      const pullMax = lerp(CONFIG.spring.pullMaxIdle, CONFIG.spring.pullMaxActive, intensity);
      const coreRadius = CONFIG.spring.coreRadius + pullMax * pull;

      // ====== центральное кольцо (манит) ======
      const coreLineWidth = lerp(CONFIG.impactWave.lineWidthIdle, CONFIG.impactWave.lineWidthActive, intensity);

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
      ctx.lineWidth = coreLineWidth;
      ctx.strokeStyle = COLORS.accent;
      // в конце натяжения чуть ярче
      ctx.globalAlpha = 0.75 + 0.20 * pull;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();

      // ====== МОМЕНТ УДАРА (один раз на цикл) ======
      // удар происходит сразу после pullPortion + pausePortion (микро-пауза)
      const impactPhase = pullPortion + pausePortion;
      const cycleIndex = Math.floor(t / cycle);

      // Запоминаем, что удар в этом цикле уже "сработал"
      // (нужно только для синхронизации, чтобы не было дребезга)
      if (p >= impactPhase && lastImpactIndex !== cycleIndex) {
        lastImpactIndex = cycleIndex;
      }

      // ====== ВОЛНА: видна только после удара, и угасает до конца цикла ======
      if (p >= impactPhase) {
        const post = clamp01((p - impactPhase) / (1 - impactPhase)); // 0..1
        const elapsed = post * (cycle * (1 - impactPhase)); // сек с удара

        const waveSpeed = lerp(CONFIG.impactWave.speedIdle, CONFIG.impactWave.speedActive, intensity);
        const front = coreRadius + elapsed * waveSpeed;

        // затухание по времени, чтобы к концу цикла почти пропала
        const fadeTime = Math.exp(-CONFIG.impactWave.fade * elapsed);

        const alphaPeak = lerp(CONFIG.impactWave.alphaPeakIdle, CONFIG.impactWave.alphaPeakActive, intensity);
        const baseAlpha = alphaPeak * fadeTime;

        if (front < maxRadius + CONFIG.impactWave.width * 2 && baseAlpha > 0.01) {
          for (let k = 0; k < CONFIG.impactWave.trailCount; k++) {
            const r = front - k * CONFIG.impactWave.width * 0.55;
            if (r <= coreRadius) continue;

            const a = baseAlpha * (1 - k * 0.35);
            if (a <= 0.01) continue;

            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.lineWidth = coreLineWidth * (1 - k * 0.10);
            ctx.strokeStyle = COLORS.accent;
            ctx.globalAlpha = a;
            ctx.lineCap = "round";
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      // ===== ПРОГРЕСС УДЕРЖАНИЯ (твой redeem) =====
      if (holdProgress > 0.01) {
        const progAngle = holdProgress * Math.PI * 2;
        const progRadius = minSide * CONFIG.progress.radiusFactor;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, progRadius, -Math.PI / 2, -Math.PI / 2 + progAngle);
        ctx.lineWidth =
          CONFIG.progress.lineWidthBase + CONFIG.progress.lineWidthBoost * intensity;
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