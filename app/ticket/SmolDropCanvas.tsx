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
  holdDurationMs: 800,

  // Спираль
  lineWidth: 8,
  centerDotRadius: 3.2,
  spiralTightness: 0.018, // чем больше — тем быстрее разъезжается радиус
  maxTurns: 10.5, // сколько витков максимум (визуально)
  segmentsPerTurn: 140, // плотность линии

  // Скорости (рад/сек)
  idleSpin: 0.85,
  holdingSpin: 2.2,
  pendingSpin: 3.2,
  successSpin: 7.5,

  // Скорость “разматывания” (как быстро растёт длина спирали)
  idleUnspool: 2.0, // рад/сек
  holdingUnspool: 6.0,
  pendingUnspool: 9.0,
  successUnspool: 22.0,

  // Плавность переходов
  lerpK: 0.10,

  // После success держим финал
  successSettleMs: 900,

  // Error shake
  errorShakeMs: 260,
};

type CanvasState = "idle" | "holding" | "pending" | "success" | "error";

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

    let redeemCalled = false;
    let frameId: number | null = null;
    let apiTimeoutId: number | null = null;

    // Управление спиралью
    let thetaLen = 0; // текущая “длина” спирали (в радианах)
    let thetaLenTarget = 0;

    let spin = CONFIG.idleSpin;
    let spinTarget = CONFIG.idleSpin;

    let unspool = CONFIG.idleUnspool;
    let unspoolTarget = CONFIG.idleUnspool;

    let phase = 0; // вращение спирали
    let phaseTarget = 0;

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

    function startHold() {
      if (state === "success" || state === "pending") return;
      setState("holding");
      holdStart = performance.now();
      holdProgress = 0;
      redeemCalled = false;

      spinTarget = CONFIG.holdingSpin;
      unspoolTarget = CONFIG.holdingUnspool;
    }

    function endHold() {
      if (state === "holding") {
        setState("idle");
        spinTarget = CONFIG.idleSpin;
        unspoolTarget = CONFIG.idleUnspool;
      }
    }

    function onRedeem() {
      if (redeemCalled) return;
      redeemCalled = true;
      setState("pending");

      spinTarget = CONFIG.pendingSpin;
      unspoolTarget = CONFIG.pendingUnspool;

      apiTimeoutId = window.setTimeout(() => {
        const ok = true; // <-- подставь реальный результат
        if (ok) {
          setState("success");
          spinTarget = CONFIG.successSpin;
          unspoolTarget = CONFIG.successUnspool;

          // на успех — доматываем спираль до максимума быстро
          thetaLenTarget = CONFIG.maxTurns * Math.PI * 2;
        } else {
          setState("error");
          // при ошибке возвращаемся к idle параметрам
          spinTarget = CONFIG.idleSpin;
          unspoolTarget = CONFIG.idleUnspool;
        }
      }, 400);
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

    function drawStamp(now: number, cx: number, cy: number) {
      const dt = now - stateStart;
      const t = clamp01(dt / 300);
      const s = easeOutBack(t);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.10 * (1 - easeOutCubic(t)));
      ctx.scale(s, s);

      const w = Math.min(width * 0.84, 340);
      const h = 86;
      const x = -w / 2;
      const y = -h / 2;
      const r = 18;

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

      ctx.fillStyle = COLORS.rings;
      ctx.font = "900 22px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("ПОГАШЕНО", 0, 0);

      ctx.restore();
    }

    function drawSpiral(now: number, cx: number, cy: number) {
      // мягкое вращение фазы + “дыхание” толщины
      phaseTarget += spin * (1 / 60);
      phase = lerp(phase, phaseTarget, 0.10);

      // вычисляем коэффициент спирали от экрана
      const minSide = Math.min(width, height);
      const a = minSide * CONFIG.spiralTightness; // r = a * theta

      // сколько точек рисуем
      const thetaMax = Math.max(0.01, thetaLen);
      const turns = thetaMax / (Math.PI * 2);
      const segments = Math.min(
        Math.floor(turns * CONFIG.segmentsPerTurn),
        2400
      );

      ctx.save();
      ctx.strokeStyle = COLORS.rings;
      ctx.lineWidth = CONFIG.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = 0.95;

      ctx.beginPath();

      for (let i = 0; i <= segments; i++) {
        const p = i / Math.max(1, segments);
        const th = thetaMax * p;

        // спираль Архимеда
        const r = a * th;

        // лёгкая “игровая” вибрация амплитуды (очень умеренно)
        const wobble = 1 + 0.012 * Math.sin(th * 3.2 + now / 170);

        const ang = th + phase;
        const x = cx + Math.cos(ang) * r * wobble;
        const y = cy + Math.sin(ang) * r * wobble;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.stroke();
      ctx.restore();

      // центральная точка
      ctx.save();
      ctx.fillStyle = COLORS.rings;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.arc(cx, cy, CONFIG.centerDotRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawScene(now: number) {
      const cx = width / 2;
      const cy = height / 2;

      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, width, height);

      // error shake
      if (state === "error") {
        const dt = now - stateStart;
        const k = clamp01(1 - dt / CONFIG.errorShakeMs);
        const sx = Math.sin(dt * 0.22) * 7 * k;
        const sy = Math.cos(dt * 0.18) * 5 * k;
        ctx.save();
        ctx.translate(sx, sy);
      }

      drawSpiral(now, cx, cy);

      // UI states
      if (state === "pending") {
        drawLabel("Проверка…", cx, cy + 64, 0.92);
      }

      if (state === "success") {
        // лёгкий зелёный оверлей
        ctx.save();
        ctx.fillStyle = COLORS.successOverlay;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();

        // после доматывания — показываем штамп и текст
        const dt = now - stateStart;
        if (dt > 160) drawStamp(now, cx, cy);
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
        ctx.restore();
      }
    }

    function loop(now: number) {
      // state-driven targets
      const maxTheta = CONFIG.maxTurns * Math.PI * 2;

      if (state === "idle") {
        spinTarget = CONFIG.idleSpin;
        unspoolTarget = CONFIG.idleUnspool;
        // в idle спираль “дышит”: растём до ~70% и снова
        thetaLenTarget = (maxTheta * 0.72) * (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(now / 1800)));
      }

      if (state === "holding") {
        const elapsed = now - holdStart;
        holdProgress = clamp01(elapsed / CONFIG.holdDurationMs);

        // при удержании цель длины растёт
        thetaLenTarget = lerp(maxTheta * 0.55, maxTheta * 0.82, holdProgress);

        if (holdProgress >= 1 && !redeemCalled) onRedeem();
      } else {
        holdProgress += (0 - holdProgress) * 0.15;
      }

      if (state === "pending") {
        // pending — крутим и немного доматываем
        thetaLenTarget = Math.min(maxTheta * 0.92, Math.max(thetaLenTarget, maxTheta * 0.70));
      }

      if (state === "success") {
        // доматываем до полного, потом стабилизируем
        thetaLenTarget = maxTheta;

        const dt = now - stateStart;
        if (dt > CONFIG.successSettleMs) {
          // после settle можно слегка успокоить скорость, чтобы не вертелось “вечно”
          spinTarget = 1.2;
          unspoolTarget = 0.0;
        }
      }

      // плавные переходы скоростей
      spin = lerp(spin, spinTarget, CONFIG.lerpK);
      unspool = lerp(unspool, unspoolTarget, CONFIG.lerpK);

      // разматывание длины
      const dtSec = 1 / 60;
      // подтягиваем длину к таргету + добавляем “unspool” как скорость роста
      const toward = (thetaLenTarget - thetaLen) * 0.08;
      thetaLen = Math.max(0, Math.min(maxTheta, thetaLen + toward + unspool * dtSec));

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
