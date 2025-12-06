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
      // Локально, если забыли настроить .env
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

    const data = await n8nRes.json().catch(() => ({}));

    if (!n8nRes.ok) {
      return NextResponse.json(
        { ok: false, error: (data as any).error || "REDEEM_FAILED" },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    console.error("REDEEM_ERROR", e);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
