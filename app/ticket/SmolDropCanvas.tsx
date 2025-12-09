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

    // -------- РАДАР-ВИЗУАЛ --------
            function drawScene(t: number) {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  // Центр строго по середине экрана
  const cx = width / 2;
  const cy = height / 2;

  // Максимальный радиус так, чтобы сектор не обрезался
  const maxRadius = Math.min(width, height) * 0.45;

  // Параметры от интенсивности (удержание)
  const baseThickness = 2 + intensity * 3;
  const baseSpeed = 0.35 + intensity * 1.1;

  const bands = 9;                 // количество полос
  const angleSpan = Math.PI * 0.5; // ~90°, сектор как у радара

  // Толстые красивые полосы как в Apple Watch
for (let i = 0; i < bands; i++) {
  const k = i / Math.max(1, bands - 1);

  const r = maxRadius * (0.22 + 0.065 * i);

  // Скорость: внутренние быстрее
  const speedFactor = 1.6 - 0.7 * k;
  const phase = t * baseSpeed * speedFactor;

  const baseDir = 0; // вправо
  const midAngle = baseDir;
  const startAngle = midAngle - angleSpan / 2 + phase;
  const endAngle = midAngle + angleSpan / 2 + phase;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);

  // Толстые линии
  const lineWidth = 8 + intensity * 4; // БАЗА = 8px, при удержании до 12px
  ctx.lineWidth = lineWidth;

  ctx.strokeStyle = COLORS.accent;

  // Меньше прозрачности — более плотный вид
  ctx.globalAlpha = 0.75 - 0.4 * k + 0.2 * intensity;

  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
}


  // прогресс удержания — тонкая дуга вокруг центра
  if (holdProgress > 0.01) {
    const progAngle = holdProgress * Math.PI * 2;
    const progRadius = maxRadius * 0.24;
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

  // состояния поверх
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
