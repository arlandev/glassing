// JSearch gives the same posting a new job_id on every search, so a match is identified by title + company instead.
// Keep in sync with the backfill in supabase/migrations/20261016020000_match_dedupe.sql.
const norm = (s: string | null) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
export const matchKey = (title: string, company: string | null) => `${norm(title)}|${norm(company)}`;

// Shortens text at a word boundary instead of mid-word.
export function clip(text: string, max: number) {
  if (text.length <= max) return text;
  const space = text[max] === " " ? max : text.lastIndexOf(" ", max); // keep a word that ends right at the limit
  return `${text.slice(0, space > 0 ? space : max).replace(/[\s,;:.-]+$/, "")}…`;
}

// JSearch leaves job_is_remote off in many countries (every Philippine result we checked), even for "Remote ..." titles.
// shortcut: a description that only says "remote" in passing ("remote monitoring") counts too; check just the title if that gets noisy.
const REMOTE = /(?<!\b(?:non|not|no)[- ])\b(?:remote|work from home|work-from-home|wfh|home[- ]based|telecommute)\b/i;
export const mentionsRemote = (text: string) => REMOTE.test(text);

// A job board's favicon. DuckDuckGo's service answers directly for every board we've seen (Google's redirects).
export const iconUrl = (host: string) => `https://icons.duckduckgo.com/ip3/${host}.ico`;

// The job board a listing came from, from its apply link (e.g. "ph.jobstreet.com" -> "jobstreet.com").
export function sourceHost(url: string) {
  try {
    const parts = new URL(url).hostname.split(".");
    return parts.slice(parts.length > 2 && parts.at(-2)!.length > 3 ? -2 : -3).join(".").replace(/^www\./, "");
  } catch {
    return null;
  }
}
