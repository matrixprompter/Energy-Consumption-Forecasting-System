import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const region = searchParams.get("region") || "TR";
  const limit = parseInt(searchParams.get("limit") || "500", 10);

  const supabase = createAdminClient();

  let query = supabase
    .from("energy_readings")
    .select("*", { count: "exact" })
    .eq("region", region)
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (from) query = query.gte("timestamp", from);
  if (to) query = query.lte("timestamp", to);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, total: count });
}
