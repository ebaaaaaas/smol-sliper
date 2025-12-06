"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

type Status = "idle" | "processing" | "success" | "error";

function TicketPageInner() {
  const searchParams = useSearchParams();
  const uuid = searchParams.get("t") || undefined;

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Нет uuid в ссылке => сразу красный экран
  if (!uuid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-900 text-white">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Билет не найден</h1>
          <p className="opacity-80">Неверная или устаревшая ссылка.</p>
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
        setErrorMsg(data.error || "Билет уже погашен или недействителен");
        return;
      }

      setStatus("success");
    } catch (e) {
      setStatus("error");
      setErrorMsg(
        "Ошибка соединения. Попробуй ещё раз или покажи этот экран бармену."
      );
    }
  };

  // Успешное гашение
  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-900 text-white">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-extrabold">Билет погашен</h1>
          <p className="opacity-80">Можно наливать.</p>
        </div>
      </div>
    );
  }

  // Ошибка при гашении
  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-900 text-white">
        <div className="text-center space-y-4 mt-10">
          <h1 className="text-3xl font-extrabold">Ошибка</h1>
          <p className="opacity-80">{errorMsg}</p>
        </div>
        <button
          className="mt-10 px-6 py-3 rounded-full bg-white/10 border border-white/30 backdrop-blur"
          onClick={handleRedeem}
        >
          Попробовать ещё раз
        </button>
      </div>
    );
  }

  // Основной экран билета
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-black via-slate-900 to-gray-900 text-white">
      <div className="mb-8 text-center">
        <h1 className="text-xl font-semibold tracking-wide uppercase opacity-70">
          SMOL.DROP
        </h1>
        <p className="mt-2 text-sm opacity-70">Твой живой билет</p>
      </div>

      <div className="w-56 h-56 rounded-full border border-white/20 flex items-center justify-center relative overflow-hidden animate-pulse">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(255,255,255,0.25),transparent_60%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.1),transparent_60%)] animate-[ping_3s_linear_infinite]" />
        <div className="relative text-center space-y-1">
          <div className="text-[10px] tracking-[0.2em] uppercase opacity-70">
            Ticket
          </div>
          <div className="text-3xl font-bold">
            {status === "processing" ? "..." : "READY"}
          </div>
          <div className="text-xs opacity-60">UUID скрыт внутри</div>
        </div>
      </div>

      <button
        onClick={handleRedeem}
        disabled={status === "processing"}
        className="mt-10 px-8 py-3 rounded-full border border-white/40 bg-white/5 backdrop-blur-lg text-sm tracking-wide uppercase disabled:opacity-50"
      >
        {status === "processing" ? "Гашу билет..." : "Тапни, чтобы погасить"}
      </button>

      <p className="mt-4 text-[11px] opacity-50 px-8 text-center">
        Покажи этот экран бармену. Скриншоты не канают.
      </p>
    </div>
  );
}

export default function TicketPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
          <div className="text-center space-y-2">
            <h1 className="text-xl font-semibold">Загружаю билет…</h1>
            <p className="text-sm opacity-70">Почти готово.</p>
          </div>
        </div>
      }
    >
      <TicketPageInner />
    </Suspense>
  );
}
