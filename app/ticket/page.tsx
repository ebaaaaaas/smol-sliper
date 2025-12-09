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
      // TODO: сюда подключишь свой реальный API
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

  const overlayColor =
    status === "success"
      ? "#1f8a42cc"
      : status === "error"
      ? "#8b0000cc"
      : "#03045ECC";

  return (
    <div className="relative min-h-screen flex items-center justify-center text-white overflow-hidden">
      {/* Фон с горизонтальными полосами на весь экран */}
      <div
        className={`pointer-events-none absolute inset-0 opacity-80 ${
          status === "holding" ? "animate-lines-fast" : "animate-lines"
        }`}
      >
        <div
          className="w-[220%] h-full translate-x-[-20%]"
          style={{
            // ГОРИЗОНТАЛЬНЫЕ ПОЛОСЫ: толще + больше просвет
            background:
              "repeating-linear-gradient(to bottom, #B8FB3C 0px, #B8FB3C 4px, transparent 4px, transparent 14px)",
          }}
        />
      </div>

      {/* Тонирующий оверлей */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: overlayColor,
        }}
      />

      {/* Контент */}
      <div className="relative z-10 w-full max-w-sm px-6 text-center">
        <p
          className="text-sm uppercase tracking-[0.25em] mb-2"
          style={{ color: "#B8FB3C" }}
        >
          SMOL.DROP
        </p>
        <p className="text-xs text-[#E5E7EB]/80 mb-8">Покажите этот экран сотруднику</p>

        <div className="mb-8">
          <p
            className="text-xs uppercase tracking-[0.25em] mb-4"
            style={{ color: "#B8FB3C" }}
          >
            УДЕРЖИВАЙТЕ
          </p>
          <p
            className="text-5xl font-semibold mb-3"
            style={{ color: "#B8FB3C" }}
          >
            HOLD
          </p>
          <p className="text-sm text-center text-[#F9FAFB]/90">{message}</p>
        </div>

        <p className="text-xs text-[#E5E7EB]/70">
          Удерживайте палец ~1 секунду. Действие необратимо.
        </p>
      </div>

      {/* Интерактивная зона на весь экран */}
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

      {/* Анимации полос */}
      <style jsx global>{`
        .animate-lines {
          animation: smol-lines 2.4s linear infinite;
        }
        .animate-lines-fast {
          animation: smol-lines 0.7s linear infinite;
        }
        @keyframes smol-lines {
          0% {
            transform: translateX(-20%);
          }
          100% {
            transform: translateX(-80%);
          }
        }
        body {
          background-color: #03045e;
        }
      `}</style>
    </div>
  );
}
