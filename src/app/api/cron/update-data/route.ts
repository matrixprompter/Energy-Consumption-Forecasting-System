import { NextResponse } from "next/server";

const ML_API_URL = process.env.NEXT_PUBLIC_ML_API_URL || "http://localhost:8000";

export async function GET() {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const res = await fetch(`${ML_API_URL}/update-data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_date: oneDayAgo.toISOString(),
        to_date: now.toISOString(),
      }),
    });

    const data = await res.json();
    return NextResponse.json({ status: "ok", ...data });
  } catch {
    return NextResponse.json({ status: "error", message: "ML API unavailable" }, { status: 503 });
  }
}
