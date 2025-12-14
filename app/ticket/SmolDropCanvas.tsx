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
  spacing: 70,
  speed: 1.15, // теперь в "рад/сек" (логичнее для орбит)
  lineWidth: 7,
  extraRings: 3,

  holdDurationMs: 800,

  progress: {
    radiusFactor: 0.16,
    lineWidthBase: 3,
    lineWidthBoost: 2,
  },

  sheen: {
    width: 180,
    speed: 520, // px/sec
    alpha: 0.12,
  },

  noise: {
    alpha: 0.06,
    step: 3, // крупное зерно, чтобы не грузить
  },

  particles: {
    count: 34,
    lifeMs: 520,
    speedMin: 180,
    speedMax: 520,
    sizeMin: 1.2,
    sizeMax: 3.2,
  },

  stamp: {
    appearMs: 320,
    settleMs: 520,
  },
};

type CanvasState = "idle" | "holding" | "pending" | "success" | "error";

function get2DContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context is not available");
  return ctx;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
// приятный "дорогой" easing
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  size: number;
};

function hash01(n: number) {
  // детерминированный псевдорандом без Math.random (стабильно)
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
      ctx.font = "600 16px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = COLORS.text;
      ctx.globalAlpha = alpha;
      ctx.fillText(text, cx, cy);
      ctx.restore();
    }

    function spawnSuccessParticles(now: number, cx: number, cy: number) {
      particles.length = 0;
      const { count, lifeMs, speedMin, speedMax, sizeMin, sizeMax } = CONFIG.particles;

      for (let i = 0; i < count; i++) {
        const a = (Math.PI * 2 * i) / count + (hash01(i + 11) - 0.5) * 0.35;
        const sp = speedMin + (speedMax - speedMin) * hash01(i + 77);
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          born: now,
          life: lifeMs + 120 * hash01(i + 1234),
          size: sizeMin + (sizeMax - sizeMin) * hash01(i + 999),
        });
      }
    }

    function onRedeem() {
      if (redeemCalled) return;
      redeemCalled = true;
      setState("pending");

      apiTimeoutId = window.setTimeout(() => {
        const ok = true; // <-- тут твой реальный результат
        setState(ok ? "success" : "error");
        targetIntensity = ok ? 0.65 : 0.25;

        if (ok) {
          const cx = width / 2;
          const cy = height / 2;
          spawnSuccessParticles(performance.now(), cx, cy);
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

    function drawNoise() {
      ctx.save();
      ctx.globalAlpha = CONFIG.noise.alpha;
      ctx.fillStyle = COLORS.rings;
      const step = CONFIG.noise.step;
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          // редкая "пыль"
          if (hash01(x * 0.07 + y * 0.11) > 0.985) {
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
      ctx.restore();
    }

    function drawSheen(t: number) {
      // диагональный блик, который даёт “премиум”
      const w = CONFIG.sheen.width;
      const x = ((t * CONFIG.sheen.speed) % (width + w * 2)) - w;
      ctx.save();
      ctx.translate(x, 0);
      ctx.rotate(-0.35);

      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, "rgba(184, 251, 60, 0)");
      g.addColorStop(0.5, `rgba(184, 251, 60, ${CONFIG.sheen.alpha})`);
      g.addColorStop(1, "rgba(184, 251, 60, 0)");

      ctx.fillStyle = g;
      ctx.fillRect(0, -height, w, height * 3);
      ctx.restore();
    }

    function drawOrbitRings(t: number, cx: number, cy: number) {
      const maxR = Math.hypot(cx, cy);
      const ringCount = Math.ceil(maxR / CONFIG.spacing) + CONFIG.extraRings;

      const baseSpin = CONFIG.speed * (0.7 + 0.7 * intensity); // ускоряем при удержании
      const pull = state === "holding" ? 10 * intensity : 0; // лёгкое "сжатие"

      ctx.save();
      ctx.strokeStyle = COLORS.rings;
      ctx.lineWidth = CONFIG.lineWidth;
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.92;

      for (let i = 0; i < ringCount; i++) {
        const r = i * CONFIG.spacing + 14 - pull;
        if (r <= 0 || r > maxR + CONFIG.lineWidth) continue;

        // вместо полного круга — 3–5 сегментов на кольцо
        const segs = 3 + Math.floor(hash01(i + 1) * 3);
        const rot = t * baseSpin * (0.6 + hash01(i + 33)) + i * 0.45;

        for (let s = 0; s < segs; s++) {
          const start = rot + (Math.PI * 2 * s) / segs + (hash01(i * 19 + s) - 0.5) * 0.25;
          const len = (0.55 + 0.25 * Math.sin(t * 1.7 + i * 0.3)) * (Math.PI * 2) / segs;
          const end = start + len * (0.72 + 0.22 * hash01(i * 7 + s * 13));

          ctx.beginPath();
          ctx.arc(cx, cy, r, start, end);
          ctx.stroke();
        }
      }

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
      ctx.lineWidth = CONFIG.progress.lineWidthBase + CONFIG.progress.lineWidthBoost * intensity;
      ctx.strokeStyle = COLORS.rings;
      ctx.globalAlpha = 0.96;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();
    }

    function drawStamp(now: number, cx: number, cy: number) {
      const dt = now - stateStart;
      const appearT = clamp01(dt / CONFIG.stamp.appearMs);
      const settleT = clamp01(dt / CONFIG.stamp.settleMs);
      const s = easeOutBack(appearT);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.12 * (1 - easeOutCubic(settleT)));

      ctx.globalAlpha = 0.92;
      ctx.scale(s, s);

      const w = Math.min(width, 320);
      const h = 86;
      const x = -w / 2;
      const y = -h / 2;

      // рамка
      ctx.lineWidth = 3;
      ctx.strokeStyle = COLORS.rings;
      ctx.fillStyle = "rgba(0, 11, 59, 0.55)";
      // rounded rect
      const r = 18;
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
      ctx.font = "800 22px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("ПОГАШЕНО", 0, 0);

      ctx.restore();
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

        // движение
        p.x += (p.vx / 60) * (1 + 0.2 * intensity);
        p.y += (p.vy / 60) * (1 + 0.2 * intensity);
        // затухание
        const a = 1 - easeOutCubic(t);

        ctx.globalAlpha = 0.65 * a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    function drawScene(now: number) {
      const t = now / 1000;

      // фон
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      // shake для error — дешёво и эффективно
      if (state === "error") {
        const dt = now - stateStart;
        const k = clamp01(1 - dt / 260);
        const sx = (Math.sin(dt * 0.22) * 6) * k;
        const sy = (Math.cos(dt * 0.18) * 4) * k;
        ctx.save();
        ctx.translate(sx, sy);
      }

      // “дорогость”: орбиты + блик + лёгкий шум
      drawOrbitRings(t, cx, cy);
      drawSheen(t);
      drawNoise();

      // прогресс удержания
      drawHoldProgress(cx, cy);

      // states overlay + label
      if (state === "success") {
        // flash в начале успеха
        const dt = now - stateStart;
        const flash = clamp01(1 - dt / 140);
        ctx.save();
        ctx.globalAlpha = 0.55 * flash;
        ctx.fillStyle = COLORS.rings;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();

        ctx.save();
        ctx.fillStyle = COLORS.successOverlay;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();

        drawStamp(now, cx, cy + 2);
        drawParticles(now);
        drawLabel("Билет погашён", cx, cy + 78, 0.9);
      } else if (state === "error") {
        ctx.save();
        ctx.fillStyle = COLORS.errorOverlay;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
        drawLabel("Ошибка", cx, cy, 0.95);
      } else if (state === "pending") {
        drawLabel("Проверка…", cx, cy, 0.92);
      } else if (state === "holding") {
        drawLabel("Держи…", cx, cy + 64, 0.75);
      }

      if (state === "error") {
        ctx.restore(); // закрываем translate shake
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
