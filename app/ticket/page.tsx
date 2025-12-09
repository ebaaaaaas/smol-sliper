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
      // TODO: сюда вставишь реальный вызов API гашения
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
      style={{
        backgroundColor: resultBg,
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
    >
      {/* РАДАР */}
      {!isResult && (
        <div className="relative z-10 flex flex-col items-center justify-center w-full px-6">
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
              <g className="radar-group">
                {radii.map((r) => (
                  <path
                    key={r}
                    d={`M 0 -${r} A ${r} ${r} 0 0 1 0 ${r}`}
                    fill="none"
                    stroke="#B8FB3C"
                    strokeWidth={3}
                    strokeLinecap="round"
                    opacity={0.9}
                  />
                ))}
              </g>
            </svg>
          </div>

          <div className="mt-10 text-[10px] uppercase tracking-[0.25em] text-white/40">
            НАЖМИТЕ И УДЕРЖИВАЙТЕ
          </div>
        </div>
      )}

      {/* ЭКРАН ПОСЛЕ ГАШЕНИЯ */}
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

      {/* ЖЕСТ НА ВЕСЬ ЭКРАН */}
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
          style={{
            WebkitTapHighlightColor: "transparent",
          }}
        />
      )}

      {/* СТИЛИ */}
      <style jsx global>{`
        .smol-radar {
          width: 260px;
          height: 260px;
          filter: drop-shadow(0 0 18px rgba(184, 251, 60, 0.35));
        }

        .radar-group {
          transform-origin: center;
          animation: radar-rotate 3s linear infinite;
        }

        .smol-radar.charged .radar-group {
          animation-duration: 0.9s;
          filter: drop-shadow(0 0 26px rgba(184, 251, 60, 0.6));
        }

        .smol-radar.paused .radar-group {
          animation-play-state: paused;
        }

        @keyframes radar-rotate {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        html,
        body {
          -webkit-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
        }

        body {
          background-color: #03045e;
        }
      `}</style>
    </div>
  );
}
