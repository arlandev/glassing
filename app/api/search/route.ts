import { admin, userFrom } from "@/lib/admin";
import { nextSearchAt, windowStart } from "@/lib/cooldown";
import { SEARCH_PROFILE_COLUMNS, runSearches, type SearchProfile } from "@/lib/scan";
import { canMatch } from "@/lib/score";

export const maxDuration = 120;

// "Search now" on the dashboard: one manual search per scheduled-scan window (lib/cooldown.ts).
export async function POST(req: Request) {
  const user = await userFrom(req);
  if (!user) return Response.json({ error: "sign in first" }, { status: 401 });
  const db = admin();

  // Claim this window's search in one update, so a double click can't run two.
  const previous = await db
    .from("profiles")
    .select("mode, skills, target_title, last_manual_scan_at")
    .eq("id", user.id)
    .single();
  if (previous.error) throw previous.error;
  if (!previous.data.target_title) return Response.json({ error: "save a target job title first" }, { status: 400 });
  if (!canMatch(previous.data)) {
    return Response.json({ error: "upload your resume first, or switch to job title only" }, { status: 400 });
  }

  const claimed = await db
    .from("profiles")
    .update({ last_manual_scan_at: new Date().toISOString() })
    .eq("id", user.id)
    .or(`last_manual_scan_at.is.null,last_manual_scan_at.lt."${new Date(windowStart()).toISOString()}"`)
    .select(SEARCH_PROFILE_COLUMNS);
  if (claimed.error) throw claimed.error;
  if (!claimed.data.length) {
    const next = nextSearchAt(previous.data.last_manual_scan_at) ?? Date.now();
    return Response.json({ error: "already searched", next_at: new Date(next).toISOString() }, { status: 429 });
  }

  const result = await runSearches(db, claimed.data as SearchProfile[], new Date().toISOString());
  if (result.failedSearches) {
    // The provider failed, so give the search back rather than spend the user's turn.
    await db.from("profiles").update({ last_manual_scan_at: previous.data.last_manual_scan_at }).eq("id", user.id);
    return Response.json({ error: "the job search failed, try again in a minute" }, { status: 502 });
  }
  return Response.json({ new_matches: result.newMatches });
}
