import { NextRequest, NextResponse } from "next/server";

const N8N_WEBHOOK_URL = process.env.N8N_REDEEM_WEBHOOK_URL;

export async function POST(req: NextRequest) {
  try {
    const { uuid } = await req.json();

    if (!uuid || typeof uuid !== "string") {
      return NextResponse.json(
        { ok: false, error: "INVALID_UUID" },
        { status: 400 }
      );
    }

    if (!N8N_WEBHOOK_URL) {
      return NextResponse.json(
        { ok: false, error: "WEBHOOK_NOT_CONFIGURED" },
        { status: 500 }
      );
    }

    const n8nRes = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uuid }),
    });

    const raw = await n8nRes.text();

    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // ответ не JSON — оставим raw как есть
    }

    // ---- Достаём result из ответа n8n ----
    let result: string | undefined;

    if (Array.isArray(parsed) && parsed[0]?.result) {
      // классический ответ Postgres-ноды / responseNode
      result = parsed[0].result;
    } else if (parsed && typeof parsed === "object" && "result" in parsed) {
      result = (parsed as any).result;
    }

    // Успех только если:
    // - HTTP 200
    // - и result === "success" (или result отсутствует вообще)
    const isSuccess =
      n8nRes.ok && (result === "success" || result === undefined);

    if (!isSuccess) {
      const errorMessage =
        (parsed && parsed.error) ||
        result ||
        raw ||
        `REDEEM_FAILED_${n8nRes.status}`;

      return NextResponse.json(
        { ok: false, error: errorMessage },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      result: result ?? "success",
      data: parsed ?? raw,
    });
  } catch (e) {
    console.error("REDEEM_ERROR", e);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}