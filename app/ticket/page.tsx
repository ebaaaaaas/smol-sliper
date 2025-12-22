"use client";

import { useEffect, useState } from "react";

/* === N8N ENDPOINTS === */
const INFO_WEBHOOK = "https://myn8nbeget.su/webhook/ticket-info";
const REDEEM_WEBHOOK = "https://myn8nbeget.su/webhook/redeem-ticket";

/* === BRAND COLORS === */
const COLORS = {
  bg: "#000B3B",        // фирменный синий
  accent: "#B8FB3C",    // фирменный салатовый
  text: "#FFFFFF",
  muted: "rgba(255,255,255,0.7)",
  mutedWeak: "rgba(255,255,255,0.55)",
};

type TicketStatus = "loading" | "active" | "redeemed" | "invalid" | "error";

export default function TicketPage() {
  const [status, setStatus] = useState<TicketStatus>("loading");
  const [uuid, setUuid] = useState<string | null>(null);
  const [offlineToken, setOfflineToken] = useState<string | null>(null);
  const [showOffline, setShowOffline] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  /* === LOAD TICKET === */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const t = params.get("t");

    if (!t) {
      setStatus("invalid");
      return;
    }

    setUuid(t);

    fetch(`${INFO_WEBHOOK}?t=${t}`)
      .then(r => r.json())
      .then(data => {
        if (!data?.status) {
          setStatus("error");
          return;
        }

        if (data.status === "active") setStatus("active");
        else if (data.status === "redeemed") setStatus("redeemed");
        else setStatus("invalid");

        if (data.offline_token) {
          setOfflineToken(data.offline_token);
          localStorage.setItem("sliper_offline_token", data.offline_token);
        }
      })
      .catch(() => {
        // offline fallback
        const cached = localStorage.getItem("sliper_offline_token");
        if (cached) setOfflineToken(cached);
        setStatus("active");
      });
  }, []);

  /* === REDEEM === */
  const redeemTicket = async () => {
    if (!uuid || redeeming) return;

    setRedeeming(true);

    try {
      const res = await fetch(`${REDEEM_WEBHOOK}?t=${uuid}`, {
        method: "POST",
      });
      const data = await res.json();

      if (data?.success) {
        setStatus("redeemed");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div style={styles.page}>
      {status === "loading" && <p>Загрузка билета…</p>}

      {/* === ACTIVE === */}
      {status === "active" && (
        <>
          <h1 style={styles.title}>АКТИВЕН</h1>
          <p style={styles.subtitle}>Покажите этот экран на кассе</p>

          <button
            style={styles.primaryButton}
            onClick={redeemTicket}
            disabled={redeeming}
          >
            {redeeming ? "ПРОВЕРКА…" : "ПОГАСИТЬ БИЛЕТ"}
          </button>

          <p style={styles.hint}>Нажимайте только на кассе</p>

          <div style={styles.cashierBlock}>
            Кассир <strong>ничего не вводит</strong><br />
            Достаточно увидеть экран
          </div>

          {/* === OFFLINE LINK === */}
          {offlineToken && (
            <>
              <button
                style={styles.link}
                onClick={() => setShowOffline(v => !v)}
              >
                {showOffline ? "Скрыть аварийный код" : "Нет интернета?"}
              </button>

              {showOffline && (
                <div style={styles.offlineBox}>
                  <div style={styles.offlineWarning}>
                    ⚠️ Используйте этот код <strong>только если</strong><br />
                    кнопка «Погасить билет» не работает
                  </div>

                  <h3 style={styles.offlineTitle}>АВАРИЙНЫЙ КОД</h3>
                  <p style={styles.offlineSubtitle}>Только если нет интернета</p>

                  <div style={styles.code}>{offlineToken}</div>

                  <p style={styles.offlineMeta}>Одноразовый</p>
                  <p style={styles.offlineMeta}>
                    Кассир ничего не вводит
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* === REDEEMED === */}
      {status === "redeemed" && (
        <>
          <h1 style={styles.title}>БИЛЕТ ИСПОЛЬЗОВАН</h1>
          <p style={styles.subtitle}>
            Повторное использование невозможно
          </p>
        </>
      )}

      {/* === INVALID / ERROR === */}
      {(status === "invalid" || status === "error") && (
        <>
          <h1 style={styles.title}>БИЛЕТ НЕДЕЙСТВИТЕЛЕН</h1>
          <p style={styles.subtitle}>
            Он уже был использован или истёк
          </p>
        </>
      )}
    </div>
  );
}

/* === STYLES === */
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: COLORS.bg,
    color: COLORS.text,
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
    letterSpacing: "0.5px",
  },
  subtitle: {
    color: COLORS.muted,
  },
  primaryButton: {
    marginTop: "12px",
    padding: "16px 24px",
    fontSize: "18px",
    fontWeight: 800,
    background: COLORS.accent,
    color: COLORS.bg,
    border: "none",
    borderRadius: "14px",
    width: "100%",
    maxWidth: "320px",
    cursor: "pointer",
  },
  hint: {
    fontSize: "14px",
    color: COLORS.mutedWeak,
  },
  cashierBlock: {
    fontSize: "14px",
    color: COLORS.muted,
    lineHeight: 1.4,
  },
  link: {
    marginTop: "24px",
    background: "none",
    border: "none",
    color: COLORS.accent,
    textDecoration: "underline",
    cursor: "pointer",
    fontSize: "15px",
  },
  offlineBox: {
    marginTop: "16px",
    padding: "16px",
    border: `1px solid rgba(184,251,60,0.6)`,
    borderRadius: "14px",
    maxWidth: "340px",
    opacity: 0.95,
  },
  offlineWarning: {
    fontSize: "13px",
    marginBottom: "12px",
    color: COLORS.muted,
  },
  offlineTitle: {
    fontSize: "16px",
    fontWeight: 800,
  },
  offlineSubtitle: {
    fontSize: "13px",
    color: COLORS.mutedWeak,
  },
  code: {
    fontSize: "26px",
    letterSpacing: "6px",
    margin: "12px 0",
    fontWeight: 900,
  },
  offlineMeta: {
    fontSize: "13px",
    color: COLORS.mutedWeak,
  },
};
