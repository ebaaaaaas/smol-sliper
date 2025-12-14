"use client";

import { useEffect, useRef } from "react";

const COLORS = {
  bg: "#000B3B",
  rings: "#B8FB3C",
  errorOverlay: "rgba(255, 60, 60, 0.22)",
  successOverlay: "rgba(184, 251, 60, 0.18)",
  text: "#FFFFFF",
};

const CONFIG = {
  spacing: 74, // расстояние между орбитами
  ringWidth: 10, // толщина сегментов
  ringAlpha: 0.9,

  // скорость вращения орбит (рад/сек), усиление при hold
  spinBase: 0.65,
  spinBoost: 1.35,

  // сколько сегментов на кольцо (диапазон)
  segMin: 3,
  segMax: 6,

  // удержание
  holdDurationMs: 800,

  // прогресс удержания
  progress: {
    radiusFactor: 0.16,
    lineWidthBase: 3,
    lineWidthBoost: 2,
  },

  // “game” эффект SUCCESS
  success: {
    freezeMs: 520,
    flashMs: 120,
    shockMs: 420,
    burstLifeMs: 520,
    burstCount: 38,
  },

  // микрозерно (анти-скрин + “дорогая” текстура)
  noise: {
    alpha: 0.06,
    step: 3,
    threshold: 0.986,
  },

  // pending
  pendingDim: 0.65,

  // error shake
  errorShakeMs: 260,
};

type CanvasState = "idle" | "holding" | "pending" | "success" | "error";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  size: number;
};

function get2DContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context is not available");
  return ctx;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// детерминированный псевдослучай (стабильно, без Math.random)
function hash01(n: number) {
  const s = Math.sin(n * 999.123) * 43758.5453;
  return s - Math.floor(s);
}

