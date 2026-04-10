import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service Role client — RLS'yi bypass eder.
 * Sadece sunucu tarafında kullanılmalı (API routes, cron jobs, migration scriptleri).
 * ASLA tarayıcıya gönderme!
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
