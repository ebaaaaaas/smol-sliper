"use client";

import React, { useState, useRef } from "react";

const HOLD_DURATION_MS = 800;

type Status = "idle" | "holding" | "processing" | "success" | "error";

export default function TicketPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isResult = status === "success" || status === "error";

  const startHold = () => {
    if (status !== "idle") return;

    setStatus("holding");

    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    holdTimeoutRef.current = setTimeout(() => {
      triggerRedeem();
    }, HOLD_DURATION_MS);
  };

  const endHold = () => {
    if (status !== "holding") return;

    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    setStatus("idle");
  };

  const triggerRedeem = async () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }

    setStatus("processing");
    setMessage("");

    try {
      // TODO: сюда потом вставишь реальный вызов API гашения
      await new Promise((r) => setTimeout(r, 700));
      const ok = true; // заглушка

      if (ok) {
        setStatus("success");
        setMessage("Погашено");
      } else {
        setStatus("error");
        setMessage("Ошибка");
      }
    } catch {
      setStatus("error");
      setMessage("Сбой");
    }
  };

  const resultBg =
    status === "success"
      ? "#1F8A42"
      : status === "error"
      ? "#8B0000"
      : "#03045E";

  const radii = [40, 55, 70, 85, 100, 115, 130];

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden flex items-center justify-center"
      style={{ backgroundColor: resultBg }}
    >
      {/* РАДАР-АНИМАЦИЯ */}
      {!isResult && (
        <div className="relative z-10 flex flex-col items-center justify-center w-full px-6">
          {/* Лого сверху */}
          <div className="mb-10 text-[10px] tracking-[0.35em] uppercase">
            <span style={{ color: "#B8FB3C" }}>SMOL.DROP</span>
          </div>

          <div className="flex items-center justify-center">
            <svg
              viewBox="-150 -150 300 300"
              className={[
                "smol-radar",
                status === "holding" ? "charged" : "",
                status === "processing" ? "paused" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {radii.map((r, i) => {
                const circumference = 2 * Math.PI * r;
                const visible = circumference * 0.55; // длина видимого сегмента
                const gap = circumference - visible;
                return (
                  <circle
                    key={r}
                    cx="0"
                    cy="0"
                    r={r}
                    fill="none"
                    stroke="#B8FB3C"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeDasharray={`${visible} ${gap}`}
                    strokeDashoffset={visible / 2}
                    opacity={0.9}
                    className={`ring ring-${i}`}
                  />
                );
              })}
            </svg>
          </div>

          <div className="mt-10 text-[10px] uppercase tracking-[0.25em] text-white/40">
            НАЖМИТЕ И УДЕРЖИВАЙТЕ
          </div>
        </div>
      )}

      {/* Экран после гашения */}
      {isResult && (
        <div className="relative z-10 flex flex-col items-center justify-center w-full min-h-screen px-6 text-center">
          <p
            className="text-4xl font-semibold mb-2"
            style={{ color: "#B8FB3C" }}
          >
            {status === "success" ? "Погашено" : "Ошибка"}
          </p>
          {message && (
            <p className="text-xs text-[#F9FAFB]/80">
              {status === "success"
                ? "Покажите экран сотруднику."
                : "Обратитесь к персоналу."}
            </p>
          )}
        </div>
      )}

      {/* Жест на весь экран */}
      {!isResult && (
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
      )}

      {/* АНИМАЦИИ — аккуратные, без “пьяного” вращения */}
      <style jsx global>{`
        .smol-radar {
          width: 260px;
          height: 260px;
          filter: drop-shadow(0 0 18px rgba(184, 251, 60, 0.35));
        }

        .ring {
          transform-origin: center;
          animation: ring-move 3.2s linear infinite;
        }

        /* разная скорость для глубины, но без вращения фигуры */
        .ring-0 {
          animation-duration: 3.8s;
        }
        .ring-1 {
          animation-duration: 3.4s;
        }
        .ring-2 {
          animation-duration: 3s;
        }
        .ring-3 {
          animation-duration: 2.6s;
        }
        .ring-4 {
          animation-duration: 2.2s;
        }
        .ring-5 {
          animation-duration: 2.8s;
        }
        .ring-6 {
          animation-duration: 4.2s;
        }

        .smol-radar.charged .ring {
          animation-duration: 1.1s;
          stroke-width: 4;
          filter: drop-shadow(0 0 26px rgba(184, 251, 60, 0.6));
        }

        .smol-radar.paused .ring {
          animation-play-state: paused;
        }

        @keyframes ring-move {
          0% {
            stroke-dashoffset: 0;
          }
          100% {
            stroke-dashoffset: -420;
          }
        }

        body {
          background-color: #03045e;
        }
      `}</style>
    </div>
  );
}
