import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createAdminClient();
  const periods = ["1d", "7d", "30d", "90d", "180d", "1y"];
  const allResults: Record<string, unknown> = {};

  for (const p of periods) {
    const { data } = await supabase
      .from("model_comparisons")
      .select("*")
      .eq("dataset_period", p)
      .order("run_at", { ascending: false })
      .limit(1);

    if (!data || data.length === 0) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = data[0] as any;
    let notesMetrics: Record<string, unknown> = {};
    if (row.notes) {
      try {
        notesMetrics = JSON.parse(row.notes);
      } catch { /* ignore */ }
    }

    const periodResult: Record<string, unknown> = {};
    for (const modelName of ["prophet", "xgboost"]) {
      if (modelName in notesMetrics) {
        periodResult[modelName] = notesMetrics[modelName];
      } else {
        periodResult[modelName] = {
          mape: row[`${modelName}_mape`],
          rmse: null, mae: null, r2: null,
        };
      }
    }
    periodResult.winner = row.winner;
    allResults[p] = periodResult;
  }

  return NextResponse.json(allResults);
}
