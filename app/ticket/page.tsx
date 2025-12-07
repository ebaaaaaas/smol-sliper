"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Status = "idle" | "processing" | "success" | "error";

function TicketPageInner() {
  const searchParams = useSearchParams();
  const uuid = searchParams.get("t") || undefined;

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [timer, setTimer] = useState<number>(60);

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
        return;
      }

      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  // ---- КНОПКА-ШАР: цвета ----
  let color = "bg-pink-500 shadow-[0_0_50px_rgba(236,72,153,0.35)]";
  if (status === "processing")
    color = "bg-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.35)]";
  if (status === "success")
    color = "bg-green-500 shadow-[0_0_50px_rgba(16,185,129,0.35)]";
  if (status === "error")
    color = "bg-red-500 shadow-[0_0_50px_rgba(239,68,68,0.35)]";

  // ---- Текст в шаре ----
  const timeLabel = `00:${Math.max(timer, 0)
    .toString()
    .padStart(2, "0")}`;

  let actionLabel = "ПОГАСИТЬ БИЛЕТ";
  if (status === "processing") actionLabel = "Гашу…";
  if (status === "success") actionLabel = "ГОТОВО";
  if (status === "error") actionLabel = "ОШИБКА";

  // ---- Подпись под шаром ----
  let bottomNote = "Билет активен";
  if (status === "success") bottomNote = "Приятного аппетита";
  if (status === "error") bottomNote = "Уже использовали";

  return (
    <div className="min-h-screen bg-white text-black flex flex-col justify-center items-center px-4">

      {/* Большой круг-кнопка */}
      <button
        onClick={handleRedeem}
        disabled={status === "processing" || status === "success"}
        className={`
          w-64 h-64 rounded-full flex flex-col items-center justify-center
          text-white font-semibold uppercase tracking-wide
          transition active:scale-95
          ${color}
        `}
      >
        <div className="text-4xl font-bold">{timeLabel}</div>
        <div className="mt-2 text-sm opacity-90">{actionLabel}</div>
      </button>

      {/* Подпись */}
      <p className="mt-8 text-sm text-zinc-600">{bottomNote}</p>

      {/* Ошибка (опционально) */}
      {status === "error" && errorMsg && (
        <p className="mt-3 text-xs text-red-500">{errorMsg}</p>
      )}
    </div>
  );
}

export default function TicketPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center text-black">
          <p>Загрузка…</p>
        </div>
      }
    >
      <TicketPageInner />
    </Suspense>
  );
}
