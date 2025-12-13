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

const CONFIG = {
  rings: {
    maxRadiusFactor: 0.95,
    spacing: 20,
    lineWidth: 6,
    alphaCenter: 0.22,
    alphaEdge: 0.06,
  },

  auto: {
    cycleSec: 2.2,
    pullPortion: 0.34,
    pausePortion: 0.06,
  },

  spring: {
    coreRadius: 14,
    pullMaxIdle: 28,
    pullMaxActive: 40,
    pullEase: 2.8,
  },

  shock: {
    speedIdle: 240,
    speedActive: 320,
    width: 90,
    compressIdle: 10,
    compressActive: 16,
    fade: 0.85,
    lineWidthIdle: 10,
    lineWidthActive: 12,
    alphaPeakIdle: 0.72,
    alphaPeakActive: 0.9,
  },

  progress: {
    radiusFactor: 0.16,
    lineWidthBase: 3,
    lineWidthBoost: 2,
  },
};

export function SmolDropCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // ✅ фиксируем не-null на старте эффекта
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const rawCtx = canvasEl.getContext("2d");
    if (!rawCtx) return;

    const ctx = rawCtx as CanvasRenderingContext2D;

    let width = 0;
    let height = 0;
    let dpr = 1;

    const HOLD_DURATION = 800;

    let state: CanvasState = "idle";
    let holdStart = 0;
    let holdProgress = 0;

    let intensity = 0; // 0..1
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

      // ✅ используем только canvasEl (не-null)
      canvasEl.width = Math.floor(width * dpr);
      canvasEl.height = Math.floor(height * dpr);
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

    canvasEl.addEventListener("pointerdown", handlePointerDown);
    canvasEl.addEventListener("pointerup", handlePointerUp);
    canvasEl.addEventListener("pointercancel", handlePointerUp);
    canvasEl.addEventListener("pointerleave", handlePointerUp);

    const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
    const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

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

      const minSide = Math.min(width, height);
      const maxRadius = minSide * CONFIG.rings.maxRadiusFactor;

      // автоцикл
      const cycle = CONFIG.auto.cycleSec;
      const p = (t % cycle) / cycle;
      const pullPortion = CONFIG.auto.pullPortion;
      const impactPhase = pullPortion + CONFIG.auto.pausePortion;

      // натяжение
      let pull = 0;
      if (p < pullPortion) {
        const u = clamp01(p / pullPortion);
        pull = Math.pow(u, CONFIG.spring.pullEase);
      }

      const pullMax = lerp(CONFIG.spring.pullMaxIdle, CONFIG.spring.pullMaxActive, intensity);
      const coreRadius = CONFIG.spring.coreRadius + pullMax * pull;

      // волна после удара (одна)
      let shockFront = -1;
      let shockAlpha = 0;

      const shockSpeed = lerp(CONFIG.shock.speedIdle, CONFIG.shock.speedActive, intensity);
      const compress = lerp(CONFIG.shock.compressIdle, CONFIG.shock.compressActive, intensity);
      const shockLineWidth = lerp(CONFIG.shock.lineWidthIdle, CONFIG.shock.lineWidthActive, intensity);
      const shockAlphaPeak = lerp(CONFIG.shock.alphaPeakIdle, CONFIG.shock.alphaPeakActive, intensity);

      if (p >= impactPhase) {
        const post = clamp01((p - impactPhase) / (1 - impactPhase));
        const elapsed = post * (cycle * (1 - impactPhase));

        shockFront = coreRadius + elapsed * shockSpeed;
        shockAlpha = shockAlphaPeak * Math.exp(-CONFIG.shock.fade * elapsed);
      }

      // деформация колец (сжатие возле фронта без задвоения)
      const sigma = CONFIG.shock.width;

      function deformRadius(baseR: number): number {
        let dr = 0;

        // pull: ближние кольца чуть раздвигаются
        if (pull > 0.001) {
          const d = baseR - coreRadius;
          const env = Math.exp(-(d * d) / (2 * 140 * 140));
          dr += pullMax * pull * env * 0.35;
        }

        // shock: локально "съезжаются" (чуть внутрь) вокруг фронта
        if (shockFront > 0 && shockAlpha > 0.001) {
          const dist = baseR - shockFront;
          const env = Math.exp(-(dist * dist) / (2 * sigma * sigma));
          dr += -compress * env * shockAlpha;
        }

        return baseR + dr;
      }

      // кольца
      const spacing = CONFIG.rings.spacing;
      const ringCount = Math.ceil(maxRadius / spacing) + 4;

      for (let i = 1; i < ringCount; i++) {
        const baseR = i * spacing;
        const r = deformRadius(baseR);
        if (r <= coreRadius * 0.7 || r > maxRadius) continue;

        const fade = 1 - r / maxRadius;
        const alpha =
          CONFIG.rings.alphaEdge +
          (CONFIG.rings.alphaCenter - CONFIG.rings.alphaEdge) * fade;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.lineWidth = CONFIG.rings.lineWidth;
        ctx.strokeStyle = COLORS.accent;
        ctx.globalAlpha = alpha;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
      }

      // центральное кольцо
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
      ctx.lineWidth = shockLineWidth;
      ctx.strokeStyle = COLORS.accent;
      ctx.globalAlpha = 0.78 + 0.18 * pull;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();

      // одна четкая волна (одно кольцо фронта)
      if (shockFront > 0 && shockAlpha > 0.01 && shockFront < maxRadius + sigma) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, shockFront, 0, Math.PI * 2);
        ctx.lineWidth = shockLineWidth;
        ctx.strokeStyle = COLORS.accent;
        ctx.globalAlpha = shockAlpha;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
      }

      // прогресс удержания
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

      intensity += (targetIntensity - intensity) * 0.08;

      drawScene(now);
      frameId = requestAnimationFrame(loop);
    }

    frameId = requestAnimationFrame(loop);

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      if (apiTimeoutId !== null) window.clearTimeout(apiTimeoutId);
      window.removeEventListener("resize", resize);

      canvasEl.removeEventListener("pointerdown", handlePointerDown);
      canvasEl.removeEventListener("pointerup", handlePointerUp);
      canvasEl.removeEventListener("pointercancel", handlePointerUp);
      canvasEl.removeEventListener("pointerleave", handlePointerUp);

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
