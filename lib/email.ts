import { COUNTRIES } from "./countries.ts";
import { iconUrl, sourceHost } from "./text.ts";

type MatchLine = {
  title: string;
  company: string | null;
  location: string | null;
  url: string;
  score: number;
  ai_score?: number | null;
  ai_note?: string | null;
};
type Search = { title: string; country: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Email clients ignore stylesheets, so deskkit's look is inlined: dot-grid page, window chrome, glossy pills.
const FONT = "font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;letter-spacing:-0.03em;";
const BLUE = "background:#a2c7ff;background-image:linear-gradient(#edf4ff 0%,#d6e7ff 18%,#a2c7ff 50%,#99cbf8 80%,#a2d2f7 100%);border:1px solid #221898;";
const GREEN = "background:#c9f0cf;background-image:linear-gradient(#effbf1 0%,#d9f5dd 18%,#c9f0cf 50%,#cef2d4 100%);border:1px solid #9bbc9f;";
const light = (color: string) =>
  `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${color};margin-right:5px;"></span>`;

export function renderMatchesEmail(search: Search, jobs: MatchLine[], appUrl: string) {
  const where = COUNTRIES.find((c) => c.code === search.country)?.name ?? search.country;
  const title = search.title.toLowerCase();
  const n = jobs.length;
  const subject = `${n} new ${title} job${n === 1 ? "" : "s"} in ${where}`;
  const intro = `${n} new match${n === 1 ? "" : "es"} for ${title} in ${where}, best first.`;

  const text = [
    "hey - glassing found some jobs for you.",
    "",
    intro,
    "",
    ...jobs.flatMap((j) => [
      `${j.score}  ${j.title.toLowerCase()}`,
      `    ${[j.company, j.location, sourceHost(j.url) && `via ${sourceHost(j.url)}`].filter(Boolean).join(" · ").toLowerCase()}`,
      ...(j.ai_score ? [`    ai ${j.ai_score}/5 · ${j.ai_note ?? ""}`] : []),
      `    ${j.url}`,
      "",
    ]),
    `open glassing: ${appUrl}`,
  ].join("\n");

  const rows = jobs
    .map(
      (j, i) => `
      <tr><td style="padding:14px 0;${i ? "border-top:2px dotted rgba(0,0,0,0.15);" : ""}">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
          <td width="56" valign="top" style="padding-top:1px;">
            <span style="${j.score >= 80 ? GREEN : BLUE}display:inline-block;border-radius:999px;padding:2px 10px;${FONT}font-size:13px;font-weight:500;color:#000;">${j.score}</span>
          </td>
          <td valign="top" style="${FONT}">
            ${
              sourceHost(j.url)
                ? `<img src="${esc(iconUrl(sourceHost(j.url)!))}" width="14" height="14" alt="" style="vertical-align:-2px;margin-right:6px;border:0;border-radius:3px;">`
                : ""
            }<a href="${esc(j.url)}" style="color:#000;font-size:16px;font-weight:500;text-decoration:none;">${esc(j.title.toLowerCase())}</a>
            <div style="font-size:14px;color:#666666;padding-top:2px;">${esc([j.company, j.location, sourceHost(j.url) && `via ${sourceHost(j.url)}`].filter(Boolean).join(" · ").toLowerCase())}</div>${
              j.ai_score
                ? `<div style="font-size:13px;color:#0f9d3a;padding-top:4px;">ai ${j.ai_score}/5 · ${esc(j.ai_note ?? "")}</div>`
                : ""
            }
          </td>
        </tr></table>
      </td></tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;background-image:radial-gradient(rgba(0,0,0,0.13) 1px,transparent 1.3px);background-size:34px 34px;">
<tr><td align="center" style="padding:40px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
    <tr><td style="${FONT}font-size:15px;font-weight:500;color:#000;padding:0 4px 16px;">glassing</td></tr>
    <tr><td style="border:1px solid #8c8c8c;border-radius:8px;background:#e6e6e7;background-image:linear-gradient(90deg,#d6d5d7 0%,#f0f0f0 50%,#d6d5d7 100%);padding:8px 4px 4px;box-shadow:0 10px 24px rgba(0,0,0,0.12);">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="60" style="padding:0 4px 8px;line-height:12px;">${light("#ff5f57")}${light("#febc2e")}${light("#28c840")}</td>
        <td align="center" style="${FONT}font-size:12px;color:#999999;padding-bottom:8px;">new matches</td>
        <td width="60"></td>
      </tr></table>
      <div style="background:#ffffff;border-radius:4px;padding:24px;">
        <p style="${FONT}margin:0 0 6px;font-size:20px;font-weight:500;color:#000;">hey - glassing found some jobs for you.</p>
        <p style="${FONT}margin:0 0 12px;font-size:14px;color:#666666;">${esc(intro)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}
        </table>
        <div style="padding-top:20px;">
          <a href="${esc(appUrl)}" style="${BLUE}${FONT}display:inline-block;border-radius:999px;padding:9px 22px;font-size:16px;font-weight:500;color:#000;text-decoration:none;box-shadow:0 10px 24px rgba(0,0,0,0.12);">open glassing</a>
        </div>
      </div>
    </td></tr>
    <tr><td align="center" style="${FONT}font-size:12px;color:#999999;padding:16px 4px;">you're getting this because you set up a job search on glassing.</td></tr>
  </table>
</td></tr></table>
</body></html>`;

  return { subject, html, text };
}

export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text, html }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
}

export async function sendMatches(to: string, search: Search, jobs: MatchLine[]) {
  const { subject, html, text } = renderMatchesEmail(search, jobs, process.env.APP_URL ?? "");
  await sendEmail(to, subject, text, html);
}
