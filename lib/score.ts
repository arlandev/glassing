export const MIN_SCORE = 60;

export type ScoreProfile = {
  target_title: string | null;
  location: string | null;
  remote_only: boolean;
  skills: string[];
  seniority: string | null;
};

export type ScoreJob = {
  title: string;
  description: string | null;
  location: string | null;
  is_remote: boolean | null;
};

const LEVELS = ["junior", "mid", "senior", "lead"];
const STOP = new Set(["and", "of", "the", "a", "an", "in", "for", "to", "with", "i", "ii", "iii"]);

const words = (s: string) =>
  s.toLowerCase().split(/[^a-z0-9+#.]+/).map((w) => w.replace(/\.$/, "")).filter((w) => w && !STOP.has(w));

// Whole-term match that also works for terms like "c++", "c#" and "node.js".
const hasTerm = (text: string, term: string) =>
  new RegExp(`(?<![a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`).test(text);

export function levelOf(jobTitle: string) {
  const t = jobTitle.toLowerCase();
  if (/\b(intern|junior|jr|entry|graduate)\b/.test(t)) return 0;
  if (/\b(lead|principal|staff|head|director)\b/.test(t)) return 3;
  if (/\b(senior|sr)\b/.test(t)) return 2;
  return 1;
}

// 0-100: title 40, skills 40, seniority 10, location 10.
export function scoreJob(p: ScoreProfile, j: ScoreJob) {
  if (p.remote_only && !j.is_remote) return 0;

  const target = words(p.target_title ?? "");
  const title = new Set(words(j.title));
  const titleFit = target.length ? target.filter((w) => title.has(w)).length / target.length : 0;

  // A posting rarely lists everything a person knows, so 8 hits counts as a full skills match.
  const text = `${j.title} ${j.description ?? ""}`.toLowerCase();
  const hits = p.skills.filter((s) => hasTerm(text, s.toLowerCase())).length;
  const skillFit = p.skills.length ? Math.min(hits / Math.min(p.skills.length, 8), 1) : 0;

  const level = LEVELS.indexOf(p.seniority ?? "");
  const levelFit = level < 0 ? 0.5 : [1, 0.5, 0, 0][Math.abs(level - levelOf(j.title))];

  const city = (p.location ?? "").split(",")[0].trim().toLowerCase();
  const placeFit = j.is_remote || !city || (j.location ?? "").toLowerCase().includes(city) ? 1 : 0;

  return Math.round(40 * titleFit + 40 * skillFit + 10 * levelFit + 10 * placeFit);
}
