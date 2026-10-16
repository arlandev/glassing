"use client";

import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useCallback, useEffect, useState } from "react";
import { nextSearchAt } from "@/lib/cooldown";
import { COUNTRIES } from "@/lib/countries";
import { canMatch } from "@/lib/score";
import { supabase } from "@/lib/supabase";
import { NEEDS_RESUME, TAILOR_PER_DAY, TAILOR_PER_MONTH } from "@/lib/tailor";

type Mode = "resume" | "title";

type Profile = {
  mode: Mode;
  target_title: string | null;
  country: string;
  location: string | null;
  remote_only: boolean;
  paused: boolean;
  summary: string | null;
  skills: string[];
  seniority: string | null;
  years_experience: number | null;
  last_manual_scan_at: string | null;
  suggested_titles: string[];
  resume: unknown; // the transcript tailoring rewrites; null until a resume is (re-)uploaded
};

type Match = {
  score: number;
  ai_score: number | null;
  ai_note: string | null;
  created_at: string;
  jobs: { id: string; title: string; company: string | null; location: string | null; is_remote: boolean | null; url: string };
};

function Window({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="dk-window">
      <div className="dk-window__bar">
        <span className="dk-lights"><i /><i /><i /></span>
        <h2 className="dk-window__title">{title}</h2>
      </div>
      <div className="dk-window__body stack">{children}</div>
    </section>
  );
}

// shortcut: the cooldown label is computed on render, so a tab left open past the unlock time needs a refresh.
function SearchNow({ profile, searching, onClick }: { profile: Profile; searching: boolean; onClick: () => void }) {
  const next = nextSearchAt(profile.last_manual_scan_at);
  const ready = canMatch(profile);
  const label = searching
    ? "searching…"
    : !profile.target_title
      ? "save a search first"
      : profile.paused
      ? "search paused"
      : !ready
      ? "upload your resume first"
      : next
      ? `search again at ${new Date(next).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase()}`
      : "search now";
  return (
    <button className="dk-btn dk-btn--sm dk-blue" onClick={onClick} disabled={searching || !ready || !!next || !profile.target_title || profile.paused}>
      {label}
    </button>
  );
}

const TITLE_ONLY_TIP =
  "job title only skips your resume: listings are scored on how closely the title matches yours, plus location. " +
  "expect more loosely related jobs and rougher scores.";

function ModePicker({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <div className="modes">
      <div className="dk-segmented" role="group" aria-label="how jobs are matched">
        <button type="button" className="dk-seg" aria-pressed={mode === "resume"} onClick={() => onChange("resume")}>
          match my resume
        </button>
        <button type="button" className="dk-seg" aria-pressed={mode === "title"} onClick={() => onChange("title")}>
          job title only
        </button>
      </div>
      {mode === "title" && (
        <span className="tip dk-badge dk-orange" tabIndex={0} data-tip={TITLE_ONLY_TIP}>
          noisier matches
        </span>
      )}
    </div>
  );
}

type Tailoring = { id: string; job_id: string; created_at: string };

// The feed shows matches from the last 30 days (postings go stale), 50 at a time.
const FEED_DAYS = 30;
const PAGE = 50;

// Slots used so far, on the same UTC day/month boundaries the server's claim_tailoring uses.
function tailorUsage(rows: Tailoring[]) {
  const now = new Date();
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const month = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const at = rows.map((r) => Date.parse(r.created_at));
  return { today: at.filter((t) => t >= day).length, month: at.filter((t) => t >= month).length };
}

