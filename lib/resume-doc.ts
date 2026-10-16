import { z } from "zod";

// A resume as structured text: what the upload transcribes and what tailoring rewrites.
export const ResumeDoc = z.object({
  name: z.string(),
  headline: z.string().describe("current or most recent job title"),
  contact: z.array(z.string()).describe("each contact line as written: email, phone, city, links"),
  summary: z.string().describe("the resume's own summary or objective, or empty"),
  sections: z.array(
    z.object({
      heading: z.string().describe("lowercase section name, e.g. experience, education, projects"),
      entries: z.array(
        z.object({
          title: z.string(),
          org: z.string(),
          dates: z.string(),
          location: z.string(),
          bullets: z.array(z.string()),
        }),
      ),
    }),
  ),
  skills: z.array(z.string()).describe("skills exactly as the resume lists them"),
});

export type ResumeDoc = z.infer<typeof ResumeDoc>;
