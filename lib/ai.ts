import Anthropic from "@anthropic-ai/sdk";
import { admin } from "@/lib/admin";
import { sendEmail } from "@/lib/email";

export const claude = new Anthropic();

const ALERT_EVERY_MS = 12 * 60 * 60 * 1000;

// Emails the owner (ALERT_EMAIL) that the Claude budget ran out, at most every 12 hours.
export async function alertBudgetHit(where: string) {
  const to = process.env.ALERT_EMAIL;
  if (!to) return console.error("budget hit but ALERT_EMAIL is not set");
  const db = admin();
  const last = await db.from("app_state").select("value").eq("key", "spend_alert").maybeSingle();
  if (last.data && Date.now() - Date.parse(last.data.value) < ALERT_EVERY_MS) return;
  await db.from("app_state").upsert({ key: "spend_alert", value: new Date().toISOString() });
  await sendEmail(
    to,
    "glassing: claude api spend limit hit",
    `the anthropic api refused a request (${where}) with a billing / usage-limit error at ${new Date().toISOString()}.\n\n` +
      "paused until the limit resets or you raise it: resume reading, ai match ratings and resume tailoring.\n" +
      "still working: job searches, scoring and match emails.\n\n" +
      "raise or check the limit at console.anthropic.com under billing / limits.",
  ).catch((e) => console.error("budget alert email failed", e));
}
