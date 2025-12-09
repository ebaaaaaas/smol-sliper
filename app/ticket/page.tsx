"use client";

import React, { useState, useRef } from "react";

const HOLD_DURATION_MS = 800;

type Status = "idle" | "holding" | "processing" | "success" | "error";

export default function TicketPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("Удерживайте палец, чтобы погасить билет");
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canInteract = status === "idle" || status === "holding";

  const startHold = () => {
    if (!canInteract) return;

    setStatus("holding");
    setMessage("Держите палец…");

    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);

    holdTimeoutRef.current = setTimeout(() => {
      triggerRedeem();
    }, HOLD_DURATION_MS);
  };

  const endHold = () => {
    if (!canInteract) return;

    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }

    setStatus("idle");
    setMessage("Удерживайте палец, чтобы погасить билет");
  };

  const triggerRedeem = async () => {
    setStatus("processing");
    setMessage("Гашение билета…");

    try {
      // TODO: Вставь реальный API
      await new Promise((r) => setTimeout(r, 800));
      const ok = true;

      if (ok) {
        setStatus("success");
        setMessage("Билет погашен. Приятного аппетита!");
      } else {
        setStatus("error");
        setMessage("Ошибка гашения. Обратитесь к персоналу.");
      }
    } catch {
      setStatus("error");
      setMessage("Ошибка соединения. Попробуйте ещё раз.");
    }
  };

  const bgClass =
    status === "success"
      ? "bg-[#1f8a42]"
      : status === "error"
      ? "bg-[#8b0000]"
      : "bg-[#03045E]"; // ТВОЙ ФИРМЕННЫЙ ФОН

  return (
    <div className={`${bgClass} min-h-screen text-white flex flex-col items-center justify-center`}>
      <div className="w-full max-w-sm px-6">
        <div className="mb-6 text-center">
          <p className="text-sm uppercase tracking-[0.2em]" style={{ color: "#B8FB3C" }}>
            Smol.Drop
          </p>
          <p className="mt-2 text-xs text-[#9CA3AF]">Покажите экран сотруднику</p>
        </div>

        <div
          className={`relative overflow-hidden rounded-2xl border border-[#1F2937] ${
            status === "success"
              ? "shadow-[0_0_30px_rgba(184,251,60,0.4)]"
              : status === "error"
              ? "shadow-[0_0_30px_rgba(255,0,0,0.3)]"
              : "shadow-[0_0_40px_rgba(184,251,60,0.25)]"
          }`}
        >
          {/* АНИМАЦИОННЫЕ ЛИНИИ */}
          <div
            className={`absolute inset-0 opacity-70 ${
              status === "holding" ? "animate-lines-fast" : "animate-lines"
            }`}
          >
            <div
              className="w-[200%] h-full translate-x-[-25%]"
              style={{
                background:
                  "repeating-linear-gradient(to right, #B8FB3C 0px, #B8FB3C 2px, transparent 2px, transparent 6px)",
              }}
            />
          </div>

          {/* ПОЛУПРОЗРАЧНАЯ МАСКА */}
          <div className="relative z-10 flex flex-col items-center justify-center px-6 py-10 bg-black/40">
            <p className="text-xs uppercase tracking-[0.2em] mb-3" style={{ color: "#B8FB3C" }}>
              УДЕРЖИВАЙТЕ
            </p>
            <p className="text-4xl font-semibold mb-2" style={{ color: "#B8FB3C" }}>
              HOLD
            </p>
            <p className="text-sm text-center text-[#E5E7EB]">{message}</p>
          </div>

          {/* ОБЛАСТЬ ДЛЯ ЖЕСТА */}
          <button
            type="button"
            className="absolute inset-0 z-20 touch-none"
            onMouseDown={startHold}
            onMouseUp={endHold}
            onMouseLeave={endHold}
            onTouchStart={(e) => {
              e.preventDefault();
              startHold();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              endHold();
            }}
          />
        </div>

        <p className="mt-4 text-xs text-center text-[#9CA3AF]">
          Удерживайте палец ~1 секунду. Действие необратимо.
        </p>
      </div>

      {/* АНИМАЦИИ */}
      <style jsx global>{`
        .animate-lines {
          animation: smol-lines 2.4s linear infinite;
        }
        .animate-lines-fast {
          animation: smol-lines 0.7s linear infinite;
        }
        @keyframes smol-lines {
          0% {
            transform: translateX(-25%);
          }
          100% {
            transform: translateX(-75%);
          }
        }
      `}</style>
    </div>
  );
}