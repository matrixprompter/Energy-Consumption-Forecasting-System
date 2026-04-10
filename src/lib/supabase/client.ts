import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Tarayıcı tarafı Supabase client (Client Components için)
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
