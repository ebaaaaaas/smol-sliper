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

  // Визуальный таймер (чисто антураж, не блокирующий)
  useEffect(() => {
    if (status !== "idle") return;
    if (timer <= 0) return;

    const id = setTimeout(() => setTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer, status]);

  if (!uuid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-950 text-white">
        <div className="text-center space-y-3 px-6">
          <h1 className="text-2xl font-bold">Билет не найден</h1>
          <p className="opacity-75 text-sm">
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

  // Успешное гашение
  if (status === "success") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-green-950 text-emerald-50">
        <div className="text-center space-y-4 px-6">
          <div className="text-xs tracking-[0.25em] uppercase opacity-60">
            SMOL.DROP
          </div>
          <h1 className="text-3xl font-extrabold">Билет погашен</h1>
          <p className="opacity-80 text-sm">Этот заказ можно отдать гостю.</p>
        </div>
      </div>
    );
  }

  // Ошибка при гашении
  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-950 text-red-50">
        <div className="text-center space-y-4 px-6 mt-4">
          <div className="text-xs tracking-[0.25em] uppercase opacity-60">
            SMOL.DROP
          </div>
          <h1 className="text-2xl font-extrabold">Ошибка билета</h1>
          <p className="opacity-80 text-sm">{errorMsg}</p>
        </div>
        <button
          className="mt-10 px-7 py-3 rounded-full border border-red-200/50 bg-red-900/60 text-sm uppercase tracking-wide backdrop-blur disabled:opacity-40"
          onClick={handleRedeem}
        >
          Попробовать ещё раз
        </button>
      </div>
    );
  }

  // Основной экран билета
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-black via-slate-950 to-zinc-900 text-white">
      {/* Верхний бар / бренд */}
      <div className="absolute top-6 inset-x-0 flex justify-center">
        <div className="px-4 py-2 rounded-full border border-white/10 bg-black/40 backdrop-blur flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs tracking-[0.25em] uppercase opacity-70">
            SMOL.DROP
          </span>
        </div>
      </div>

      {/* Билет */}
      <div className="w-full max-w-sm px-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden relative">
          {/* Живой фон */}
          <div className="absolute inset-0 opacity-60 mix-blend-screen pointer-events-none">
            <div className="w-full h-full bg-[radial-gradient(circle_at_0%_0%,rgba(94,234,212,0.35),transparent_50%),radial-gradient(circle_at_100%_100%,rgba(56,189,248,0.35),transparent_55%)] animate-pulse" />
          </div>

          <div className="relative px-6 pt-6 pb-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-[11px] uppercase tracking-[0.22em] opacity-70">
                  drop ticket
                </div>
                <div className="text-lg font-semibold">Твой дроп-билет</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase opacity-60">
                  Время на показ
                </div>
                <div className="font-mono text-sm">
                  00:{timer.toString().padStart(2, "0")}
                </div>
              </div>
            </div>

            {/* Кружок-антискрин */}
            <div className="flex justify-center py-3">
              <div className="w-40 h-40 rounded-full border border-white/30 bg-black/40 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-[-40%] bg-[conic-gradient(from_0deg,rgba(56,189,248,0.2),rgba(94,234,212,0.5),rgba(248,250,252,0.3),rgba(56,189,248,0.2))] animate-[spin_6s_linear_infinite]" />
                <div className="absolute inset-[18%] rounded-full bg-black/80 backdrop-blur" />
                <div className="relative text-center space-y-1">
                  <div className="text-[10px] tracking-[0.22em] uppercase opacity-70">
                    LIVE
                  </div>
                  <div className="text-2xl font-bold">
                    {status === "processing" ? "..." : "READY"}
                  </div>
                  <div className="text-[11px] opacity-60">
                    UUID спрятан внутри
                  </div>
                </div>
              </div>
            </div>

            {/* Инфо-блок */}
            <div className="text-[11px] leading-relaxed opacity-75 border-t border-white/10 pt-3">
              Покажи этот экран бармену. Скриншоты не канают — билет живой и
              меняется в реальном времени.
            </div>
          </div>
        </div>
      </div>

      {/* Кнопка погасить */}
      <button
        onClick={handleRedeem}
        disabled={status === "processing"}
        className="mt-8 px-10 py-3 rounded-full border border-emerald-400/60 bg-emerald-500/20 text-sm font-semibold tracking-wide uppercase backdrop-blur hover:bg-emerald-500/30 disabled:opacity-50"
      >
        {status === "processing" ? "Гашу билет…" : "Тапни, чтобы погасить"}
      </button>

      <p className="mt-4 text-[11px] opacity-50 px-8 text-center">
        После гашения билет загорится зелёным. Бармен увидит, что заказ уже
        можно отдать.
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
