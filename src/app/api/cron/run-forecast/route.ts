import { NextResponse } from "next/server";

const ML_API = process.env.NEXT_PUBLIC_ML_API_URL || "http://localhost:8000";

export async function GET() {
  const results: Record<string, unknown> = {};

  for (const model of ["prophet", "xgboost"]) {
    try {
      const res = await fetch(`${ML_API}/forecast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, horizon: 24 }),
      });

      if (res.ok) {
        results[model] = await res.json();
      } else {
        results[model] = { error: await res.text(), status: res.status };
      }
    } catch (e) {
      results[model] = { error: e instanceof Error ? e.message : "ML API unreachable" };
    }
  }

  // SHAP verilerini de al
  try {
    const shapRes = await fetch(`${ML_API}/feature-importance`);
    if (shapRes.ok) {
      results.shap = await shapRes.json();
    }
  } catch { /* opsiyonel */ }

  return NextResponse.json({ ok: true, results });
}
