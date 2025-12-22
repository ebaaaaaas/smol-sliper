"use client";

import { useEffect, useState } from "react";

const REDEEM_WEBHOOK = "https://myn8nbeget.su/webhook/redeem-ticket";

type Status = "loading" | "active" | "redeemed" | "error" | "invalid";

export default function TicketPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [uuid, setUuid] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  // === ИНИЦИАЛИЗАЦИЯ ===
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const t = params.get("t");

    if (!t) {
      setStatus("invalid");
      return;
    }

    setUuid(t);
    setStatus("active"); // ⬅️ ВАЖНО: сразу активен, НЕ ждём backend
  }, []);

  // === ПОГАШЕНИЕ ===
  async function redeem() {
    if (!uuid || redeeming) return;

    setRedeeming(true);

    try {
      const res = await fetch(`${REDEEM_WEBHOOK}?t=${uuid}`, {
        method: "POST",
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // если JSON не пришёл, но HTTP 200 — считаем успех
        if (res.ok) {
          setStatus("redeemed");
          return;
        }
        throw new Error("no json");
      }

      const result = Array.isArray(data)
        ? data[0]?.result
        : data?.result;

      if (result === "success" || result === "already_redeemed") {
        setStatus("redeemed");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setRedeeming(false);
    }
  }

  // === UI ===
  return (
    <div style={styles.page}>
      {status === "loading" && <p>Загрузка…</p>}

      {status === "invalid" && (
        <>
          <h1 style={styles.title}>БИЛЕТ НЕДЕЙСТВИТЕЛЕН</h1>
          <p style={styles.text}>Ссылка повреждена</p>
        </>
      )}

      {status === "active" && (
        <>
          <h1 style={styles.title}>АКТИВЕН</h1>
          <p style={styles.text}>Покажите этот экран на кассе</p>

          <button
            style={styles.button}
            onClick={redeem}
            disabled={redeeming}
          >
            {redeeming ? "ПРОВЕРКА…" : "ПОГАСИТЬ БИЛЕТ"}
          </button>

          <p style={styles.hint}>
            Нажимайте только на кассе<br />
            Кассиру достаточно увидеть экран
          </p>
        </>
      )}

      {status === "redeemed" && (
        <>
          <h1 style={styles.title}>БИЛЕТ ИСПОЛЬЗОВАН</h1>
          <p style={styles.text}>Повторное использование невозможно</p>
        </>
      )}

      {status === "error" && (
        <>
          <h1 style={styles.title}>ОШИБКА СВЯЗИ</h1>
          <p style={styles.text}>Попробуйте ещё раз</p>

          <button
            style={styles.button}
            onClick={redeem}
            disabled={redeeming}
          >
            ПОВТОРИТЬ ПОПЫТКУ
          </button>
        </>
      )}
    </div>
  );
}

// === СТИЛИ ===
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#000B3B",
    color: "#FFFFFF",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    textAlign: "center",
    fontFamily: "system-ui, -apple-system, sans-serif",
    gap: "16px",
  },
  title: {
    fontSize: "28px",
    fontWeight: 900,
  },
  text: {
    opacity: 0.8,
  },
  hint: {
    fontSize: "14px",
    opacity: 0.6,
    marginTop: "12px",
  },
  button: {
    marginTop: "16px",
    padding: "16px 24px",
    fontSize: "18px",
    fontWeight: 900,
    background: "#B8FB3C",
    color: "#000B3B",
    border: "none",
    borderRadius: "14px",
    width: "100%",
    maxWidth: "320px",
    cursor: "pointer",
  },
};