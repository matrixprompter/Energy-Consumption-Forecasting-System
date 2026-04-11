import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelName = searchParams.get("model");
  const supabase = createAdminClient();

  if (modelName) {
    const { data, error } = await supabase
      .from("forecasts")
      .select("*")
      .eq("model_name", modelName)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) return NextResponse.json({ forecast: null });
    return NextResponse.json({ forecast: data[0] });
  }

  // Her iki model için en son tahmini getir
  const results: Record<string, unknown> = {};
  for (const m of ["prophet", "xgboost"]) {
    const { data } = await supabase
      .from("forecasts")
      .select("*")
      .eq("model_name", m)
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      results[m] = data[0];
    }
  }

  return NextResponse.json(results);
}
