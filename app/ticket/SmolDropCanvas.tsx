"use client";

import { useEffect, useRef, useState } from "react";

// !!! >>> ВСТАВЬ СЮДА СВОЙ URL ИЗ N8N (API: Ticket Info) <<< !!!
const INFO_WEBHOOK = "https://myn8nbeget.su/webhook/ticket-info"; 

const COLORS = {
  bg: "#000B3B",
  rings: "#B8FB3C",
  errorOverlay: "rgba(255, 60, 60, 0.22)",
  successOverlay: "rgba(184, 251, 60, 0.18)",
  text: "#FFFFFF",
};

const CONFIG = {
  holdDurationMs: 800,
  lineWidth: 8,
  centerDotRadius: 3.2,
  spiralTightness: 0.018,
  maxTurns: 10.5,
  segmentsPerTurn: 140,
  idleSpin: 0.85,
  holdingSpin: 2.2,
  pendingSpin: 3.2,
  successSpin: 7.5,
  idleUnspool: 2.0,
  holdingUnspool: 6.0,
  pendingUnspool: 9.0,
  successUnspool: 22.0,
  lerpK: 0.10,
  introMs: 900,
  successSettleMs: 900,
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
  
  // === НОВЫЕ ПЕРЕМЕННЫЕ STATE ===
  const [offlineToken, setOfflineToken] = useState<string | null>(null);
  const [ticketStatus, setTicketStatus] = useState<string>("loading");

  // === 1. ЭФФЕКТ ЗАГРУЗКИ (ИДЕТ В N8N) ===
  useEffect(() => {
    const fetchTicket = async () => {
      // Проверка на среду браузера
      if (typeof window === 'undefined') return;
      
      const params = new URLSearchParams(window.location.search);
      const uuid = params.get('t');

      if (!uuid) {
        setTicketStatus("no_uuid");
        return;
      }

      try {
        console.log("Запрашиваем билет:", uuid);
        const res = await fetch(`${INFO_WEBHOOK}?t=${uuid}`);
        const data = await res.json();
        console.log("Ответ сервера:", data);

        if (data.status) setTicketStatus(data.status);

        if (data.offline_token) {
          setOfflineToken(data.offline_token);
          // Дублируем в хранилище на всякий случай
          localStorage.setItem('sliper_offline_token', data.offline_token);
        }
      } catch (e) {
        console.error("Ошибка сети:", e);
        // Если сеть упала, пробуем показать старый токен
        const cached = localStorage.getItem('sliper_offline_token');
        if (cached) setOfflineToken(cached);
      }
    };

    fetchTicket();
  }, []);


  // === 2. ЭФФЕКТ АНИМАЦИИ (ТВОЙ СТАРЫЙ КОД) ===
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = get2DContext(canvas);

    let width = 0;
    let height = 0;
    let dpr = 1;

    let state: CanvasState = "idle";
    let stateStart = performance.now();
    let introStart = stateStart;

    let holdStart = 0;
    let holdProgress = 0;
    let redeemCalled = false;
    let frameId: number | null = null;
    let apiTimeoutId: number | null = null;

    let thetaLen = 0;
    let thetaLenTarget = 0;
    let spin = CONFIG.idleSpin;
    let spinTarget = CONFIG.idleSpin;
    let unspool = CONFIG.idleUnspool;
    let unspoolTarget = CONFIG.idleUnspool;
    let phase = 0;
    let phaseVel = 0;

    const preventDefault = (e: Event) => e.preventDefault();
    window.addEventListener("contextmenu", preventDefault);
    document.addEventListener("selectstart", preventDefault);

    function setState(next: CanvasState) {
      state = next;
      stateStart = performance.now();
      if (next === "idle") {
        introStart = stateStart;
        thetaLen = 0;
        thetaLenTarget = 0;
      }
    }

    function resize() {
      if (!canvas) return;
      dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    window.addEventListener("resize", resize);
    resize();

    function drawLabel(text: string, cx: number, cy: number, alpha = 0.9) {
      ctx.save();
      ctx.font = "600 16px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = COLORS.text;
      ctx.globalAlpha = alpha;
      ctx.fillText(text, cx, cy);
      ctx.restore();
    }

    function startHold() {
      if (state === "success" || state === "pending") return;
      state = "holding";
      stateStart = performance.now();
      holdStart = stateStart;
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

    // ЛОГИКА ОНЛАЙН ПОГАШЕНИЯ (ПОКА ЗАГЛУШКА, МЫ ЕЕ ПОДКЛЮЧИМ ПОЗЖЕ)
    function onRedeem() {
      if (redeemCalled) return;
      redeemCalled = true;
      state = "pending";
      stateStart = performance.now();
      spinTarget = CONFIG.pendingSpin;
      unspoolTarget = CONFIG.pendingUnspool;

      apiTimeoutId = window.setTimeout(() => {
        // Тут потом будет настоящий вызов API
        const ok = true; 
        if (ok) {
          state = "success";
          stateStart = performance.now();
          spinTarget = CONFIG.successSpin;
          unspoolTarget = CONFIG.successUnspool;
          thetaLenTarget = CONFIG.maxTurns * Math.PI * 2;
        } else {
          state = "error";
          stateStart = performance.now();
          spinTarget = CONFIG.idleSpin;
          unspoolTarget = CONFIG.idleUnspool;
        }
      }, 400);
    }

    const handlePointerDown = (e: PointerEvent) => { e.preventDefault(); startHold(); };
    const handlePointerUp = (e: PointerEvent) => { e.preventDefault(); endHold(); };

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
      // (Упрощенный путь для штампа, оставим как было)
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = COLORS.rings;
      ctx.font = "900 22px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("ПОГАШЕНО", 0, 0);
      ctx.restore();
    }

    function drawSpiral(now: number, cx: number, cy: number) {
      const dtSec = 1 / 60;
      phaseVel = lerp(phaseVel, spin, 0.12);
      phase += phaseVel * dtSec;
      const minSide = Math.min(width, height);
      const a = minSide * CONFIG.spiralTightness;
      const thetaMax = Math.max(0.001, thetaLen);
      const turns = thetaMax / (Math.PI * 2);
      const segments = Math.min(Math.floor(turns * CONFIG.segmentsPerTurn), 2600);
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
        const r = a * th;
        const wobble = 1 + 0.010 * Math.sin(th * 3.0 + now / 180);
        const ang = th + phase;
        const x = cx + Math.cos(ang) * r * wobble;
        const y = cy + Math.sin(ang) * r * wobble;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
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
      if (state === "error") {
        const dt = now - stateStart;
        const k = clamp01(1 - dt / CONFIG.errorShakeMs);
        const sx = Math.sin(dt * 0.22) * 7 * k;
        const sy = Math.cos(dt * 0.18) * 5 * k;
        ctx.save();
        ctx.translate(sx, sy);
      }
      drawSpiral(now, cx, cy);
      if (state === "pending") drawLabel("Проверка…", cx, cy + 64, 0.92);
      if (state === "success") {
        ctx.save();
        ctx.fillStyle = COLORS.successOverlay;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
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
      if (state === "holding") drawLabel("Держи…", cx, cy + 64, 0.75);
      if (state === "error") ctx.restore();
    }

    function loop(now: number) {
      const maxTheta = CONFIG.maxTurns * Math.PI * 2;
      if (state === "idle") {
        spinTarget = CONFIG.idleSpin;
        unspoolTarget = CONFIG.idleUnspool;
        const introT = clamp01((now - introStart) / CONFIG.introMs);
        const introK = easeOutCubic(introT);
        const idleLen = maxTheta * 0.78;
        const breathe = introT < 1 ? 1 : 0.92 + 0.08 * (0.5 + 0.5 * Math.sin(now / 1800));
        thetaLenTarget = idleLen * introK * breathe;
      }
      if (state === "holding") {
        const elapsed = now - holdStart;
        holdProgress = clamp01(elapsed / CONFIG.holdDurationMs);
        thetaLenTarget = lerp(maxTheta * 0.62, maxTheta * 0.90, holdProgress);
        if (holdProgress >= 1 && !redeemCalled) onRedeem();
      } else {
        holdProgress += (0 - holdProgress) * 0.15;
      }
      if (state === "pending") thetaLenTarget = Math.max(thetaLenTarget, maxTheta * 0.82);
      if (state === "success") {
        thetaLenTarget = maxTheta;
        const dt = now - stateStart;
        if (dt > CONFIG.successSettleMs) {
          spinTarget = 1.2;
          unspoolTarget = 0.0;
        }
      }
      if (state === "error") {
        spinTarget = CONFIG.idleSpin;
        unspoolTarget = CONFIG.idleUnspool;
      }
      spin = lerp(spin, spinTarget, CONFIG.lerpK);
      unspool = lerp(unspool, unspoolTarget, CONFIG.lerpK);
      const dtSec = 1 / 60;
      const toward = (thetaLenTarget - thetaLen) * 0.10;
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
    <div style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden", backgroundColor: COLORS.bg }}>
      
      {/* САМА АНИМАЦИЯ */}
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          touchAction: "none",
        }}
      />

      {/* ОФЛАЙН КОД (ПОКАЗЫВАЕМ ТОЛЬКО ЕСЛИ ОН ЕСТЬ И БИЛЕТ АКТИВЕН) */}
      {offlineToken && ticketStatus === 'active' && (
        <div style={{
          position: "absolute",
          bottom: "8%",
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          color: COLORS.rings,
          zIndex: 10,
          pointerEvents: "none", // Пропускаем клики сквозь код на спираль
          width: "100%"
        }}>
          <div style={{ 
            fontFamily: "monospace", 
            fontSize: "12px", 
            textTransform: "uppercase",
            opacity: 0.6,
            marginBottom: "6px"
          }}>
            код для проверки без интернета
          </div>
          <div style={{ 
            fontSize: "32px", 
            fontWeight: "900", 
            fontFamily: "monospace", 
            letterSpacing: "4px",
            textShadow: "0 0 15px rgba(184, 251, 60, 0.3)"
          }}>
            {offlineToken}
          </div>
        </div>
      )}

      {/* СООБЩЕНИЯ О СТАТУСЕ */}
      {ticketStatus === 'no_uuid' && (
        <div style={{ position: "absolute", top: "50%", width: "100%", textAlign: "center", color: "white" }}>
          Ссылка повреждена (нет ID билета)
        </div>
      )}
       
       {ticketStatus === 'redeemed' && (
        <div style={{ 
            position: "absolute", 
            top: "15%", 
            width: "100%", 
            textAlign: "center", 
            color: COLORS.rings, 
            fontWeight: '900',
            fontSize: "24px"
        }}>
          БИЛЕТ УЖЕ ПОГАШЕН
        </div>
      )}

    </div>
  );
}
