"use client";

import { useEffect, useState } from "react";

const INFO_WEBHOOK = "https://myn8nbeget.su/webhook/ticket-info";

export default function TicketPage() {
  const [raw, setRaw] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("t");

    if (!t) {
      setError("Нет параметра t в URL");
      return;
    }

    (async () => {
      try {
        const res = await fetch(INFO_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ t }),
        });

        const text = await res.text();

        try {
          const json = JSON.parse(text);
          setRaw(json);
        } catch {
          setRaw({ parseError: true, text });
        }
      } catch (e: any) {
        setError(e?.message || "fetch error");
      }
    })();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000B3B",
        color: "#FFFFFF",
        padding: "20px",
        fontFamily: "monospace",
      }}
    >
      <h1 style={{ color: "#B8FB3C" }}>Smol.Drop / ticket-info debug</h1>

      {error && (
        <pre style={{ color: "red" }}>
          ERROR:
          {"\n"}
          {error}
        </pre>
      )}

      <pre
        style={{
          marginTop: "20px",
          padding: "16px",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(184,251,60,0.4)",
          borderRadius: "12px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        RAW RESPONSE:
        {"\n\n"}
        {raw ? JSON.stringify(raw, null, 2) : "loading…"}
      </pre>
    </div>
  );
}