import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("forecasts")
    .select("metadata")
    .eq("model_name", "xgboost")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = (data as any)?.[0];
  if (!row?.metadata) {
    return NextResponse.json({ features: [] });
  }

  // metadata JSON string veya obje olabilir
  let meta = row.metadata;
  if (typeof meta === "string") {
    try { meta = JSON.parse(meta); } catch { meta = {}; }
  }

  const features = (meta as Record<string, unknown>).shap || [];
  return NextResponse.json({ features });
}
