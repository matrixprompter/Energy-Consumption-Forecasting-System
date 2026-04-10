import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const model = searchParams.get("model") || "xgboost";
  const horizon = searchParams.get("horizon");

  const supabase = createAdminClient();

  let query = supabase
    .from("forecasts")
    .select("*")
    .eq("model_name", model)
    .order("created_at", { ascending: false })
    .limit(10);

  if (horizon) query = query.eq("forecast_horizon", parseInt(horizon, 10));

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
