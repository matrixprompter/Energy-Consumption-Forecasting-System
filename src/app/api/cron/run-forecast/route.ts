import { NextResponse } from "next/server";

const ML_API_URL = process.env.NEXT_PUBLIC_ML_API_URL || "http://localhost:8000";

export async function GET() {
  const results: Record<string, unknown> = {};

  for (const model of ["prophet", "xgboost", "sarima"]) {
    try {
      const res = await fetch(`${ML_API_URL}/forecast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, horizon: 24, region: "TR" }),
      });
      results[model] = await res.json();
    } catch {
      results[model] = { error: "failed" };
    }
  }

  return NextResponse.json({ status: "ok", results });
}
