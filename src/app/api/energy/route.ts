import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const region = searchParams.get("region") || "TR";
  const limit = parseInt(searchParams.get("limit") || "500", 10);

  const supabase = createAdminClient();

  // Supabase max 1000 rows per query — paginate for larger requests
  const allData: unknown[] = [];
  const batchSize = 1000;
  let offset = 0;

  while (allData.length < limit) {
    const currentBatch = Math.min(batchSize, limit - allData.length);
    let query = supabase
      .from("energy_readings")
      .select("*")
      .eq("region", region)
      .order("timestamp", { ascending: false })
      .range(offset, offset + currentBatch - 1);

    if (from) query = query.gte("timestamp", from);
    if (to) query = query.lte("timestamp", to);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) break;

    allData.push(...data);
    offset += data.length;

    if (data.length < currentBatch) break;
  }

  return NextResponse.json({ data: allData, total: allData.length });
}
