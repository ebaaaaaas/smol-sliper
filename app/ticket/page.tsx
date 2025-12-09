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
    // палец убрали до нужного времени — откат
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

    // freeze — остановили динамику
    setStatus("processing");
    setMessage("");

    try {
      // 🔹 ЗАГЛУШКА: здесь пока нет реального API, только эффект
      await new Promise((r) => setTimeout(r, 700));
      const ok = true;

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

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden flex items-center justify-center"
      style={{ backgroundColor: resultBg }}
    >
      {/* ДИАГОНАЛЬНЫЕ ЛИНИИ НА ВЕСЬ ЭКРАН */}
      {!isResult && (
        <div className="pointer-events-none absolute inset-0">
          <div
            className={[
              "smol-stripes",
              status === "holding" ? "fast" : "",
              status === "processing" ? "paused" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          />
        </div>
      )}

      {/* КОНТЕНТ */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full min-h-screen px-6">
        {/* Маленький бренд */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.35em] uppercase">
          <span style={{ color: "#B8FB3C" }}>Smol.Drop</span>
        </div>

        {isResult && (
          <div className="text-center">
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
      </div>

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
        />
      )}

      {/* СТИЛИ ДЛЯ ЛИНИЙ */}
      <style jsx global>{`
        .smol-stripes {
          width: 220%;
          height: 220%;
          position: absolute;
          top: -10%;
          left: -10%;
          background: repeating-linear-gradient(
            135deg,
            #b8fb3c 0px,
            #b8fb3c 2px,
            transparent 2px,
            transparent 16px
          );
          animation: smol-diag 2.6s linear infinite;
          opacity: 0.9;
        }

        .smol-stripes.fast {
          animation-duration: 0.7s;
          background: repeating-linear-gradient(
            135deg,
            #b8fb3c 0px,
            #b8fb3c 5px,
            transparent 5px,
            transparent 18px
          );
        }

        .smol-stripes.paused {
          animation-play-state: paused;
        }

        @keyframes smol-diag {
          0% {
            transform: translateX(-15%);
          }
          100% {
            transform: translateX(-75%);
          }
        }

        body {
          background-color: #03045e;
        }
      `}</style>
    </div>
  );
}
