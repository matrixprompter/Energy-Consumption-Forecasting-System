import { NextRequest, NextResponse } from "next/server";

const ML_API_URL = process.env.NEXT_PUBLIC_ML_API_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await fetch(`${ML_API_URL}/scenario`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "ML API unavailable" },
      { status: 503 }
    );
  }
}
