// ─── Supabase Client Init ───
// Reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from env.
// The Database type will be filled in once the Supabase schema exists (Phase 2+).
// TODO: Replace `Record<string, unknown>` with the generated Database type once
// the Supabase schema is created. Import from `@/generated/supabase` or equivalent.

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

type Database = Record<string, unknown>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase: SupabaseClient<Database> = createClient(
  supabaseUrl,
  supabaseAnonKey
);
