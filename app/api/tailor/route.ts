import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { admin, userFrom } from "@/lib/admin";
import { alertBudgetHit, claude } from "@/lib/ai";
import { AI_PAUSED, isBudgetError } from "@/lib/budget";
import { ResumeDoc } from "@/lib/resume-doc";
import { NEEDS_RESUME, TAILOR_PER_DAY, TAILOR_PER_MONTH, TAILOR_SYSTEM_PROMPT, unverifiedNumbers } from "@/lib/tailor";

export const maxDuration = 180;

const Tailored = z.object({ resume: ResumeDoc, changes: z.array(z.string()) });

// Tailors the user's resume to one of their matches with Sonnet, within the daily/monthly caps.
export async function POST(req: Request) {
  const user = await userFrom(req);
  if (!user) return Response.json({ error: "sign in first" }, { status: 401 });
  const { job_id } = await req.json().catch(() => ({}));
  if (typeof job_id !== "string") return Response.json({ error: "missing job" }, { status: 400 });
  const db = admin();

  const profile = await db.from("profiles").select("resume").eq("id", user.id).single();
  if (profile.error) throw profile.error;
  if (!profile.data.resume) return Response.json({ error: NEEDS_RESUME }, { status: 400 });

  // Only jobs the user was matched with, so this can't be pointed at arbitrary postings.
  const match = await db
    .from("matches")
    .select("jobs(title, company, location, description)")
    .eq("user_id", user.id)
    .eq("job_id", job_id)
    .maybeSingle();
  if (match.error) throw match.error;
  const job = match.data?.jobs as unknown as { title: string; company: string | null; location: string | null; description: string | null };
  if (!job) return Response.json({ error: "that job isn't in your matches" }, { status: 404 });

  const claim = await db.rpc("claim_tailoring", {
    p_user: user.id,
    p_job: job_id,
    p_day_limit: TAILOR_PER_DAY,
    p_month_limit: TAILOR_PER_MONTH,
  });
  if (claim.error) throw claim.error;
  const slot = claim.data as { id?: string; existing?: boolean; limit?: "day" | "month"; today?: number; month?: number };
  if (slot.limit === "day") {
    return Response.json({ error: `you've used today's ${TAILOR_PER_DAY} tailored resumes. more tomorrow (resets 00:00 utc).` }, { status: 429 });
  }
  if (slot.limit === "month") {
    return Response.json({ error: `you've used this month's ${TAILOR_PER_MONTH} tailored resumes. more next month.` }, { status: 429 });
  }
  if (slot.existing) return Response.json({ id: slot.id });

  const giveBack = () => db.from("tailorings").delete().eq("id", slot.id!); // a failed attempt doesn't use up a slot
  let out;
  try {
    const res = await claude.beta.messages.parse({
      model: "claude-sonnet-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(Tailored) },
      system: TAILOR_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content:
            `<resume>\n${JSON.stringify(profile.data.resume)}\n</resume>\n\n` +
            `<posting>\ntitle: ${job.title}\ncompany: ${job.company ?? ""}\nlocation: ${job.location ?? ""}\n\n` +
            `${(job.description ?? "").slice(0, 12000)}\n</posting>\n\nTailor the resume to this posting, following every rule.`,
        },
      ],
    });
    out = res.stop_reason === "refusal" ? null : res.parsed_output;
  } catch (e) {
    await giveBack();
    if (!isBudgetError(e)) throw e;
    await alertBudgetHit("resume tailoring");
    return Response.json({ error: AI_PAUSED }, { status: 503 });
  }
  if (!out) {
    await giveBack();
    return Response.json({ error: "couldn't tailor that one, try again" }, { status: 502 });
  }

  const saved = await db
    .from("tailorings")
    .update({
      resume: out.resume,
      changes: out.changes.slice(0, 6),
      unverified_numbers: unverifiedNumbers(profile.data.resume, out.resume),
    })
    .eq("id", slot.id!);
  if (saved.error) throw saved.error;
  return Response.json({ id: slot.id, today: slot.today, month: slot.month });
}
