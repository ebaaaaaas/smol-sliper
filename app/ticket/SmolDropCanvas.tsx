"use client";

import { useEffect, useRef } from "react";

const COLORS = {
  bg: "#000B3B",
  accent: "#B8FB3C",
  errorOverlay: "rgba(255, 60, 60, 0.22)",
  successOverlay: "rgba(184, 251, 60, 0.18)",
  text: "#FFFFFF",
};

// ====== НАСТРОЙКИ (ПРУЖИНА -> УДАР -> ВОЛНА + ДЕФОРМАЦИЯ КОЛЕЦ) ======
const CONFIG = {
  rings: {
    maxRadiusFactor: 0.95,
    spacing: 20,
    // базовая видимость колец
    alphaCenter: 0.22,
    alphaEdge: 0.06,
    // толщина фоновых колец (как на GIF — одинаковая)
    baseLineWidth: 6,
  },

  auto: {
    cycleSec: 2.0,       // период удара (меньше = чаще)
    pullPortion: 0.32,   // доля цикла на натяжение
    pausePortion: 0.06,  // микро пауза перед ударом
  },

  spring: {
    coreRadius: 14,
    pullMaxIdle: 30,
    pullMaxActive: 44,
    pullEase: 2.6,       // резкость натяжения (больше = резче)
  },

  // ДЕФОРМАЦИЯ КОЛЕЦ ОТ НАТЯЖЕНИЯ ЦЕНТРА
  pullField: {
    width: 120,          // насколько далеко от центра затрагивает кольца (px)
    strength: 0.55,      // сила раздвижки колец при натяжении (0..1)
  },

  // ДЕФОРМАЦИЯ КОЛЕЦ ОТ УДАРНОЙ ВОЛНЫ
  shock: {
    speedIdle: 520,
    speedActive: 720,
    width: 52,           // ширина зоны сжатия вокруг фронта (px)
    ampIdle: 16,         // сила сжатия расстояния между кольцами (px)
    ampActive: 28,
    fade: 1.10,          // затухание по времени (меньше = дольше живёт)
    // “хвост” волны — сколько фронтов рисуем
    trailCount: 3,
    lineWidthIdle: 10,
    lineWidthActive: 12,
    alphaPeakIdle: 0.7,
    alphaPeakActive: 0.9,
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
    const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

    function drawScene(now: number) {
      const t = now / 1000;

      // фон
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      const minSide = Math.min(width, height);
      const maxRadius = minSide * CONFIG.rings.maxRadiusFactor;
      const spacing = CONFIG.rings.spacing;

      // ====== АВТО-ЦИКЛ ======
      const cycle = CONFIG.auto.cycleSec;
      const p = (t % cycle) / cycle; // 0..1
      const pullPortion = CONFIG.auto.pullPortion;
      const impactPhase = pullPortion + CONFIG.auto.pausePortion;

      // ====== НАТЯЖЕНИЕ (0..1) ======
      let pull = 0;
      if (p < pullPortion) {
        const u = clamp01(p / pullPortion);
        pull = Math.pow(u, CONFIG.spring.pullEase);
      }

      // центральный радиус
      const pullMax = lerp(CONFIG.spring.pullMaxIdle, CONFIG.spring.pullMaxActive, intensity);
      const coreRadius = CONFIG.spring.coreRadius + pullMax * pull;

      // ====== ПАРАМЕТРЫ УДАРА (после impactPhase) ======
      let shockFront = -1;
      let shockAlphaBase = 0;

      const shockSpeed = lerp(CONFIG.shock.speedIdle, CONFIG.shock.speedActive, intensity);
      const shockAmp = lerp(CONFIG.shock.ampIdle, CONFIG.shock.ampActive, intensity);
      const shockLineWidth = lerp(CONFIG.shock.lineWidthIdle, CONFIG.shock.lineWidthActive, intensity);
      const shockAlphaPeak = lerp(CONFIG.shock.alphaPeakIdle, CONFIG.shock.alphaPeakActive, intensity);

      if (p >= impactPhase) {
        const post = clamp01((p - impactPhase) / (1 - impactPhase)); // 0..1
        const elapsed = post * (cycle * (1 - impactPhase)); // сек после удара
        shockFront = coreRadius + elapsed * shockSpeed;
        shockAlphaBase = shockAlphaPeak * Math.exp(-CONFIG.shock.fade * elapsed);
      }

      // ====== ФУНКЦИЯ ДЕФОРМАЦИИ КОЛЕЦ ======
      // 1) Pull-field: когда центр расширяется — ближайшие кольца уезжают наружу.
      // 2) Shock-field: после удара — кольца СХОДЯТСЯ к фронту (сжатие расстояния), потом возвращаются.
      const pullFieldWidth = CONFIG.pullField.width;
      const pullFieldStrength = CONFIG.pullField.strength;

      function deformRadius(baseR: number): number {
        let dr = 0;

        // Pull-field (только когда pull>0)
        if (pull > 0.001) {
          const d = baseR - coreRadius;
          const env = Math.exp(-(d * d) / (2 * pullFieldWidth * pullFieldWidth));
          // толкаем наружу пропорционально pull
          dr += pullMax * pull * env * pullFieldStrength;
        }

        // Shock-field (после удара)
        if (shockFront > 0 && shockAlphaBase > 0.001) {
          const dist = baseR - shockFront; // + снаружи, - внутри
          const sigma = CONFIG.shock.width;

          const env = Math.exp(-(dist * dist) / (2 * sigma * sigma));

          // КЛЮЧЕВАЯ ШТУКА: сжатие расстояния
          // кольца по обе стороны фронта "подтягиваются" к фронту:
          // если dist>0 (внешние) -> dr отрицательное (тянем внутрь),
          // если dist<0 (внутренние) -> dr положительное (тянем наружу).
          const pullToFront = -(dist / sigma) * env;

          dr += shockAmp * pullToFront * shockAlphaBase;
        }

        return baseR + dr;
      }

      // ====== 0) КОЛЬЦА (НО УЖЕ ДЕФОРМИРОВАННЫЕ) ======
      const ringCount = Math.ceil(maxRadius / spacing) + 4;

      for (let i = 1; i < ringCount; i++) {
        const baseR = i * spacing;
        const r = deformRadius(baseR);

        if (r <= coreRadius * 0.6 || r > maxRadius) continue;

        const fade = 1 - r / maxRadius;
        const alpha =
          CONFIG.rings.alphaEdge +
          (CONFIG.rings.alphaCenter - CONFIG.rings.alphaEdge) * fade;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.lineWidth = CONFIG.rings.baseLineWidth;
        ctx.strokeStyle = COLORS.accent;
        ctx.globalAlpha = alpha;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
      }

      // ====== 1) ЦЕНТРАЛЬНОЕ КОЛЬЦО (натяжение) ======
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
      ctx.lineWidth = shockLineWidth;
      ctx.strokeStyle = COLORS.accent;
      ctx.globalAlpha = 0.78 + 0.18 * pull; // чуть ярче на натяжении
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();

      // ====== 2-3) ВИДИМЫЙ ФРОНТ УДАРА (поверх) ======
      // Это не обязательно, но делает "удар" читаемым
      if (shockFront > 0 && shockAlphaBase > 0.01 && shockFront < maxRadius + CONFIG.shock.width * 2) {
        for (let k = 0; k < CONFIG.shock.trailCount; k++) {
          const rr = shockFront - k * CONFIG.shock.width * 0.55;
          if (rr <= coreRadius) continue;

          const a = shockAlphaBase * (1 - k * 0.35);
          if (a <= 0.01) continue;

          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, rr, 0, Math.PI * 2);
          ctx.lineWidth = shockLineWidth * (1 - k * 0.10);
          ctx.strokeStyle = COLORS.accent;
          ctx.globalAlpha = a;
          ctx.lineCap = "round";
          ctx.stroke();
          ctx.restore();
        }
      }

      // ===== ПРОГРЕСС УДЕРЖАНИЯ =====
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