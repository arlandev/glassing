// JSearch (Google for Jobs: LinkedIn, Indeed, Glassdoor, ZipRecruiter, ...) via RapidAPI.
import { mentionsRemote } from "./text.ts";

const HOST = "jsearch.p.rapidapi.com";

type JSearchJob = {
  job_id: string;
  job_title: string;
  employer_name: string;
  job_location: string | null;
  job_is_remote: boolean | null;
  job_apply_link: string;
  job_description: string | null;
  job_posted_at_datetime_utc: string | null;
};

// Returns the last 3 days' postings for one search, shaped as rows for the jobs table.
export async function searchJobs(title: string, country: string, location: string | null, remoteOnly: boolean) {
  const params = new URLSearchParams({
    query: location ? `${title} in ${location}` : title,
    // Smaller markets (e.g. the Philippines) list jobs by date only and show up a day or more late, so "today" is often
    // empty. Matches dedupe by title + company, so a job seen in an earlier scan isn't sent again.
    date_posted: "3days",
    // shortcut: 1 page = up to 10 jobs per search per run; raise for busy searches (each page costs 1 request).
    num_pages: "1",
    country,
  });
  if (remoteOnly) params.set("work_from_home", "true");

  const res = await fetch(`https://${HOST}/search-v2?${params}`, {
    headers: { "x-rapidapi-key": process.env.RAPIDAPI_KEY!, "x-rapidapi-host": HOST },
  });
  if (!res.ok) throw new Error(`jsearch ${res.status}: ${await res.text()}`);

  const jobs: JSearchJob[] = (await res.json()).data?.jobs ?? [];
  return jobs
    .filter((j) => /^https?:\/\//.test(j.job_apply_link)) // links end up in emails and the dashboard
    .map((j) => ({
      id: j.job_id,
      title: j.job_title,
      company: j.employer_name,
      location: j.job_location,
      is_remote: j.job_is_remote || mentionsRemote(`${j.job_title} ${j.job_description ?? ""}`),
      url: j.job_apply_link,
      description: j.job_description,
      posted_at: j.job_posted_at_datetime_utc,
    }));
}
