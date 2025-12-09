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

    // Жёстко говорим TS, что это не null
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

    function drawScene(t: number) {
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const baseRadius = Math.min(width, height) * 0.25;

      const speedBase = 0.4 + intensity * 1.0;
      const thicknessBase = 2 + intensity * 3;
      const radiusPulseAmp = baseRadius * (0.02 + 0.03 * intensity);

      const orbits = 4;
      for (let i = 0; i < orbits; i++) {
        const orbitRatio = 0.75 + i * 0.18;
        const r =
          baseRadius * orbitRatio +
          radiusPulseAmp * Math.sin(t * (0.4 + 0.1 * i) + i);

        const angleSpan = Math.PI * (1.4 + 0.1 * i);
        const baseAngle = t * speedBase * (1 + i * 0.2);
        const phaseOffset = i * 0.7;
        const startAngle = baseAngle + phaseOffset;
        const endAngle = startAngle + angleSpan;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, startAngle, endAngle);
        ctx.lineWidth = thicknessBase * (0.9 + i * 0.08);
        ctx.strokeStyle = COLORS.accent;
        ctx.globalAlpha = 0.4 + 0.1 * i + 0.3 * intensity;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
      }

      const rays = 6;
      const rayLength = baseRadius * 1.4;
      for (let i = 0; i < rays; i++) {
        const rayPhase = (i * Math.PI * 2) / rays;
        const rayAngle = t * (0.3 + 0.5 * intensity) + rayPhase;

        const innerR = baseRadius * 0.3;
        const outerR = innerR + rayLength * (0.8 + 0.2 * intensity);

        const x1 = cx + Math.cos(rayAngle) * innerR;
        const y1 = cy + Math.sin(rayAngle) * innerR;
        const x2 = cx + Math.cos(rayAngle) * outerR;
        const y2 = cy + Math.sin(rayAngle) * outerR;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineWidth = 1 + 2 * intensity;
        ctx.strokeStyle = COLORS.accent;
        ctx.globalAlpha = 0.25 + 0.35 * intensity;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
      }

      const coreR = baseRadius * 0.35;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.lineWidth = 1 + 2 * intensity;
      ctx.strokeStyle = COLORS.accent;
      ctx.globalAlpha = 0.4 + 0.3 * intensity;
      ctx.stroke();
      ctx.restore();

      if (holdProgress > 0.01) {
        const progAngle = holdProgress * Math.PI * 2;
        ctx.save();
        ctx.beginPath();
        ctx.arc(
          cx,
          cy,
          coreR * 0.85,
          -Math.PI / 2,
          -Math.PI / 2 + progAngle
        );
        ctx.lineWidth = 3 + 2 * intensity;
        ctx.strokeStyle = COLORS.accent;
        ctx.globalAlpha = 0.8;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
      }

      if (intensity > 0.05) {
        const glowR = coreR * (1.1 + 0.3 * intensity);
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
        grad.addColorStop(0, "rgba(184,251,60,0.28)");
        grad.addColorStop(1, "rgba(184,251,60,0)");
        ctx.save();
        ctx.fillStyle = grad;
        ctx.fillRect(cx - glowR, cy - glowR, glowR * 2, glowR * 2);
        ctx.restore();
      }

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