export default function Dashboard({ session }: { session: Session }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [tailorings, setTailorings] = useState<Tailoring[]>([]);
  const [tailoring, setTailoring] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [total, setTotal] = useState(0);
  const router = useRouter();

  const load = useCallback(async () => {
    const [p, m, t] = await Promise.all([
      supabase.from("profiles").select("*").single(),
      supabase
        .from("matches")
        .select("score, ai_score, ai_note, created_at, jobs(id, title, company, location, is_remote, url)", { count: "exact" })
        .gte("created_at", new Date(Date.now() - FEED_DAYS * 864e5).toISOString())
        .order("score", { ascending: false })
        .range(0, shown - 1),
      supabase.from("tailorings").select("id, job_id, created_at").not("resume", "is", null),
    ]);
    if (p.error || m.error || t.error) return setStatus((p.error ?? m.error ?? t.error)!.message);
    setProfile(p.data);
    setMatches(m.data as unknown as Match[]); // embedded rows are loosely typed without generated types
    setTotal(m.count ?? m.data.length);
    setTailorings(t.data);
  }, [shown]);

  useEffect(() => {
    load(); // eslint-disable-line react-hooks/set-state-in-effect -- fetch on mount
  }, [load]);

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setStatus("reading your resume. this takes up to a minute.");
    const body = new FormData();
    body.append("resume", file);
    const res = await fetch("/api/resume", {
      method: "POST",
      body,
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const json = await res.json().catch(() => ({}));
    setStatus(res.ok ? "resume analyzed." : (json.error ?? "upload failed, try again."));
    setBusy(false);
    load();
  }

  async function tailor(jobId: string) {
    if (!profile?.resume) {
      return setStatus(profile?.summary ? "re-upload your resume once so ai can tailor it to jobs." : NEEDS_RESUME);
    }
    setTailoring(jobId);
    setStatus("tailoring your resume to this job. this takes up to a minute.");
    const res = await fetch("/api/tailor", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId }),
    });
    const json = await res.json().catch(() => ({}));
    setTailoring(null);
    if (res.ok) return router.push(`/tailor/${json.id}`);
    setStatus(json.error ?? "tailoring failed, try again.");
    load();
  }

  async function searchNow() {
    setSearching(true);
    setStatus("searching linkedin, indeed and more…");
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const json = await res.json().catch(() => ({}));
    const found = json.new_matches;
    setStatus(
      res.ok
        ? found
          ? `found ${found} new match${found === 1 ? "" : "es"}.`
          : "no new matches right now. we'll keep looking."
        : (json.error ?? "search failed, try again."),
    );
    setSearching(false);
    load();
  }

  async function setMode(mode: Mode) {
    const { error } = await supabase.from("profiles").update({ mode }).eq("id", session.user.id);
    setStatus(
      error
        ? error.message
        : mode === "title"
          ? "job title only: matching on the title you enter."
          : "matching against your resume.",
    );
    load();
  }

  async function setPaused(paused: boolean) {
    const { error } = await supabase.from("profiles").update({ paused }).eq("id", session.user.id);
    setStatus(
      error
        ? error.message
        : paused
          ? "search paused: no scans or match emails until you resume it."
          : "search resumed. the next scan picks it up.",
    );
    load();
  }

  async function deleteSearch() {
    if (!confirm("delete this search? scans and match emails stop. your past matches stay.")) return;
    const { error } = await supabase
      .from("profiles")
      .update({ target_title: null, location: null, remote_only: false, paused: false })
      .eq("id", session.user.id);
    setStatus(error ? error.message : "search deleted. save a new one any time.");
    load();
  }

  async function saveSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const { error } = await supabase
      .from("profiles")
      .update({
        target_title: String(form.get("title")).trim() || null,
        country: String(form.get("country")),
        location: String(form.get("location")).trim() || null,
        remote_only: form.get("remote") === "on",
      })
      .eq("id", session.user.id);
    setStatus(error ? error.message : "saved. the next hourly scan uses this search.");
    load();
  }

  if (!profile) return <p className="dk-container board dk-muted" role="status">{status || "loading…"}</p>;
  const usage = tailorUsage(tailorings);
  const tailoredFor = new Map(tailorings.map((t) => [t.job_id, t.id]));

  return (
    <main className="dk-container board">
      {status && <p className="dk-small dk-muted" role="status">{status}</p>}
      <ModePicker mode={profile.mode} onChange={setMode} />

      <div className="board__top">
        {profile.mode === "resume" && (
          <Window title="resume.pdf">
            {profile.summary ? (
              <>
                <p className="dk-text">{profile.summary}</p>
                <p className="dk-small dk-muted">
                  {profile.seniority} · {profile.years_experience} years
                </p>
                <div className="chips">
                  {profile.skills.map((s) => <span key={s} className="dk-badge">{s}</span>)}
                </div>
              </>
            ) : (
              <p className="dk-text dk-muted">upload your resume and we&apos;ll summarize it and pull out your skills.</p>
            )}
            {profile.summary && !profile.resume && (
              <p className="dk-small dk-muted">re-upload your resume once to unlock tailoring it to jobs.</p>
            )}
            <label className="dk-btn dk-blue" aria-disabled={busy}>
              {busy ? "reading…" : profile.summary ? "replace resume" : "upload resume"}
              <input className="sr-only" type="file" accept="application/pdf" disabled={busy} onChange={upload} />
            </label>
          </Window>
        )}

        <Window title="search">
          <form className="stack" onSubmit={saveSearch} key={profile.target_title ?? ""}>
            <label>
              target job title
              <input className="dk-input" name="title" defaultValue={profile.target_title ?? ""} required />
            </label>
            {profile.mode === "resume" && profile.suggested_titles.length > 0 && (
              <div className="chips">
                <span className="tip dk-badge dk-blue" tabIndex={0} data-tip="ai suggested these titles from your resume">
                  ai
                </span>
                {profile.suggested_titles.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="dk-badge dk-lower"
                    onClick={(e) => {
                      (e.currentTarget.form!.elements.namedItem("title") as HTMLInputElement).value = t;
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
            <label>
              country
              <select className="dk-input" name="country" defaultValue={profile.country} required>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </label>
            <label>
              <span>city <span className="dk-faint">(optional)</span></span>
              <input
                className="dk-input"
                name="location"
                placeholder="leave blank to search the whole country"
                defaultValue={profile.location ?? ""}
              />
            </label>
            <label className="check">
              <input type="checkbox" name="remote" defaultChecked={profile.remote_only} />
              remote only
            </label>
            <button className="dk-btn">save search</button>
          </form>
          {profile.target_title && (
            <>
              {profile.paused && (
                <p className="dk-small dk-muted">this search is paused: no scans or match emails.</p>
              )}
              <div className="search-actions">
                <button className="dk-btn dk-btn--sm" onClick={() => setPaused(!profile.paused)}>
                  {profile.paused ? "resume search" : "pause search"}
                </button>
                <button className="linklike" onClick={deleteSearch}>delete search</button>
              </div>
            </>
          )}
        </Window>
      </div>

      <Window title={`matches (${total})`}>
        <SearchNow profile={profile} searching={searching} onClick={searchNow} />
        {!!profile.resume && (
          <p className="dk-small dk-muted">
            tailored resumes left: {TAILOR_PER_DAY - Math.min(usage.today, TAILOR_PER_DAY)} today ·{" "}
            {TAILOR_PER_MONTH - Math.min(usage.month, TAILOR_PER_MONTH)} this month
          </p>
        )}
        {matches.length ? (
          <ul className="matches">
            {matches.map((m, i) => (
              <li key={m.jobs.id} style={{ "--i": i } as React.CSSProperties}>
                <span className={`dk-badge ${m.score >= 80 ? "dk-green" : "dk-blue"}`}>{m.score}</span>
                <div className="grow">
                  <a href={m.jobs.url} target="_blank" rel="noreferrer" className="dk-lower">{m.jobs.title}</a>
                  <p className="dk-small dk-muted dk-lower">
                    {[m.jobs.company, m.jobs.location, m.jobs.is_remote && "remote"].filter(Boolean).join(" · ")}
                  </p>
                  {m.ai_score && (
                    <p className="dk-small ai-note">
                      <span className={`dk-tag ${m.ai_score >= 4 ? "" : "meh"}`}>ai {m.ai_score}/5</span> {m.ai_note}
                    </p>
                  )}
                </div>
                <div className="row-side">
                  <span className="dk-caption">
                    {new Date(m.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric" })}
                  </span>
                  {tailoredFor.has(m.jobs.id) ? (
                    <Link className="dk-btn dk-btn--sm" href={`/tailor/${tailoredFor.get(m.jobs.id)}`}>view tailored</Link>
                  ) : (
                    <button className="dk-btn dk-btn--sm" disabled={!!tailoring} onClick={() => tailor(m.jobs.id)}>
                      {tailoring === m.jobs.id ? "tailoring…" : "tailor resume"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="dk-text dk-muted">no matches yet. the scan runs at the top of every hour.</p>
        )}
        {matches.length < total && (
          <button className="dk-btn dk-btn--sm" onClick={() => setShown((n) => n + PAGE)}>
            show more ({total - matches.length} left)
          </button>
        )}
      </Window>
    </main>
  );
}
