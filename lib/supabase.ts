import { createClient } from "@supabase/supabase-js";

// TODO(Phase 2): once supabase/schema.sql has been run against your Supabase
// project, generate the typed `Database` definition (e.g. via
// `supabase gen types typescript`) and replace the `any` below with
// `createClient<Database>(...)` so every query is fully typed.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly at build/boot time rather than surfacing a confusing runtime
  // error the first time a query is made.
  console.warn(
    "[KrishiBandhu] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { "cache-control": "no-store" } },
});
