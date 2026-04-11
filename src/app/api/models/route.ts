import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createAdminClient();

  const models = ["prophet", "xgboost"];
  const results = [];

  for (const model of models) {
    const { data } = await supabase
      .from("forecasts")
      .select("model_name, mape, rmse, mae, created_at")
      .eq("model_name", model)
      .order("created_at", { ascending: false })
      .limit(1);

    results.push({
      name: model,
      latest: data?.[0] || null,
    });
  }

  return NextResponse.json({ models: results });
}
