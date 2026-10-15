import { createClient } from "@supabase/supabase-js";

// Server-only client that bypasses row level security. Never import this from a client component.
export const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

// Returns the signed-in user for a request carrying `Authorization: Bearer <supabase access token>`.
export async function userFrom(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return null;
  const { data } = await admin().auth.getUser(token);
  return data.user;
}