export function SmolDropCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = get2DContext(canvas);

    let width = 0;
    let height = 0;
    let dpr = 1;

    let state: CanvasState = "idle";
    let stateStart = performance.now();

    let holdStart = 0;
    let holdProgress = 0;

    let intensity = 0;
    let targetIntensity = 0;

    let redeemCalled = false;
    let frameId: number | null = null;
    let apiTimeoutId: number | null = null;

    // game эффекты
    let freezeUntil = 0;
    let shockStart = 0;
    let burstStart = 0;
    const particles: Particle[] = [];

    const preventDefault = (e: Event) => e.preventDefault();
    window.addEventListener("contextmenu", preventDefault);
    document.addEventListener("selectstart", preventDefault);

    function setState(next: CanvasState) {
      state = next;
      stateStart = performance.now();
    }

    function resize() {
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

    function drawLabel(text: string, cx: number, cy: number, alpha = 0.9) {
      ctx.save();
      ctx.font =
        "600 16px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = COLORS.text;
      ctx.globalAlpha = alpha;
      ctx.fillText(text, cx, cy);
      ctx.restore();
    }

    function drawNoise() {
      ctx.save();
      ctx.globalAlpha = CONFIG.noise.alpha;
      ctx.fillStyle = COLORS.rings;
      const step = CONFIG.noise.step;

      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const v = hash01(x * 0.07 + y * 0.11);
          if (v > CONFIG.noise.threshold) ctx.fillRect(x, y, 1, 1);
        }
      }
      ctx.restore();
    }

    function spawnBurst(now: number, cx: number, cy: number) {
      particles.length = 0;
      const n = CONFIG.success.burstCount;

      for (let i = 0; i < n; i++) {
        const a =
          (Math.PI * 2 * i) / n + (hash01(i + 11) - 0.5) * 0.35;
        const sp =
          200 + 420 * hash01(i + 77); // speed
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          born: now,
          life: CONFIG.success.burstLifeMs + 120 * hash01(i + 1234),
          size: 1.4 + 2.8 * hash01(i + 999),
        });
      }
    }

    function drawParticles(now: number) {
      if (!particles.length) return;

      ctx.save();
      ctx.fillStyle = COLORS.rings;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const age = now - p.born;
        const t = age / p.life;

        if (t >= 1) {
          particles.splice(i, 1);
          continue;
        }

        // движение (60fps аппрокс)
        p.x += p.vx / 60;
        p.y += p.vy / 60;

        const a = 1 - easeOutCubic(t);
        ctx.globalAlpha = 0.7 * a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    function drawShockwave(now: number, cx: number, cy: number) {
      if (state !== "success") return;
      const dt = now - shockStart;
      if (dt < 0 || dt > CONFIG.success.shockMs) return;

      const p = dt / CONFIG.success.shockMs; // 0..1
      const k = 1 - p;
      const max = Math.min(width, height) * 0.52;
      const r = max * (0.12 + 0.88 * p);

      ctx.save();
      ctx.strokeStyle = COLORS.rings;

      // основной контур
      ctx.globalAlpha = 0.6 * k;
      ctx.lineWidth = 10 * k + 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      // glow
      ctx.globalAlpha = 0.18 * k;
      ctx.lineWidth = 24 * k + 6;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    function drawHoldProgress(cx: number, cy: number) {
      if (holdProgress <= 0.01) return;

      const progAngle = holdProgress * Math.PI * 2;
      const minSide = Math.min(width, height);
      const progRadius = minSide * CONFIG.progress.radiusFactor;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, progRadius, -Math.PI / 2, -Math.PI / 2 + progAngle);
      ctx.lineWidth =
        CONFIG.progress.lineWidthBase + CONFIG.progress.lineWidthBoost * intensity;
      ctx.strokeStyle = COLORS.rings;
      ctx.globalAlpha = 0.96;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();
    }

    function drawStamp(now: number, cx: number, cy: number) {
      // game-pop + лёгкий back easing
      const dt = now - stateStart;
      const t = clamp01(dt / 280);
      const s = easeOutBack(t);

      // микровибра (очень маленькая) чтобы было “аркадно”
      const jig = state === "success" ? (1 - t) * 1.3 : 0;
      const jx = Math.sin(dt * 0.18) * jig;
      const jy = Math.cos(dt * 0.22) * jig;

      ctx.save();
      ctx.translate(cx + jx, cy + jy);
      ctx.rotate(-0.12 * (1 - easeOutCubic(t)));
      ctx.scale(s, s);

      const w = Math.min(width * 0.84, 340);
      const h = 88;
      const x = -w / 2;
      const y = -h / 2;
      const r = 18;

      // фон штампа
      ctx.globalAlpha = 0.96;
      ctx.fillStyle = "rgba(0, 11, 59, 0.60)";
      ctx.strokeStyle = COLORS.rings;
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // текст
      ctx.fillStyle = COLORS.rings;
      ctx.font = "900 22px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("ПОГАШЕНО", 0, 0);

      ctx.restore();
    }

    function drawOrbits(now: number, cx: number, cy: number) {
      // FREEZE: используем “замороженное” время для движения орбит
      const timeNow = now < freezeUntil ? freezeUntil : now;
      const t = timeNow / 1000;

      const maxR = Math.hypot(cx, cy);
      const ringCount = Math.ceil(maxR / CONFIG.spacing) + 3;

      const spin = CONFIG.spinBase + CONFIG.spinBoost * intensity;

      ctx.save();
      ctx.strokeStyle = COLORS.rings;
      ctx.lineWidth = CONFIG.ringWidth;
      ctx.lineCap = "round";

      // в success/pending чуть приглушаем фон, чтобы центр доминировал
      const bgDim =
        state === "success" ? 0.40 : state === "pending" ? CONFIG.pendingDim : 1.0;

      ctx.globalAlpha = CONFIG.ringAlpha * bgDim;

      for (let i = 0; i < ringCount; i++) {
        const r = i * CONFIG.spacing + 18;
        if (r > maxR + CONFIG.ringWidth) continue;

        const segs =
          CONFIG.segMin + Math.floor(hash01(i + 1) * (CONFIG.segMax - CONFIG.segMin + 1));
        const rot = t * spin * (0.55 + 0.65 * hash01(i + 33)) + i * 0.42;

        for (let s = 0; s < segs; s++) {
          const base = (Math.PI * 2 * s) / segs;
          const jitter = (hash01(i * 19 + s) - 0.5) * 0.22;
          const start = rot + base + jitter;

          // длина сегмента “дышит”
          const breathe = 0.65 + 0.25 * Math.sin((now / 1000) * 1.6 + i * 0.35);
          const len =
            breathe * (Math.PI * 2) / segs * (0.70 + 0.22 * hash01(i * 7 + s * 13));

          ctx.beginPath();
          ctx.arc(cx, cy, r, start, start + len);
          ctx.stroke();
        }
      }

      // маленький “ядро-спиннер” в центре на pending/holding
      if (state === "holding" || state === "pending") {
        const coreR = Math.min(width, height) * 0.038;
        const coreSegs = 6;
        ctx.globalAlpha = 0.95;
        for (let k = 0; k < coreSegs; k++) {
          const a = t * 4.6 + (Math.PI * 2 * k) / coreSegs;
          ctx.beginPath();
          ctx.arc(cx, cy, coreR, a, a + 0.55);
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    function onRedeem() {
      if (redeemCalled) return;
      redeemCalled = true;
      setState("pending");

      apiTimeoutId = window.setTimeout(() => {
        const ok = true; // <-- здесь подставь реальный результат
        if (ok) {
          const now = performance.now();
          freezeUntil = now + CONFIG.success.freezeMs;
          shockStart = now;
          burstStart = now;
          spawnBurst(now, width / 2, height / 2);

          setState("success");
          targetIntensity = 0.6;
        } else {
          setState("error");
          targetIntensity = 0.2;
        }
      }, 400);
    }

    function startHold() {
      if (state === "success" || state === "pending") return;
      setState("holding");
      holdStart = performance.now();
      holdProgress = 0;
      targetIntensity = 1;
      redeemCalled = false;
    }

    function endHold() {
      if (state === "holding") {
        setState("idle");
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
      const cx = width / 2;
      const cy = height / 2;

      // фон
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, width, height);

      // ERROR shake (короткий)
      if (state === "error") {
        const dt = now - stateStart;
        const k = clamp01(1 - dt / CONFIG.errorShakeMs);
        const sx = Math.sin(dt * 0.22) * 7 * k;
        const sy = Math.cos(dt * 0.18) * 5 * k;
        ctx.save();
        ctx.translate(sx, sy);
      }

      // орбиты
      drawOrbits(now, cx, cy);

      // текстура/анти-скрин
      drawNoise();

      // прогресс удержания
      drawHoldProgress(cx, cy);

      // STATES
      if (state === "pending") {
        drawLabel("Проверка…", cx, cy + 64, 0.92);
      }

      if (state === "success") {
        // flash (игровая вспышка)
        const dt = now - burstStart;
        const f = clamp01(1 - dt / CONFIG.success.flashMs);
        if (f > 0) {
          ctx.save();
          ctx.globalAlpha = 0.55 * f;
          ctx.fillStyle = COLORS.rings;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        }

        // мягкий зелёный оверлей
        ctx.save();
        ctx.fillStyle = COLORS.successOverlay;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();

        drawShockwave(now, cx, cy);
        drawParticles(now);

        // штамп “ПОГАШЕНО”
        drawStamp(now, cx, cy);

        drawLabel("Билет погашён", cx, cy + 78, 0.9);
      }

      if (state === "error") {
        ctx.save();
        ctx.fillStyle = COLORS.errorOverlay;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
        drawLabel("Ошибка", cx, cy, 0.95);
      }

      if (state === "holding") {
        drawLabel("Держи…", cx, cy + 64, 0.75);
      }

      if (state === "error") {
        ctx.restore(); // закрываем shake translate
      }
    }

    function loop(now: number) {
      if (state === "holding") {
        const elapsed = now - holdStart;
        holdProgress = clamp01(elapsed / CONFIG.holdDurationMs);
        if (holdProgress >= 1 && !redeemCalled) onRedeem();
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