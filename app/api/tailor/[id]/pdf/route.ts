import { admin, userFrom } from "@/lib/admin";
import type { ResumeDoc } from "@/lib/resume-doc";
import { renderResumePdf } from "@/lib/resume-pdf";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// The tailored resume as a Typst-rendered PDF. Only its owner can download it.
export async function GET(req: Request, ctx: RouteContext<"/api/tailor/[id]/pdf">) {
  const user = await userFrom(req);
  if (!user) return new Response("sign in first", { status: 401 });
  const { id } = await ctx.params;

  const row = await admin()
    .from("tailorings")
    .select("resume, jobs(company)")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (row.error) throw row.error;
  if (!row.data?.resume) return new Response("not found", { status: 404 });

  const resume = row.data.resume as ResumeDoc;
  const company = (row.data.jobs as unknown as { company: string | null } | null)?.company ?? "";
  const name = [slug(resume.name), "resume", slug(company)].filter(Boolean).join("-");
  const pdf = renderResumePdf(resume, process.env.APP_URL || new URL(req.url).origin);
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"` },
  });
}
