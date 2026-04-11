import { NextResponse } from "next/server";

const ML_API = process.env.NEXT_PUBLIC_ML_API_URL || "http://localhost:8000";

export async function GET() {
  try {
    const now = new Date();
    const from = new Date(now.getTime() - 2 * 3600000); // son 2 saat
    const to = now;

    const res = await fetch(`${ML_API}/update-data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_date: from.toISOString(),
        to_date: to.toISOString(),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "ML API unreachable" },
      { status: 503 }
    );
  }
}
