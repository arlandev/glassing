import type { SupabaseClient } from "@supabase/supabase-js";
import { searchJobs } from "@/lib/jsearch";
import { type RateJob, type RateProfile, rateNewMatches } from "@/lib/rate";
import { MIN_SCORE, canMatch, scoreJob } from "@/lib/score";
import { matchKey } from "@/lib/text";

export const SEARCH_PROFILE_COLUMNS =
  "id, mode, target_title, country, location, remote_only, skills, seniority, summary, years_experience";

export type SearchProfile = {
  id: string;
  mode: string;
  target_title: string;
  country: string;
  location: string | null;
  remote_only: boolean;
  skills: string[];
  seniority: string | null;
  summary: string | null;
  years_experience: number | null;
};

// Searches JSearch for these profiles and saves new matches. Users with the same search share one request.
// Pass `notifiedAt` to save matches as already seen (a user who searched on the dashboard doesn't need an email).
export async function runSearches(db: SupabaseClient, profiles: SearchProfile[], notifiedAt: string | null = null) {
  const searches = new Map<string, SearchProfile[]>();
  for (const p of profiles.filter(canMatch)) {
    const key = [p.target_title, p.country, p.location ?? "", p.remote_only].join("|").toLowerCase();
    searches.set(key, [...(searches.get(key) ?? []), p]);
  }

  let failedSearches = 0;
  let newMatches = 0;
  const toRate: { profile: RateProfile; job: RateJob; score: number }[] = [];
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

    // shortcut: unstable JSearch ids mean a repeat posting adds a new (unmatched) jobs row each run; prune old jobs rows if the table gets big.
    const saved = await db.from("jobs").upsert(jobs, { onConflict: "id", ignoreDuplicates: true });
    if (saved.error) throw saved.error;

    const matches = users.flatMap((u) =>
      jobs
        .map((j) => ({
          user_id: u.id,
          job_id: j.id,
          dedupe_key: matchKey(j.title, j.company),
          score: scoreJob(u, j),
          notified_at: notifiedAt,
        }))
        .filter((m) => m.score >= MIN_SCORE),
    );
    if (!matches.length) continue;
    // A posting a user already has (same title + company, whatever job_id JSearch gave it this time) is skipped,
    // so a listing is never sent to the same person twice.
    const matched = await db
      .from("matches")
      .upsert(matches, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
      .select("user_id, job_id, score");
    if (matched.error) throw matched.error;
    newMatches += matched.data.length;

    // Resume-mode users get an AI second opinion on their best new matches (title-only has no resume to compare).
    for (const m of matched.data) {
      const profile = users.find((u) => u.id === m.user_id);
      const job = jobs.find((j) => j.id === m.job_id);
      if (profile?.mode === "resume" && job) toRate.push({ profile, job, score: m.score });
    }
  }

  await rateNewMatches(db, toRate);
  return { searches: searches.size, failedSearches, newMatches };
}
