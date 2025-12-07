"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Status = "idle" | "processing" | "success" | "error";

function TicketPageInner() {
  const searchParams = useSearchParams();
  const uuid = searchParams.get("t") || undefined;

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [timer, setTimer] = useState<number>(15); // визуальный таймер

  // Таймер — чисто визуальный, не блокирует гашение
  useEffect(() => {
    if (status !== "idle") return;
    if (timer <= 0) return;

    const id = setTimeout(() => setTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer, status]);

  // Если нет uuid — сразу ошибка
  if (!uuid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-zinc-900">
        <div className="text-center space-y-3 px-6">
          <h1 className="text-2xl font-semibold">Билет не найден</h1>
          <p className="text-sm text-zinc-500">
            Неверная или устаревшая ссылка. Попроси новый дроп.
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
    } catch (e) {
      setStatus("error");
      setErrorMsg(
        "Не удалось связаться с сервером. Попробуй ещё раз или покажи экран бармену."
      );
    }
  };

  // Цвет кнопки в зависимости от статуса
  let buttonColor =
    "bg-pink-500 hover:bg-pink-600 text-white shadow-[0_18px_45px_rgba(236,72,153,0.45)]";
  if (status === "processing") {
    buttonColor =
      "bg-amber-400 hover:bg-amber-500 text-zinc-900 shadow-[0_18px_45px_rgba(251,191,36,0.45)]";
  } else if (status === "success") {
    buttonColor =
      "bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_18px_45px_rgba(16,185,129,0.45)]";
  } else if (status === "error") {
    buttonColor =
      "bg-red-500 hover:bg-red-600 text-white shadow-[0_18px_45px_rgba(239,68,68,0.45)]";
  }

  const isDisabled = status === "processing" || status === "success";

  const timerLabel = `00:${Math.max(timer, 0)
    .toString()
    .padStart(2, "0")}`;

  let caption = "Погасить билет";
  if (status === "processing") caption = "Гашу билет…";
  if (status === "success") caption = "Билет погашен";
  if (status === "error") caption = "Ошибка, попробуй ещё раз";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white text-zinc-900 px-6">
      {/* Логотип сверху */}
      <div className="absolute top-8 inset-x-0 flex justify-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-zinc-200 bg-zinc-50">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] tracking-[0.25em] uppercase text-zinc-500">
            SMOL.DROP
          </span>
        </div>
      </div>

      {/* Основной контейнер */}
      <div className="w-full max-w-sm flex flex-col items-center gap-6 mt-8">
        <div className="text-center space-y-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">
            drop ticket
          </div>
          <h1 className="text-xl font-semibold">Твой билет готов</h1>
          <p className="text-xs text-zinc-500">
            Нажимай кнопку только у стойки. После гашения цвет подскажет, что
            делать дальше.
          </p>
        </div>

        {/* Большая круглая кнопка с таймером */}
        <button
          onClick={handleRedeem}
          disabled={isDisabled}
          className={`
            relative
            w-52 h-52
            rounded-full
            flex flex-col items-center justify-center
            ${buttonColor}
            transition
            active:scale-95
            disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100
          `}
        >
          {/* Внутренний круг для глубины */}
          <div className="absolute inset-3 rounded-full bg-black/10" />

          <div className="relative flex flex-col items-center justify-center gap-1">
            <div className="text-[11px] uppercase tracking-[0.22em] opacity-80">
              {status === "success"
                ? "success"
                : status === "error"
                ? "error"
                : "timer"}
            </div>
            <div className="text-4xl font-semibold tabular-nums">
              {timerLabel}
            </div>
            <div className="text-[11px] uppercase tracking-[0.22em] opacity-90">
              {caption}
            </div>
          </div>
        </button>

        {/* Подпись и ошибка */}
        <div className="text-center space-y-2">
          <p className="text-[11px] text-zinc-500">
            <span className="font-medium">Розовая</span> — билет активен.{" "}
            <span className="font-medium">Зелёная</span> — можно отдать заказ.{" "}
            <span className="font-medium">Красная</span> — билет недействителен.
          </p>
          {status === "error" && errorMsg && (
            <p className="text-[11px] text-red-500">{errorMsg}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TicketPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white text-zinc-900">
          <div className="text-center space-y-2">
            <h1 className="text-lg font-medium">Загружаю билет…</h1>
            <p className="text-sm text-zinc-500">Пара секунд.</p>
          </div>
        </div>
      }
    >
      <TicketPageInner />
    </Suspense>
  );
}
