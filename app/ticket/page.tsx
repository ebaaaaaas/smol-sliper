"use client";

import { useEffect, useState } from "react";

// === URL N8N ===
const INFO_WEBHOOK = "https://myn8nbeget.su/webhook/ticket-info";
const REDEEM_WEBHOOK = "https://myn8nbeget.su/webhook/redeem-ticket";

export default function TicketPage() {
  const [ticketStatus, setTicketStatus] = useState<
    "loading" | "active" | "redeemed" | "invalid" | "error"
  >("loading");

  const [offlineToken, setOfflineToken] = useState<string | null>(null);
  const [showOffline, setShowOffline] = useState(false);
  const [uuid, setUuid] = useState<string | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);

  // === ЗАГРУЗКА БИЛЕТА ===
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const t = params.get("t");

    if (!t) {
      setTicketStatus("invalid");
      return;
    }

    setUuid(t);

    fetch(`${INFO_WEBHOOK}?t=${t}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data?.status) {
          setTicketStatus("error");
          return;
        }

        if (data.status === "active") setTicketStatus("active");
        else if (data.status === "redeemed") setTicketStatus("redeemed");
        else setTicketStatus("invalid");

        if (data.offline_token) {
          setOfflineToken(data.offline_token);
          localStorage.setItem("sliper_offline_token", data.offline_token);
        }
      })
      .catch(() => {
        const cached = localStorage.getItem("sliper_offline_token");
        if (cached) setOfflineToken(cached);
        setTicketStatus("active"); // offline-допуск
      });
  }, []);

  // === ОНЛАЙН ПОГАШЕНИЕ ===
  const redeemTicket = async () => {
    if (!uuid || isRedeeming) return;

    setIsRedeeming(true);

    try {
      const res = await fetch(`${REDEEM_WEBHOOK}?t=${uuid}`, {
        method: "POST",
      });

      const data = await res.json();

      if (data?.success) {
        setTicketStatus("redeemed");
      } else {
        setTicketStatus("error");
      }
    } catch {
      setTicketStatus("error");
    } finally {
      setIsRedeeming(false);
    }
  };

  // === UI ===
  return (
    <div style={styles.page}>
      {ticketStatus === "loading" && <h2>Загрузка билета…</h2>}

      {ticketStatus === "active" && (
        <>
          <h1 style={styles.status}>АКТИВЕН</h1>
          <p style={styles.subtitle}>Покажите этот экран на кассе</p>

          <button
            onClick={redeemTicket}
            disabled={isRedeeming}
            style={styles.button}
          >
            {isRedeeming ? "ПРОВЕРКА…" : "ПОГАСИТЬ БИЛЕТ"}
          </button>

          <p style={styles.hint}>Нажимайте только на кассе</p>

          <div style={styles.cashier}>
            Кассиру достаточно увидеть этот экран<br />
            Ничего вводить и сканировать не нужно
          </div>

          {offlineToken && (
            <>
              <button
                style={styles.link}
                onClick={() => setShowOffline((v) => !v)}
              >
                Нет интернета?
              </button>

              {showOffline && (
                <div style={styles.offline}>
                  <h3>АВАРИЙНЫЙ КОД</h3>
                  <p>Только если нет интернета</p>
                  <code style={styles.code}>{offlineToken}</code>
                  <p>Одноразовый</p>
                  <p style={{ opacity: 0.8 }}>
                    Кассиру не нужно вводить код
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {ticketStatus === "redeemed" && (
        <>
          <h1 style={styles.status}>БИЛЕТ ИСПОЛЬЗОВАН</h1>
          <p>Повторное использование невозможно</p>
        </>
      )}

      {(ticketStatus === "invalid" || ticketStatus === "error") && (
        <>
          <h1 style={styles.status}>БИЛЕТ НЕДЕЙСТВИТЕЛЕН</h1>
          <p>Он уже был использован или истёк</p>
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
    gap: "16px",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  status: {
    fontSize: "28px",
    fontWeight: 900,
  },
  subtitle: {
    opacity: 0.9,
  },
  button: {
    marginTop: "16px",
    padding: "16px 24px",
    fontSize: "18px",
    fontWeight: 700,
    background: "#B8FB3C",
    color: "#000B3B",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    width: "100%",
    maxWidth: "320px",
  },
  hint: {
    fontSize: "14px",
    opacity: 0.75,
  },
  cashier: {
    marginTop: "8px",
    fontSize: "14px",
    opacity: 0.7,
  },
  link: {
    marginTop: "24px",
    background: "none",
    border: "none",
    color: "#B8FB3C",
    textDecoration: "underline",
    cursor: "pointer",
  },
  offline: {
    marginTop: "16px",
    padding: "16px",
    border: "1px solid #B8FB3C",
    borderRadius: "12px",
    maxWidth: "320px",
  },
  code: {
    display: "block",
    fontSize: "24px",
    letterSpacing: "4px",
    margin: "12px 0",
  },
};
