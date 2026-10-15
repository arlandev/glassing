import { createClient } from "@supabase/supabase-js";

// Browser client. Row level security limits it to the signed-in user's rows.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
