import type { SupabaseClient } from "@supabase/supabase-js";
import { searchJobs } from "@/lib/jsearch";
import { MIN_SCORE, scoreJob } from "@/lib/score";

export const SEARCH_PROFILE_COLUMNS = "id, target_title, country, location, remote_only, skills, seniority";

export type SearchProfile = {
  id: string;
  target_title: string;
  country: string;
  location: string | null;
  remote_only: boolean;
  skills: string[];
  seniority: string | null;
};

// Searches JSearch for these profiles and saves new matches. Users with the same search share one request.
// Pass `notifiedAt` to save matches as already seen (a user who searched on the dashboard doesn't need an email).
export async function runSearches(db: SupabaseClient, profiles: SearchProfile[], notifiedAt: string | null = null) {
  const searches = new Map<string, SearchProfile[]>();
  for (const p of profiles) {
    const key = [p.target_title, p.country, p.location ?? "", p.remote_only].join("|").toLowerCase();
    searches.set(key, [...(searches.get(key) ?? []), p]);
  }

  let failedSearches = 0;
  let newMatches = 0;
  for (const users of searches.values()) {
    const { target_title, country, location, remote_only } = users[0];
    let jobs;
    try {
      jobs = await searchJobs(target_title, country, location, remote_only);
    } catch (e) {
      console.error(e); // one bad search shouldn't stop everyone else's
      failedSearches++;
      continue;
    }
    if (!jobs.length) continue;

    const saved = await db.from("jobs").upsert(jobs, { onConflict: "id", ignoreDuplicates: true });
    if (saved.error) throw saved.error;

    const matches = users.flatMap((u) =>
      jobs
        .map((j) => ({ user_id: u.id, job_id: j.id, score: scoreJob(u, j), notified_at: notifiedAt }))
        .filter((m) => m.score >= MIN_SCORE),
    );
    if (!matches.length) continue;
    // Matches a user already has are skipped, so a listing is never sent to the same person twice.
    const matched = await db
      .from("matches")
      .upsert(matches, { onConflict: "user_id,job_id", ignoreDuplicates: true })
      .select("job_id");
    if (matched.error) throw matched.error;
    newMatches += matched.data.length;
  }

  return { searches: searches.size, failedSearches, newMatches };
}
