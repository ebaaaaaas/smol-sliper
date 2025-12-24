"use client";

import { useEffect, useState } from "react";

const INFO_WEBHOOK = "https://myn8nbeget.su/webhook/ticket-info";
const REDEEM_WEBHOOK = "https://myn8nbeget.su/webhook/redeem-ticket";

type Status = "loading" | "active" | "redeemed" | "invalid" | "error";

function normalize(v: any): string | null {
  if (typeof v !== "string") return null;
  return v.startsWith("=") ? v.slice(1) : v;
}

export default function TicketPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [uuid, setUuid] = useState<string | null>(null);

  const [offlineToken, setOfflineToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const [showOffline, setShowOffline] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  // === INIT: ticket-info ===
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("t");

    if (!t) {
      setStatus("invalid");
      return;
    }

    setUuid(t);

    (async () => {
      try {
        const res = await fetch(INFO_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ t }),
        });

        const raw = await res.json();
        const data = Array.isArray(raw) ? raw[0] : raw;

        const s = normalize(data?.status);

        if (s === "active") {
          setStatus("active");
          setOfflineToken(normalize(data.offline_token));
          setExpiresAt(normalize(data.expires_at));
        } else if (s === "redeemed") {
          setStatus("redeemed");
        } else {
          setStatus("invalid");
        }
      } catch {
        setStatus("error");
      }
    })();
  }, []);

  // === REDEEM ===
  async function redeem() {
    if (!uuid || redeeming) return;

    setRedeeming(true);

    try {
      const res = await fetch(`${REDEEM_WEBHOOK}?t=${uuid}`, {
        method: "POST",
      });

      const raw = await res.json();
      const data = Array.isArray(raw) ? raw[0] : raw;

      if (data?.result === "success" || data?.result === "already_redeemed") {
        setStatus("redeemed");
        setShowOffline(false);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setRedeeming(false);
    }
  }

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

          <button style={styles.button} onClick={redeem} disabled={redeeming}>
            {redeeming ? "ПРОВЕРКА…" : "ПОГАСИТЬ БИЛЕТ"}
          </button>

          <p style={styles.hint}>
            Нажимайте только на кассе<br />
            Кассиру ничего вводить не нужно
          </p>

          {offlineToken && (
            <>
              <button style={styles.link} onClick={() => setShowOffline(v => !v)}>
                {showOffline ? "Скрыть аварийный код" : "Нет интернета?"}
              </button>

              {showOffline && (
                <div style={styles.offlineBox}>
                  <p style={styles.offlineWarn}>
                    Используйте код <b>только</b> если кнопка не работает
                  </p>

                  <div style={styles.code}>{offlineToken}</div>

                  {expiresAt && (
                    <p style={styles.offlineMeta}>
                      Действителен до {formatTime(expiresAt)}
                    </p>
                  )}

                  <p style={styles.offlineMeta}>Одноразовый</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {status === "redeemed" && (
        <>
          <h1 style={styles.title}>БИЛЕТ ИСПОЛЬЗОВАН</h1>
          <p style={styles.text}>Повтор невозможен</p>
        </>
      )}

      {status === "error" && (
        <>
          <h1 style={styles.title}>ОШИБКА СВЯЗИ</h1>
          <p style={styles.text}>Попробуйте ещё раз</p>
        </>
      )}
    </div>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

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
  title: { fontSize: "28px", fontWeight: 900 },
  text: { opacity: 0.8 },
  hint: { fontSize: "14px", opacity: 0.6 },
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
  link: {
    marginTop: "20px",
    background: "none",
    border: "none",
    color: "#B8FB3C",
    textDecoration: "underline",
    cursor: "pointer",
  },
  offlineBox: {
    marginTop: "12px",
    padding: "14px",
    border: "1px solid rgba(184,251,60,0.6)",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.05)",
    maxWidth: "320px",
  },
  offlineWarn: { fontSize: "13px", opacity: 0.85 },
  code: {
    fontSize: "26px",
    fontWeight: 900,
    letterSpacing: "6px",
    margin: "12px 0",
  },
  offlineMeta: { fontSize: "13px", opacity: 0.6 },
};
