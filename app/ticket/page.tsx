"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Status = "idle" | "processing" | "success" | "error";

function TicketPageInner() {
  const searchParams = useSearchParams();
  const uuid = searchParams.get("t") || undefined;

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [timer, setTimer] = useState<number>(60); // 60 секунд

  // Визуальный таймер
  useEffect(() => {
    if (status !== "idle") return;
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer, status]);

  if (!uuid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-black">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Билет не найден</h1>
          <p className="text-sm text-zinc-500">
            Неверная или устаревшая ссылка.
          </p>
        </div>
      </div>
    );
  }

  const handleRedeem = async () => {
    if (status === "processing" || status === "success") return;
    setStatus("processing");
    setErrorMsg(null);

    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uuid }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setStatus("error");
        setErrorMsg(
          data.error ||
            "Билет уже погашен или недействителен. Попроси бармена проверить."
        );
        return;
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg("Не удалось связаться с сервером.");
    }
  };

  // ---- ПАЛИТРЫ ДЛЯ GEL-КНОПКИ ----
  // Внешний glow
  let outerGlow =
    "shadow-[0_0_80px_rgba(236,72,153,0.55)] bg-[radial-gradient(circle_at_30%_0%,rgba(255,255,255,0.5),transparent_55%),radial-gradient(circle_at_50%_120%,rgba(219,39,119,0.9),rgba(236,72,153,1))]";
  // Внутренний залив
  let innerFill =
    "bg-[radial-gradient(circle_at_30%_0%,rgba(255,255,255,0.9),rgba(236,72,153,0.9))]";
  if (status === "processing") {
    outerGlow =
      "shadow-[0_0_80px_rgba(245,158,11,0.55)] bg-[radial-gradient(circle_at_30%_0%,rgba(255,255,255,0.55),transparent_55%),radial-gradient(circle_at_50%_120%,rgba(234,179,8,0.9),rgba(251,191,36,1))]";
    innerFill =
      "bg-[radial-gradient(circle_at_30%_0%,rgba(255,255,255,0.9),rgba(251,191,36,0.9))]";
  }
  if (status === "success") {
    outerGlow =
      "shadow-[0_0_80px_rgba(16,185,129,0.55)] bg-[radial-gradient(circle_at_30%_0%,rgba(255,255,255,0.55),transparent_55%),radial-gradient(circle_at_50%_120%,rgba(22,163,74,0.9),rgba(16,185,129,1))]";
    innerFill =
      "bg-[radial-gradient(circle_at_30%_0%,rgba(255,255,255,0.9),rgba(16,185,129,0.9))]";
  }
  if (status === "error") {
    outerGlow =
      "shadow-[0_0_80px_rgba(239,68,68,0.55)] bg-[radial-gradient(circle_at_30%_0%,rgba(255,255,255,0.55),transparent_55%),radial-gradient(circle_at_50%_120%,rgba(220,38,38,0.9),rgba(239,68,68,1))]";
    innerFill =
      "bg-[radial-gradient(circle_at_30%_0%,rgba(255,255,255,0.9),rgba(239,68,68,0.9))]";
  }

  const timeLabel = `00:${Math.max(timer, 0)
    .toString()
    .padStart(2, "0")}`;

  let actionLabel = "ПОГАСИТЬ БИЛЕТ";
  if (status === "processing") actionLabel = "Гашу…";
  if (status === "success") actionLabel = "ГОТОВО";
  if (status === "error") actionLabel = "ОШИБКА";

  let bottomNote = "Розовый шар — билет активен.";
  if (status === "success") bottomNote = "Зелёный шар — приятного аппетита.";
  if (status === "error") bottomNote = "Красный шар — билет уже использовали.";

  const disabled = status === "processing" || status === "success";

  return (
    <div className="min-h-screen bg-white text-black flex flex-col items-center justify-center px-4">
      {/* Логотип сверху */}
      <div className="absolute top-8 inset-x-0 flex justify-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-zinc-200 bg-zinc-50">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] tracking-[0.25em] uppercase text-zinc-500">
            SMOL.DROP
          </span>
        </div>
      </div>

      {/* Немного фона за шаром */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-x-0 bottom-20 h-64 bg-[radial-gradient(circle_at_50%_0%,rgba(236,72,153,0.12),transparent_60%)]" />
      </div>

      {/* GEL-шар */}
      <button
        onClick={handleRedeem}
        disabled={disabled}
        className={`
          relative
          w-64 h-64
          rounded-full
          flex items-center justify-center
          ${outerGlow}
          transition
          active:scale-95
          disabled:opacity-80 disabled:cursor-not-allowed disabled:active:scale-100
        `}
      >
        {/* Внутренний "гелевый" слой */}
        <div
          className={`
            w-[82%] h-[82%]
            rounded-full
            ${innerFill}
            flex items-center justify-center
            relative
          `}
        >
          {/* Блик сверху */}
          <div className="pointer-events-none absolute top-0 inset-x-[12%] h-1/2 rounded-t-full bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.95),transparent_60%)] opacity-70" />

          {/* Текст в центре */}
          <div className="relative flex flex-col items-center justify-center gap-1 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
            <div className="text-[11px] tracking-[0.22em] uppercase opacity-90">
              TIMER
            </div>
            <div className="text-4xl font-bold tabular-nums">{timeLabel}</div>
            <div className="text-[11px] tracking-[0.22em] uppercase opacity-95">
              {actionLabel}
            </div>
          </div>
        </div>
      </button>

      {/* Подпись */}
      <p className="mt-8 text-sm text-zinc-600 text-center max-w-xs">
        {bottomNote}
      </p>

      {status === "error" && errorMsg && (
        <p className="mt-3 text-xs text-red-500 text-center max-w-xs">
          {errorMsg}
        </p>
      )}
    </div>
  );
}

export default function TicketPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white text-black flex items-center justify-center">
          <p className="text-sm text-zinc-600">Загружаю билет…</p>
        </div>
      }
    >
      <TicketPageInner />
    </Suspense>
  );
}
