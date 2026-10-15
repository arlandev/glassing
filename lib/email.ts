type MatchLine = { title: string; company: string | null; location: string | null; url: string; score: number };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function sendMatches(to: string, jobs: MatchLine[]) {
  const rows = jobs
    .map(
      (j) =>
        `<li style="margin-bottom:8px"><a href="${esc(j.url)}">${esc(j.title)}</a> · ${esc(j.company ?? "")}` +
        `${j.location ? ` · ${esc(j.location)}` : ""} · <b>${j.score}</b></li>`,
    )
    .join("");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to,
      subject: `${jobs.length} new job${jobs.length === 1 ? "" : "s"} for you`,
      html:
        `<p>new job matches for you:</p><ul>${rows}</ul>` +
        `<p><a href="${esc(process.env.APP_URL ?? "")}">open glassing</a></p>`,
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
}
