import { admin } from "@/lib/admin";
import { sendMatches } from "@/lib/email";
import { SEARCH_PROFILE_COLUMNS, runSearches, type SearchProfile } from "@/lib/scan";

export const maxDuration = 300;

type Pending = {
  user_id: string;
  job_id: string;
  score: number;
  profiles: { email: string; target_title: string; country: string };
  jobs: { title: string; company: string | null; location: string | null; url: string };
};

// Called every 4 hours by the Railway cron service `scan-cron` (see README).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const db = admin();

  const { data, error } = await db.from("profiles").select(SEARCH_PROFILE_COLUMNS).not("target_title", "is", null);
  if (error) throw error;
  const { searches, failedSearches } = await runSearches(db, data as SearchProfile[]);

  // Email every unsent match, including any left over from a send that failed on the last run.
  const pending = await db
    .from("matches")
    .select("user_id, job_id, score, profiles(email, target_title, country), jobs(title, company, location, url)")
    .is("notified_at", null)
    .order("score", { ascending: false });
  if (pending.error) throw pending.error;

  // Without generated Supabase types, embedded rows come back loosely typed.
  const byUser = Map.groupBy(pending.data as unknown as Pending[], (m) => m.user_id);
  let emailed = 0;
  for (const [userId, rows] of byUser) {
    try {
      const { email, target_title, country } = rows[0].profiles;
      await sendMatches(email, { title: target_title, country }, rows.map((r) => ({ ...r.jobs, score: r.score })));
    } catch (e) {
      console.error(e); // left unsent, retried next run
      continue;
    }
    const marked = await db
      .from("matches")
      .update({ notified_at: new Date().toISOString() })
      .eq("user_id", userId)
      .in("job_id", rows.map((r) => r.job_id));
    if (marked.error) throw marked.error;
    emailed++;
  }

  return Response.json({ searches, failedSearches, emailed });
}
