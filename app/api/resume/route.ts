import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { admin, userFrom } from "@/lib/admin";
import { RESUME_SYSTEM_PROMPT } from "@/lib/resume-prompt";

export const maxDuration = 120;

const MAX_BYTES = 4 * 1024 * 1024; // stays under common serverless body limits

// Field rules live in RESUME_SYSTEM_PROMPT; descriptions here point back to them.
const ResumeProfile = z.object({
  is_resume: z.boolean().describe("see <is_resume>"),
  summary: z.string().describe("see <summary>"),
  skills: z.array(z.string()).describe("see <skills>"),
  seniority: z.enum(["junior", "mid", "senior", "lead"]).describe("see <seniority>"),
  years_experience: z.number().int().describe("see <years_experience>"),
  suggested_titles: z.array(z.string()).describe("see <suggested_titles>"),
});

const claude = new Anthropic();

export async function POST(req: Request) {
  const user = await userFrom(req);
  if (!user) return Response.json({ error: "sign in first" }, { status: 401 });

  const file = (await req.formData()).get("resume");
  if (!(file instanceof File) || file.type !== "application/pdf") {
    return Response.json({ error: "upload a pdf" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return Response.json({ error: "pdf must be under 4 mb" }, { status: 413 });

  const res = await claude.messages.parse({
    model: "claude-haiku-5-5",
    max_tokens: 16000,
    // high effort: the recommended level for strict instruction following on Haiku; still a fraction of a cent per resume
    output_config: { effort: "high", format: zodOutputFormat(ResumeProfile) },
    system: RESUME_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: Buffer.from(await file.arrayBuffer()).toString("base64"),
            },
          },
          {
            type: "text",
            text: `Today's date is ${new Date().toISOString().slice(0, 10)}. Extract the profile from this document, following every rule in the system prompt.`,
          },
        ],
      },
    ],
  });

  const out = res.parsed_output;
  if (res.stop_reason === "refusal" || !out) {
    return Response.json({ error: "couldn't read that resume, try another pdf" }, { status: 422 });
  }
  if (!out.is_resume) return Response.json({ error: "that doesn't look like a resume" }, { status: 422 });

  // Enforce the limits the prompt asks for, since a schema can't guarantee them.
  const profile = {
    summary: out.summary.trim(),
    skills: [...new Set(out.skills.map((s) => s.trim().toLowerCase()).filter(Boolean))].slice(0, 25),
    seniority: out.seniority,
    years_experience: Math.min(Math.max(out.years_experience, 0), 60),
    suggested_titles: [...new Set(out.suggested_titles.map((t) => t.trim()).filter(Boolean))].slice(0, 3),
  };

  const db = admin();
  const saved = await db
    .from("profiles")
    .update({ ...profile, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (saved.error) throw saved.error;
  // First upload: start searching for the best-fit title until the user picks their own.
  if (profile.suggested_titles.length) {
    const titled = await db
      .from("profiles")
      .update({ target_title: profile.suggested_titles[0] })
      .eq("id", user.id)
      .is("target_title", null);
    if (titled.error) throw titled.error;
  }

  return Response.json(profile);
}
