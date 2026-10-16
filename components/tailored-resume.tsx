"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ResumeDoc } from "@/lib/resume-doc";
import { supabase } from "@/lib/supabase";

type Row = {
  resume: ResumeDoc | null;
  changes: string[];
  unverified_numbers: string[];
  jobs: { title: string; company: string | null; url: string };
};

export default function TailoredResume({ id }: { id: string }) {
  const [row, setRow] = useState<Row | null>();
  const [downloading, setDownloading] = useState(false);

  async function download() {
    setDownloading(true);
    const { data } = await supabase.auth.getSession();
    const res = await fetch(`/api/tailor/${id}/pdf`, {
      headers: { Authorization: `Bearer ${data.session?.access_token}` },
    });
    setDownloading(false);
    if (!res.ok) return alert("couldn't make the pdf, try again.");
    const file = res.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1] ?? "resume.pdf";
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(await res.blob()), download: file });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  useEffect(() => {
    supabase
      .from("tailorings")
      .select("resume, changes, unverified_numbers, jobs(title, company, url)")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => setRow(data as unknown as Row | null)); // embedded rows are loosely typed
  }, [id]);

  const nav = (
    <nav className="dk-menubar">
      <div className="dk-menubar__left">
        <Link className="dk-menubar__brand" href="/">glassing</Link>
      </div>
      <div className="dk-menubar__right">
        <Link href="/">back to matches</Link>
      </div>
    </nav>
  );

  if (row === undefined) return <>{nav}<p className="dk-container board dk-muted">loading…</p></>;
  if (!row?.resume) {
    return <>{nav}<p className="dk-container board dk-muted">this tailored resume isn&apos;t available.</p></>;
  }
  const r = row.resume;

  return (
    <>
      {nav}
      <main className="dk-container board tailor">
        <section className="dk-window">
          <div className="dk-window__bar">
            <span className="dk-lights"><i /><i /><i /></span>
            <h2 className="dk-window__title">tailored for {row.jobs.title.toLowerCase()}</h2>
          </div>
          <div className="dk-window__body stack">
            <p className="dk-small dk-muted">
              rewritten from your resume for{" "}
              <a href={row.jobs.url} target="_blank" rel="noreferrer">
                {[row.jobs.title, row.jobs.company].filter(Boolean).join(" at ").toLowerCase()}
              </a>
              . read it through before you send it.
            </p>
            <ul className="dk-checklist">
              {row.changes.map((c) => <li key={c}>{c}</li>)}
            </ul>
            {row.unverified_numbers.length > 0 && (
              <p className="dk-small" role="alert">
                <span className="dk-tag warn">check these</span> numbers not found in your original resume:{" "}
                {row.unverified_numbers.join(", ")}
              </p>
            )}
            <button className="dk-btn dk-blue" onClick={download} disabled={downloading}>
              {downloading ? "making pdf…" : "download pdf"}
            </button>
          </div>
        </section>

        <article className="paper">
          <h1>{r.name}</h1>
          <p className="paper__head">{[r.headline, ...r.contact].filter(Boolean).join(" · ")}</p>
          {r.summary && <p className="paper__summary">{r.summary}</p>}
          {r.sections.map((s) => (
            <section key={s.heading}>
              <h2>{s.heading}</h2>
              {s.entries.map((e, i) => (
                <div className="entry" key={i}>
                  <div className="entry__top">
                    <strong>{[e.title, e.org].filter(Boolean).join(" · ")}</strong>
                    <span>{[e.location, e.dates].filter(Boolean).join(" · ")}</span>
                  </div>
                  {e.bullets.length > 0 && (
                    <ul>{e.bullets.map((b, k) => <li key={k}>{b}</li>)}</ul>
                  )}
                </div>
              ))}
            </section>
          ))}
          {r.skills.length > 0 && (
            <section>
              <h2>skills</h2>
              <p>{r.skills.join(" · ")}</p>
            </section>
          )}
        </article>
      </main>
    </>
  );
}
