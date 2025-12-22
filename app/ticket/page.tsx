"use client";

import { useEffect, useMemo, useState } from "react";

/* === N8N ENDPOINTS === */
const INFO_WEBHOOK = "https://myn8nbeget.su/webhook/ticket-info";    // POST-only
const REDEEM_WEBHOOK = "https://myn8nbeget.su/webhook/redeem-ticket"; // POST, uuid in query ?t=

/* === BRAND COLORS === */
const COLORS = {
  bg: "#000B3B",
  accent: "#B8FB3C",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,0.70)",
  mutedWeak: "rgba(255,255,255,0.55)",
  box: "rgba(255,255,255,0.06)",
};

type TicketStatus = "loading" | "active" | "redeemed" | "invalid" | "error";

function safeUpperToken(x: unknown): string | null {
  if (!x) return null;
  const s = String(x).trim();
  if (!s) return null;
  return s.toUpperCase();
}

/** n8n sometimes returns array of items; normalize to object */
function normalizeN8n(data: any): any {
  if (Array.isArray(data)) return data[0] ?? {};
  return data ?? {};
}

export default function TicketPage() {
  const [status, setStatus] = useState<TicketStatus>("loading");
  const [uuid, setUuid] = useState<string | null>(null);

  const [offlineToken, setOfflineToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [showOffline, setShowOffline] = useState(false);

  const [redeeming, setRedeeming] = useState(false);

  const ticketUrlUuid = useMemo(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("t");
  }, []);

  /* === LOAD TICKET (POST to ticket-info) === */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const t = ticketUrlUuid;
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
          // отправляем и в body, и в query-стиле не надо — тут body достаточно
          body: JSON.stringify({ t }),
        });

        const raw = await res.json();
        const data = normalizeN8n(raw);

        // статус может называться по-разному
        const s =
          (data.status ?? data.ticket_status ?? data.state ?? "").toString().toLowerCase();

        if (s === "active") setStatus("active");
        else if (s === "redeemed") setStatus("redeemed");
        else if (s === "invalid" || s === "not_found" || s === "no_uuid") setStatus("invalid");
        else {
          // если статус не пришёл — это ошибка контракта/сети
          setStatus("error");
        }

        // токен тоже может называться по-разному
        const tok = safeUpperToken(data.offline_token ?? data.code ?? data.offlineCode ?? data.token);
        if (tok) {
          setOfflineToken(tok);
          localStorage.setItem("sliper_offline_token", tok);
        } else {
          // если не пришёл — пробуем кеш (только как UX-fallback, не как “истина”)
          const cached = localStorage.getItem("sliper_offline_token");
          if (cached) setOfflineToken(safeUpperToken(cached));
        }

        const exp = data.expires_at ?? data.expiresAt ?? null;
        if (exp) setExpiresAt(String(exp));
      } catch (e) {
        // сеть/ошибка n8n: всё равно показываем active, но без гарантий, с оффлайн-опцией если есть кеш
        const cached = localStorage.getItem("sliper_offline_token");
        if (cached) setOfflineToken(safeUpperToken(cached));
        setStatus("error");
      }
    })();
  }, [ticketUrlUuid]);

  /* === REDEEM (POST to redeem-ticket with query ?t=uuid; response is ARRAY with result) === */
  const redeemTicket = async () => {
    if (!uuid || redeeming) return;

    setRedeeming(true);
    try {
      const res = await fetch(`${REDEEM_WEBHOOK}?t=${encodeURIComponent(uuid)}`, {
        method: "POST",
        // body пустой — как у тебя сейчас, n8n берёт query.t
      });

      const raw = await res.json();
      const data = normalizeN8n(raw);

      // твой workflow возвращает result: success / already_redeemed / not_found
      const r = (data.result ?? "").toString().toLowerCase();

      if (r === "success" || r === "already_redeemed") {
        setStatus("redeemed");
        // после успеха прячем оффлайн (чтобы не было “альтернативы”)
        setShowOffline(false);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setRedeeming(false);
    }
  };

  const showOfflineLink = status === "active" && !!offlineToken;

  return (
    <div style={styles.page}>
      {status === "loading" && <p style={styles.subtitle}>Загрузка билета…</p>}

      {status === "active" && (
        <>
          <h1 style={styles.title}>АКТИВЕН</h1>
          <p style={styles.subtitle}>Покажите этот экран на кассе</p>

          <button style={styles.primaryButton} onClick={redeemTicket} disabled={redeeming}>
            {redeeming ? "ПРОВЕРКА…" : "ПОГАСИТЬ БИЛЕТ"}
          </button>

          <p style={styles.hint}>Нажимайте только на кассе</p>

          <div style={styles.cashierBlock}>
            Кассир <strong>ничего не вводит</strong>
            <br />
            Достаточно увидеть экран
          </div>

          {showOfflineLink && (
            <>
              <button style={styles.link} onClick={() => setShowOffline(v => !v)}>
                {showOffline ? "Скрыть аварийный код" : "Нет интернета?"}
              </button>

              {showOffline && (
                <div style={styles.offlineBox}>
                  <div style={styles.offlineWarning}>
                    ⚠️ Используйте этот код <strong>только если</strong>
                    <br />
                    кнопка «Погасить билет» не работает
                  </div>

                  <h3 style={styles.offlineTitle}>АВАРИЙНЫЙ КОД</h3>
                  <p style={styles.offlineSubtitle}>Только если нет интернета</p>

                  <div style={styles.code}>{offlineToken}</div>

                  {expiresAt && (
                    <p style={styles.offlineMeta}>
                      Действителен до: {formatTime(expiresAt)}
                    </p>
                  )}

                  <p style={styles.offlineMeta}>Одноразовый</p>
                  <p style={styles.offlineMeta}>Кассир ничего не вводит</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {status === "redeemed" && (
        <>
          <h1 style={styles.title}>БИЛЕТ ИСПОЛЬЗОВАН</h1>
          <p style={styles.subtitle}>Повторное использование невозможно</p>
        </>
      )}

      {status === "invalid" && (
        <>
          <h1 style={styles.title}>БИЛЕТ НЕДЕЙСТВИТЕЛЕН</h1>
          <p style={styles.subtitle}>Ссылка повреждена или билет не найден</p>
        </>
      )}

      {status === "error" && (
        <>
          <h1 style={styles.title}>ОШИБКА СВЯЗИ</h1>
          <p style={styles.subtitle}>Попробуйте ещё раз или используйте аварийный код</p>

          {showOfflineLink && (
            <button style={styles.link} onClick={() => setShowOffline(v => !v)}>
              {showOffline ? "Скрыть аварийный код" : "Открыть аварийный код"}
            </button>
          )}

          {showOffline && offlineToken && (
            <div style={styles.offlineBox}>
              <div style={styles.offlineWarning}>
                ⚠️ Используйте этот код <strong>только если</strong>
                <br />
                кнопка «Погасить билет» не работает
              </div>

              <h3 style={styles.offlineTitle}>АВАРИЙНЫЙ КОД</h3>
              <p style={styles.offlineSubtitle}>Только если нет интернета</p>
              <div style={styles.code}>{offlineToken}</div>

              {expiresAt && (
                <p style={styles.offlineMeta}>
                  Действителен до: {formatTime(expiresAt)}
                </p>
              )}

              <p style={styles.offlineMeta}>Одноразовый</p>
              <p style={styles.offlineMeta}>Кассир ничего не вводит</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function formatTime(iso: string): string {
  // простой формат без локалей: HH:MM (по локальному времени устройства)
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
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
    maxWidth: "360px",
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
    maxWidth: "360px",
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
    maxWidth: "360px",
    background: COLORS.box,
  },
  offlineWarning: {
    fontSize: "13px",
    marginBottom: "12px",
    color: COLORS.muted,
    lineHeight: 1.35,
  },
  offlineTitle: {
    fontSize: "16px",
    fontWeight: 900,
    letterSpacing: "0.3px",
    margin: 0,
  },
  offlineSubtitle: {
    fontSize: "13px",
    color: COLORS.mutedWeak,
    marginTop: "6px",
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
    marginTop: "6px",
  },
};
